import { BackupData } from '../../types';
import { validateAndNormalizeBackup } from '../../db';
import {
  CloudAuthState,
  CloudSyncError,
  CloudSyncProvider,
  ConnectOptions,
  RemoteBackupRecord,
  WriteBackupOptions,
} from './types';

export const DRIVE_FOLDER_NAME = 'RatingsApp';
export const DRIVE_FILE_NAME = 'ratingsapp-backup.json';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export const DRIVE_META_STORAGE_KEY = 'ratingsapp_drive_meta_v1';
export const DRIVE_TOKEN_SESSION_KEY = 'ratingsapp_drive_token_v1';
export const DRIVE_CLIENT_ID_OVERRIDE_KEY = 'ratingsapp_google_client_id_override';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_EXPIRY_BUFFER_MS = 15_000;

export interface DrivePersistedMetadata {
  isConnected: boolean;
  accountEmail?: string;
  folderId?: string;
  fileId?: string;
  lastSyncAt?: string;
  autoSyncEnabled: boolean;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }) => GoogleTokenClient;
  revoke?: (token: string, done?: () => void) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

export interface GoogleDriveProviderDeps {
  fetchFn?: typeof fetch;
  getClientIdFn?: () => string;
  loadGisFn?: () => Promise<GoogleAccountsOAuth2>;
  isOnlineFn?: () => boolean;
  nowFn?: () => number;
}

export function getConfiguredGoogleClientId(): string {
  if (typeof window !== 'undefined') {
    try {
      const override = localStorage.getItem(DRIVE_CLIENT_ID_OVERRIDE_KEY)?.trim();
      if (override) return override;
    } catch {
      // Ignorar errores de almacenamiento
    }
  }
  const envId = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_GOOGLE_CLIENT_ID;
  return (envId || '').trim();
}

export function setGoogleClientIdOverride(clientId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = clientId.trim();
  if (trimmed) {
    localStorage.setItem(DRIVE_CLIENT_ID_OVERRIDE_KEY, trimmed);
  } else {
    localStorage.removeItem(DRIVE_CLIENT_ID_OVERRIDE_KEY);
  }
}

export function loadDriveMetadata(): DrivePersistedMetadata {
  if (typeof window === 'undefined') {
    return { isConnected: false, autoSyncEnabled: true };
  }
  try {
    const raw = localStorage.getItem(DRIVE_META_STORAGE_KEY);
    if (!raw) return { isConnected: false, autoSyncEnabled: true };
    const parsed = JSON.parse(raw) as Partial<DrivePersistedMetadata>;
    return {
      isConnected: Boolean(parsed.isConnected),
      accountEmail: parsed.accountEmail,
      folderId: parsed.folderId,
      fileId: parsed.fileId,
      lastSyncAt: parsed.lastSyncAt,
      autoSyncEnabled: parsed.autoSyncEnabled ?? true,
    };
  } catch {
    return { isConnected: false, autoSyncEnabled: true };
  }
}

export function saveDriveMetadata(patch: Partial<DrivePersistedMetadata>): DrivePersistedMetadata {
  const next = { ...loadDriveMetadata(), ...patch };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DRIVE_META_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }
  return next;
}

let gisLoadPromise: Promise<GoogleAccountsOAuth2> | null = null;

export function loadGisScript(): Promise<GoogleAccountsOAuth2> {
  if (typeof window === 'undefined') {
    return Promise.reject(new CloudSyncError('AUTH_REQUIRED', 'GIS requiere un navegador activo.'));
  }

  const existing = window.google?.accounts?.oauth2;
  if (existing) {
    return Promise.resolve(existing);
  }

  if (gisLoadPromise) {
    return gisLoadPromise;
  }

  gisLoadPromise = new Promise<GoogleAccountsOAuth2>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_URL}"]`
    );

    const script =
      existingScript ||
      (() => {
        const el = document.createElement('script');
        el.src = GIS_SCRIPT_URL;
        el.async = true;
        el.defer = true;
        document.head.appendChild(el);
        return el;
      })();

    const onReady = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) {
        resolve(oauth2);
      } else {
        gisLoadPromise = null;
        script.remove();
        reject(new CloudSyncError('NETWORK_ERROR', 'No se pudo inicializar Google Identity Services.'));
      }
    };

    const onError = () => {
      gisLoadPromise = null;
      script.remove();
      reject(
        new CloudSyncError(
          'NETWORK_ERROR',
          'No se pudo cargar el script de Google Identity Services. Verificá tu conexión.'
        )
      );
    };

    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  return gisLoadPromise;
}

function readStoredToken(now: number): StoredToken | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRIVE_TOKEN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredToken>;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    if (parsed.expiresAt - TOKEN_EXPIRY_BUFFER_MS <= now) {
      sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY);
      return null;
    }
    return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeStoredToken(token: StoredToken | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!token) {
      sessionStorage.removeItem(DRIVE_TOKEN_SESSION_KEY);
    } else {
      sessionStorage.setItem(DRIVE_TOKEN_SESSION_KEY, JSON.stringify(token));
    }
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export class GoogleDriveProvider implements CloudSyncProvider {
  readonly id = 'google-drive' as const;
  readonly displayName = 'Google Drive';

  private readonly fetchFn: typeof fetch;
  private readonly getClientIdFn: () => string;
  private readonly loadGisFn: () => Promise<GoogleAccountsOAuth2>;
  private readonly isOnlineFn: () => boolean;
  private readonly nowFn: () => number;
  private inMemoryToken: StoredToken | null = null;

  constructor(deps: GoogleDriveProviderDeps = {}) {
    this.fetchFn = deps.fetchFn ?? ((...args) => fetch(...args));
    this.getClientIdFn = deps.getClientIdFn ?? getConfiguredGoogleClientId;
    this.loadGisFn = deps.loadGisFn ?? loadGisScript;
    this.isOnlineFn =
      deps.isOnlineFn ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    this.nowFn = deps.nowFn ?? (() => Date.now());
  }

  isConfigured(): boolean {
    return this.getClientIdFn().length > 0;
  }

  private getValidToken(): StoredToken | null {
    const now = this.nowFn();
    if (this.inMemoryToken && this.inMemoryToken.expiresAt - TOKEN_EXPIRY_BUFFER_MS > now) {
      return this.inMemoryToken;
    }
    this.inMemoryToken = null;
    const stored = readStoredToken(now);
    if (stored) {
      this.inMemoryToken = stored;
    }
    return stored;
  }

  private clearToken(): void {
    this.inMemoryToken = null;
    writeStoredToken(null);
  }

  getAuthState(): CloudAuthState {
    const meta = loadDriveMetadata();
    const token = this.getValidToken();
    return {
      isConnected: meta.isConnected,
      hasActiveToken: Boolean(token),
      accountEmail: meta.accountEmail,
      tokenExpiresAt: token?.expiresAt,
    };
  }

  private ensureOnline(): void {
    if (!this.isOnlineFn()) {
      throw new CloudSyncError(
        'OFFLINE',
        'Estás sin conexión a internet. Tus datos locales siguen operativos y se sincronizarán cuando vuelvas a conectarte.'
      );
    }
  }

  private requireAccessToken(): string {
    this.ensureOnline();
    const token = this.getValidToken();
    if (!token) {
      throw new CloudSyncError(
        'TOKEN_EXPIRED',
        'Tu sesión de Google Drive expiró o requiere autenticación. Volvé a conectar tu cuenta.',
        401
      );
    }
    return token.accessToken;
  }

  async connect(options: ConnectOptions = {}): Promise<CloudAuthState> {
    this.ensureOnline();
    const clientId = this.getClientIdFn();
    if (!clientId) {
      throw new CloudSyncError(
        'NOT_CONFIGURED',
        'Falta configurar el Google OAuth Client ID (VITE_GOOGLE_CLIENT_ID o en Opciones Avanzadas).'
      );
    }

    const oauth2 = await this.loadGisFn();

    const token = await new Promise<StoredToken>((resolve, reject) => {
      let settled = false;
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        prompt: options.prompt,
        callback: (response: GoogleTokenResponse) => {
          if (settled) return;
          settled = true;
          if (response.error || !response.access_token) {
            const code =
              response.error === 'access_denied' || response.error === 'interaction_required'
                ? 'AUTH_DENIED'
                : 'AUTH_REQUIRED';
            reject(
              new CloudSyncError(
                code,
                response.error_description || 'No se completó la autorización con Google Drive.'
              )
            );
            return;
          }
          const expiresInSec = typeof response.expires_in === 'number' ? response.expires_in : 3600;
          resolve({
            accessToken: response.access_token,
            expiresAt: this.nowFn() + expiresInSec * 1000,
          });
        },
        error_callback: (err) => {
          if (settled) return;
          settled = true;
          const isDenied = err.type === 'popup_closed' || err.type === 'popup_failed_to_open';
          reject(
            new CloudSyncError(
              isDenied ? 'AUTH_DENIED' : 'AUTH_REQUIRED',
              err.message || 'Se canceló o bloqueó la ventana de inicio de sesión de Google.'
            )
          );
        },
      });

      client.requestAccessToken(
        options.prompt !== undefined ? { prompt: options.prompt } : undefined
      );
    });

    this.inMemoryToken = token;
    writeStoredToken(token);

    const accountEmail = await this.fetchAccountEmailBestEffort(token.accessToken);
    saveDriveMetadata({
      isConnected: true,
      ...(accountEmail ? { accountEmail } : {}),
    });

    return this.getAuthState();
  }

  async disconnect(): Promise<void> {
    const token = this.getValidToken();
    if (token && typeof window !== 'undefined' && window.google?.accounts?.oauth2?.revoke) {
      try {
        await new Promise<void>((resolve) => {
          window.google!.accounts!.oauth2!.revoke!(token.accessToken, () => resolve());
        });
      } catch {
        // Ignorar fallos de revocación si no hay red
      }
    }
    this.clearToken();
    saveDriveMetadata({
      isConnected: false,
      accountEmail: undefined,
      folderId: undefined,
      fileId: undefined,
      lastSyncAt: undefined,
    });
  }

  private async fetchAccountEmailBestEffort(accessToken: string): Promise<string | undefined> {
    try {
      const response = await this.fetchFn(
        `${DRIVE_API_BASE}/about?fields=user(emailAddress,displayName)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!response.ok) return undefined;
      const body = (await response.json()) as { user?: { emailAddress?: string } };
      return body.user?.emailAddress;
    } catch {
      return undefined;
    }
  }

  private async mapHttpError(response: Response): Promise<CloudSyncError> {
    let rawText = '';
    try {
      rawText = await response.text();
    } catch {
      rawText = '';
    }

    if (response.status === 401) {
      this.clearToken();
      return new CloudSyncError(
        'TOKEN_EXPIRED',
        'Tu sesión de Google Drive expiró (401). Volvé a conectar tu cuenta para sincronizar.',
        401
      );
    }

    if (response.status === 403) {
      const isQuota = /quota|storageQuotaExceeded/i.test(rawText);
      if (isQuota) {
        return new CloudSyncError(
          'QUOTA_EXCEEDED',
          'Tu cuenta de Google Drive alcanzó el límite de almacenamiento.',
          403
        );
      }
      return new CloudSyncError(
        'FORBIDDEN',
        'Permisos insuficientes o revocados en Google Drive (403). Reconectá tu cuenta y aceptá el acceso.',
        403
      );
    }

    if (response.status === 404) {
      return new CloudSyncError(
        'NOT_FOUND',
        'El archivo de respaldo no se encontró en Google Drive (404). Pudo haber sido eliminado manualmente.',
        404
      );
    }

    if (response.status === 507) {
      return new CloudSyncError(
        'QUOTA_EXCEEDED',
        'Tu almacenamiento de Google Drive está lleno (507). Liberá espacio e intentá nuevamente.',
        507
      );
    }

    return new CloudSyncError(
      'UNKNOWN',
      `Error al comunicarse con Google Drive (HTTP ${response.status}).`,
      response.status
    );
  }

  private async authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = this.requireAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    let response: Response;
    try {
      response = await this.fetchFn(url, { ...init, headers });
    } catch {
      throw new CloudSyncError(
        'NETWORK_ERROR',
        'No se pudo establecer conexión con Google Drive. Verificá tu acceso a internet.'
      );
    }

    if (!response.ok) {
      throw await this.mapHttpError(response);
    }

    return response;
  }

  private async findFolderId(): Promise<string | null> {
    const q = encodeURIComponent(
      `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const res = await this.authorizedFetch(
      `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=5`
    );
    const json = (await res.json()) as { files?: Array<{ id: string; name: string }> };
    return json.files?.[0]?.id ?? null;
  }

  private async ensureFolderId(): Promise<string> {
    const meta = loadDriveMetadata();
    if (meta.folderId) {
      try {
        const verify = await this.authorizedFetch(
          `${DRIVE_API_BASE}/files/${encodeURIComponent(meta.folderId)}?fields=id,trashed`
        );
        const info = (await verify.json()) as { id?: string; trashed?: boolean };
        if (info.id && !info.trashed) {
          return info.id;
        }
      } catch (err) {
        if (err instanceof CloudSyncError && err.code !== 'NOT_FOUND') {
          throw err;
        }
      }
    }

    const foundId = await this.findFolderId();
    if (foundId) {
      saveDriveMetadata({ folderId: foundId });
      return foundId;
    }

    const createdRes = await this.authorizedFetch(`${DRIVE_API_BASE}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    const created = (await createdRes.json()) as { id: string };
    saveDriveMetadata({ folderId: created.id });
    return created.id;
  }

  private async findBackupFileInDrive(): Promise<{ id: string; name: string; modifiedTime?: string } | null> {
    const folderId = await this.findFolderId();
    const query = folderId
      ? `name = '${DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed = false`
      : `name = '${DRIVE_FILE_NAME}' and trashed = false`;

    const res = await this.authorizedFetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=5`
    );
    const json = (await res.json()) as {
      files?: Array<{ id: string; name: string; modifiedTime?: string }>;
    };
    const file = json.files?.[0];
    if (!file) return null;
    if (folderId) {
      saveDriveMetadata({ folderId, fileId: file.id });
    } else {
      saveDriveMetadata({ fileId: file.id });
    }
    return file;
  }

  async readBackup(): Promise<RemoteBackupRecord | null> {
    this.requireAccessToken();
    const meta = loadDriveMetadata();
    let targetFile: { id: string; name: string; modifiedTime?: string } | null = null;

    if (meta.fileId) {
      let needsRelookup = false;
      try {
        const metaRes = await this.authorizedFetch(
          `${DRIVE_API_BASE}/files/${encodeURIComponent(meta.fileId)}?fields=id,name,modifiedTime,trashed`
        );
        const info = (await metaRes.json()) as {
          id: string;
          name: string;
          modifiedTime?: string;
          trashed?: boolean;
        };
        if (info.trashed) {
          saveDriveMetadata({ fileId: undefined });
          needsRelookup = true;
        } else {
          targetFile = { id: info.id, name: info.name, modifiedTime: info.modifiedTime };
        }
      } catch (err) {
        if (err instanceof CloudSyncError && err.code === 'NOT_FOUND') {
          saveDriveMetadata({ fileId: undefined });
          needsRelookup = true;
        } else {
          throw err;
        }
      }

      if (needsRelookup) {
        targetFile = await this.findBackupFileInDrive();
        if (!targetFile) {
          throw new CloudSyncError(
            'NOT_FOUND',
            'El archivo de respaldo previamente vinculado fue eliminado o movido a la Papelera en Google Drive. Podés recrearlo subiendo tus datos locales.',
            404
          );
        }
      }
    } else {
      targetFile = await this.findBackupFileInDrive();
    }

    if (!targetFile) {
      return null;
    }

    const contentRes = await this.authorizedFetch(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(targetFile.id)}?alt=media`
    );
    const rawText = await contentRes.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new CloudSyncError(
        'INVALID_BACKUP',
        'El archivo en Google Drive no contiene JSON válido. Tus datos locales no fueron modificados.'
      );
    }

    let normalized: BackupData;
    try {
      normalized = validateAndNormalizeBackup(parsed);
    } catch (err) {
      throw new CloudSyncError(
        'INVALID_BACKUP',
        (err as Error).message || 'El respaldo remoto tiene un formato incompatible.'
      );
    }

    return {
      fileId: targetFile.id,
      fileName: targetFile.name,
      modifiedTime: targetFile.modifiedTime,
      data: normalized,
    };
  }

  async writeBackup(
    data: BackupData,
    existingFileId?: string,
    options: WriteBackupOptions = {}
  ): Promise<{ fileId: string; modifiedTime?: string }> {
    this.requireAccessToken();
    const meta = loadDriveMetadata();
    const targetFileId = existingFileId ?? meta.fileId;
    const payloadJson = JSON.stringify(data, null, 2);

    if (targetFileId) {
      try {
        const updateRes = await this.authorizedFetch(
          `${DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(targetFileId)}?uploadType=media&fields=id,modifiedTime`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: payloadJson,
          }
        );
        const updated = (await updateRes.json()) as { id: string; modifiedTime?: string };
        saveDriveMetadata({ fileId: updated.id });
        return { fileId: updated.id, modifiedTime: updated.modifiedTime };
      } catch (err) {
        if (
          err instanceof CloudSyncError &&
          err.code === 'NOT_FOUND' &&
          options.recreateIfMissing
        ) {
          saveDriveMetadata({ fileId: undefined });
        } else {
          throw err;
        }
      }
    }

    const folderId = await this.ensureFolderId();
    const boundary = `ratingsapp_boundary_${this.nowFn()}`;
    const metadataPart = JSON.stringify({
      name: DRIVE_FILE_NAME,
      parents: [folderId],
      mimeType: 'application/json',
    });
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadataPart}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${payloadJson}\r\n` +
      `--${boundary}--`;

    const createRes = await this.authorizedFetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,modifiedTime`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    const created = (await createRes.json()) as { id: string; modifiedTime?: string };
    saveDriveMetadata({ folderId, fileId: created.id });
    return { fileId: created.id, modifiedTime: created.modifiedTime };
  }
}

