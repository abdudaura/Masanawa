import type { Pool, PoolClient } from "pg";

/** AF09 durable qualified-listen counter. AF00 allocates append-only SQL.
 * This adapter is the only authority for per-viewer/day uniqueness; a media
 * GET, ticket request or card impression never increments a play.
 */
export interface TalkListenStore {
  open(input: { tenantId: string; postId: string; viewerId: string; revision: number; durationMs: number }): Promise<string>;
  complete(input: { tenantId: string; postId: string; viewerId: string; listenId: string; playedMs: number;
    canView: (authorAccountId: string) => Promise<boolean> }): Promise<{ counted: boolean; listenCount: number }>;
}

async function withTransaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally { db.release(); }
}

const id = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function createPostgresTalkListenStore(pool: Pool): TalkListenStore {
  const counts = async (db: PoolClient, tenantId: string, postId: string): Promise<number> => {
    const result = await db.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM social.audio_post_listen_days WHERE tenant_id=$1 AND post_id=$2",
      [tenantId, postId]);
    const count = Number(result.rows[0]?.count ?? NaN);
    if (!Number.isSafeInteger(count) || count < 0) throw Error("audio_posts.listen_invalid_count");
    return count;
  };
  return {
    async open({ tenantId, postId, viewerId, revision, durationMs }) {
      if (![tenantId, postId, viewerId].every(id) ||
          !Number.isSafeInteger(revision) || revision < 0 ||
          !Number.isSafeInteger(durationMs) || durationMs < 1000 || durationMs > 180000) {
        throw Error("audio_posts.listen_invalid_input");
      }
      return withTransaction(pool, async db => {
        const row = await db.query<{listen_id:string}>(
          "INSERT INTO social.audio_post_listen_sessions " +
          "(tenant_id,post_id,viewer_account_id,post_revision,duration_ms) " +
          "SELECT tenant_id,post_id,$3,$4,$5 FROM social.audio_posts " +
          "WHERE tenant_id=$1 AND post_id=$2 AND revision=$4 AND status='published' " +
          "RETURNING listen_id",
          [tenantId,postId,viewerId,revision,durationMs]);
        if (!row.rows[0]) throw Error("audio_posts.listen_not_visible");
        return row.rows[0].listen_id;
      });
    },
    async complete({tenantId,postId,viewerId,listenId,playedMs,canView}) {
      if (![tenantId,postId,viewerId].every(id) || !uuid(listenId) ||
          !Number.isSafeInteger(playedMs) || playedMs < 0 || playedMs > 180000) {
        throw Error("audio_posts.listen_invalid_input");
      }
      return withTransaction(pool, async db => {
        const result = await db.query<{
          author_account_id:string; post_revision:number; duration_ms:number;
          issued_at:Date|string; expires_at:Date|string; accepted:boolean; counted:boolean;
          post_status:string|null; current_revision:number|null;
        }>(
          "SELECT p.author_account_id,s.post_revision,s.duration_ms,s.issued_at,s.expires_at," +
          "s.accepted,s.counted,p.status AS post_status,p.revision AS current_revision " +
          "FROM social.audio_post_listen_sessions s " +
          "JOIN social.audio_posts p ON p.tenant_id=s.tenant_id AND p.post_id=s.post_id " +
          "WHERE s.tenant_id=$1 AND s.post_id=$2 AND s.viewer_account_id=$3 AND s.listen_id=$4 FOR UPDATE OF s",
          [tenantId,postId,viewerId,listenId]);
        const row = result.rows[0];
        if (!row || row.post_status !== "published" ||
            row.current_revision !== row.post_revision ||
            !await canView(row.author_account_id)) throw Error("audio_posts.listen_not_visible");
        if (row.accepted) return { counted: row.counted, listenCount: await counts(db,tenantId,postId) };
        // Server wall clock limits self-reported progress; seek jumps and instant
        // "completed" requests cannot earn a listen. Only one/day is counted.
        const clock = await db.query<{elapsed:string;valid:boolean}>(
          "SELECT GREATEST(0,EXTRACT(EPOCH FROM (now()-$1::timestamptz))*1000)::text AS elapsed," +
          "now() <= $2::timestamptz AS valid",
          [row.issued_at,row.expires_at]);
        const elapsed = Number(clock.rows[0]?.elapsed);
        if (clock.rows[0]?.valid !== true || !Number.isFinite(elapsed)) {
          throw Error("audio_posts.listen_expired");
        }
        const threshold = Math.min(3000, Math.ceil(row.duration_ms * 0.75));
        if (playedMs < threshold || playedMs > row.duration_ms ||
            playedMs > elapsed + 1500) throw Error("audio_posts.listen_insufficient_progress");
        const added = await db.query(
          "INSERT INTO social.audio_post_listen_days " +
          "(tenant_id,post_id,viewer_account_id,listen_day) " +
          "VALUES($1,$2,$3,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING RETURNING post_id",
          [tenantId,postId,viewerId]);
        const counted = added.rows.length > 0;
        await db.query(
          "UPDATE social.audio_post_listen_sessions SET accepted=true,counted=$5 " +
          "WHERE tenant_id=$1 AND post_id=$2 AND viewer_account_id=$3 AND listen_id=$4",
          [tenantId,postId,viewerId,listenId,counted]);
        return { counted, listenCount: await counts(db,tenantId,postId) };
      });
    },
  };
}
