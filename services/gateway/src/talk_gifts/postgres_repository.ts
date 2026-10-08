import type {
  TalkGiftRepository,
  TalkGiftTarget,
} from "./model.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface TalkGiftSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface GiftTargetRow extends Record<string, unknown> {
  talk_id: string;
  title: string;
  host_user_id: string;
  host_name: string;
}

function target(row: GiftTargetRow): TalkGiftTarget {
  return Object.freeze({
    talkId: row.talk_id,
    talkTitle: row.title,
    hostUserId: row.host_user_id,
    hostName: row.host_name,
  });
}

export function createPostgresTalkGiftRepository(
  pool: TalkGiftSqlPool,
): TalkGiftRepository {
  return Object.freeze<TalkGiftRepository>({
    async resolveTarget(input) {
      const result = await pool.query<GiftTargetRow>(
        `SELECT t.talk_id, t.title, t.host_user_id, t.host_name
           FROM talks.talks t
          WHERE t.tenant_id = $1
            AND t.talk_id = $2
            AND (
              t.state IN ('live','reconnecting')
              OR (
                t.state = 'ended'
                AND EXISTS (
                  SELECT 1
                    FROM talks.replay_sessions r
                   WHERE r.tenant_id = t.tenant_id
                     AND r.talk_id = t.talk_id
                     AND r.recording_state = 'finalized'
                     AND r.publication_state = 'published'
                     AND NOT EXISTS (
                       SELECT 1 FROM talks.safety_enforcement se
                        WHERE se.tenant_id = r.tenant_id
                          AND se.target_kind = 'replay'
                          AND se.target_id = r.recording_id
                          AND se.visibility IN ('restricted','blocked')
                     )
                )
              )
            )
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               WHERE se.tenant_id = t.tenant_id
                 AND se.target_kind = 'talk'
                 AND se.target_id = t.talk_id
                 AND se.visibility IN ('restricted','blocked')
            )
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_enforcement se
               JOIN talks.public_profiles hp
                 ON hp.tenant_id = se.tenant_id
                AND hp.user_id = t.host_user_id
                AND hp.handle = se.target_id
               WHERE se.tenant_id = t.tenant_id
                 AND se.target_kind = 'profile'
                 AND se.visibility IN ('restricted','blocked')
            )
            AND NOT EXISTS (
              SELECT 1 FROM talks.safety_preferences sp
               WHERE sp.tenant_id = t.tenant_id
                 AND sp.blocked = TRUE
                 AND (
                   (sp.viewer_user_id = $3 AND sp.subject_user_id = t.host_user_id)
                   OR
                   (sp.viewer_user_id = t.host_user_id AND sp.subject_user_id = $3)
                 )
            )
          LIMIT 1`,
        [input.tenantId, input.talkId, input.senderUserId],
      );
      return result.rows[0] ? target(result.rows[0]) : null;
    },
  });
}

