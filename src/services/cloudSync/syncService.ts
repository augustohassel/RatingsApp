import {
  applySyncedBackup,
  clearPendingLocalChanges,
  exportBackupData,
  hasPendingLocalChanges,
  LOCAL_DATA_CHANGED_EVENT,
} from '../../db';
import { mergeBackups, MergeStats } from '../../utils/syncEngine';
import {
  GoogleDriveProvider,
  loadDriveMetadata,
  saveDriveMetadata,
} from './googleDriveProvider';
import { CloudSyncError, CloudSyncErrorCode, CloudSyncProvider } from './types';

export type SyncActivityStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatusSnapshot {
  isConfigured: boolean;
  isConnected: boolean;
  hasActiveToken: boolean;
  accountEmail?: string;
  lastSyncAt?: string;
  autoSyncEnabled: boolean;
  hasPendingChanges: boolean;
  status: SyncActivityStatus;
  lastError?: {
    code: CloudSyncErrorCode;
    message: string;
  };
}

export interface SyncExecutionResult {
  success: boolean;
  message: string;
  stats?: MergeStats;
  errorCode?: CloudSyncErrorCode;
}

export class CloudSyncManager {
  private provider: CloudSyncProvider;
  private listeners = new Set<() => void>();
  private activePromise: Promise<SyncExecutionResult> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SyncActivityStatus = 'idle';
  private lastError?: { code: CloudSyncErrorCode; message: string };

  constructor(provider: CloudSyncProvider = new GoogleDriveProvider()) {
    this.provider = provider;
  }

  setProviderForTesting(provider: CloudSyncProvider): void {
    this.provider = provider;
    this.status = 'idle';
    this.lastError = undefined;
    this.notify();
  }

  getSnapshot(): SyncStatusSnapshot {
    const auth = this.provider.getAuthState();
    const meta = loadDriveMetadata();
    return {
      isConfigured: this.provider.isConfigured(),
      isConnected: auth.isConnected,
      hasActiveToken: auth.hasActiveToken,
      accountEmail: auth.accountEmail,
      lastSyncAt: meta.lastSyncAt,
      autoSyncEnabled: meta.autoSyncEnabled,
      hasPendingChanges: hasPendingLocalChanges(),
      status: this.status,
      lastError: this.lastError,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  setAutoSyncEnabled(enabled: boolean): void {
    saveDriveMetadata({ autoSyncEnabled: enabled });
    this.notify();
  }

  private normalizeError(err: unknown): CloudSyncError {
    if (err instanceof CloudSyncError) return err;
    return new CloudSyncError(
      'UNKNOWN',
      (err as Error)?.message || 'Error inesperado durante la sincronización.'
    );
  }

  private isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  async connectAndSync(prompt?: '' | 'consent' | 'select_account'): Promise<SyncExecutionResult> {
    if (!this.isOnline()) {
      const offlineMsg = 'Estás sin conexión a internet. Conectate para vincular tu cuenta de Google Drive.';
      this.status = 'offline';
      this.lastError = { code: 'OFFLINE', message: offlineMsg };
      this.notify();
      return { success: false, message: offlineMsg, errorCode: 'OFFLINE' };
    }

    try {
      await this.provider.connect(prompt !== undefined ? { prompt } : undefined);
      this.lastError = undefined;
      this.notify();
      return await this.syncNow({ interactive: true });
    } catch (err) {
      const syncErr = this.normalizeError(err);
      this.status = syncErr.code === 'OFFLINE' ? 'offline' : 'error';
      this.lastError = { code: syncErr.code, message: syncErr.message };
      this.notify();
      return { success: false, message: syncErr.message, errorCode: syncErr.code };
    }
  }

  async disconnect(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.provider.disconnect();
    this.status = 'idle';
    this.lastError = undefined;
    this.notify();
  }

  private runExclusiveTask(
    offlineMessage: string,
    task: () => Promise<SyncExecutionResult>
  ): Promise<SyncExecutionResult> {
    if (this.activePromise) {
      return this.activePromise;
    }

    const promise = (async (): Promise<SyncExecutionResult> => {
      if (!this.isOnline()) {
        this.status = 'offline';
        this.lastError = { code: 'OFFLINE', message: offlineMessage };
        this.notify();
        return { success: false, message: offlineMessage, errorCode: 'OFFLINE' };
      }

      this.status = 'syncing';
      this.lastError = undefined;
      this.notify();

      try {
        return await task();
      } catch (err) {
        const syncErr = this.normalizeError(err);
        this.status = syncErr.code === 'OFFLINE' ? 'offline' : 'error';
        this.lastError = { code: syncErr.code, message: syncErr.message };
        this.notify();
        return { success: false, message: syncErr.message, errorCode: syncErr.code };
      }
    })().finally(() => {
      this.activePromise = null;
    });

    this.activePromise = promise;
    return promise;
  }

  private async ensureInteractiveToken(): Promise<void> {
    const auth = this.provider.getAuthState();
    if (!auth.hasActiveToken) {
      await this.provider.connect();
    }
  }

  private markSyncSuccess(): void {
    saveDriveMetadata({ lastSyncAt: new Date().toISOString(), isConnected: true });
    clearPendingLocalChanges();
    this.status = 'idle';
    this.lastError = undefined;
    this.notify();
  }

  async syncNow(options: { interactive?: boolean } = {}): Promise<SyncExecutionResult> {
    if (this.activePromise) {
      return this.activePromise;
    }

    const auth = this.provider.getAuthState();
    if (!auth.isConnected && !options.interactive && this.isOnline()) {
      return { success: false, message: 'No hay cuenta conectada.', errorCode: 'AUTH_REQUIRED' };
    }

    return this.runExclusiveTask(
      'Modo offline: no hay conexión a internet. Tus cambios quedan guardados localmente.',
      async () => {
        const currentAuth = this.provider.getAuthState();
        if (!currentAuth.isConnected && !options.interactive) {
          this.status = 'idle';
          this.notify();
          return { success: false, message: 'No hay cuenta conectada.', errorCode: 'AUTH_REQUIRED' };
        }

        if (!currentAuth.hasActiveToken) {
          if (!options.interactive) {
            throw new CloudSyncError(
              'TOKEN_EXPIRED',
              'Tu sesión de Google Drive expiró. Reautenticá tu cuenta en Ajustes para sincronizar.',
              401
            );
          }
          await this.provider.connect();
        }

        const metaBefore = loadDriveMetadata();
        const isFirstLink = !metaBefore.lastSyncAt;
        const localBackup = await exportBackupData();
        const remoteRecord = await this.provider.readBackup();

        const mergeResult = mergeBackups(localBackup, remoteRecord?.data ?? null, {
          isFirstLink,
        });

        if (mergeResult.localChanged) {
          await applySyncedBackup(mergeResult.merged);
        }

        if (mergeResult.remoteChanged) {
          await this.provider.writeBackup(mergeResult.merged, remoteRecord?.fileId);
        }

        this.markSyncSuccess();

        return {
          success: true,
          message: remoteRecord
            ? 'Sincronización completada con Google Drive.'
            : 'Respaldo inicial creado en Google Drive.',
          stats: mergeResult.stats,
        };
      }
    );
  }

  async overwriteRemoteWithLocal(): Promise<SyncExecutionResult> {
    return this.runExclusiveTask(
      'Sin conexión a internet para subir el respaldo a Google Drive.',
      async () => {
        await this.ensureInteractiveToken();
        const localBackup = await exportBackupData();
        const meta = loadDriveMetadata();
        await this.provider.writeBackup(localBackup, meta.fileId, { recreateIfMissing: true });
        this.markSyncSuccess();
        return {
          success: true,
          message: 'Datos locales subidos a Google Drive correctamente.',
        };
      }
    );
  }

  async restoreFromRemote(): Promise<SyncExecutionResult> {
    return this.runExclusiveTask(
      'Sin conexión a internet para restaurar desde Google Drive.',
      async () => {
        await this.ensureInteractiveToken();
        const remote = await this.provider.readBackup();
        if (!remote) {
          const msg = 'No se encontró ningún archivo de respaldo en Google Drive.';
          this.status = 'error';
          this.lastError = { code: 'NOT_FOUND', message: msg };
          this.notify();
          return { success: false, message: msg, errorCode: 'NOT_FOUND' };
        }

        await applySyncedBackup(remote.data);
        this.markSyncSuccess();
        return {
          success: true,
          message: `Se restauraron ${remote.data.topics.length} ámbitos y ${remote.data.evaluations.length} evaluaciones desde Google Drive.`,
        };
      }
    );
  }

  triggerOpportunisticSync(delayMs = 1500): void {
    const meta = loadDriveMetadata();
    const auth = this.provider.getAuthState();
    if (!auth.isConnected || !auth.hasActiveToken || !meta.autoSyncEnabled || !this.isOnline()) {
      return;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow({ interactive: false });
    }, delayMs);
  }

  setupLifecycleListeners(): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleLocalChange = () => {
      this.notify();
      this.triggerOpportunisticSync(1500);
    };

    const handleVisibilityOrOnline = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (this.isOnline() && this.status === 'offline') {
        this.status = 'idle';
        this.lastError = undefined;
        this.notify();
      }
      this.triggerOpportunisticSync(500);
    };

    const handleOffline = () => {
      const meta = loadDriveMetadata();
      if (meta.isConnected) {
        this.status = 'offline';
        this.notify();
      }
    };

    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalChange);
    window.addEventListener('online', handleVisibilityOrOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    }

    return () => {
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, handleLocalChange);
      window.removeEventListener('online', handleVisibilityOrOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      }
    };
  }
}

export const syncManager = new CloudSyncManager();

