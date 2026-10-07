import type { TalkDiscoveryItem } from "../talks/model.js";
import type {
  TalkSearchPerson,
  TalkSearchPersona,
  TalkSearchPersonaKind,
  TalkSearchRepository,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkSearchSqlPool {
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
  state: "live" | "reconnecting" | "ended";
  listener_count: string | number;
  duration_seconds: string | number | null;
  host_avatar_url: string | null;
  comment_count: string | number;
}

interface PersonRow extends Record<string, unknown> {
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  live_talk_id: string | null;
}

interface PersonaRow extends Record<string, unknown> {
  public_id: string;
  display_name: string;
  kind: TalkSearchPersonaKind;
  seat_fee_label: string;
  is_available: boolean;
  role: string;
  avatar_url: string | null;
  is_verified: boolean;
}

function escapedLike(query: string): string {
  return query.replace(/[\\%_]/gu, "\\$&");
}

function talk(row: TalkRow): TalkDiscoveryItem {
  return Object.freeze({
    id: row.talk_id,
    title: row.title,
    summary: row.summary,
    hostName: row.host_name,
    topic: row.topic,
    heroImageUrl: null,
    hostAvatarUrl: row.host_avatar_url,
    isLive: row.state === "live",
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

function person(row: PersonRow): TalkSearchPerson {
  return Object.freeze({
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    isLive: row.live_talk_id !== null,
    liveTalkId: row.live_talk_id,
  });
}

function persona(row: PersonaRow): TalkSearchPersona {
  return Object.freeze({
    publicId: row.public_id,
    displayName: row.display_name,
    kind: row.kind,
    seatFeeLabel: row.seat_fee_label,
    isAvailable: row.is_available,
    role: row.role,
    avatarUrl: row.avatar_url,
    isVerified: row.is_verified,
  });
}

export function createPostgresTalkSearchRepository(
  pool: TalkSearchSqlPool,
): TalkSearchRepository {
  return Object.freeze({
    async searchTalks(input) {
      const escaped = escapedLike(input.query);
      const contains = `%${escaped}%`;
      const prefix = `${escaped}%`;
      const result = await pool.query<TalkRow>(
        `SELECT
           t.talk_id, t.host_user_id, t.host_name, t.title, t.topic, t.summary,
           t.state, t.listener_count, t.duration_seconds,
           hp.avatar_url AS host_avatar_url,
           (SELECT count(*)::int
              FROM talks.comments c
             WHERE c.tenant_id = t.tenant_id
               AND c.talk_id = t.talk_id) AS comment_count
         FROM talks.talks t
         LEFT JOIN talks.public_profiles hp
           ON hp.tenant_id = t.tenant_id
          AND hp.user_id = t.host_user_id
        WHERE t.tenant_id = $1
          AND t.state IN ('live','reconnecting','ended')
          AND (
            t.state <> 'ended'
            OR EXISTS (
              SELECT 1
                FROM talks.replays replay
               WHERE replay.tenant_id=t.tenant_id
                 AND replay.talk_id=t.talk_id
                 AND replay.provider_status='complete'
                 AND replay.session_json->>'publicationState'='published'
            )
          )
          AND (
            t.title ILIKE $2 ESCAPE '\\'
            OR t.topic ILIKE $2 ESCAPE '\\'
            OR t.summary ILIKE $2 ESCAPE '\\'
            OR t.host_name ILIKE $2 ESCAPE '\\'
          )
        ORDER BY
          CASE t.state WHEN 'live' THEN 0 WHEN 'reconnecting' THEN 1 ELSE 2 END,
          CASE
            WHEN lower(t.title) = lower($3) THEN 0
            WHEN lower(t.host_name) = lower($3) THEN 1
            WHEN t.title ILIKE $4 ESCAPE '\\' THEN 2
            WHEN t.host_name ILIKE $4 ESCAPE '\\' THEN 3
            WHEN t.topic ILIKE $4 ESCAPE '\\' THEN 4
            ELSE 5
          END,
          t.listener_count DESC,
          COALESCE(t.started_at, t.created_at) DESC,
          t.talk_id ASC
        LIMIT $5`,
        [input.tenantId, contains, input.query, prefix, input.limit],
      );
      return Object.freeze(result.rows.map(talk));
    },

    async searchPeople(input) {
      const escaped = escapedLike(input.query);
      const contains = `%${escaped}%`;
      const prefix = `${escaped}%`;
      const result = await pool.query<PersonRow>(
        `SELECT
           p.handle, p.display_name, p.bio, p.avatar_url,
           CASE WHEN live.state = 'live' THEN p.live_talk_id ELSE NULL END
             AS live_talk_id
         FROM talks.public_profiles p
         LEFT JOIN talks.talks live
           ON live.tenant_id = p.tenant_id
          AND live.talk_id = p.live_talk_id
          AND live.state = 'live'
        WHERE p.tenant_id = $1
          AND (
            p.handle ILIKE $2 ESCAPE '\\'
            OR p.display_name ILIKE $2 ESCAPE '\\'
            OR p.bio ILIKE $2 ESCAPE '\\'
          )
        ORDER BY
          CASE WHEN live.state = 'live' THEN 0 ELSE 1 END,
          CASE
            WHEN lower(p.handle) = lower($3) THEN 0
            WHEN lower(p.display_name) = lower($3) THEN 1
            WHEN p.handle ILIKE $4 ESCAPE '\\' THEN 2
            WHEN p.display_name ILIKE $4 ESCAPE '\\' THEN 3
            ELSE 4
          END,
          p.updated_at DESC,
          p.handle ASC
        LIMIT $5`,
        [input.tenantId, contains, input.query, prefix, input.limit],
      );
      return Object.freeze(result.rows.map(person));
    },

    async searchPersonas(input) {
      const escaped = escapedLike(input.query);
      const contains = `%${escaped}%`;
      const prefix = `${escaped}%`;
      const result = await pool.query<PersonaRow>(
        `SELECT
           p.public_id, p.display_name, p.kind, p.seat_fee_label,
           p.is_available, p.role, p.avatar_url, p.is_verified
         FROM talks.persona_profiles p
         LEFT JOIN identity.twin_profiles twin
           ON twin.tenant_id = p.tenant_id
          AND twin.public_id = p.public_id
          AND twin.discoverable = true
        WHERE p.tenant_id = $1
          AND ($3::text IS NULL OR p.kind = $3)
          AND (p.kind <> 'expert' OR p.is_verified = true)
          AND (p.kind <> 'twin' OR twin.public_id IS NOT NULL)
          AND (
            p.display_name ILIKE $2 ESCAPE '\\'
            OR p.role ILIKE $2 ESCAPE '\\'
            OR p.bio ILIKE $2 ESCAPE '\\'
            OR p.topics_json::text ILIKE $2 ESCAPE '\\'
          )
        ORDER BY
          CASE WHEN p.is_available THEN 0 ELSE 1 END,
          CASE WHEN p.is_verified THEN 0 ELSE 1 END,
          CASE
            WHEN lower(p.display_name) = lower($4) THEN 0
            WHEN p.display_name ILIKE $5 ESCAPE '\\' THEN 1
            WHEN p.role ILIKE $5 ESCAPE '\\' THEN 2
            ELSE 3
          END,
          p.updated_at DESC,
          p.public_id ASC
        LIMIT $6`,
        [
          input.tenantId,
          contains,
          input.kind ?? null,
          input.query,
          prefix,
          input.limit,
        ],
      );
      return Object.freeze(result.rows.map(persona));
    },
  });
}
