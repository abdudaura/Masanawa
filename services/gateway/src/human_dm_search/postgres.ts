import type { SearchHit, SearchRepository } from "./search.js";

interface Result<T> { readonly rows: T[] }
interface Client {
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Result<T>>;
  release(): void;
}
export interface SearchPool { connect(): Promise<Client> }
/** F15 alone chooses the canonical C02 schema. Do not auto-detect or apply a competing 0017. */
export type C02Dialect = "conversations-472" | "threads-475";
type Row = Record<string, unknown> & {
  message_id: string; conversation_id: string; sender_user_id: string;
  sequence: string | number; body: string; created_at_us: string;
  edited_at: Date | string | null;
};
function result(row: Row): SearchHit {
  return {
    messageId: row.message_id, conversationId: row.conversation_id,
    senderUserId: row.sender_user_id, sequence: String(row.sequence),
    body: row.body, createdAtUs: row.created_at_us,
    editedAt: row.edited_at === null ? null : new Date(row.edited_at).toISOString(),
  };
}
/** Uses one authoritative SQL snapshot per request, current C01 accepted consent,
 * both active identities, reciprocal blocks, profile restrictions and tombstones.
 * No separate index of private messages is persisted. Unindexed LIKE queries are
 * strictly deadline bounded until F15 adds a reviewed search index. */
export function createPostgresHumanDmSearch(pool: SearchPool, dialect: C02Dialect): SearchRepository {
  const table = dialect === "conversations-472" ? "talks.human_dm_conversations" :
    dialect === "threads-475" ? "talks.human_dm_threads" : null;
  if (!table) throw new Error("F15 must select an explicit C02 dialect");
  const statement = [
    "SELECT m.message_id::text AS message_id,m.conversation_id::text AS conversation_id,",
    " m.sender_user_id,m.sequence::text AS sequence,m.body,",
    " to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS created_at_us,",
    " m.edited_at",
    " FROM talks.human_dm_messages m",
    " JOIN " + table + " c ON c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id",
    " JOIN identity.users self ON self.tenant_id=c.tenant_id AND self.user_id=$2 AND self.state='active'",
    " JOIN identity.users first_person ON first_person.tenant_id=c.tenant_id",
    "   AND first_person.user_id=c.first_user_id AND first_person.state='active'",
    " JOIN identity.users second_person ON second_person.tenant_id=c.tenant_id",
    "   AND second_person.user_id=c.second_user_id AND second_person.state='active'",
    " WHERE m.tenant_id=$1 AND c.tenant_id=$1",
    " AND $2 IN (c.first_user_id,c.second_user_id)",
    " AND m.deleted_at IS NULL AND m.body IS NOT NULL",
    " AND EXISTS (SELECT 1 FROM talks.human_dm_contact_requests edge",
    "  WHERE edge.tenant_id=c.tenant_id AND edge.first_user_id=c.first_user_id",
    "   AND edge.second_user_id=c.second_user_id AND edge.status='accepted')",
    " AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences block",
    "  WHERE block.tenant_id=c.tenant_id AND block.blocked=true",
    "   AND ((block.viewer_user_id=c.first_user_id AND block.subject_user_id=c.second_user_id)",
    "   OR (block.viewer_user_id=c.second_user_id AND block.subject_user_id=c.first_user_id)))",
    " AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement safety",
    "  JOIN talks.public_profiles profile ON profile.tenant_id=safety.tenant_id",
    "    AND profile.handle=safety.target_id",
    "  WHERE safety.tenant_id=c.tenant_id AND safety.target_kind='profile'",
    "    AND safety.visibility IN ('restricted','blocked')",
    "    AND profile.user_id IN (c.first_user_id,c.second_user_id))",
    " AND ($3::uuid IS NULL OR m.conversation_id=$3::uuid)",
    // strpos rather than ILIKE: SQL % and _ in user text remain literal.
    " AND strpos(lower(m.body),lower($4::text))>0",
    " AND ($5::timestamptz IS NULL OR (m.created_at,m.message_id)<($5::timestamptz,$6::uuid))",
    " ORDER BY m.created_at DESC,m.message_id DESC LIMIT $7",
  ].join("\n");
  return Object.freeze({
    async search(input: Parameters<SearchRepository["search"]>[0]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED READ ONLY");
        // A slow unindexed scan fails closed instead of occupying a Gateway worker.
        await client.query("SET LOCAL statement_timeout='750ms'");
        const queryResult = await client.query<Row>(statement, [
          input.tenantId, input.userId, input.conversationId, input.text,
          input.before?.createdAtUs ?? null, input.before?.messageId ?? null, input.limit,
        ]);
        await client.query("COMMIT");
        return queryResult.rows.map(result);
      } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* keep original error */ }
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
