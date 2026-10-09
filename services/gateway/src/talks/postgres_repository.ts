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
  reaction_count?: string | number;
  followed_host?: boolean;
  participants_json?: unknown;
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


function mapParticipants(value: unknown): readonly import("./model.js").TalkParticipantPreview[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const participants = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const kind =
      row.kind === "expert" || row.kind === "twin" || row.kind === "human"
        ? row.kind
        : null;
    if (!id || !name || kind === null) return [];
    return [Object.freeze({
      id,
      name,
      kind,
      avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : null,
      isHost: false,
    })];
  });
  return Object.freeze(participants);
}

const participantProjectionSql = `
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', CASE WHEN s.kind='human' THEN s.user_id ELSE s.persona_id END,
        'name', s.display_name,
        'kind', s.kind,
        'avatarUrl', s.avatar_url,
        'isHost', false
      )
      ORDER BY s.admitted_at ASC, s.participant_id ASC
    )
      FROM talks.talk_seats s
     WHERE s.tenant_id=t.tenant_id
       AND s.talk_id=t.talk_id
       AND s.is_host=false
       AND (s.active=true OR t.state='ended')
       AND (
         (s.kind='human' AND s.user_id IS NOT NULL)
         OR
         (s.kind IN ('expert','twin') AND s.persona_id IS NOT NULL)
       )
  ), '[]'::jsonb) AS participants_json
`;

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
  return Object.freeze<TalkRepository>({
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
                ${participantProjectionSql},
                (SELECT count(*)::int FROM talks.comments c
                  WHERE c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id) AS comment_count,
                (SELECT count(*)::int FROM talks.participation p
                  WHERE p.tenant_id = t.tenant_id
                    AND p.talk_id = t.talk_id
                    AND p.reaction IS NOT NULL) AS reaction_count,
                EXISTS (
                  SELECT 1 FROM talks.follows f
                   WHERE f.tenant_id = t.tenant_id
                     AND f.follower_user_id = $3
                     AND f.followed_user_id = t.host_user_id
                ) AS followed_host
           FROM talks.talks t
          WHERE t.tenant_id = $1
            AND ($2::text = 'explore' OR t.state = 'live')
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_preferences sp
               WHERE sp.tenant_id = t.tenant_id
                 AND sp.viewer_user_id = $3
                 AND sp.subject_user_id = t.host_user_id
                 AND (sp.blocked OR sp.muted)
            )
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_preferences host_block
               WHERE host_block.tenant_id = t.tenant_id
                 AND host_block.viewer_user_id = t.host_user_id
                 AND host_block.subject_user_id = $3
                 AND host_block.blocked = TRUE
            )
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id = t.tenant_id
                 AND se.target_kind = 'talk'
                 AND se.target_id = t.talk_id
                 AND se.visibility IN ('restricted','blocked')
            )
            AND (
              state IN ('live','reconnecting')
              OR (
                state = 'ended'
                AND (
                  EXISTS (
                    SELECT 1 FROM talks.replay_sessions r
                     WHERE r.tenant_id=t.tenant_id
                       AND r.talk_id=t.talk_id
                       AND r.recording_state='finalized'
                       AND r.publication_state='published'
                       AND NOT EXISTS (
                         SELECT 1 FROM talks.safety_enforcement replay_se
                          WHERE replay_se.tenant_id=r.tenant_id
                            AND replay_se.target_kind='replay'
                            AND replay_se.target_id=r.recording_id
                            AND replay_se.visibility IN ('restricted','blocked')
                       )
                  )
                  OR NOT EXISTS (
                    SELECT 1 FROM talks.replay_sessions r
                     WHERE r.tenant_id=t.tenant_id
                       AND r.talk_id=t.talk_id
                  )
                )
              )
            )
          ORDER BY CASE WHEN state = 'live' THEN 0 ELSE 1 END,
                   COALESCE(started_at, created_at) DESC
          LIMIT $4`,
        [input.tenantId, input.feed, input.viewerUserId, input.limit],
      );
      return Object.freeze(result.rows.map((row) =>
        Object.freeze({
          talk: mapTalk(row),
          commentCount: Number(row.comment_count ?? 0),
          reactionCount: Number(row.reaction_count ?? 0),
          followedHost: row.followed_host === true,
          participants: mapParticipants(row.participants_json),
        })
      ));
    },

    async getTalk(input) {
      const result = await pool.query<TalkRow>(
        `SELECT ${talkColumns},
                ${participantProjectionSql},
                (SELECT count(*)::int FROM talks.comments c
                  WHERE c.tenant_id = t.tenant_id AND c.talk_id = t.talk_id) AS comment_count
           FROM talks.talks t
          WHERE t.tenant_id = $1 AND t.talk_id = $2
            AND (
              t.host_user_id = $3
              OR (
                NOT EXISTS (
                  SELECT 1 FROM talks.safety_preferences sp
                   WHERE sp.tenant_id = t.tenant_id
                     AND sp.viewer_user_id = $3
                     AND sp.subject_user_id = t.host_user_id
                     AND (sp.blocked OR sp.muted)
                )
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_preferences host_block
                   WHERE host_block.tenant_id = t.tenant_id
                     AND host_block.viewer_user_id = t.host_user_id
                     AND host_block.subject_user_id = $3
                     AND host_block.blocked = TRUE
                )
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_enforcement se
                 WHERE se.tenant_id = t.tenant_id
                   AND se.target_kind = 'talk'
                   AND se.target_id = t.talk_id
                   AND se.visibility IN ('restricted','blocked')
                )
              )
            )
            AND (
              t.state <> 'ended'
              OR host_user_id = $3
              OR EXISTS (
                SELECT 1 FROM talks.replay_sessions r
                 WHERE r.tenant_id=t.tenant_id
                   AND r.talk_id=t.talk_id
                   AND r.recording_state='finalized'
                   AND r.publication_state='published'
                   AND NOT EXISTS (
                     SELECT 1 FROM talks.safety_enforcement replay_se
                      WHERE replay_se.tenant_id=r.tenant_id
                        AND replay_se.target_kind='replay'
                        AND replay_se.target_id=r.recording_id
                        AND replay_se.visibility IN ('restricted','blocked')
                   )
              )
            )
          LIMIT 1`,
        [input.tenantId, input.talkId, input.viewerUserId],
      );
      const row = result.rows[0];
      return row
        ? Object.freeze({
            talk: mapTalk(row),
            commentCount: Number(row.comment_count ?? 0),
            participants: mapParticipants(row.participants_json),
          })
        : null;
    },

    async updateMetadata(input) {
      const result = await pool.query<TalkRow>(
        `UPDATE talks.talks
            SET title=COALESCE($4,title),
                topic=COALESCE($5,topic),
                summary=COALESCE($6,summary),
                updated_at=$7
          WHERE tenant_id=$1
            AND talk_id=$2
            AND host_user_id=$3
          RETURNING ${talkColumns}`,
        [
          input.tenantId,
          input.talkId,
          input.hostUserId,
          input.title ?? null,
          input.topic ?? null,
          input.summary ?? null,
          input.updatedAt,
        ],
      );
      return result.rows[0] ? mapTalk(result.rows[0]) : null;
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
             SELECT 1 FROM talks.talks t
              WHERE t.tenant_id = $1 AND t.talk_id = $2
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_preferences sp
                   WHERE sp.tenant_id = t.tenant_id
                     AND sp.viewer_user_id = $4
                     AND sp.subject_user_id = t.host_user_id
                     AND (sp.blocked OR sp.muted)
                )
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_preferences host_block
                   WHERE host_block.tenant_id = t.tenant_id
                     AND host_block.viewer_user_id = t.host_user_id
                     AND host_block.subject_user_id = $4
                     AND host_block.blocked
                )
                AND NOT EXISTS (
                  SELECT 1 FROM talks.safety_enforcement se
                   WHERE se.tenant_id = t.tenant_id
                     AND se.target_kind = 'talk'
                     AND se.target_id = t.talk_id
                     AND se.visibility IN ('restricted','blocked')
                )
                -- Comments are always public. Prevent new comments on
                -- restricted ended recordings, even from the Host.
                AND (
                  t.state <> 'ended' OR NOT EXISTS (
                    SELECT 1 FROM talks.replay_sessions hidden_r
                    JOIN talks.safety_enforcement hidden_se
                      ON hidden_se.tenant_id=hidden_r.tenant_id
                     AND hidden_se.target_kind='replay'
                     AND hidden_se.target_id=hidden_r.recording_id
                     AND hidden_se.visibility IN ('restricted','blocked')
                   WHERE hidden_r.tenant_id=t.tenant_id
                     AND hidden_r.talk_id=t.talk_id
                  )
                )
                AND (
                  t.state IN ('live','reconnecting')
                  OR (
                    t.state = 'ended'
                    AND (
                      t.host_user_id = $4
                      OR EXISTS (
                        SELECT 1 FROM talks.replay_sessions r
                         WHERE r.tenant_id=t.tenant_id
                           AND r.talk_id=t.talk_id
                           AND r.recording_state='finalized'
                           AND r.publication_state='published'
                           AND NOT EXISTS (
                             SELECT 1 FROM talks.safety_enforcement replay_se
                              WHERE replay_se.tenant_id=r.tenant_id
                                AND replay_se.target_kind='replay'
                                AND replay_se.target_id=r.recording_id
                                AND replay_se.visibility IN ('restricted','blocked')
                           )
                      )
                    )
                  )
                )
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

