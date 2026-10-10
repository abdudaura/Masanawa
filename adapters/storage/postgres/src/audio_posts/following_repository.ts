import type { Pool, PoolClient } from "pg";
import type { AudioPostRecord, PublicFeedPage } from "../../../../../services/gateway/src/audio_posts/contract.js";
import type { FollowingRepository } from "../../../../../services/gateway/src/audio_posts/following.js";
import type { PostVisibility } from "./repository.js";

/** Uses the same creator IDs as audio_posts; AF00 owns installing the SQL proposal. */
type Creator = { author_id: string; author_kind: "human" | "masana"; author_account_id: string };
type PostRow = {
  tenant_id: string; post_id: string; author_id: string; author_account_id: string;
  author_kind: "human" | "masana"; asset_id: string; request_id: string;
  title: string; duration_ms: number; status: AudioPostRecord["status"];
  revision: number; created_at: Date | string; published_at: Date | string | null;
  like_count?: number | string; comment_count?: number | string;
  /** Exact six-digit timestamp returned as SQL text; pg Date truncates microseconds. */
  cursor_time: string;
};
const postColumns = "p.tenant_id,p.post_id,p.author_id,p.author_account_id,p.author_kind,p.asset_id,p.request_id,p.title,p.duration_ms,p.status,p.revision,p.created_at,p.published_at" +
  // One canonical reaction/comment authority, matching Discover/Saved/My Talks.
  ",(SELECT COUNT(*)::int FROM social.audio_post_reactions r2 " +
  "WHERE r2.tenant_id=p.tenant_id AND r2.post_id=p.post_id AND r2.kind='like') AS like_count" +
  ",(SELECT COUNT(*)::int FROM social.audio_post_comments c " +
  "WHERE c.tenant_id=p.tenant_id AND c.post_id=p.post_id AND c.removed=false) AS comment_count";
const cursorStampSql = "to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_time";
const toDate = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();
function record(r: PostRow): AudioPostRecord {
  return {
    tenantId: r.tenant_id, postId: r.post_id, authorId: r.author_id,
    authorAccountId: r.author_account_id, authorKind: r.author_kind,
    assetId: r.asset_id, requestId: r.request_id, title: r.title,
    durationMs: Number(r.duration_ms), status: r.status, revision: Number(r.revision),
    createdAt: toDate(r.created_at),
    publishedAt: r.published_at === null ? null : toDate(r.published_at),
    likeCount: Number(r.like_count ?? 0), commentCount: Number(r.comment_count ?? 0),
  };
}
// Opaque cursor retains the full PostgreSQL microseconds; do not parse pg's
// Date instance for a keyset boundary or pages can silently skip newer rows.
const stampRe = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z$/;
const idRe = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function validStamp(stamp: string): boolean {
  if (!stampRe.test(stamp)) return false;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return false;
  // Reject normalized invalid dates while permitting the three extra micros.
  return new Date(parsed).toISOString().slice(0, 23) === stamp.slice(0, 23);
}
function cursor(r: PostRow): string {
  if (!validStamp(r.cursor_time) || !idRe.test(r.post_id)) {
    throw Error("audio_posts.invalid_following_row");
  }
  return Buffer.from(JSON.stringify([r.cursor_time, r.post_id])).toString("base64url");
}
function parseCursor(value: string | null): { created: string; id: string } | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length < 12 || value.length > 256 ||
      !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("audio_posts.invalid_following_cursor");
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.toString("base64url") !== value) throw Error("noncanonical");
    const parsed: unknown = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 ||
        typeof parsed[0] !== "string" || typeof parsed[1] !== "string" ||
        !validStamp(parsed[0]) || !idRe.test(parsed[1])) {
      throw Error("malformed");
    }
    return { created: parsed[0], id: parsed[1] };
  } catch {
    throw Error("audio_posts.invalid_following_cursor");
  }
}
async function transactional<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
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

export function createPostgresFollowingRepository(
  pool: Pool, visibility: PostVisibility,
): FollowingRepository {
  return {
    async setFromVisiblePost({ tenantId, accountId, postId, enabled }) {
      return transactional(pool, async db => {
        // Lock the publication row against concurrent removal while resolving creator.
        const r = await db.query<Creator>(
          "SELECT author_id,author_kind,author_account_id FROM social.audio_posts " +
          "WHERE tenant_id=$1 AND post_id=$2 AND status='published' FOR SHARE",
          [tenantId, postId],
        );
        const author = r.rows[0];
        if (!author || author.author_account_id === accountId) return null;
        // This is the established privacy/block policy, not a second follow ACL.
        const allowed = await visibility.canView({
          tenantId, viewerId: accountId, authorAccountId: author.author_account_id,
        });
        if (!allowed) return null;
        if (enabled) {
          await db.query(
            "INSERT INTO social.audio_post_follows " +
            "(tenant_id,follower_account_id,author_id,author_kind) VALUES ($1,$2,$3,$4) " +
            "ON CONFLICT DO NOTHING",
            [tenantId, accountId, author.author_id, author.author_kind],
          );
        } else {
          await db.query(
            "DELETE FROM social.audio_post_follows WHERE tenant_id=$1 AND " +
            "follower_account_id=$2 AND author_id=$3 AND author_kind=$4",
            [tenantId, accountId, author.author_id, author.author_kind],
          );
        }
        return { authorId: author.author_id, authorKind: author.author_kind, following: enabled };
      });
    },
    async statusFromVisiblePost({ tenantId, accountId, postId }) {
      const r = await pool.query<Creator>(
        "SELECT author_id,author_kind,author_account_id FROM social.audio_posts " +
        "WHERE tenant_id=$1 AND post_id=$2 AND status='published'",
        [tenantId, postId],
      );
      const author = r.rows[0];
      if (!author || author.author_account_id === accountId) return null;
      if (!await visibility.canView({
        tenantId, viewerId: accountId, authorAccountId: author.author_account_id,
      })) return null;
      const result = await pool.query<{ following: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM social.audio_post_follows WHERE " +
        "tenant_id=$1 AND follower_account_id=$2 AND author_id=$3 AND author_kind=$4) AS following",
        [tenantId, accountId, author.author_id, author.author_kind],
      );
      return {
        authorId: author.author_id,
        authorKind: author.author_kind,
        following: result.rows[0]?.following === true,
      };
    },
    async creatorFeed({ tenantId, viewerId, authorId, authorKind, limit, cursor: from }) {
      const seek = parseCursor(from);
      const batchSize = Math.min(limit * 3, 90);
      const rows = await pool.query<PostRow>(
        "SELECT " + postColumns + "," + cursorStampSql + " FROM social.audio_posts p " +
        "WHERE p.tenant_id=$1 AND p.author_id=$2 AND p.author_kind=$3 " +
        "AND p.status='published' AND ($4::timestamptz IS NULL OR " +
        "(p.created_at,p.post_id)<($4::timestamptz,$5::text)) " +
        "ORDER BY p.created_at DESC,p.post_id DESC LIMIT $6",
        [tenantId, authorId, authorKind, seek?.created ?? null, seek?.id ?? null, batchSize],
      );
      const visible: AudioPostRecord[] = [];
      let scanned = 0;
      for (const r of rows.rows) {
        scanned++;
        if (await visibility.canView({
          tenantId, viewerId, authorAccountId: r.author_account_id,
        })) visible.push(record(r));
        if (visible.length >= limit) break;
      }
      const hasMore = scanned < rows.rows.length || rows.rows.length === batchSize;
      return {
        items: visible,
        nextCursor: hasMore && scanned ? cursor(rows.rows[scanned - 1]!) : null,
      } satisfies PublicFeedPage;
    },
    async feed({ tenantId, viewerId, limit, cursor: from }) {
      const seek = parseCursor(from);
      const batchSize = Math.min(limit * 3, 90);
      const rows = await pool.query<PostRow>(
        "SELECT " + postColumns + "," + cursorStampSql + " FROM social.audio_posts p " +
        "JOIN social.audio_post_follows f ON f.tenant_id=p.tenant_id " +
        "AND f.author_id=p.author_id AND f.author_kind=p.author_kind " +
        "AND f.follower_account_id=$2 " +
        "WHERE p.tenant_id=$1 AND p.status='published' " +
        "AND ($3::timestamptz IS NULL OR " +
        "(p.created_at,p.post_id)<($3::timestamptz,$4::text)) " +
        "ORDER BY p.created_at DESC,p.post_id DESC LIMIT $5",
        [tenantId, viewerId, seek?.created ?? null, seek?.id ?? null, batchSize],
      );
      const visible: AudioPostRecord[] = [];
      let scanned = 0;
      for (const r of rows.rows) {
        scanned++;
        if (await visibility.canView({
          tenantId, viewerId, authorAccountId: r.author_account_id,
        })) visible.push(record(r));
        if (visible.length >= limit) break;
      }
      const hasMore = scanned < rows.rows.length || rows.rows.length === batchSize;
      return {
        items: visible,
        nextCursor: hasMore && scanned ? cursor(rows.rows[scanned - 1]!) : null,
      } satisfies PublicFeedPage;
    },
  };
}
