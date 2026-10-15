import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  initializeDatabase,
  exportBackup,
  importBackup,
  clearAllDatabase,
  resetDatabase,
  clearChatMessages,
  INITIALIZED_KEY,
} from './index';
import { DAILY_MOOD_TOPIC_ID } from '../types';

describe('RatingsDatabase & Database Operations', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.topics.clear();
    await db.evaluations.clear();
    await db.chatMessages.clear();
  });

  it('initializes database with default topics and sample evaluation on first run', async () => {
    await initializeDatabase();

    const topicsCount = await db.topics.count();
    expect(topicsCount).toBeGreaterThanOrEqual(3);

    const dailyMood = await db.topics.get(DAILY_MOOD_TOPIC_ID);
    expect(dailyMood).toBeDefined();
    expect(dailyMood?.name).toBe('Sensación Diaria');

    const evalsCount = await db.evaluations.count();
    expect(evalsCount).toBeGreaterThanOrEqual(1);

    expect(localStorage.getItem(INITIALIZED_KEY)).toBe('true');
  });

  it('exports valid backup JSON string', async () => {
    await initializeDatabase();

    const json = await exportBackup();
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
    expect(Array.isArray(parsed.topics)).toBe(true);
    expect(Array.isArray(parsed.evaluations)).toBe(true);
    expect(parsed.topics.length).toBeGreaterThan(0);
  });

  it('imports valid backup and replaces data', async () => {
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
  });

  it('rejects invalid backup JSON with error message', async () => {
    const res = await importBackup(JSON.stringify({ version: 1 }));
    expect(res.success).toBe(false);
    expect(res.message).toContain('Formato de archivo inválido');
  });

  it('clears all database tables and marks initialized', async () => {
    await initializeDatabase();
    await clearAllDatabase();

    expect(await db.topics.count()).toBe(0);
    expect(await db.evaluations.count()).toBe(0);
    expect(await db.chatMessages.count()).toBe(0);
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

