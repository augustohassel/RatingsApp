import { BackupData, EvaluationEntry, Tombstone, TombstoneEntityType, Topic } from '../types';
import { BACKUP_SCHEMA_VERSION, validateAndNormalizeBackup } from '../db';

export const SEED_TOPIC_IDS = new Set(['topic-daily-mood', 'topic-work', 'topic-swimming']);
export const SAMPLE_EVALUATION_ID = 'sample-eval-1';

export interface MergeOptions {
  /** Indica si es la primera vinculación del dispositivo con la nube. */
  isFirstLink?: boolean;
  /** Timestamp de referencia para `exportedAt`. */
  now?: number;
  /** Si se define, descarta tombstones con `deletedAt < pruneOlderThan`. */
  pruneTombstonesOlderThan?: number;
}

export interface MergeStats {
  topicsAdded: number;
  topicsUpdated: number;
  topicsDeleted: number;
  evaluationsAdded: number;
  evaluationsUpdated: number;
  evaluationsDeleted: number;
}

export interface MergeResult {
  merged: BackupData;
  localChanged: boolean;
  remoteChanged: boolean;
  stats: MergeStats;
}

interface SyncableEntity {
  id: string;
  createdAt: number;
  updatedAt?: number;
}

function getEntityTimestamp(entity: SyncableEntity): number {
  return typeof entity.updatedAt === 'number' ? entity.updatedAt : entity.createdAt;
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function pickWinningEntity<T extends SyncableEntity>(a: T, b: T): T {
  const tsA = getEntityTimestamp(a);
  const tsB = getEntityTimestamp(b);
  if (tsA !== tsB) {
    return tsA > tsB ? a : b;
  }
  // Desempate determinístico y simétrico independiente del orden (local vs remoto)
  return canonicalStringify(a) >= canonicalStringify(b) ? a : b;
}

function hasRemoteMeaningfulContent(remote: BackupData): boolean {
  return (
    remote.topics.length > 0 ||
    remote.evaluations.length > 0 ||
    (remote.tombstones?.length ?? 0) > 0
  );
}

function filterUntouchedSeedsForFirstLink(local: BackupData, remote: BackupData): BackupData {
  const remoteTopicIds = new Set(remote.topics.map((t) => t.id));
  const remoteTopicTombstones = new Set(
    (remote.tombstones || []).filter((t) => t.entityType === 'topic').map((t) => t.id)
  );
  const remoteHasCuratedTopics = remote.topics.length > 0 || remoteTopicTombstones.size > 0;

  const filteredTopics = local.topics.filter((topic) => {
    const isUntouchedSeed = SEED_TOPIC_IDS.has(topic.id) && (topic.updatedAt ?? topic.createdAt) <= 1;
    if (!isUntouchedSeed) return true;
    if (topic.isSystem) {
      return !remoteTopicIds.has(topic.id) && !remoteTopicTombstones.has(topic.id);
    }
    return !remoteHasCuratedTopics;
  });

  const filteredEvaluations = local.evaluations.filter((ev) => {
    if (ev.id !== SAMPLE_EVALUATION_ID) return true;
    const isUntouchedSample = getEntityTimestamp(ev) === ev.createdAt;
    return !isUntouchedSample;
  });

  return {
    ...local,
    topics: filteredTopics,
    evaluations: filteredEvaluations,
  };
}

function mergeEntityCollection<T extends SyncableEntity>(
  entityType: TombstoneEntityType,
  localItems: T[],
  remoteItems: T[],
  localTombstones: Tombstone[],
  remoteTombstones: Tombstone[]
): {
  items: T[];
  tombstones: Tombstone[];
  added: number;
  updated: number;
  deleted: number;
} {
  const tombstoneMap = new Map<string, Tombstone>();
  for (const t of [...localTombstones, ...remoteTombstones]) {
    if (t.entityType !== entityType) continue;
    const existing = tombstoneMap.get(t.id);
    if (!existing || t.deletedAt > existing.deletedAt) {
      tombstoneMap.set(t.id, t);
    }
  }

  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const remoteMap = new Map(remoteItems.map((item) => [item.id, item]));
  const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);

  const mergedItems: T[] = [];
  let added = 0;
  let updated = 0;
  let deleted = 0;

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);
    const winner =
      localItem && remoteItem
        ? pickWinningEntity(localItem, remoteItem)
        : (localItem || remoteItem)!;

    const tombstone = tombstoneMap.get(id);
    const winnerTs = getEntityTimestamp(winner);

    if (tombstone && tombstone.deletedAt >= winnerTs) {
      if (localItem) deleted += 1;
      continue;
    }

    if (tombstone && winnerTs > tombstone.deletedAt) {
      tombstoneMap.delete(id);
    }

    mergedItems.push(winner);
    if (!localItem && remoteItem) {
      added += 1;
    } else if (localItem && canonicalStringify(localItem) !== canonicalStringify(winner)) {
      updated += 1;
    }
  }

  mergedItems.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  return {
    items: mergedItems,
    tombstones: Array.from(tombstoneMap.values()),
    added,
    updated,
    deleted,
  };
}

export function areBackupsEquivalent(a: BackupData, b: BackupData): boolean {
  const normalizeForCompare = (data: BackupData) => ({
    topics: [...data.topics].sort((x, y) => x.id.localeCompare(y.id)),
    evaluations: [...data.evaluations]
      .map((ev) => ({ ...ev, updatedAt: getEntityTimestamp(ev) }))
      .sort((x, y) => x.id.localeCompare(y.id)),
    tombstones: [...(data.tombstones || [])].sort(
      (x, y) => x.entityType.localeCompare(y.entityType) || x.id.localeCompare(y.id)
    ),
  });

  return canonicalStringify(normalizeForCompare(a)) === canonicalStringify(normalizeForCompare(b));
}

/**
 * Combina de forma pura, determinística e idempotente dos respaldos (`local` y `remote`).
 * Resuelve conflictos por entidad usando `id` + `updatedAt` (Last-Write-Wins) y propaga borrados mediante tombstones.
 */
export function mergeBackups(
  rawLocal: BackupData,
  rawRemote: BackupData | null,
  options: MergeOptions = {}
): MergeResult {
  const now = options.now ?? Date.now();
  const originalLocal = validateAndNormalizeBackup(rawLocal);
  const normalizedRemote = rawRemote ? validateAndNormalizeBackup(rawRemote) : null;

  if (!normalizedRemote) {
    const merged: BackupData = {
      ...originalLocal,
      version: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date(now).toISOString(),
    };
    return {
      merged,
      localChanged: false,
      remoteChanged: true,
      stats: {
        topicsAdded: 0,
        topicsUpdated: 0,
        topicsDeleted: 0,
        evaluationsAdded: 0,
        evaluationsUpdated: 0,
        evaluationsDeleted: 0,
      },
    };
  }

  const effectiveLocal =
    options.isFirstLink && hasRemoteMeaningfulContent(normalizedRemote)
      ? filterUntouchedSeedsForFirstLink(originalLocal, normalizedRemote)
      : originalLocal;

  const localTombstones = effectiveLocal.tombstones || [];
  const remoteTombstones = normalizedRemote.tombstones || [];

  const topicMerge = mergeEntityCollection<Topic>(
    'topic',
    effectiveLocal.topics,
    normalizedRemote.topics,
    localTombstones,
    remoteTombstones
  );

  const evalMerge = mergeEntityCollection<EvaluationEntry>(
    'evaluation',
    effectiveLocal.evaluations,
    normalizedRemote.evaluations,
    localTombstones,
    remoteTombstones
  );

  // Garantizar integridad referencial si un ámbito fue eliminado mediante tombstone
  const deletedTopicTombstones = new Map(
    topicMerge.tombstones.map((t) => [t.id, t])
  );
  const activeTopicIds = new Set(topicMerge.items.map((t) => t.id));
  const evalTombstoneMap = new Map(evalMerge.tombstones.map((t) => [t.id, t]));

  const cleanEvaluations: EvaluationEntry[] = [];
  let extraDeletedEvaluations = 0;

  for (const ev of evalMerge.items) {
    const topicTombstone = deletedTopicTombstones.get(ev.topicId);
    if (!activeTopicIds.has(ev.topicId) && topicTombstone) {
      const existingTomb = evalTombstoneMap.get(ev.id);
      const deletedAt = Math.max(topicTombstone.deletedAt, getEntityTimestamp(ev));
      if (!existingTomb || deletedAt > existingTomb.deletedAt) {
        evalTombstoneMap.set(ev.id, {
          id: ev.id,
          entityType: 'evaluation',
          deletedAt,
        });
      }
      if (originalLocal.evaluations.some((le) => le.id === ev.id)) {
        extraDeletedEvaluations += 1;
      }
      continue;
    }
    cleanEvaluations.push(ev);
  }

  let allTombstones = [...topicMerge.tombstones, ...evalTombstoneMap.values()];
  if (typeof options.pruneTombstonesOlderThan === 'number') {
    const threshold = options.pruneTombstonesOlderThan;
    allTombstones = allTombstones.filter((t) => t.deletedAt >= threshold);
  }
  allTombstones.sort(
    (a, b) => a.entityType.localeCompare(b.entityType) || a.id.localeCompare(b.id)
  );

  const merged: BackupData = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    topics: topicMerge.items,
    evaluations: cleanEvaluations,
    tombstones: allTombstones,
  };

  return {
    merged,
    localChanged: !areBackupsEquivalent(originalLocal, merged),
    remoteChanged: !areBackupsEquivalent(normalizedRemote, merged),
    stats: {
      topicsAdded: topicMerge.added,
      topicsUpdated: topicMerge.updated,
      topicsDeleted: topicMerge.deleted,
      evaluationsAdded: evalMerge.added,
      evaluationsUpdated: evalMerge.updated,
      evaluationsDeleted: evalMerge.deleted + extraDeletedEvaluations,
    },
  };
}

