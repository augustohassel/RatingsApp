import { describe, it, expect } from 'vitest';
import { mergeBackups, areBackupsEquivalent } from './syncEngine';
import { BackupData, EvaluationEntry, Topic } from '../types';

function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    name: 'Trabajo',
    color: '#6366f1',
    icon: 'Briefcase',
    items: [{ id: 'i-1', name: 'Foco', defaultWeight: 8 }],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeEval(overrides: Partial<EvaluationEntry> = {}): EvaluationEntry {
  return {
    id: 'eval-1',
    topicId: 'topic-1',
    date: '2026-10-15T12:00:00.000Z',
    items: [],
    totalWeight: 10,
    finalScore: 8,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeBackup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    version: 2,
    exportedAt: '2026-10-15T12:00:00.000Z',
    topics: [],
    evaluations: [],
    tombstones: [],
    ...overrides,
  };
}

describe('syncEngine - mergeBackups', () => {
  it('uploads local backup cleanly when remote does not exist yet', () => {
    const local = makeBackup({
      topics: [makeTopic()],
      evaluations: [makeEval()],
    });

    const result = mergeBackups(local, null, { now: 9999 });
    expect(result.localChanged).toBe(false);
    expect(result.remoteChanged).toBe(true);
    expect(result.merged.topics).toHaveLength(1);
    expect(result.merged.evaluations).toHaveLength(1);
    expect(result.merged.version).toBe(2);
  });

  it('combines parallel additions from two devices without duplication', () => {
    const sharedTopic = makeTopic();
    const local = makeBackup({
      topics: [sharedTopic],
      evaluations: [makeEval({ id: 'eval-local', createdAt: 2000, updatedAt: 2000 })],
    });
    const remote = makeBackup({
      topics: [sharedTopic, makeTopic({ id: 'topic-2', name: 'Natación', createdAt: 2500, updatedAt: 2500 })],
      evaluations: [makeEval({ id: 'eval-remote', topicId: 'topic-2', createdAt: 3000, updatedAt: 3000 })],
    });

    const result = mergeBackups(local, remote, { now: 4000 });
    expect(result.localChanged).toBe(true);
    expect(result.remoteChanged).toBe(true);
    expect(result.merged.topics.map((t) => t.id)).toEqual(['topic-1', 'topic-2']);
    expect(result.merged.evaluations.map((e) => e.id)).toEqual(['eval-local', 'eval-remote']);
    expect(result.stats.topicsAdded).toBe(1);
    expect(result.stats.evaluationsAdded).toBe(1);
  });

  it('resolves edit conflicts deterministically via Last-Write-Wins (updatedAt)', () => {
    const local = makeBackup({
      topics: [makeTopic({ name: 'Trabajo Viejo', updatedAt: 2000 })],
      evaluations: [makeEval({ finalScore: 9, updatedAt: 5000 })],
    });
    const remote = makeBackup({
      topics: [makeTopic({ name: 'Trabajo Actualizado', updatedAt: 4000 })],
      evaluations: [makeEval({ finalScore: 6, updatedAt: 3000 })],
    });

    const result = mergeBackups(local, remote);
    expect(result.merged.topics[0].name).toBe('Trabajo Actualizado');
    expect(result.merged.evaluations[0].finalScore).toBe(9);
    expect(result.localChanged).toBe(true);
    expect(result.remoteChanged).toBe(true);
  });

  it('propagates deletions using tombstones and avoids resurrection', () => {
    const local = makeBackup({
      topics: [makeTopic()],
      evaluations: [makeEval({ id: 'eval-keep', updatedAt: 2000 }), makeEval({ id: 'eval-del', updatedAt: 2000 })],
    });
    const remote = makeBackup({
      topics: [makeTopic()],
      evaluations: [makeEval({ id: 'eval-keep', updatedAt: 2000 })],
      tombstones: [{ id: 'eval-del', entityType: 'evaluation', deletedAt: 3000 }],
    });

    const result = mergeBackups(local, remote);
    expect(result.merged.evaluations.map((e) => e.id)).toEqual(['eval-keep']);
    expect(result.merged.tombstones).toEqual([{ id: 'eval-del', entityType: 'evaluation', deletedAt: 3000 }]);
    expect(result.stats.evaluationsDeleted).toBe(1);

    // Re-running merge is completely idempotent
    const secondRun = mergeBackups(result.merged, result.merged);
    expect(secondRun.localChanged).toBe(false);
    expect(secondRun.remoteChanged).toBe(false);
  });

  it('keeps an entity if edited/recreated after an older tombstone', () => {
    const local = makeBackup({
      topics: [makeTopic()],
      evaluations: [makeEval({ id: 'eval-1', finalScore: 10, updatedAt: 6000 })],
    });
    const remote = makeBackup({
      topics: [makeTopic()],
      evaluations: [],
      tombstones: [{ id: 'eval-1', entityType: 'evaluation', deletedAt: 3000 }],
    });

    const result = mergeBackups(local, remote);
    expect(result.merged.evaluations).toHaveLength(1);
    expect(result.merged.evaluations[0].finalScore).toBe(10);
    expect(result.merged.tombstones).toEqual([]);
  });

  it('removes evaluations belonging to a tombstoned topic to preserve referential integrity', () => {
    const local = makeBackup({
      topics: [makeTopic({ id: 'topic-x', updatedAt: 1000 })],
      evaluations: [makeEval({ id: 'eval-orphan', topicId: 'topic-x', createdAt: 5000, updatedAt: 5000 })],
    });
    const remote = makeBackup({
      topics: [],
      evaluations: [],
      tombstones: [{ id: 'topic-x', entityType: 'topic', deletedAt: 3000 }],
    });

    const result = mergeBackups(local, remote);
    expect(result.merged.topics).toEqual([]);
    expect(result.merged.evaluations).toEqual([]);
    expect(result.merged.tombstones?.some((t) => t.id === 'eval-orphan')).toBe(true);
  });

  it('prevents untouched seed data (sample-eval-1 and initial topics) from polluting remote on first link', () => {
    const localFreshDevice = makeBackup({
      topics: [
        makeTopic({ id: 'topic-daily-mood', name: 'Sensación Diaria', isSystem: true, createdAt: 1, updatedAt: 1 }),
        makeTopic({ id: 'topic-work', name: 'Trabajo / Laboral', createdAt: 1, updatedAt: 1 }),
        makeTopic({ id: 'topic-swimming', name: 'Natación / Deporte', createdAt: 1, updatedAt: 1 }),
      ],
      evaluations: [
        makeEval({ id: 'sample-eval-1', topicId: 'topic-work', createdAt: 99999, updatedAt: 99999 }),
      ],
    });

    const remoteExisting = makeBackup({
      topics: [makeTopic({ id: 'topic-work', name: 'Mi Trabajo Custom', createdAt: 500, updatedAt: 500 })],
      evaluations: [makeEval({ id: 'real-eval-1', topicId: 'topic-work', finalScore: 9, createdAt: 600, updatedAt: 600 })],
      tombstones: [{ id: 'sample-eval-1', entityType: 'evaluation', deletedAt: 700 }],
    });

    const result = mergeBackups(localFreshDevice, remoteExisting, { isFirstLink: true });
    expect(result.merged.topics.map((t) => t.id)).toEqual(['topic-daily-mood', 'topic-work']);
    expect(result.merged.topics.find((t) => t.id === 'topic-work')?.name).toBe('Mi Trabajo Custom');
    expect(result.merged.evaluations.map((e) => e.id)).toEqual(['real-eval-1']);
    expect(result.localChanged).toBe(true);
  });

  it('preserves user-created local records even on first link when remote also exists', () => {
    const localWithUserWork = makeBackup({
      topics: [
        makeTopic({ id: 'topic-daily-mood', name: 'Sensación Diaria', isSystem: true, createdAt: 1, updatedAt: 1 }),
        makeTopic({ id: 'topic-custom-b', name: 'Lectura', createdAt: 2000, updatedAt: 2000 }),
      ],
      evaluations: [
        makeEval({ id: 'sample-eval-1', topicId: 'topic-work', createdAt: 1500, updatedAt: 1500 }),
        makeEval({ id: 'eval-b-1', topicId: 'topic-custom-b', createdAt: 2100, updatedAt: 2100 }),
      ],
    });

    const remoteExisting = makeBackup({
      topics: [makeTopic({ id: 'topic-daily-mood', name: 'Sensación Diaria', isSystem: true, createdAt: 100, updatedAt: 100 })],
      evaluations: [makeEval({ id: 'eval-a-1', topicId: 'topic-daily-mood', createdAt: 500, updatedAt: 500 })],
    });

    const result = mergeBackups(localWithUserWork, remoteExisting, { isFirstLink: true });
    expect(result.merged.topics.map((t) => t.id)).toEqual(['topic-daily-mood', 'topic-custom-b']);
    expect(result.merged.evaluations.map((e) => e.id)).toEqual(['eval-a-1', 'eval-b-1']);
  });

  it('maintains commutativity between Device A and Device B merges', () => {
    const a = makeBackup({
      topics: [makeTopic({ id: 't1', name: 'A', updatedAt: 1000 })],
      evaluations: [makeEval({ id: 'e1', topicId: 't1', updatedAt: 2000 })],
      tombstones: [{ id: 'e-old', entityType: 'evaluation', deletedAt: 1500 }],
    });
    const b = makeBackup({
      topics: [makeTopic({ id: 't1', name: 'B', updatedAt: 2000 }), makeTopic({ id: 't2', name: 'T2', updatedAt: 2000 })],
      evaluations: [makeEval({ id: 'e-old', topicId: 't1', updatedAt: 1200 })],
    });

    const ab = mergeBackups(a, b, { now: 5000 }).merged;
    const ba = mergeBackups(b, a, { now: 5000 }).merged;
    expect(areBackupsEquivalent(ab, ba)).toBe(true);
  });

  it('normalizes legacy v1 remote backups and rejects unsupported future versions', () => {
    const local = makeBackup({ topics: [makeTopic()] });
    const legacyRemote = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      topics: [makeTopic({ id: 'topic-v1', name: 'Legacy', createdAt: 500, updatedAt: 500 })],
      evaluations: [
        {
          id: 'eval-v1',
          topicId: 'topic-v1',
          date: '2026-01-01T10:00:00.000Z',
          items: [],
          totalWeight: 10,
          finalScore: 7,
          createdAt: 500,
        },
      ],
    } as BackupData;

    const result = mergeBackups(local, legacyRemote);
    expect(result.merged.evaluations[0].updatedAt).toBe(500);

    const futureRemote = { ...legacyRemote, version: 3 };
    expect(() => mergeBackups(local, futureRemote)).toThrow(/Versión de respaldo incompatible/);
  });
});

