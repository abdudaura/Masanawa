import type {
  ReplayInsightClaim, ReplayInsightDraft, ReplayInsightRepository,
  ReplayInsightSource, ReplayInsightView,
} from "./model.js";

export interface InsightSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}
interface SourceRow extends Record<string, unknown> {
  tenant_id: string; talk_id: string; recording_id: string;
  checksum_sha256: string; revision: number;
}
interface InsightRow extends Record<string, unknown> {
  talk_id: string; recording_id: string; status: "processing" | "ready" | "failed";
  summary: string | null; highlights: unknown; next_talk_title: string | null;
  updated_at: Date | string;
}
/** Eligibility is checked again for every read and write. Never trust a stale R13 view. */
const ELIGIBLE = `
  FROM talks.talks t
  JOIN talks.replay_sessions r
    ON r.tenant_id=t.tenant_id AND r.talk_id=t.talk_id
  JOIN talks.replay_media_jobs m
    ON m.tenant_id=r.tenant_id AND m.talk_id=r.talk_id
   AND m.recording_id=r.recording_id
 WHERE t.tenant_id=$1 AND t.talk_id=$3 AND t.host_user_id=$2
   AND t.state='ended'
   AND r.recording_state='finalized' AND r.publication_state <> 'blocked'
   AND r.session_json->>'hostRecordingConsent'='true'
   AND m.status='ready' AND m.checksum_sha256 IS NOT NULL
   AND m.checksum_sha256 ~ '^[a-fA-F0-9]{64}$'
   AND NOT EXISTS (
      SELECT 1 FROM talks.safety_enforcement se
       WHERE se.tenant_id=t.tenant_id
         AND ((se.target_kind='talk' AND se.target_id=t.talk_id)
           OR (se.target_kind='replay' AND se.target_id=r.recording_id))
         AND se.visibility IN ('restricted','blocked')
   )`;
const AVAILABLE = `SELECT r.tenant_id,r.talk_id,r.recording_id,
  m.checksum_sha256,r.revision ${ELIGIBLE}`;
function toView(row: InsightRow): ReplayInsightView {
  const highlights = Array.isArray(row.highlights)
    ? row.highlights.filter((value): value is string => typeof value === "string")
    : [];
  return Object.freeze({
    talkId: row.talk_id, recordingId: row.recording_id,
    status: row.status,
    summary: row.status === "ready" ? row.summary : null,
    highlights: row.status === "ready" ? Object.freeze(highlights) : Object.freeze([]),
    nextTalkTitle: row.status === "ready" ? row.next_talk_title : null,
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}
export function createPostgresReplayInsightRepository(pool: InsightSqlPool): ReplayInsightRepository {
  return Object.freeze({
    async source(tenantId, userId, talkId) {
      const response = await pool.query<SourceRow>(AVAILABLE + " LIMIT 1", [tenantId, userId, talkId]);
      const source = response.rows[0];
      return source ? Object.freeze({
        tenantId: source.tenant_id, talkId: source.talk_id,
        recordingId: source.recording_id, checksumSha256: source.checksum_sha256,
        replayRevision: Number(source.revision),
      }) : null;
    },
    async read(tenantId, userId, talkId) {
      const result = await pool.query<InsightRow>(`
        SELECT i.talk_id,i.recording_id,i.status,i.summary,i.highlights,
               i.next_talk_title,i.updated_at
          FROM talks.post_session_insights i
          JOIN ( ${AVAILABLE} ) allowed
            ON allowed.tenant_id=i.tenant_id AND allowed.talk_id=i.talk_id
           AND allowed.recording_id=i.recording_id
           AND allowed.checksum_sha256=i.media_checksum
         WHERE i.tenant_id=$1 AND i.talk_id=$3 AND i.host_user_id=$2
           AND i.consented_at > now() - interval '30 days'
         LIMIT 1`, [tenantId, userId, talkId]);
      return result.rows[0] ? toView(result.rows[0]) : null;
    },
    async claim(source: ReplayInsightSource, userId: string, token: string) {
      const result = await pool.query(`
        INSERT INTO talks.post_session_insights (
          tenant_id,talk_id,recording_id,host_user_id,media_checksum,
          status,lease_token,lease_until,consented_at,updated_at
        )
        SELECT r.tenant_id,r.talk_id,r.recording_id,$2,m.checksum_sha256,
               'processing',$6,now()+interval '60 seconds',now(),now()
          ${ELIGIBLE}
          AND r.recording_id=$4 AND m.checksum_sha256=$5
        ON CONFLICT(tenant_id,talk_id) DO UPDATE SET
          recording_id=EXCLUDED.recording_id,
          media_checksum=EXCLUDED.media_checksum,
          host_user_id=EXCLUDED.host_user_id,
          status='processing',lease_token=EXCLUDED.lease_token,
          lease_until=EXCLUDED.lease_until,consented_at=now(),updated_at=now(),
          summary=NULL,highlights='[]'::jsonb,next_talk_title=NULL
        WHERE talks.post_session_insights.recording_id <> EXCLUDED.recording_id
           OR talks.post_session_insights.media_checksum <> EXCLUDED.media_checksum
           OR (talks.post_session_insights.status='failed')
           OR (talks.post_session_insights.status='processing'
             AND talks.post_session_insights.lease_until < now())
           OR talks.post_session_insights.consented_at <= now()-interval '30 days'
        RETURNING 1`,
        [source.tenantId, userId, source.talkId, source.recordingId,
         source.checksumSha256, token]);
      return (result.rowCount ?? 0) === 1;
    },
    async complete(claim: ReplayInsightClaim, draft: ReplayInsightDraft) {
      const { source, leaseToken } = claim;
      const result = await pool.query(`
        UPDATE talks.post_session_insights i
           SET status='ready',lease_token=NULL,lease_until=NULL,
               summary=$7,highlights=$8::jsonb,next_talk_title=$9,
               updated_at=now()
         WHERE i.tenant_id=$1 AND i.talk_id=$3
           AND i.recording_id=$4 AND i.media_checksum=$5
           AND i.lease_token=$6 AND i.status='processing'
           AND i.lease_until>now()
           AND EXISTS (
             SELECT 1 FROM talks.talks t
             JOIN talks.replay_sessions r
               ON r.tenant_id=t.tenant_id AND r.talk_id=t.talk_id
             JOIN talks.replay_media_jobs m
               ON m.tenant_id=r.tenant_id AND m.talk_id=r.talk_id
               AND m.recording_id=r.recording_id
             WHERE t.tenant_id=$1 AND t.talk_id=$3
               AND t.host_user_id=i.host_user_id AND t.state='ended'
               AND r.recording_id=$4 AND m.checksum_sha256=$5
               AND m.status='ready' AND r.recording_state='finalized'
               AND r.publication_state<>'blocked'
               AND r.session_json->>'hostRecordingConsent'='true'
               AND NOT EXISTS (
                 SELECT 1 FROM talks.safety_enforcement se
                  WHERE se.tenant_id=$1
                    AND ((se.target_kind='talk' AND se.target_id=$3)
                      OR (se.target_kind='replay' AND se.target_id=$4))
                    AND se.visibility IN ('restricted','blocked')
               )
           )
         RETURNING 1`,
        [source.tenantId, null, source.talkId, source.recordingId,
         source.checksumSha256, leaseToken, draft.summary,
         JSON.stringify(draft.highlights), draft.nextTalkTitle]);
      return (result.rowCount ?? 0) === 1;
    },
    async fail(claim: ReplayInsightClaim) {
      const { source, leaseToken } = claim;
      await pool.query(`
        UPDATE talks.post_session_insights
           SET status='failed',lease_token=NULL,lease_until=NULL,
               summary=NULL,highlights='[]'::jsonb,next_talk_title=NULL,
               updated_at=now()
         WHERE tenant_id=$1 AND talk_id=$2 AND recording_id=$3
           AND lease_token=$4 AND status='processing'`,
        [source.tenantId, source.talkId, source.recordingId, leaseToken]);
    },
  });
}
