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

/**
 * Contrato extensible para proveedores de sincronización personal Zero-Backend.
 * Cada implementación opera directo entre el navegador del usuario y su almacenamiento.
 */
export interface CloudSyncProvider {
  readonly id: CloudProviderId;
  readonly displayName: string;
  /** Indica si el proveedor cuenta con configuración mínima (ej. Client ID) para autenticar. */
  isConfigured(): boolean;
  /** Devuelve el estado actual de conexión y vigencia del token en memoria. */
  getAuthState(): CloudAuthState;
  /** Inicia o renueva la sesión OAuth interactiva en el navegador. */
  connect(options?: ConnectOptions): Promise<CloudAuthState>;
  /** Revoca el token activo y limpia los metadatos locales de sesión. */
  disconnect(): Promise<void>;
  /** Lee y valida el archivo de respaldo remoto, o devuelve null si no existe. */
  readBackup(): Promise<RemoteBackupRecord | null>;
  /** Crea o actualiza el archivo de respaldo remoto con el snapshot combinado. */
  writeBackup(
    data: BackupData,
    existingFileId?: string,
    options?: WriteBackupOptions
  ): Promise<{ fileId: string; modifiedTime?: string }>;
}

