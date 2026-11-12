import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  initializeDatabase,
  exportBackup,
  importBackup,
  clearAllDatabase,
  resetDatabase,
  clearChatMessages,
  deleteEvaluationWithTombstone,
  deleteTopicWithTombstone,
  saveEvaluation,
  applySyncedBackup,
  hasPendingLocalChanges,
  clearPendingLocalChanges,
  INITIALIZED_KEY,
  BACKUP_SCHEMA_VERSION,
} from './index';
import { DAILY_MOOD_TOPIC_ID } from '../types';

describe('RatingsDatabase & Database Operations', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.topics.clear();
    await db.evaluations.clear();
    await db.chatMessages.clear();
    await db.tombstones.clear();
  });

  it('initializes database with default topics and sample evaluation on first run', async () => {
    await initializeDatabase();

    const topicsCount = await db.topics.count();
    expect(topicsCount).toBeGreaterThanOrEqual(3);

    const dailyMood = await db.topics.get(DAILY_MOOD_TOPIC_ID);
    expect(dailyMood).toBeDefined();
    expect(dailyMood?.name).toBe('Sensación Diaria');
    expect(dailyMood?.updatedAt).toBe(1);

    const evals = await db.evaluations.toArray();
    expect(evals.length).toBeGreaterThanOrEqual(1);
    expect(typeof evals[0].updatedAt).toBe('number');

    expect(localStorage.getItem(INITIALIZED_KEY)).toBe('true');
  });

  it('exports valid v2 backup JSON string with tombstones and updatedAt', async () => {
    await initializeDatabase();

    const json = await exportBackup();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBeDefined();
    expect(Array.isArray(parsed.topics)).toBe(true);
    expect(Array.isArray(parsed.evaluations)).toBe(true);
    expect(Array.isArray(parsed.tombstones)).toBe(true);
    expect(parsed.topics.length).toBeGreaterThan(0);
    expect(typeof parsed.evaluations[0].updatedAt).toBe('number');
  });

  it('imports legacy v1 backup and normalizes evaluation updatedAt', async () => {
    const customBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      topics: [
        {
          id: 'topic-test-custom',
          name: 'Guitarra',
          color: '#ec4899',
          icon: 'Music',
          items: [{ id: 'g-1', name: 'Técnica', defaultWeight: 7 }],
          createdAt: 2000,
          updatedAt: 2000,
        },
      ],
      evaluations: [
        {
          id: 'eval-custom-1',
          topicId: 'topic-test-custom',
          date: '2026-10-15T12:00:00.000Z',
          items: [{ itemId: 'g-1', name: 'Técnica', weight: 7, percentage: 100, score: 8, contribution: 8 }],
          totalWeight: 7,
          finalScore: 8,
          createdAt: 2000,
        },
      ],
    };

    const res = await importBackup(JSON.stringify(customBackup));
    expect(res.success).toBe(true);
    expect(res.message).toContain('Se importaron 1 temas y 1 evaluaciones');

    const topics = await db.topics.toArray();
    expect(topics).toHaveLength(1);
    expect(topics[0].id).toBe('topic-test-custom');

    const evals = await db.evaluations.toArray();
    expect(evals).toHaveLength(1);
    expect(evals[0].id).toBe('eval-custom-1');
    expect(evals[0].updatedAt).toBe(2000);
  });

  it('imports v2 backup preserving tombstones', async () => {
    const v2Backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      topics: [],
      evaluations: [],
      tombstones: [{ id: 'eval-deleted-1', entityType: 'evaluation', deletedAt: 5000 }],
    };

    const res = await importBackup(JSON.stringify(v2Backup));
    expect(res.success).toBe(true);
    const tombstones = await db.tombstones.toArray();
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]).toEqual({ id: 'eval-deleted-1', entityType: 'evaluation', deletedAt: 5000 });
  });

  it('rejects invalid backup JSON or future schema version', async () => {
    const resInvalid = await importBackup(JSON.stringify({ version: 1 }));
    expect(resInvalid.success).toBe(false);
    expect(resInvalid.message).toContain('Formato de archivo inválido');

    const resFuture = await importBackup(
      JSON.stringify({ version: 99, exportedAt: new Date().toISOString(), topics: [], evaluations: [] })
    );
    expect(resFuture.success).toBe(false);
    expect(resFuture.message).toContain('Versión de respaldo incompatible');
  });

  it('records tombstones when deleting evaluation or topic and marks pending sync', async () => {
    await initializeDatabase();
    clearPendingLocalChanges();

    await deleteEvaluationWithTombstone('sample-eval-1');
    expect(await db.evaluations.get('sample-eval-1')).toBeUndefined();
    const evalTombstone = await db.tombstones.get('sample-eval-1');
    expect(evalTombstone?.entityType).toBe('evaluation');
    expect(hasPendingLocalChanges()).toBe(true);

    clearPendingLocalChanges();
    await saveEvaluation({
      id: 'eval-work-2',
      topicId: 'topic-work',
      date: '2026-10-16T12:00:00.000Z',
      items: [],
      totalWeight: 10,
      finalScore: 9,
      createdAt: 3000,
    });

    await deleteTopicWithTombstone('topic-work');
    expect(await db.topics.get('topic-work')).toBeUndefined();
    expect(await db.evaluations.get('eval-work-2')).toBeUndefined();
    expect((await db.tombstones.get('topic-work'))?.entityType).toBe('topic');
    expect((await db.tombstones.get('eval-work-2'))?.entityType).toBe('evaluation');
  });

  it('applies synced backup without marking local changes pending', async () => {
    clearPendingLocalChanges();
    await applySyncedBackup({
      version: 2,
      exportedAt: new Date().toISOString(),
      topics: [
        {
          id: 'topic-remote',
          name: 'Remoto',
          color: '#6366f1',
          icon: 'Smile',
          items: [],
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      evaluations: [],
      tombstones: [],
    });

    expect(await db.topics.get('topic-remote')).toBeDefined();
    expect(hasPendingLocalChanges()).toBe(false);
  });

  it('clears all database tables and marks initialized', async () => {
    await initializeDatabase();
    await deleteEvaluationWithTombstone('sample-eval-1');
    await clearAllDatabase();

    expect(await db.topics.count()).toBe(0);
    expect(await db.evaluations.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
    expect(await db.tombstones.count()).toBe(0);
    expect(localStorage.getItem(INITIALIZED_KEY)).toBe('true');
  });

  it('clears only chat messages without touching topics or evaluations', async () => {
    await initializeDatabase();
    await db.chatMessages.add({
      id: 'msg-1',
      role: 'user',
      content: 'Mensaje de prueba',
      timestamp: Date.now(),
    });

    expect(await db.chatMessages.count()).toBe(1);

    await clearChatMessages();

    expect(await db.chatMessages.count()).toBe(0);
    expect(await db.topics.count()).toBeGreaterThan(0);
    expect(await db.evaluations.count()).toBeGreaterThan(0);
  });

  it('resets database to default templates', async () => {
    await db.topics.add({
      id: 'random-topic',
      name: 'Random',
      color: '#fff',
      icon: 'Smile',
      items: [],
      createdAt: 1,
      updatedAt: 1,
    });

    await resetDatabase();

    const topics = await db.topics.toArray();
    expect(topics.some((t) => t.id === 'topic-work')).toBe(true);
    expect(topics.some((t) => t.id === 'random-topic')).toBe(false);
  });
});

