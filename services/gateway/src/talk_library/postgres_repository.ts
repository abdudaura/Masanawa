import type { TalkRecord } from "../talks/model.js";
import type {
  TalkLibraryRepository,
  TalkLibraryRow,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkLibrarySqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface TalkRow extends Record<string, unknown> {
  tenant_id: string;
  talk_id: string;
  host_user_id: string;
  host_name: string;
  title: string;
  topic: string;
  summary: string;
  state: "draft" | "live" | "reconnecting" | "ended";
  listener_count: string | number;
  duration_seconds: string | number | null;
  created_at: string | Date;
  updated_at: string | Date;
  comment_count: string | number;
}

interface SavedRow extends Record<string, unknown> {
  saved: boolean;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function record(row: TalkRow): TalkRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    talkId: row.talk_id,
    hostUserId: row.host_user_id,
    hostName: row.host_name,
    title: row.title,
    topic: row.topic,
    summary: row.summary,
    state: row.state,
    listenerCount: Number(row.listener_count),
    durationSeconds:
      row.duration_seconds === null ? null : Number(row.duration_seconds),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function libraryRow(row: TalkRow): TalkLibraryRow {
  return Object.freeze({
    talk: record(row),
    commentCount: Number(row.comment_count),
  });
}

const projection = `
  t.tenant_id, t.talk_id, t.host_user_id, t.host_name, t.title, t.topic,
  t.summary, t.state, t.listener_count, t.duration_seconds,
  t.created_at, t.updated_at,
  (SELECT count(*)::int
     FROM talks.comments c
    WHERE c.tenant_id = t.tenant_id
      AND c.talk_id = t.talk_id) AS comment_count
`;

async function visibleTalkExists(
  pool: TalkLibrarySqlPool,
  tenantId: string,
  talkId: string,
): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM talks.talks
        WHERE tenant_id = $1
          AND talk_id = $2
          AND state IN ('live','reconnecting','ended')
     ) AS exists`,
    [tenantId, talkId],
  );
  return result.rows[0]?.exists === true;
}

export function createPostgresTalkLibraryRepository(
  pool: TalkLibrarySqlPool,
): TalkLibraryRepository {
  return Object.freeze({
    async listOwned(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${projection}
           FROM talks.talks t
          WHERE t.tenant_id = $1
            AND t.host_user_id = $2
            AND t.state IN ('live','reconnecting','ended')
          ORDER BY
            CASE WHEN t.state IN ('live','reconnecting') THEN 0 ELSE 1 END,
            COALESCE(t.started_at, t.created_at) DESC,
            t.talk_id DESC
          LIMIT $3`,
        [input.tenantId, input.userId, input.limit],
      );
      return Object.freeze(result.rows.map(libraryRow));
    },

    async listSaved(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${projection}
           FROM talks.saved_talks s
           JOIN talks.talks t
             ON t.tenant_id = s.tenant_id
            AND t.talk_id = s.talk_id
          WHERE s.tenant_id = $1
            AND s.user_id = $2
            AND t.state IN ('live','reconnecting','ended')
          ORDER BY s.saved_at DESC, s.talk_id DESC
          LIMIT $3`,
        [input.tenantId, input.userId, input.limit],
      );
      return Object.freeze(result.rows.map(libraryRow));
    },

    async readSaved(input) {
      if (!(await visibleTalkExists(pool, input.tenantId, input.talkId))) {
        return null;
      }
      const result = await pool.query<SavedRow>(
        `SELECT EXISTS (
           SELECT 1
             FROM talks.saved_talks
            WHERE tenant_id = $1
              AND user_id = $2
              AND talk_id = $3
         ) AS saved`,
        [input.tenantId, input.userId, input.talkId],
      );
      return result.rows[0]?.saved === true;
    },

    async setSaved(input) {
      if (!(await visibleTalkExists(pool, input.tenantId, input.talkId))) {
        return null;
      }

      if (input.saved) {
        await pool.query(
          `INSERT INTO talks.saved_talks (
             tenant_id, user_id, talk_id, saved_at
           ) VALUES ($1,$2,$3,$4)
           ON CONFLICT (tenant_id, user_id, talk_id) DO UPDATE
             SET saved_at = EXCLUDED.saved_at`,
          [input.tenantId, input.userId, input.talkId, input.changedAt],
        );
        return true;
      }

      await pool.query(
        `DELETE FROM talks.saved_talks
          WHERE tenant_id = $1 AND user_id = $2 AND talk_id = $3`,
        [input.tenantId, input.userId, input.talkId],
      );
      return false;
    },
  });
}
