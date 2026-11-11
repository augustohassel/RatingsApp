import { BackupData } from '../../types';

export type CloudProviderId = 'google-drive';

export type CloudSyncErrorCode =
  | 'OFFLINE'
  | 'NOT_CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'AUTH_DENIED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_BACKUP'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class CloudSyncError extends Error {
  constructor(
    public readonly code: CloudSyncErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'CloudSyncError';
  }
}

export interface CloudAuthState {
  isConnected: boolean;
  hasActiveToken: boolean;
  accountEmail?: string;
  tokenExpiresAt?: number;
}

export interface RemoteBackupRecord {
  fileId: string;
  fileName: string;
  modifiedTime?: string;
  data: BackupData;
}

export interface ConnectOptions {
  prompt?: '' | 'consent' | 'select_account';
}

export interface WriteBackupOptions {
  /** Si es true, ignora el fileId previo y crea un archivo nuevo si hace falta. */
  recreateIfMissing?: boolean;
}

export interface CloudSyncProvider {
  readonly id: CloudProviderId;
  readonly displayName: string;
  isConfigured(): boolean;
  getAuthState(): CloudAuthState;
  connect(options?: ConnectOptions): Promise<CloudAuthState>;
  disconnect(): Promise<void>;
  readBackup(): Promise<RemoteBackupRecord | null>;
  writeBackup(
    data: BackupData,
    existingFileId?: string,
    options?: WriteBackupOptions
  ): Promise<{ fileId: string; modifiedTime?: string }>;
}

