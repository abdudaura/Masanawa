import type { Pool, PoolClient } from "pg";
import type {
  AudioPostProcessingQueue, PendingAudioPost,
} from "@masanawa/contracts";

type PendingRow = {
  tenant_id: string; post_id: string; revision: number;
  created_at: Date | string;
};
// PostgreSQL TIMESTAMPTZ has microsecond precision. pg's default Date parser
// truncates it to milliseconds; that loses keyset rows sharing a millisecond.
const microsecondUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
function asDate(raw: Date | string): string {
  if (typeof raw === "string") {
    if (!microsecondUtc.test(raw) || !Number.isFinite(Date.parse(raw))) {
      throw new Error("audio_posts.invalid_pending_time");
    }
    return raw; // Keep all six digits in SQL cursors, never Date-round them.
  }
  if (!(raw instanceof Date) || !Number.isFinite(raw.getTime())) {
    throw new Error("audio_posts.invalid_pending_time");
  }
  // Compatibility for mocked/legacy Date rows; SQL below always returns text.
  return raw.toISOString().replace(/Z$/, "000Z");
}
function cursorEncode(row: PendingRow): string {
  return Buffer.from(JSON.stringify([asDate(row.created_at), row.post_id])).toString("base64url");
}
function cursorDecode(raw: string | null): [string, string] | null {
  if (raw === null) return null;
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(raw)) {
    throw new Error("audio_posts.invalid_processing_cursor");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")); }
  catch { throw new Error("audio_posts.invalid_processing_cursor"); }
  if (!Array.isArray(parsed) || parsed.length !== 2 ||
      typeof parsed[0] !== "string" || !microsecondUtc.test(parsed[0]) ||
      !Number.isFinite(Date.parse(parsed[0])) ||
      typeof parsed[1] !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(parsed[1])) {
    throw new Error("audio_posts.invalid_processing_cursor");
  }
  return [parsed[0], parsed[1]];
}

/** Adapter uses existing social.audio_posts, no new schema or queue authority.
 * Advisory session locks avoid concurrent moderation across worker processes.
 * If unlock fails the connection is discarded, not returned with a live lock.
 */
export function createPostgresAudioPostProcessingQueue(pool: Pool): AudioPostProcessingQueue {
  return {
    async listPending({ tenantId, cursor, limit }) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30) {
        throw new Error("audio_posts.invalid_processing_limit");
      }
      const after = cursorDecode(cursor);
      const response = await pool.query<PendingRow>(
        `SELECT tenant_id,post_id,revision,
                to_char(created_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
         FROM social.audio_posts
         WHERE tenant_id=$1 AND status='processing'
           AND ($2::timestamptz IS NULL OR (created_at,post_id) < ($2::timestamptz,$3))
         ORDER BY created_at DESC,post_id DESC LIMIT $4`,
        [tenantId, after?.[0] ?? null, after?.[1] ?? "", limit + 1],
      );
      const visible = response.rows.slice(0, limit);
      const items: PendingAudioPost[] = visible.map(row => ({
        tenantId: row.tenant_id, postId: row.post_id,
        revision: Number(row.revision), createdAt: asDate(row.created_at),
      }));
      return {
        items,
        nextCursor: response.rows.length > limit && visible.length
          ? cursorEncode(visible[visible.length - 1]!) : null,
      };
    },
    async withLease<T>({ tenantId, postId }: { tenantId: string; postId: string }, work: () => Promise<T>): Promise<T | null> {
      const connection: PoolClient = await pool.connect();
      let owned = false, discard = false;
      try {
        const result = await connection.query<{ acquired: boolean }>(
          "SELECT pg_try_advisory_lock(hashtext($1::text),hashtext($2::text)) AS acquired",
          [tenantId, postId],
        );
        owned = result.rows[0]?.acquired === true;
        if (!owned) return null;
        return await work();
      } finally {
        if (owned) {
          try {
            const unlocked = await connection.query<{ released: boolean }>(
              "SELECT pg_advisory_unlock(hashtext($1::text),hashtext($2::text)) AS released",
              [tenantId, postId],
            );
            if (unlocked.rows[0]?.released !== true) discard = true;
          } catch { discard = true; }
        }
        connection.release(discard ? new Error("audio_posts.lock_release_failed") : undefined);
      }
    },
  };
}
