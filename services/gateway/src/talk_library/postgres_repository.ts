import type { TalkDiscoveryItem } from "../talks/model.js";
import type {
  MyTalksView,
  TalkDraftPreview,
  TalkLibraryRepository,
  TalkSavedState,
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
  talk_id: string;
  host_user_id: string;
  host_name: string;
  title: string;
  topic: string;
  summary: string;
  state: "draft" | "live" | "reconnecting" | "ended";
  listener_count: string | number;
  duration_seconds: string | number | null;
  updated_at: string | Date;
  host_avatar_url: string | null;
  comment_count: string | number;
  saved_at?: string | Date;
}

interface SavedRow extends Record<string, unknown> {
  saved: boolean;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function discovery(row: TalkRow): TalkDiscoveryItem {
  return Object.freeze({
    id: row.talk_id,
    title: row.title,
    summary: row.summary,
    hostName: row.host_name,
    topic: row.topic,
    heroImageUrl: null,
    hostAvatarUrl: row.host_avatar_url,
    isLive: row.state === "live" || row.state === "reconnecting",
    listenerCount: Number(row.listener_count),
    commentCount: Number(row.comment_count),
    durationSeconds:
      row.duration_seconds === null ? null : Number(row.duration_seconds),
    participants: Object.freeze([
      Object.freeze({
        id: row.host_user_id,
        name: row.host_name,
        kind: "human" as const,
        avatarUrl: row.host_avatar_url,
        isHost: true,
      }),
    ]),
  });
}

function draft(row: TalkRow): TalkDraftPreview {
  return Object.freeze({
    id: row.talk_id,
    topic: row.topic,
    title: row.title,
    updatedAt: iso(row.updated_at),
  });
}

const projection = `
  t.talk_id, t.host_user_id, t.host_name, t.title, t.topic, t.summary,
  t.state, t.listener_count, t.duration_seconds, t.updated_at,
  hp.avatar_url AS host_avatar_url,
  (SELECT count(*)::int
     FROM talks.comments c
    WHERE c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id) AS comment_count
`;

export function createPostgresTalkLibraryRepository(
  pool: TalkLibrarySqlPool,
): TalkLibraryRepository {
  return Object.freeze({
    async loadMine(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${projection}
           FROM talks.talks t
           LEFT JOIN talks.public_profiles hp
             ON hp.tenant_id = t.tenant_id
            AND hp.user_id = t.host_user_id
          WHERE t.tenant_id = $1
            AND t.host_user_id = $2
            AND t.state IN ('draft','live','reconnecting','ended')
          ORDER BY
            CASE t.state
              WHEN 'live' THEN 0
              WHEN 'reconnecting' THEN 1
              WHEN 'ended' THEN 2
              ELSE 3
            END,
            t.updated_at DESC,
            t.talk_id ASC
          LIMIT $3`,
        [input.tenantId, input.userId, input.limit],
      );

      const live: TalkDiscoveryItem[] = [];
      const replays: TalkDiscoveryItem[] = [];
      const drafts: TalkDraftPreview[] = [];

      for (const row of result.rows) {
        if (row.state === "draft") {
          drafts.push(draft(row));
        } else if (row.state === "ended") {
          replays.push(discovery(row));
        } else {
          live.push(discovery(row));
        }
      }

      return Object.freeze({
        live: Object.freeze(live),
        replays: Object.freeze(replays),
        drafts: Object.freeze(drafts),
      } satisfies MyTalksView);
    },

    async loadSaved(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${projection}, s.saved_at
           FROM talks.saved_talks s
           JOIN talks.talks t
             ON t.tenant_id = s.tenant_id
            AND t.talk_id = s.talk_id
           LEFT JOIN talks.public_profiles hp
             ON hp.tenant_id = t.tenant_id
            AND hp.user_id = t.host_user_id
          WHERE s.tenant_id = $1
            AND s.user_id = $2
            AND t.state IN ('live','reconnecting','ended')
          ORDER BY s.saved_at DESC, t.talk_id ASC
          LIMIT $3`,
        [input.tenantId, input.userId, input.limit],
      );
      return Object.freeze(result.rows.map(discovery));
    },

    async savedState(input) {
      const result = await pool.query<SavedRow>(
        `SELECT EXISTS (
           SELECT 1
             FROM talks.saved_talks s
            WHERE s.tenant_id = t.tenant_id
              AND s.user_id = $3
              AND s.talk_id = t.talk_id
         ) AS saved
           FROM talks.talks t
          WHERE t.tenant_id = $1
            AND t.talk_id = $2
            AND t.state IN ('live','reconnecting','ended')
          LIMIT 1`,
        [input.tenantId, input.talkId, input.userId],
      );
      return result.rows[0]
        ? Object.freeze({ saved: result.rows[0].saved })
        : null;
    },

    async setSaved(input) {
      if (input.saved) {
        const inserted = await pool.query<SavedRow>(
          `WITH saved AS (
             INSERT INTO talks.saved_talks AS existing (
               tenant_id, user_id, talk_id, saved_at
             )
             SELECT $1,$2,$3,$4
               FROM talks.talks t
              WHERE t.tenant_id = $1
                AND t.talk_id = $3
                AND t.state IN ('live','reconnecting','ended')
             ON CONFLICT (tenant_id, user_id, talk_id) DO UPDATE
               SET saved_at = existing.saved_at
             RETURNING true AS saved
           )
           SELECT saved FROM saved`,
          [input.tenantId, input.userId, input.talkId, input.changedAt],
        );
        return inserted.rows[0]
          ? Object.freeze({ saved: true })
          : null;
      }

      await pool.query(
        `DELETE FROM talks.saved_talks
          WHERE tenant_id = $1 AND user_id = $2 AND talk_id = $3`,
        [input.tenantId, input.userId, input.talkId],
      );

      const visible = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM talks.talks
            WHERE tenant_id = $1
              AND talk_id = $2
              AND state IN ('live','reconnecting','ended')
         ) AS exists`,
        [input.tenantId, input.talkId],
      );
      return visible.rows[0]?.exists
        ? Object.freeze({ saved: false })
        : null;
    },
  });
}
