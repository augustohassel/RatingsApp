import Dexie, { Table } from 'dexie';
import { Topic, EvaluationEntry, BackupData } from '../types';
import { INITIAL_TOPICS } from './seeds';

export class RatingsDatabase extends Dexie {
  topics!: Table<Topic, string>;
  evaluations!: Table<EvaluationEntry, string>;

  constructor() {
    super('RatingsAppDB');
    this.version(1).stores({
      topics: 'id, name, createdAt',
      evaluations: 'id, topicId, date, finalScore, createdAt',
    });
  }
}

export const db = new RatingsDatabase();

export const INITIALIZED_KEY = 'ratingsapp_has_initialized_v1';

/**
 * Initializes database with default topics if empty and first time
 */
export async function initializeDatabase(): Promise<void> {
  const hasInitialized = typeof window !== 'undefined' && localStorage.getItem(INITIALIZED_KEY);
  if (hasInitialized) {
    return;
  }

  const topicCount = await db.topics.count();
  if (topicCount === 0) {
    await db.topics.bulkAdd(INITIAL_TOPICS);

    // Add a sample initial evaluation for Trabajo so the user immediately sees charts and history
    const workTopic = INITIAL_TOPICS[0];
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

    await db.evaluations.add({
      id: 'sample-eval-1',
      topicId: workTopic.id,
      date: sampleDate.toISOString(),
      items: initialItems,
      totalWeight: 95,
      finalScore: 8.20,
      notes: 'Evaluación inicial de referencia tomada de la planilla.',
      createdAt: sampleDate.getTime(),
    });
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

/**
 * Export all local data to a JSON string
 */
export async function exportBackup(): Promise<string> {
  const topics = await db.topics.toArray();
  const evaluations = await db.evaluations.toArray();

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    topics,
    evaluations,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Import and replace/merge backup data
 */
export async function importBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const data: BackupData = JSON.parse(jsonString);
    if (!data.topics || !data.evaluations) {
      throw new Error('Formato de archivo inválido. Faltan colecciones de temas o evaluaciones.');
    }

    await db.transaction('rw', db.topics, db.evaluations, async () => {
      await db.topics.clear();
      await db.evaluations.clear();
      await db.topics.bulkAdd(data.topics);
      await db.evaluations.bulkAdd(data.evaluations);
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem(INITIALIZED_KEY, 'true');
    }

    return { success: true, message: `Se importaron ${data.topics.length} temas y ${data.evaluations.length} evaluaciones.` };
  } catch (error) {
    return { success: false, message: (error as Error).message || 'Error al procesar el archivo.' };
  }
}

/**
 * Wipe all data completely and ensure it stays empty across reloads
 */
export async function clearAllDatabase(): Promise<void> {
  await db.transaction('rw', db.topics, db.evaluations, async () => {
    await db.topics.clear();
    await db.evaluations.clear();
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

/**
 * Reset database to default initial state (restores Google Sheets templates)
 */
export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.topics, db.evaluations, async () => {
    await db.topics.clear();
    await db.evaluations.clear();
  });
  if (typeof window !== 'undefined') {
    localStorage.removeItem(INITIALIZED_KEY);
  }
  await initializeDatabase();
}
