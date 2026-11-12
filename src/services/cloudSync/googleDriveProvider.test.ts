import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GoogleDriveProvider,
  DRIVE_FILE_NAME,
  DRIVE_FILE_SCOPE,
  DRIVE_FOLDER_NAME,
  saveDriveMetadata,
} from './googleDriveProvider';
import { CloudSyncError } from './types';
import { CloudSyncManager } from './syncService';
import { db, saveEvaluation, saveTopic, hasPendingLocalChanges } from '../../db';
import { saveAiSettings } from '../aiService';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

function createMockGis(token = 'mock-access-token', expiresIn = 3600, error?: string) {
  return vi.fn(async () => ({
    initTokenClient: vi.fn((config: { callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void; scope: string }) => {
      expect(config.scope).toBe(DRIVE_FILE_SCOPE);
      return {
        requestAccessToken: () => {
          if (error) {
            config.callback({ error });
          } else {
            config.callback({ access_token: token, expires_in: expiresIn });
          }
        },
      };
    }),
  }));
}

describe('GoogleDriveProvider & CloudSyncManager', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.topics.clear();
    await db.evaluations.clear();
    await db.chatMessages.clear();
    await db.tombstones.clear();
  });

  it('rejects connect when offline without loading GIS or calling fetch', async () => {
    const fetchFn = vi.fn();
    const loadGisFn = vi.fn();
    const provider = new GoogleDriveProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      getClientIdFn: () => 'client-123.apps.googleusercontent.com',
      loadGisFn,
      isOnlineFn: () => false,
    });

    await expect(provider.connect()).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(loadGisFn).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('throws NOT_CONFIGURED when Client ID is missing', async () => {
    const provider = new GoogleDriveProvider({
      getClientIdFn: () => '',
      isOnlineFn: () => true,
    });

    expect(provider.isConfigured()).toBe(false);
    await expect(provider.connect()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('authenticates with GIS using minimal drive.file scope and handles access_denied', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ user: { emailAddress: 'user@example.com' } })
    );
    const provider = new GoogleDriveProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      getClientIdFn: () => 'client-123',
      loadGisFn: createMockGis('tok-1', 3600),
      isOnlineFn: () => true,
    });

    const auth = await provider.connect();
    expect(auth.isConnected).toBe(true);
    expect(auth.hasActiveToken).toBe(true);
    expect(auth.accountEmail).toBe('user@example.com');

    const deniedProvider = new GoogleDriveProvider({
      getClientIdFn: () => 'client-123',
      loadGisFn: createMockGis('', 0, 'access_denied'),
      isOnlineFn: () => true,
    });

    await expect(deniedProvider.connect()).rejects.toMatchObject({ code: 'AUTH_DENIED' });
  });

  it('creates folder and multipart backup file when writing for the first time', async () => {
    const calls: Array<{ url: string; method: string; body?: BodyInit | null }> = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method, body: init?.body });

      if (url.includes('/about')) {
        return jsonResponse({ user: { emailAddress: 'sync@example.com' } });
      }
      if (url.includes('/files?q=') && url.includes('folder')) {
        return jsonResponse({ files: [] });
      }
      if (url.endsWith('/files?fields=id') && method === 'POST') {
        return jsonResponse({ id: 'folder-abc' });
      }
      if (url.includes('/upload/drive/v3/files?uploadType=multipart')) {
        return jsonResponse({ id: 'file-xyz', modifiedTime: '2026-11-11T20:00:00Z' });
      }
      return jsonResponse({}, 404);
    });

    const provider = new GoogleDriveProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      getClientIdFn: () => 'client-123',
      loadGisFn: createMockGis('tok-write'),
      isOnlineFn: () => true,
    });

    await provider.connect();
    const res = await provider.writeBackup({
      version: 2,
      exportedAt: '2026-11-11T20:00:00Z',
      topics: [],
      evaluations: [],
      tombstones: [],
    });

    expect(res.fileId).toBe('file-xyz');
    const folderCreateCall = calls.find((c) => c.url.endsWith('/files?fields=id'));
    expect(String(folderCreateCall?.body)).toContain(DRIVE_FOLDER_NAME);
    const multipartCall = calls.find((c) => c.url.includes('uploadType=multipart'));
    expect(String(multipartCall?.body)).toContain(DRIVE_FILE_NAME);
  });

  it('handles 401 token expired, 403 forbidden, 404 deleted file, 507 quota and invalid JSON safely', async () => {
    const setupProvider = async (handler: (url: string) => Promise<Response>) => {
      const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/about')) {
          return jsonResponse({ user: { emailAddress: 'u@example.com' } });
        }
        return handler(url);
      });
      const provider = new GoogleDriveProvider({
        fetchFn: fetchFn as unknown as typeof fetch,
        getClientIdFn: () => 'client-123',
        loadGisFn: createMockGis('tok-err'),
        isOnlineFn: () => true,
      });
      await provider.connect();
      return provider;
    };

    // 401 clears token
    const p401 = await setupProvider(async () => jsonResponse({ error: 'unauthorized' }, 401));
    await expect(p401.readBackup()).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(p401.getAuthState().hasActiveToken).toBe(false);

    // 403 forbidden
    const p403 = await setupProvider(async () => jsonResponse({ error: 'forbidden' }, 403));
    await expect(p403.readBackup()).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // 507 quota exceeded
    const p507 = await setupProvider(async () => jsonResponse({ error: 'insufficientStorage' }, 507));
    await expect(p507.writeBackup({ version: 2, exportedAt: '', topics: [], evaluations: [] })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });

    // 404 when previously linked file was deleted by user
    const p404 = await setupProvider(async () => jsonResponse({ error: 'notFound' }, 404));
    saveDriveMetadata({ fileId: 'deleted-file-id' });
    await expect(p404.readBackup()).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Corrupt JSON
    const pCorrupt = await setupProvider(async (url) => {
      if (url.includes('/files?q=')) {
        return jsonResponse({ files: [{ id: 'file-1', name: DRIVE_FILE_NAME }] });
      }
      if (url.includes('alt=media')) {
        return textResponse('{not-valid-json', 200);
      }
      return jsonResponse({});
    });
    saveDriveMetadata({ fileId: undefined });
    await expect(pCorrupt.readBackup()).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
  });

  it('syncs via CloudSyncManager without leaking AiSettings or chatMessages and preserves IndexedDB on failure', async () => {
    saveAiSettings({ provider: 'gemini', apiKey: 'SECRET-AI-KEY-123', modelName: 'gemini-1.5-flash' });
    await db.chatMessages.add({
      id: 'chat-secret-1',
      role: 'user',
      content: 'Diario privado de chat',
      timestamp: 1000,
    });
    await saveTopic({
      id: 'topic-local',
      name: 'Salud',
      color: '#10b981',
      icon: 'Heart',
      items: [],
      createdAt: 2000,
      updatedAt: 2000,
    });
    await saveEvaluation({
      id: 'eval-local',
      topicId: 'topic-local',
      date: '2026-11-11T10:00:00.000Z',
      items: [],
      totalWeight: 10,
      finalScore: 9,
      createdAt: 2000,
      updatedAt: 2000,
    });

    let uploadedPayload = '';
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';
      if (url.includes('/about')) {
        return jsonResponse({ user: { emailAddress: 'sync@example.com' } });
      }
      if (url.includes('/files?q=') && url.includes('folder')) {
        return jsonResponse({ files: [{ id: 'folder-1', name: DRIVE_FOLDER_NAME }] });
      }
      if (url.includes('/files?q=') && url.includes(DRIVE_FILE_NAME)) {
        return jsonResponse({ files: [{ id: 'file-1', name: DRIVE_FILE_NAME }] });
      }
      if (url.includes('alt=media')) {
        return jsonResponse({
          version: 2,
          exportedAt: '2026-11-11T09:00:00.000Z',
          topics: [
            {
              id: 'topic-remote',
              name: 'Lectura',
              color: '#6366f1',
              icon: 'Book',
              items: [],
              createdAt: 1500,
              updatedAt: 1500,
            },
          ],
          evaluations: [],
          tombstones: [],
        });
      }
      if (url.includes('uploadType=media') && method === 'PATCH') {
        uploadedPayload = String(init?.body || '');
        return jsonResponse({ id: 'file-1', modifiedTime: '2026-11-11T20:05:00Z' });
      }
      return jsonResponse({}, 404);
    });

    const provider = new GoogleDriveProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      getClientIdFn: () => 'client-123',
      loadGisFn: createMockGis('tok-sync'),
      isOnlineFn: () => true,
    });

    const manager = new CloudSyncManager(provider);
    const result = await manager.connectAndSync();

    expect(result.success).toBe(true);
    expect(hasPendingLocalChanges()).toBe(false);

    // Merged locally
    const topics = await db.topics.toArray();
    expect(topics.map((t) => t.id).sort()).toEqual(['topic-local', 'topic-remote']);

    // Excluded secrets & chatMessages from Drive payload
    expect(uploadedPayload).not.toContain('SECRET-AI-KEY-123');
    expect(uploadedPayload).not.toContain('Diario privado de chat');
    expect(uploadedPayload).toContain('topic-local');
    expect(uploadedPayload).toContain('topic-remote');

    // Failure on corrupt remote does NOT destroy local IndexedDB
    const failingManager = new CloudSyncManager({
      ...provider,
      id: 'google-drive',
      displayName: 'Google Drive',
      isConfigured: () => true,
      getAuthState: () => ({ isConnected: true, hasActiveToken: true }),
      connect: async () => ({ isConnected: true, hasActiveToken: true }),
      disconnect: async () => {},
      readBackup: async () => {
        throw new CloudSyncError('INVALID_BACKUP', 'JSON corrupto');
      },
      writeBackup: async () => ({ fileId: 'file-1' }),
    });

    const failRes = await failingManager.syncNow({ interactive: true });
    expect(failRes.success).toBe(false);
    expect(failRes.errorCode).toBe('INVALID_BACKUP');
    expect(await db.topics.count()).toBe(2);
    expect(await db.evaluations.count()).toBe(1);
  });

  it('clears cached fileId and throws NOT_FOUND when remote file was moved to Trash', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/about')) {
        return jsonResponse({ user: { emailAddress: 'u@example.com' } });
      }
      if (url.includes('/files/file-trashed')) {
        return jsonResponse({ id: 'file-trashed', name: DRIVE_FILE_NAME, trashed: true });
      }
      if (url.includes('/files?q=')) {
        return jsonResponse({ files: [] });
      }
      return jsonResponse({}, 404);
    });

    const provider = new GoogleDriveProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      getClientIdFn: () => 'client-123',
      loadGisFn: createMockGis('tok-trash'),
      isOnlineFn: () => true,
    });
    await provider.connect();
    saveDriveMetadata({ fileId: 'file-trashed' });

    await expect(provider.readBackup()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not invoke GIS connect on non-interactive sync or opportunistic sync without active token', async () => {
    vi.useFakeTimers();
    const connectFn = vi.fn();
    saveDriveMetadata({ isConnected: true, autoSyncEnabled: true });

    const manager = new CloudSyncManager({
      id: 'google-drive',
      displayName: 'Google Drive',
      isConfigured: () => true,
      getAuthState: () => ({ isConnected: true, hasActiveToken: false }),
      connect: connectFn,
      disconnect: vi.fn(),
      readBackup: vi.fn(),
      writeBackup: vi.fn(),
    });

    manager.triggerOpportunisticSync(100);
    await vi.advanceTimersByTimeAsync(200);
    expect(connectFn).not.toHaveBeenCalled();

    const nonInteractiveRes = await manager.syncNow({ interactive: false });
    expect(nonInteractiveRes.success).toBe(false);
    expect(nonInteractiveRes.errorCode).toBe('TOKEN_EXPIRED');
    expect(connectFn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('supports overwriteRemoteWithLocal, restoreFromRemote and disconnect', async () => {
    await saveTopic({
      id: 'topic-a',
      name: 'Local A',
      color: '#6366f1',
      icon: 'Smile',
      items: [],
      createdAt: 1000,
      updatedAt: 1000,
    });

    const writeBackup = vi.fn(async () => ({ fileId: 'new-file-id' }));
    const disconnect = vi.fn(async () => {});
    const readBackup = vi.fn(async () => ({
      fileId: 'remote-file-id',
      fileName: DRIVE_FILE_NAME,
      data: {
        version: 2,
        exportedAt: '2026-11-11T20:00:00Z',
        topics: [
          {
            id: 'topic-remote-only',
            name: 'Remoto Restaurado',
            color: '#10b981',
            icon: 'Heart',
            items: [],
            createdAt: 2000,
            updatedAt: 2000,
          },
        ],
        evaluations: [],
        tombstones: [],
      },
    }));

    const manager = new CloudSyncManager({
      id: 'google-drive',
      displayName: 'Google Drive',
      isConfigured: () => true,
      getAuthState: () => ({ isConnected: true, hasActiveToken: true, accountEmail: 'a@b.com' }),
      connect: vi.fn(),
      disconnect,
      readBackup,
      writeBackup,
    });

    const overwriteRes = await manager.overwriteRemoteWithLocal();
    expect(overwriteRes.success).toBe(true);
    expect(writeBackup).toHaveBeenCalledWith(expect.any(Object), undefined, { recreateIfMissing: true });

    const restoreRes = await manager.restoreFromRemote();
    expect(restoreRes.success).toBe(true);
    const topics = await db.topics.toArray();
    expect(topics.map((t) => t.id)).toEqual(['topic-remote-only']);
    expect(hasPendingLocalChanges()).toBe(false);

    await manager.disconnect();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

