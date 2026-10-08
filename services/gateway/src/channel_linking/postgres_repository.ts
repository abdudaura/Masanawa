import { LinkError, type LinkChannel, type LinkIdentity, type LinkRepository, type LinkState } from "./service.js";

interface QueryResult<T> { rows: T[]; rowCount: number | null }
interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}
export interface LinkSqlPool {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: unknown[],
  ): Promise<QueryResult<T>>;
  connect(): Promise<SqlClient>;
}

interface Intent extends Record<string, unknown> {
  tenant_id: string; user_id: string; issued_at: Date;
  expires_at: Date; window_started_at: Date; issued_count: number;
}
function date(value: Date | string): Date { return value instanceof Date ? value : new Date(value); }
async function transaction<T>(pool: LinkSqlPool, run: (db: SqlClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally { db.release(); }
}
async function lockActiveOwner(db: SqlClient, owner: LinkIdentity): Promise<void> {
  const row = await db.query<{ state: string }>(
    "SELECT state FROM identity.users WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE",
    [owner.tenantId, owner.userId],
  );
  if (row.rows[0]?.state !== "active") throw new LinkError("UNAUTHORIZED", 403);
}

export interface PersistentLinkRepository extends LinkRepository {
  resolveChallengeOwner(channel: LinkChannel, hash: string, at: Date): Promise<LinkIdentity | null>;
  isVerifiedSender(owner: LinkIdentity, channel: LinkChannel, externalUserId: string, chatId: string): Promise<boolean>;
}

export function createPostgresLinkRepository(pool: LinkSqlPool): PersistentLinkRepository {
  return Object.freeze({
    async list(owner: LinkIdentity, at: Date): Promise<readonly LinkState[]> {
      const result = await pool.query<{
        channel: LinkChannel; linked_at: Date | string | null;
        pending_until: Date | string | null; preferred: boolean;
      }>(
        "SELECT choices.channel, " +
        "(SELECT max(l.updated_at) FROM security.customer_channel_links l " +
        "WHERE l.tenant_id=$1 AND l.user_id=$2 AND l.channel=choices.channel AND EXISTS (SELECT 1 FROM security.channel_link_intents v WHERE v.tenant_id=l.tenant_id AND v.user_id=l.user_id AND v.channel=l.channel AND v.verified_external_id=l.external_user_id AND v.verified_chat_id=l.chat_id)) AS linked_at, " +
        "(SELECT i.expires_at FROM security.channel_link_intents i " +
        "WHERE i.tenant_id=$1 AND i.user_id=$2 AND i.channel=choices.channel " +
        "AND i.consumed_at IS NULL AND i.code_hash IS NOT NULL AND i.expires_at>$3) AS pending_until, " +
        "EXISTS (SELECT 1 FROM security.channel_link_preferences p " +
        "WHERE p.tenant_id=$1 AND p.user_id=$2 AND p.channel=choices.channel) AS preferred " +
        "FROM (VALUES ('whatsapp'),('telegram')) AS choices(channel)",
        [owner.tenantId, owner.userId, at],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({
        channel: row.channel,
        linked: row.linked_at != null,
        preferred: row.linked_at != null && row.preferred,
        linkedAt: row.linked_at ? date(row.linked_at).toISOString() : null,
        pendingUntil: row.pending_until ? date(row.pending_until).toISOString() : null,
      })));
    },

    async isVerifiedSender(owner, channel, externalUserId, chatId) {
      const result = await pool.query(
        "SELECT 1 FROM security.channel_link_intents i " +
        "JOIN identity.users u ON u.tenant_id=i.tenant_id AND u.user_id=i.user_id AND u.state='active' " +
        "JOIN security.customer_channel_links l ON " +
        "l.tenant_id=i.tenant_id AND l.user_id=i.user_id AND l.channel=i.channel " +
        "AND l.external_user_id=i.verified_external_id AND l.chat_id=i.verified_chat_id " +
        "WHERE i.tenant_id=$1 AND i.user_id=$2 AND i.channel=$3 " +
        "AND i.verified_external_id=$4 AND i.verified_chat_id=$5",
        [owner.tenantId, owner.userId, channel, externalUserId, chatId],
      );
      return result.rows.length > 0;
    },

    async begin({ owner, channel, codeHash, now, expiresAt }) {
      await transaction(pool, async (db) => {
        await lockActiveOwner(db, owner);
        const existing = await db.query<Intent>(
          "SELECT issued_at, window_started_at, issued_count " +
          "FROM security.channel_link_intents WHERE tenant_id=$1 AND user_id=$2 AND channel=$3 FOR UPDATE",
          [owner.tenantId, owner.userId, channel],
        );
        const prev = existing.rows[0];
        if (prev && now.getTime() - date(prev.issued_at).getTime() < 30_000)
          throw new LinkError("LINK_COOLDOWN", 429);
        const windowLive = prev && now.getTime() - date(prev.window_started_at).getTime() < 3600_000;
        if (windowLive && Number(prev.issued_count) >= 5)
          throw new LinkError("LINK_RATE_LIMITED", 429);
        const count = windowLive ? Number(prev!.issued_count) + 1 : 1;
        const windowStart = windowLive ? prev!.window_started_at : now;
        await db.query(
          "INSERT INTO security.channel_link_intents " +
          "(tenant_id,user_id,channel,code_hash,issued_at,expires_at,window_started_at,issued_count,consumed_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL) " +
          "ON CONFLICT (tenant_id,user_id,channel) DO UPDATE SET " +
          "code_hash=EXCLUDED.code_hash,issued_at=EXCLUDED.issued_at,expires_at=EXCLUDED.expires_at, " +
          "window_started_at=EXCLUDED.window_started_at,issued_count=EXCLUDED.issued_count,consumed_at=NULL",
          [owner.tenantId, owner.userId, channel, codeHash, now, expiresAt, windowStart, count],
        );
      });
    },

    async resolveChallengeOwner(channel, hash, at) {
      const row = await pool.query<{ tenant_id: string; user_id: string }>(
        "SELECT tenant_id,user_id FROM security.channel_link_intents " +
        "WHERE channel=$1 AND code_hash=$2 AND consumed_at IS NULL AND expires_at>$3",
        [channel, hash, at],
      );
      const found = row.rows[0];
      return found ? Object.freeze({ tenantId: found.tenant_id, userId: found.user_id }) : null;
    },

    async confirm({ channel, codeHash, externalUserId, chatId, characterId, at }): Promise<boolean> {
      return transaction(pool, async (db) => {
        // Read identity first, then lock owner BEFORE the challenge row.
        // begin/unlink use the same lock order, preventing unlink/confirm deadlocks.
        const candidate = await db.query<Intent>(
          "SELECT tenant_id,user_id FROM security.channel_link_intents " +
          "WHERE channel=$1 AND code_hash=$2 AND consumed_at IS NULL",
          [channel, codeHash],
        );
        if (!candidate.rows[0]) return false;
        const owner = {
          tenantId: candidate.rows[0].tenant_id,
          userId: candidate.rows[0].user_id,
        };
        await lockActiveOwner(db, owner);
        const result = await db.query<Intent>(
          "SELECT tenant_id,user_id,expires_at FROM security.channel_link_intents " +
          "WHERE channel=$1 AND code_hash=$2 AND consumed_at IS NULL FOR UPDATE",
          [channel, codeHash],
        );
        const pending = result.rows[0];
        if (!pending || date(pending.expires_at).getTime() <= at.getTime() ||
            pending.tenant_id !== owner.tenantId || pending.user_id !== owner.userId) return false;
        const existing = await db.query<{ tenant_id: string; user_id: string }>(
          "SELECT tenant_id,user_id FROM security.customer_channel_links " +
          "WHERE channel=$1 AND external_user_id=$2 FOR UPDATE",
          [channel, externalUserId],
        );
        if (existing.rows[0] && (existing.rows[0].tenant_id !== owner.tenantId ||
                                 existing.rows[0].user_id !== owner.userId))
          throw new LinkError("LINK_CONFLICT", 409);
        // Remove an owner's old provider account only after checking the new one.
        // All operations are atomic; an insertion conflict rolls back the deletion.
        await db.query(
          "DELETE FROM security.customer_channel_links " +
          "WHERE tenant_id=$1 AND user_id=$2 AND channel=$3 AND external_user_id<>$4",
          [owner.tenantId, owner.userId, channel, externalUserId],
        );
        const inserted = await db.query(
          "INSERT INTO security.customer_channel_links " +
          "(channel,external_user_id,chat_id,tenant_id,user_id,character_id,character_session_id,updated_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,NULL,$7) " +
          "ON CONFLICT (channel,external_user_id) DO UPDATE SET " +
          "chat_id=EXCLUDED.chat_id,character_id=EXCLUDED.character_id, " +
          "character_session_id=NULL,updated_at=EXCLUDED.updated_at " +
          "WHERE security.customer_channel_links.tenant_id=EXCLUDED.tenant_id " +
          "AND security.customer_channel_links.user_id=EXCLUDED.user_id RETURNING external_user_id",
          [channel, externalUserId, chatId, owner.tenantId, owner.userId, characterId, at],
        );
        if (inserted.rowCount !== 1) throw new LinkError("LINK_CONFLICT", 409);
        await db.query(
          "UPDATE security.channel_link_intents SET code_hash=NULL,consumed_at=$4, " +
          "verified_external_id=$5,verified_chat_id=$6 " +
          "WHERE tenant_id=$1 AND user_id=$2 AND channel=$3",
          [owner.tenantId, owner.userId, channel, at, externalUserId, chatId],
        );
        return true;
      });
    },

    async unlink(owner, channel, at) {
      await transaction(pool, async (db) => {
        await lockActiveOwner(db, owner);
        await db.query(
          "DELETE FROM security.customer_channel_links WHERE tenant_id=$1 AND user_id=$2 AND channel=$3",
          [owner.tenantId, owner.userId, channel],
        );
        await db.query(
          "DELETE FROM security.channel_link_preferences WHERE tenant_id=$1 AND user_id=$2 AND channel=$3",
          [owner.tenantId, owner.userId, channel],
        );
        await db.query(
          "UPDATE security.channel_link_intents SET code_hash=NULL,consumed_at=$4, " +
          "verified_external_id=NULL,verified_chat_id=NULL " +
          "WHERE tenant_id=$1 AND user_id=$2 AND channel=$3",
          [owner.tenantId, owner.userId, channel, at],
        );
      });
    },

    async setPreferred(owner, channel, at) {
      await transaction(pool, async (db) => {
        await lockActiveOwner(db, owner);
        const linked = await db.query(
          "SELECT 1 FROM security.customer_channel_links l " +
          "WHERE l.tenant_id=$1 AND l.user_id=$2 AND l.channel=$3 AND EXISTS (SELECT 1 FROM security.channel_link_intents v WHERE v.tenant_id=l.tenant_id AND v.user_id=l.user_id AND v.channel=l.channel AND v.verified_external_id=l.external_user_id AND v.verified_chat_id=l.chat_id) LIMIT 1",
          [owner.tenantId, owner.userId, channel],
        );
        if (!linked.rows.length) throw new LinkError("LINK_NOT_FOUND", 409);
        await db.query(
          "INSERT INTO security.channel_link_preferences(tenant_id,user_id,channel,updated_at) " +
          "VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,user_id) DO UPDATE SET " +
          "channel=EXCLUDED.channel,updated_at=EXCLUDED.updated_at",
          [owner.tenantId, owner.userId, channel, at],
        );
      });
    },
  });
}
