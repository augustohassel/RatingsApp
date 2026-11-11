import Dexie, { Table } from 'dexie';
import { Topic, EvaluationEntry, BackupData, ChatMessage, Tombstone } from '../types';
import { INITIAL_TOPICS, DAILY_MOOD_TOPIC } from './seeds';

export const BACKUP_SCHEMA_VERSION = 2;
export const SYNC_PENDING_STORAGE_KEY = 'ratingsapp_sync_pending_v1';
export const LOCAL_DATA_CHANGED_EVENT = 'ratingsapp:local-data-changed';

export class RatingsDatabase extends Dexie {
  topics!: Table<Topic, string>;
  evaluations!: Table<EvaluationEntry, string>;
  chatMessages!: Table<ChatMessage, string>;
  tombstones!: Table<Tombstone, string>;

  constructor() {
    super('RatingsAppDB');
    this.version(1).stores({
      topics: 'id, name, createdAt',
      evaluations: 'id, topicId, date, finalScore, createdAt',
    });
    this.version(2).stores({
      topics: 'id, name, createdAt',
      evaluations: 'id, topicId, date, finalScore, createdAt',
      chatMessages: 'id, timestamp',
    });
    this.version(3)
      .stores({
        topics: 'id, name, createdAt, updatedAt',
        evaluations: 'id, topicId, date, finalScore, createdAt, updatedAt',
        chatMessages: 'id, timestamp',
        tombstones: 'id, entityType, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('evaluations')
          .toCollection()
          .modify((ev: EvaluationEntry) => {
            if (typeof ev.updatedAt !== 'number') {
              ev.updatedAt = ev.createdAt || Date.now();
            }
          });
      });
  }
}

export const db = new RatingsDatabase();

export const INITIALIZED_KEY = 'ratingsapp_has_initialized_v1';

/**
 * Marca cambios locales pendientes de sincronización y notifica a listeners activos.
 */
export function notifyLocalDataChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_PENDING_STORAGE_KEY, 'true');
    window.dispatchEvent(new CustomEvent(LOCAL_DATA_CHANGED_EVENT));
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}

/**
 * Devuelve si existen cambios locales pendientes de sincronizar.
 */
export function hasPendingLocalChanges(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SYNC_PENDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Limpia el indicador de cambios locales pendientes.
 */
export function clearPendingLocalChanges(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SYNC_PENDING_STORAGE_KEY);
  } catch {
    // Ignorar errores de almacenamiento
  }
}

/**
 * Initializes database with default topics if empty and first time
 */
export async function initializeDatabase(): Promise<void> {
  const hasInitialized = typeof window !== 'undefined' && localStorage.getItem(INITIALIZED_KEY);
  if (hasInitialized) {
    const dailyMoodExists = await db.topics.get(DAILY_MOOD_TOPIC.id);
    if (!dailyMoodExists) {
      await db.topics.add({ ...DAILY_MOOD_TOPIC, createdAt: 1, updatedAt: 1 });
    }
    return;
  }

  const topicCount = await db.topics.count();
  if (topicCount === 0) {
    const seededTopics = INITIAL_TOPICS.map((t) => ({
      ...t,
      createdAt: 1,
      updatedAt: 1,
    }));
    await db.topics.bulkAdd(seededTopics);

    // Add a sample initial evaluation for Trabajo so the user immediately sees charts and history
    const workTopic = seededTopics.find((t) => t.id === 'topic-work') || seededTopics[1];
    const initialItems = workTopic.items.map((it) => {

      // Nominal values matching the user's sample Google Sheet
      const sampleScores: Record<string, number> = {
        'w-1': 8,
        'w-2': 8,
        'w-3': 4,
        'w-4': 8,
        'w-5': 6,
        'w-6': 9,
        'w-7': 9,
        'w-8': 9,
        'w-9': 8,
        'w-10': 8,
        'w-11': 10,
        'w-12': 8,
        'w-13': 8,
        'w-14': 1,
      };

      const score = sampleScores[it.id] ?? 8;
      const totalWeight = 95;
      const percentage = Math.round((it.defaultWeight / totalWeight) * 10000) / 100;
      const contribution = Math.round(((it.defaultWeight / totalWeight) * score) * 100) / 100;

      return {
        itemId: it.id,
        name: it.name,
        explanation: it.explanation,
        weight: it.defaultWeight,
        percentage,
        score,
        contribution,
      };
    });

    const sampleDate = new Date();
    sampleDate.setDate(sampleDate.getDate() - 7); // 1 week ago
    const sampleTimestamp = sampleDate.getTime();

    await db.evaluations.add({
      id: 'sample-eval-1',
      topicId: workTopic.id,
      date: sampleDate.toISOString(),
      items: initialItems,
      totalWeight: 95,
      finalScore: 8.20,
      notes: 'Evaluación inicial de referencia tomada de la planilla.',
      createdAt: sampleTimestamp,
      updatedAt: sampleTimestamp,
    });
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

/**
 * Guarda o actualiza una evaluación asegurando `updatedAt` y notificando cambios locales.
 */
export async function saveEvaluation(entry: EvaluationEntry): Promise<void> {
  const now = Date.now();
  const normalized: EvaluationEntry = {
    ...entry,
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt ?? now,
  };
  await db.transaction('rw', db.evaluations, db.tombstones, async () => {
    await db.evaluations.put(normalized);
    await db.tombstones.delete(normalized.id);
  });
  notifyLocalDataChanged();
}

/**
 * Elimina una evaluación y registra su tombstone para propagar el borrado entre dispositivos.
 */
export async function deleteEvaluationWithTombstone(id: string): Promise<void> {
  const deletedAt = Date.now();
  await db.transaction('rw', db.evaluations, db.tombstones, async () => {
    await db.evaluations.delete(id);
    await db.tombstones.put({ id, entityType: 'evaluation', deletedAt });
  });
  notifyLocalDataChanged();
}

/**
 * Guarda o actualiza un ámbito asegurando `updatedAt` y notificando cambios locales.
 */
export async function saveTopic(topic: Topic): Promise<void> {
  const now = Date.now();
  const normalized: Topic = {
    ...topic,
    createdAt: topic.createdAt || now,
    updatedAt: topic.updatedAt || now,
  };
  await db.transaction('rw', db.topics, db.tombstones, async () => {
    await db.topics.put(normalized);
    await db.tombstones.delete(normalized.id);
  });
  notifyLocalDataChanged();
}

/**
 * Elimina un ámbito junto con sus evaluaciones y registra tombstones para todas las entidades borradas.
 */
export async function deleteTopicWithTombstone(topicId: string): Promise<void> {
  const deletedAt = Date.now();
  await db.transaction('rw', db.topics, db.evaluations, db.tombstones, async () => {
    const relatedEvaluations = await db.evaluations.where('topicId').equals(topicId).toArray();
    await db.topics.delete(topicId);
    await db.evaluations.where('topicId').equals(topicId).delete();

    const tombstones: Tombstone[] = [
      { id: topicId, entityType: 'topic', deletedAt },
      ...relatedEvaluations.map((ev) => ({
        id: ev.id,
        entityType: 'evaluation' as const,
        deletedAt,
      })),
    ];
    await db.tombstones.bulkPut(tombstones);
  });
  notifyLocalDataChanged();
}

/**
 * Valida y normaliza un objeto BackupData (v1 o v2). Lanza error si es inválido o incompatible.
 */
export function validateAndNormalizeBackup(raw: unknown): BackupData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Formato de archivo inválido.');
  }

  const candidate = raw as Partial<BackupData>;
  if (!Array.isArray(candidate.topics) || !Array.isArray(candidate.evaluations)) {
    throw new Error('Formato de archivo inválido. Faltan colecciones de temas o evaluaciones.');
  }

  const version = typeof candidate.version === 'number' ? candidate.version : 1;
  if (version < 1 || version > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `Versión de respaldo incompatible (v${version}). Actualizá la aplicación para importar este archivo.`
    );
  }

  const normalizedEvaluations: EvaluationEntry[] = candidate.evaluations.map((ev) => ({
    ...ev,
    updatedAt: typeof ev.updatedAt === 'number' ? ev.updatedAt : ev.createdAt,
  }));

  const normalizedTombstones: Tombstone[] = Array.isArray(candidate.tombstones)
    ? candidate.tombstones.filter(
        (t): t is Tombstone =>
          Boolean(t) &&
          typeof t.id === 'string' &&
          (t.entityType === 'topic' || t.entityType === 'evaluation') &&
          typeof t.deletedAt === 'number'
      )
    : [];

  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    topics: candidate.topics,
    evaluations: normalizedEvaluations,
    tombstones: normalizedTombstones,
  };
}

/**
 * Genera el objeto BackupData v2 completo desde IndexedDB (excluyendo chatMessages y AiSettings).
 */
export async function exportBackupData(): Promise<BackupData> {
  const [topics, rawEvaluations, tombstones] = await Promise.all([
    db.topics.toArray(),
    db.evaluations.toArray(),
    db.tombstones.toArray(),
  ]);

  const evaluations = rawEvaluations.map((ev) => ({
    ...ev,
    updatedAt: typeof ev.updatedAt === 'number' ? ev.updatedAt : ev.createdAt,
  }));

  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    topics,
    evaluations,
    tombstones,
  };
}

/**
 * Export all local data to a JSON string
 */
export async function exportBackup(): Promise<string> {
  const backup = await exportBackupData();
  return JSON.stringify(backup, null, 2);
}

async function replaceSyncTables(normalized: BackupData): Promise<void> {
  await db.transaction('rw', db.topics, db.evaluations, db.tombstones, async () => {
    await db.topics.clear();
    await db.evaluations.clear();
    await db.tombstones.clear();
    if (normalized.topics.length > 0) {
      await db.topics.bulkAdd(normalized.topics);
    }
    if (normalized.evaluations.length > 0) {
      await db.evaluations.bulkAdd(normalized.evaluations);
    }
    if (normalized.tombstones && normalized.tombstones.length > 0) {
      await db.tombstones.bulkAdd(normalized.tombstones);
    }
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

/**
 * Aplica un snapshot combinado a IndexedDB dentro de una transacción atómica sin marcar cambios pendientes.
 */
export async function applySyncedBackup(backup: BackupData): Promise<void> {
  const normalized = validateAndNormalizeBackup(backup);
  await replaceSyncTables(normalized);
}

/**
 * Import and replace backup data (compatible with v1 and v2 JSON files)
 */
export async function importBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    const normalized = validateAndNormalizeBackup(parsed);
    await replaceSyncTables(normalized);
    notifyLocalDataChanged();

    return {
      success: true,
      message: `Se importaron ${normalized.topics.length} temas y ${normalized.evaluations.length} evaluaciones.`,
    };
  } catch (error) {
    return { success: false, message: (error as Error).message || 'Error al procesar el archivo.' };
  }
}

/**
 * Wipe all data completely and ensure it stays empty across reloads
 */
export async function clearAllDatabase(): Promise<void> {
  await db.transaction('rw', db.topics, db.evaluations, db.chatMessages, db.tombstones, async () => {
    await db.topics.clear();
    await db.evaluations.clear();
    await db.chatMessages.clear();
    await db.tombstones.clear();
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
  notifyLocalDataChanged();
}

/**
 * Reset database to default initial state (restores Google Sheets templates)
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.topics, db.evaluations, db.chatMessages, db.tombstones, async () => {
    await db.topics.clear();
    await db.evaluations.clear();
    await db.chatMessages.clear();
    await db.tombstones.clear();
  });
  if (typeof window !== 'undefined') {
    localStorage.removeItem(INITIALIZED_KEY);
  }
  await initializeDatabase();
  notifyLocalDataChanged();
}

/**
 * Clear only chat messages
 */
export async function clearChatMessages(): Promise<void> {
  await db.chatMessages.clear();
}

