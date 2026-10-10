import type { Pool, PoolClient } from "pg";
import type {
 AudioPostRecord, AudioPostRepository, NewAudioPost, PublicFeedPage,
} from "../../../../../services/gateway/src/audio_posts/contract.js";

/** Canonical profile/block/moderation authority supplied by Gateway composition.
 * Must fail closed when unavailable. Not a new blocklist database.
 */
export interface PostVisibility {
  canView(input: { tenantId: string; viewerId: string; authorAccountId: string }): Promise<boolean>;
}
type Row = {
 tenant_id: string; post_id: string; author_id: string; author_account_id: string;
 author_kind: "human" | "masana"; asset_id: string; request_id: string;
 title: string; duration_ms: number; status: AudioPostRecord["status"];
 revision: number; created_at: Date | string; published_at: Date | string | null;
 like_count?: number | string; comment_count?: number | string; listen_count?: number | string;
};
function date(value: Date | string): string {
 return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function map(row: Row): AudioPostRecord {
 return {
  tenantId: row.tenant_id, postId: row.post_id, authorId: row.author_id,
  authorAccountId: row.author_account_id, authorKind: row.author_kind,
  assetId: row.asset_id, requestId: row.request_id, title: row.title,
  durationMs: Number(row.duration_ms), status: row.status, revision: Number(row.revision),
  createdAt: date(row.created_at), publishedAt: row.published_at ? date(row.published_at) : null,
  likeCount: Number(row.like_count ?? 0), commentCount: Number(row.comment_count ?? 0),
  listenCount: Number(row.listen_count ?? 0),
 };
}
async function transaction<T>(pool: Pool, fn: (db: PoolClient) => Promise<T>): Promise<T> {
 const db = await pool.connect();
 try { await db.query("BEGIN"); const result = await fn(db); await db.query("COMMIT"); return result; }
 catch (err) { await db.query("ROLLBACK"); throw err; }
 finally { db.release(); }
}
const columns = "tenant_id,post_id,author_id,author_account_id,author_kind,asset_id,request_id,title,duration_ms,status,revision,created_at,published_at";
type CommentRow = {
 tenant_id: string; post_id: string; comment_id: string; author_account_id: string;
 request_id: string; body: string; created_at: Date | string; removed: boolean;
};
const commentColumns = "tenant_id,post_id,comment_id,author_account_id,request_id,body,created_at,removed";
function mapComment(row: CommentRow) {
 return {
  tenantId: row.tenant_id, postId: row.post_id, commentId: row.comment_id,
  authorAccountId: row.author_account_id, requestId: row.request_id,
  body: row.body, createdAt: date(row.created_at), removed: row.removed,
 };
}
const qualifiedColumns = columns.split(",").map(column => "p." + column).join(",");
const countColumns = qualifiedColumns +
  ",(SELECT COUNT(*)::int FROM social.audio_post_reactions r2 " +
  "WHERE r2.tenant_id=p.tenant_id AND r2.post_id=p.post_id AND r2.kind='like') AS like_count" +
  ",(SELECT COUNT(*)::int FROM social.audio_post_comments c " +
  "WHERE c.tenant_id=p.tenant_id AND c.post_id=p.post_id AND c.removed=false) AS comment_count" +
  ",(SELECT COUNT(*)::int FROM social.audio_post_listen_days l " +
  "WHERE l.tenant_id=p.tenant_id AND l.post_id=p.post_id) AS listen_count";
// PostgreSQL stores microseconds; pg's Date conversion truncates to milliseconds.
// The page cursor must retain the exact SQL timestamp so adjacent posts cannot
// silently disappear when multiple publications share the same millisecond.
const microsecondUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
function parseCursor(raw: string | null): { stamp: string; id: string } | null {
 if (raw === null) return null;
 if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(raw)) {
  throw new Error("audio_posts.invalid_cursor");
 }
 try {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  if (Buffer.from(decoded).toString("base64url") !== raw) throw new Error("invalid");
  const pair: unknown = JSON.parse(decoded);
  if (!Array.isArray(pair) || pair.length !== 2 ||
      typeof pair[0] !== "string" || !microsecondUtc.test(pair[0]) ||
      !Number.isFinite(Date.parse(pair[0])) || typeof pair[1] !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(pair[1])) throw new Error("invalid");
  return { stamp: pair[0], id: pair[1] };
 } catch { throw new Error("audio_posts.invalid_cursor"); }
}
function makeCursor(stamp: string, id: string): string {
 if (!microsecondUtc.test(stamp) || !Number.isFinite(Date.parse(stamp))) {
  throw new Error("audio_posts.invalid_feed_timestamp");
 }
 return Buffer.from(JSON.stringify([stamp, id])).toString("base64url");
}
/** Account-fenced history paging; SQL timestamps retain PG microseconds. */
async function readLibraryPage(pool: Pool, visibility: PostVisibility, input: {
 tenantId: string; accountId: string; cursor: string | null; limit: number; saved: boolean;
}): Promise<PublicFeedPage> {
 let position = parseCursor(input.cursor);
 const items: AudioPostRecord[] = [];
 let scanned = 0, more = true;
 while (items.length < input.limit && more && scanned < 240) {
  const r = await pool.query<Row & { cursor_time: string }>(
   "SELECT " + countColumns +
   `,to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time` +
   " FROM social.audio_posts p " +
   (input.saved ? "JOIN social.audio_post_reactions r ON r.tenant_id=p.tenant_id AND r.post_id=p.post_id " : "") +
   "WHERE p.tenant_id=$1 AND " +
   (input.saved ? "r.account_id=$2 AND r.kind='save' AND p.status='published' " :
                  "p.author_account_id=$2 ") +
   "AND ($3::timestamptz IS NULL OR (p.created_at,p.post_id) < ($3::timestamptz,$4)) " +
   "ORDER BY p.created_at DESC,p.post_id DESC LIMIT 30",
   [input.tenantId,input.accountId,position?.stamp ?? null,position?.id ?? ""]);
  if (!r.rows.length) { more = false; break; }
  let consumed = 0;
  for (const row of r.rows) {
   consumed++; scanned++;
   if (typeof row.cursor_time !== "string" || !microsecondUtc.test(row.cursor_time)) {
    throw new Error("audio_posts.invalid_feed_timestamp");
   }
   const post = map(row);
   position = {stamp:row.cursor_time,id:post.postId};
   if (!input.saved || await visibility.canView({
    tenantId:input.tenantId,viewerId:input.accountId,authorAccountId:post.authorAccountId,
   })) items.push(post);
   if (items.length >= input.limit || scanned >= 240) break;
  }
  if (r.rows.length < 30 && consumed === r.rows.length) more = false;
 }
 return {items,nextCursor:more && position ? makeCursor(position.stamp,position.id) : null};
}
export function createPostgresAudioPostRepository(pool: Pool, visibility: PostVisibility): AudioPostRepository {
 return {
  async createOnce(input: NewAudioPost) {
   return transaction(pool, async db => {
    const a = input.actor;
    await db.query(
     `INSERT INTO social.audio_posts (${columns})
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing',0,$10,NULL)
      ON CONFLICT (tenant_id,author_account_id,request_id) DO NOTHING`,
     [a.tenantId,input.postId,a.authorId,a.accountId,a.authorKind,input.asset.assetId,
      input.requestId,input.title,input.asset.durationMs,input.createdAt]);
    const r = await db.query<Row>(
     "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND author_account_id=$2 AND request_id=$3 FOR SHARE",
     [a.tenantId,a.accountId,input.requestId]);
    if (!r.rows[0]) throw new Error("audio_posts.create_missing");
    return map(r.rows[0]);
   });
  },
  async byRequest(tenantId, accountId, requestId) {
   const r = await pool.query<Row>(
    "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND author_account_id=$2 AND request_id=$3",
    [tenantId,accountId,requestId]);
   return r.rows[0] ? map(r.rows[0]) : null;
  },
  async byId(tenantId, postId) {
   const r = await pool.query<Row>("SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND post_id=$2",
    [tenantId,postId]);
   return r.rows[0] ? map(r.rows[0]) : null;
  },
  async mine({tenantId, accountId, limit}) {
   const r = await pool.query<Row>(
    "SELECT " + countColumns + " FROM social.audio_posts p WHERE p.tenant_id=$1 AND p.author_account_id=$2 ORDER BY p.created_at DESC,p.post_id DESC LIMIT $3",
    [tenantId,accountId,limit]);
   return r.rows.map(map);
  },
  async saved({tenantId,viewerId,limit}) {
   // A save is an account-private preference, not a global count or grant.
   const r = await pool.query<Row>(
    "SELECT " + countColumns + " FROM social.audio_posts p " +
    "JOIN social.audio_post_reactions r ON r.tenant_id=p.tenant_id AND r.post_id=p.post_id " +
    "WHERE p.tenant_id=$1 AND r.account_id=$2 AND r.kind='save' AND p.status='published' " +
    "ORDER BY p.created_at DESC,p.post_id DESC LIMIT $3",
    [tenantId,viewerId,Math.min(150,limit*3)]);
   const items: AudioPostRecord[] = [];
   for (const row of r.rows) {
    if (await visibility.canView({tenantId,viewerId,authorAccountId:row.author_account_id})) {
     items.push(map(row));
     if (items.length === limit) break;
    }
   }
   return items;
  },
  async removeOwn({tenantId,accountId,postId}) {
   return transaction(pool, async db => {
    // Only the authenticated owning account can mutate or even read this row.
    // FOR UPDATE serializes repeat/delete/moderation races on the same post.
    const found = await db.query<Row>(
     "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND post_id=$2 AND author_account_id=$3 FOR UPDATE",
     [tenantId,postId,accountId]);
    if (!found.rows[0]) return null;
    if (found.rows[0].status === "removed") return map(found.rows[0]);
    const updated = await db.query<Row>(
     "UPDATE social.audio_posts SET status='removed',revision=revision+1,published_at=NULL WHERE tenant_id=$1 AND post_id=$2 AND author_account_id=$3 RETURNING " + columns,
     [tenantId,postId,accountId]);
    if (!updated.rows[0]) throw new Error("audio_posts.remove_conflict");
    return map(updated.rows[0]);
   });
  },
  async settle({tenantId,postId,expectedRevision,status}) {
   const r = await pool.query<Row>(
    "UPDATE social.audio_posts SET status=$4,revision=revision+1,published_at=CASE WHEN $4='published' THEN NOW() ELSE NULL END WHERE tenant_id=$1 AND post_id=$2 AND revision=$3 AND status='processing' RETURNING " + columns,
    [tenantId,postId,expectedRevision,status]);
   if (!r.rows[0]) throw new Error("audio_posts.settle_conflict");
   return map(r.rows[0]);
  },
  async publicFeed({tenantId,viewerId,cursor:token,limit}): Promise<PublicFeedPage> {
   // Scan bounded pages, applying the canonical account visibility policy before returning.
   // Cursor advances across filtered items, so blocked posts cannot loop the feed.
   if (!viewerId) throw new Error("audio_posts.viewer_required");
   let position = parseCursor(token);
   const items: AudioPostRecord[] = [];
   let more = true, scanned = 0;
   while (items.length < limit && more && scanned < 240) {
    const r = await pool.query<Row & { cursor_time: string }>(
      "SELECT " + countColumns +
      `,to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time` +
      " FROM social.audio_posts p WHERE p.tenant_id=$1 AND p.status='published' " +
      "AND ($2::timestamptz IS NULL OR (p.created_at,p.post_id) < ($2::timestamptz,$3)) " +
      "ORDER BY p.created_at DESC,p.post_id DESC LIMIT 30",
      [tenantId,position?.stamp ?? null,position?.id ?? ""]);
    if (!r.rows.length) { more = false; break; }
    let consumed = 0;
    for (const row of r.rows) {
     consumed++;
     const post = map(row);
     // pg Date loses fractional microseconds, so use the SQL text alias.
     if (typeof row.cursor_time !== "string" || !microsecondUtc.test(row.cursor_time)) {
      throw new Error("audio_posts.invalid_feed_timestamp");
     }
     position = {stamp:row.cursor_time,id:post.postId};
     scanned++;
     if (await visibility.canView({
       tenantId,viewerId,authorAccountId:post.authorAccountId,
     })) items.push(post);
     if (items.length === limit || scanned >= 240) break;
    }
    // A short batch only ends the feed if every row was consumed.
    // Reaching the visible-item limit partway through the batch leaves more.
    if (r.rows.length < 30 && consumed === r.rows.length) more = false;
   }
   // Advance past the last *scanned* row, including hidden authors.
   // Otherwise a full hidden page causes repeated rows or missing continuation.
   return { items, nextCursor: more && position ? makeCursor(position.stamp, position.id) : null };
  },
  async listComments({tenantId,viewerId,postId,limit,beforeCommentId}) {
   return transaction(pool, async db => {
    const r = await db.query<Row>(
     "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND post_id=$2 AND status='published' FOR SHARE",
     [tenantId,postId]);
    if (!r.rows[0] || !await visibility.canView({tenantId,viewerId,authorAccountId:r.rows[0].author_account_id})) {
     throw new Error("audio_posts.not_visible");
    }
    // Resolve the cursor only after post visibility, and in the same tenant/post.
    // Compare SQL timestamps directly: JavaScript Date drops PG microseconds.
    if (beforeCommentId) {
     const anchor = await db.query<{comment_id:string}>(
      "SELECT comment_id FROM social.audio_post_comments WHERE tenant_id=$1 AND post_id=$2 AND comment_id=$3",
      [tenantId,postId,beforeCommentId]);
     if (!anchor.rows[0]) throw new Error("audio_posts.invalid_comment_cursor");
    }
    const comments = await db.query<CommentRow>(
     "SELECT " + commentColumns + " FROM social.audio_post_comments " +
     "WHERE tenant_id=$1 AND post_id=$2 AND removed=false " +
     (beforeCommentId
      ? "AND (created_at,comment_id) < (SELECT created_at,comment_id FROM social.audio_post_comments " +
        "WHERE tenant_id=$1 AND post_id=$2 AND comment_id=$4) "
      : "") +
     "ORDER BY created_at DESC,comment_id DESC LIMIT $3",
     beforeCommentId ? [tenantId,postId,limit,beforeCommentId] : [tenantId,postId,limit]);
    return comments.rows.map(mapComment);
   });
  },
  async addComment({tenantId,viewerId,postId,commentId,requestId,body,createdAt}) {
   return transaction(pool, async db => {
    const r = await db.query<Row>(
     "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND post_id=$2 AND status='published' FOR SHARE",
     [tenantId,postId]);
    if (!r.rows[0] || !await visibility.canView({tenantId,viewerId,authorAccountId:r.rows[0].author_account_id})) {
     throw new Error("audio_posts.not_visible");
    }
    await db.query(
     "INSERT INTO social.audio_post_comments(tenant_id,post_id,comment_id,author_account_id,request_id,body,created_at,removed) " +
     "VALUES($1,$2,$3,$4,$5,$6,$7,false) ON CONFLICT (tenant_id,post_id,author_account_id,request_id) DO NOTHING",
     [tenantId,postId,commentId,viewerId,requestId,body,createdAt]);
    const found = await db.query<CommentRow>(
     "SELECT " + commentColumns + " FROM social.audio_post_comments " +
     "WHERE tenant_id=$1 AND post_id=$2 AND author_account_id=$3 AND request_id=$4",
     [tenantId,postId,viewerId,requestId]);
    const row = found.rows[0];
    if (!row) throw new Error("audio_posts.comment_create_missing");
    if (row.body !== body || row.removed) throw new Error("audio_posts.comment_conflict");
    return mapComment(row);
   });
  },
  async removeOwnComment({tenantId,viewerId,postId,commentId}) {
   const r = await pool.query<{comment_id:string}>(
    "UPDATE social.audio_post_comments SET removed=true,body='' " +
    "WHERE tenant_id=$1 AND post_id=$2 AND comment_id=$3 AND author_account_id=$4 RETURNING comment_id",
    [tenantId,postId,commentId,viewerId]);
   return r.rows.length > 0;
  },
  async setReaction({tenantId,viewerId,postId,kind,enabled}) {
   return transaction(pool, async db => {
    const r = await db.query<Row>(
     "SELECT " + columns + " FROM social.audio_posts WHERE tenant_id=$1 AND post_id=$2 AND status='published' FOR SHARE",
     [tenantId,postId]);
    const post = r.rows[0];
    if (!post || !await visibility.canView({tenantId,viewerId,authorAccountId:post.author_account_id})) {
      throw new Error("audio_posts.not_visible");
    }
    if (enabled) {
     await db.query(
      "INSERT INTO social.audio_post_reactions(tenant_id,post_id,account_id,kind) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [tenantId,postId,viewerId,kind]);
    } else {
     await db.query(
      "DELETE FROM social.audio_post_reactions WHERE tenant_id=$1 AND post_id=$2 AND account_id=$3 AND kind=$4",
      [tenantId,postId,viewerId,kind]);
    }
    return {enabled};
   });
  },
 };
}
