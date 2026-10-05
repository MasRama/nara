import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';
import type {
  ActivityMetadata,
  ActivityQuery,
  ActivityRecord,
  ActivityRecordInput,
} from '../contract';

interface ActivityRow {
  id: string;
  action: string;
  resource: string;
  actor_id: string | null;
  target_id: string | null;
  target_label: string | null;
  metadata_json: string;
  occurred_at: number;
}

function metadataFromRow(value: string): ActivityMetadata {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ActivityMetadata;
    }
  } catch {
    // Corrupt metadata must not make the activity feed unreadable.
  }
  return {};
}

function fromRow(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    action: row.action,
    resource: row.resource,
    actorId: row.actor_id,
    targetId: row.target_id,
    targetLabel: row.target_label,
    metadata: metadataFromRow(row.metadata_json),
    occurredAt: row.occurred_at,
  };
}

export function recordActivity(input: ActivityRecordInput): ActivityRecord {
  const record: ActivityRecord = {
    id: randomUUID(),
    action: input.action,
    resource: input.resource,
    actorId: input.actorId,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt ?? Date.now(),
  };

  getDatabase()
    .prepare(
      `INSERT INTO activity_events
        (id, action, resource, actor_id, target_id, target_label, metadata_json, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.action,
      record.resource,
      record.actorId,
      record.targetId,
      record.targetLabel,
      JSON.stringify(record.metadata),
      record.occurredAt,
    );

  return record;
}

export function listActivity(query: ActivityQuery): { data: ActivityRecord[]; total: number } {
  const where: string[] = [];
  const values: Array<string | number> = [];

  if (query.action) {
    where.push('action = ?');
    values.push(query.action);
  }
  if (query.actorId) {
    where.push('actor_id = ?');
    values.push(query.actorId);
  }
  if (query.from !== undefined) {
    where.push('occurred_at >= ?');
    values.push(query.from);
  }
  if (query.to !== undefined) {
    where.push('occurred_at <= ?');
    values.push(query.to);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const database = getDatabase();
  const data = database
    .prepare(
      `SELECT id, action, resource, actor_id, target_id, target_label, metadata_json, occurred_at
       FROM activity_events
       ${clause}
       ORDER BY occurred_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...values, query.limit, offset) as ActivityRow[];
  const total = database
    .prepare(`SELECT COUNT(*) AS count FROM activity_events ${clause}`)
    .get(...values) as { count: number };

  return { data: data.map(fromRow), total: total.count };
}
