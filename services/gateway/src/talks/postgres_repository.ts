import type {
  TalkCommentRecord,
  TalkRecord,
  TalkRepository,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkSqlPool {
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
  listener_count: number;
  duration_seconds: number | null;
  created_at: string | Date;
  updated_at: string | Date;
  comment_count?: string | number;
}

interface CommentRow extends Record<string, unknown> {
  tenant_id: string;
  talk_id: string;
  comment_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string | Date;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapTalk(row: TalkRow): TalkRecord {
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
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function mapComment(row: CommentRow): TalkCommentRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    talkId: row.talk_id,
    commentId: row.comment_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: iso(row.created_at),
  });
}

const talkColumns = `
  tenant_id, talk_id, host_user_id, host_name, title, topic, summary,
  state, listener_count, duration_seconds, created_at, updated_at
`;

export function createPostgresTalkRepository(pool: TalkSqlPool): TalkRepository {
  return Object.freeze({
    async createTalk(input) {
      const result = await pool.query<TalkRow>(
        `INSERT INTO talks.talks (
           tenant_id, talk_id, host_user_id, host_name, title, topic, summary,
           state, listener_count, duration_seconds, created_at, updated_at, started_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'','live',0,NULL,$7,$7,$7)
         RETURNING ${talkColumns}`,
        [
          input.tenantId,
          input.talkId,
          input.hostUserId,
          input.hostName,
          input.title,
          input.topic,
          input.createdAt,
        ],
      );
      return mapTalk(result.rows[0]!);
    },

    async listTalks(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${talkColumns},
                (SELECT count(*)::int FROM talks.comments c
                  WHERE c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id) AS comment_count
           FROM talks.talks t
          WHERE tenant_id = $1
            AND ($2::text = 'explore' OR state = 'live')
            AND state IN ('live','ended','reconnecting')
          ORDER BY CASE WHEN state = 'live' THEN 0 ELSE 1 END,
                   COALESCE(started_at, created_at) DESC
          LIMIT $3`,
        [input.tenantId, input.feed, input.limit],
      );
      return Object.freeze(result.rows.map((row) =>
        Object.freeze({ talk: mapTalk(row), commentCount: Number(row.comment_count ?? 0) })
      ));
    },

    async getTalk(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${talkColumns},
                (SELECT count(*)::int FROM talks.comments c
                  WHERE c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id) AS comment_count
           FROM talks.talks t
          WHERE tenant_id = $1 AND talk_id = $2
          LIMIT 1`,
        [input.tenantId, input.talkId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({ talk: mapTalk(row), commentCount: Number(row.comment_count ?? 0) })
        : null;
    },

    async listComments(input) {
      const result = await pool.query<CommentRow>(
        `SELECT tenant_id, talk_id, comment_id, author_user_id, author_name, body, created_at
           FROM talks.comments
          WHERE tenant_id = $1 AND talk_id = $2
          ORDER BY created_at ASC, comment_id ASC
          LIMIT $3`,
        [input.tenantId, input.talkId, input.limit],
      );
      return Object.freeze(result.rows.map(mapComment));
    },

    async addComment(input) {
      const result = await pool.query<CommentRow>(
        `INSERT INTO talks.comments (
           tenant_id, talk_id, comment_id, author_user_id, author_name, body, created_at
         )
         SELECT $1,$2,$3,$4,$5,$6,$7
           WHERE EXISTS (
             SELECT 1 FROM talks.talks
              WHERE tenant_id = $1 AND talk_id = $2
                AND state IN ('live','reconnecting','ended')
           )
         RETURNING tenant_id, talk_id, comment_id, author_user_id, author_name, body, created_at`,
        [
          input.tenantId,
          input.talkId,
          input.commentId,
          input.authorUserId,
          input.authorName,
          input.body,
          input.createdAt,
        ],
      );
      return result.rows[0] ? mapComment(result.rows[0]) : null;
    },
  });
}
