import type { HumanConversation, HumanMessage, HumanMessagePage, HumanMessageRepository } from "./model.js";

export interface HumanMessageSqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{rows: Row[]; rowCount: number | null}>;
  release(): void;
}
export interface HumanMessageSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{rows: Row[]; rowCount: number | null}>;
  connect(): Promise<HumanMessageSqlClient>;
}
type MessageRow = Record<string, unknown> & {
  conversation_id: string; message_id: string; sender_user_id: string;
  body: string; created_at: Date | string; edited_at: Date | string | null;
  deleted_at: Date | string | null; revision: number;
};
type ConversationRow = Record<string, unknown> & {
  conversation_id: string; first_user_id: string; second_user_id: string;
  created_at: Date | string; updated_at: Date | string;
  message_id: string | null; sender_user_id: string | null; body: string | null;
  message_created_at: Date | string | null; edited_at: Date | string | null;
  deleted_at: Date | string | null; revision: number | null;
};
function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function stamp(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}
function message(row: MessageRow): HumanMessage {
  return Object.freeze({
    conversationId: row.conversation_id, messageId: row.message_id,
    senderUserId: row.sender_user_id, text: row.body, createdAt: iso(row.created_at),
    editedAt: stamp(row.edited_at), deletedAt: stamp(row.deleted_at), revision: Number(row.revision),
  });
}
function conversation(row: ConversationRow, userId: string): HumanConversation {
  const lastMessage: HumanMessage | null = row.message_id === null ? null : message({
    conversation_id: row.conversation_id,
    message_id: row.message_id,
    sender_user_id: row.sender_user_id!,
    body: row.body!,
    created_at: row.message_created_at!,
    edited_at: row.edited_at,
    deleted_at: row.deleted_at,
    revision: row.revision!,
  });
  return Object.freeze({
    conversationId: row.conversation_id,
    otherUserId: row.first_user_id === userId ? row.second_user_id : row.first_user_id,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), lastMessage,
  });
}
// Both members must still be active; read access to old text is revoked on a
// bilateral block or platform profile restriction. This is distinct from C01's
// discovery flag: hiding a handle does not retroactively erase one's own history.
const readable = `
  SELECT 1
    FROM talks.human_dm_conversations t
    JOIN identity.users a ON a.tenant_id=t.tenant_id
      AND a.user_id=t.first_user_id AND a.state='active'
    JOIN identity.users b ON b.tenant_id=t.tenant_id
      AND b.user_id=t.second_user_id AND b.state='active'
   WHERE t.tenant_id=$1 AND t.conversation_id=$3
     AND $2 IN (t.first_user_id,t.second_user_id)
     AND NOT EXISTS (
       SELECT 1 FROM talks.safety_preferences sp
        WHERE sp.tenant_id=t.tenant_id AND sp.blocked=true
          AND ((sp.viewer_user_id=t.first_user_id AND sp.subject_user_id=t.second_user_id)
            OR (sp.viewer_user_id=t.second_user_id AND sp.subject_user_id=t.first_user_id))
     )
     AND NOT EXISTS (
       SELECT 1 FROM talks.safety_enforcement se
         JOIN talks.public_profiles p ON p.tenant_id=se.tenant_id AND p.handle=se.target_id
        WHERE se.tenant_id=t.tenant_id AND se.target_kind='profile'
          AND se.visibility IN ('restricted','blocked')
          AND p.user_id IN (t.first_user_id,t.second_user_id)
     )
`;
// Sending checks live C01 consent at the same DB connection / transaction
// as the idempotency lookup and INSERT, never from stale mobile UI state.
const sendable = `
  ${readable}
     AND (
       EXISTS (
         SELECT 1 FROM talks.human_dm_contact_requests e
          WHERE e.tenant_id=t.tenant_id
            AND e.first_user_id=t.first_user_id
            AND e.second_user_id=t.second_user_id
            AND e.status='accepted'
       )
       OR EXISTS (
         SELECT 1 FROM talks.human_dm_preferences p
          WHERE p.tenant_id=t.tenant_id
            AND p.user_id=CASE WHEN t.first_user_id=$2 THEN t.second_user_id ELSE t.first_user_id END
            AND p.admission_policy='anyone'
            AND p.discoverable_by_handle=true
            AND NOT EXISTS (
              SELECT 1 FROM talks.human_dm_contact_requests e
               WHERE e.tenant_id=t.tenant_id
                 AND e.first_user_id=t.first_user_id
                 AND e.second_user_id=t.second_user_id AND e.status='declined'
            )
       )
     )
`;
// Default 'anyone' can be explicit only; C01 defaults to 'requests'. Users
// with a previously accepted edge remain eligible after hiding their handle.
const startPermission = `
  SELECT 1 FROM identity.users sender
    JOIN identity.users recipient
      ON recipient.tenant_id=sender.tenant_id AND recipient.user_id=$3
    LEFT JOIN talks.human_dm_preferences pref
      ON pref.tenant_id=recipient.tenant_id AND pref.user_id=recipient.user_id
    LEFT JOIN talks.human_dm_contact_requests edge
      ON edge.tenant_id=sender.tenant_id
     AND edge.first_user_id=LEAST($2,$3) AND edge.second_user_id=GREATEST($2,$3)
   WHERE sender.tenant_id=$1 AND sender.user_id=$2
     AND sender.state='active' AND recipient.state='active' AND $2<>$3
     AND (edge.status='accepted' OR (
       COALESCE(pref.admission_policy,'requests')='anyone'
       AND COALESCE(pref.discoverable_by_handle,true)=true
       AND (edge.status IS NULL OR edge.status <> 'declined')
     ))
     AND NOT EXISTS (
       SELECT 1 FROM talks.safety_preferences sp
        WHERE sp.tenant_id=$1 AND sp.blocked=true
          AND ((sp.viewer_user_id=$2 AND sp.subject_user_id=$3)
            OR (sp.viewer_user_id=$3 AND sp.subject_user_id=$2))
     )
     AND NOT EXISTS (
       SELECT 1 FROM talks.safety_enforcement se
         JOIN talks.public_profiles p ON p.tenant_id=se.tenant_id AND p.handle=se.target_id
        WHERE se.tenant_id=$1 AND se.target_kind='profile'
          AND se.visibility IN ('restricted','blocked') AND p.user_id IN ($2,$3)
     )
`;
const conversationSelect = `
  SELECT t.*, m.message_id, m.sender_user_id, m.body,
         m.created_at AS message_created_at, m.edited_at, m.deleted_at, m.revision
    FROM talks.human_dm_conversations t
    LEFT JOIN LATERAL (
      SELECT message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision
        FROM talks.human_dm_messages m
       WHERE m.tenant_id=t.tenant_id AND m.conversation_id=t.conversation_id
       ORDER BY m.created_at DESC,m.message_id DESC LIMIT 1
    ) m ON true
`;
function cursor(row: MessageRow): string {
  return Buffer.from(JSON.stringify({t: iso(row.created_at), id: row.message_id}), "utf8").toString("base64url");
}
export function createPostgresHumanMessageRepository(pool: HumanMessageSqlPool): HumanMessageRepository {
  async function allowed(tenantId: string, userId: string, conversationId: string, send: boolean, client = pool): Promise<boolean> {
    const result = await client.query(send ? sendable : readable, [tenantId,userId,conversationId]);
    return result.rows.length > 0;
  }
  async function fetchOne(tenantId: string,userId: string,conversationId: string): Promise<HumanConversation | null> {
    if (!await allowed(tenantId,userId,conversationId,false)) return null;
    const r = await pool.query<ConversationRow>(`${conversationSelect}
      WHERE t.tenant_id=$1 AND t.conversation_id=$2 AND $3 IN (t.first_user_id,t.second_user_id)
      LIMIT 1`,[tenantId,conversationId,userId]);
    return r.rows[0] ? conversation(r.rows[0],userId) : null;
  }
  return Object.freeze<HumanMessageRepository>({
    async start(input) {
      const p = await pool.query(startPermission, [input.tenantId,input.userId,input.recipientUserId]);
      if (!p.rows.length) return null;
      const r = await pool.query<{conversation_id: string}>(`
        INSERT INTO talks.human_dm_conversations
          (tenant_id,conversation_id,first_user_id,second_user_id)
        VALUES ($1,$2,LEAST($3,$4),GREATEST($3,$4))
        ON CONFLICT (tenant_id,first_user_id,second_user_id)
        DO UPDATE SET conversation_id=talks.human_dm_conversations.conversation_id
        RETURNING conversation_id`,
        [input.tenantId,input.proposedId,input.userId,input.recipientUserId]);
      if (!r.rows[0]) throw new Error("messages.conversation_not_persisted");
      return fetchOne(input.tenantId,input.userId,r.rows[0].conversation_id);
    },
    async list({tenantId,userId,limit}) {
      const r = await pool.query<ConversationRow>(`${conversationSelect}
        WHERE t.tenant_id=$1 AND $2 IN (t.first_user_id,t.second_user_id)
          AND EXISTS (${readable})
        ORDER BY t.updated_at DESC,t.conversation_id DESC LIMIT $4`,
        [tenantId,userId,undefined,limit]);
      return Object.freeze(r.rows.map(x => conversation(x,userId)));
    },
    read(input) { return fetchOne(input.tenantId,input.userId,input.conversationId); },
    async history(input) {
      if (!await allowed(input.tenantId,input.userId,input.conversationId,false)) return null;
      const r = await pool.query<MessageRow>(`
        SELECT conversation_id,message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision
          FROM talks.human_dm_messages
         WHERE tenant_id=$1 AND conversation_id=$2
           AND ($3::timestamptz IS NULL OR (created_at,message_id)<($3::timestamptz,$4::text))
         ORDER BY created_at DESC,message_id DESC LIMIT $5`,
        [input.tenantId,input.conversationId,input.before?.at ?? null,input.before?.id ?? null,input.limit+1]);
      const hasMore = r.rows.length>input.limit;
      const items = r.rows.slice(0,input.limit);
      return Object.freeze({messages:Object.freeze(items.map(message)),
        nextCursor:hasMore && items.length ? cursor(items[items.length-1]!) : null});
    },
    async send(input) {
      const client = await pool.connect();
      let committed = false;
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))",
          [`human-dm-rate:${input.tenantId}:${input.userId}`]);
        if (!await allowed(input.tenantId,input.userId,input.conversationId,true,client)) return null;
        const previous = await client.query<MessageRow & {original_digest: string}>(`
          SELECT conversation_id,message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision,original_digest
            FROM talks.human_dm_messages
           WHERE tenant_id=$1 AND sender_user_id=$2 AND client_request_id=$3
           LIMIT 1`,[input.tenantId,input.userId,input.clientRequestId]);
        if (previous.rows[0]) {
          if (previous.rows[0].conversation_id!==input.conversationId ||
              previous.rows[0].original_digest!==input.digest) {
            throw new Error("messages.request_id_conflict");
          }
          await client.query("COMMIT"); committed=true;
          return message(previous.rows[0]);
        }
        const count = await client.query<{n: string | number}>(`
          SELECT count(*)::int AS n FROM talks.human_dm_messages
           WHERE tenant_id=$1 AND sender_user_id=$2
             AND created_at >= clock_timestamp()-interval '1 minute'`,[input.tenantId,input.userId]);
        if (Number(count.rows[0]?.n ?? 0)>=30) throw new Error("messages.rate_limited");
        const result = await client.query<MessageRow>(`
          INSERT INTO talks.human_dm_messages
            (tenant_id,conversation_id,message_id,sender_user_id,client_request_id,original_digest,body)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING conversation_id,message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision`,
          [input.tenantId,input.conversationId,input.messageId,input.userId,input.clientRequestId,input.digest,input.text]);
        await client.query(`
          UPDATE talks.human_dm_conversations SET updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND conversation_id=$2`,[input.tenantId,input.conversationId]);
        await client.query("COMMIT");committed=true;
        if (!result.rows[0]) throw new Error("messages.write_failed");
        return message(result.rows[0]);
      } finally {
        if (!committed) await client.query("ROLLBACK").catch(() => undefined);
        client.release();
      }
    },
    async edit(input) {
      if (!await allowed(input.tenantId,input.userId,input.conversationId,true)) return null;
      const result = await pool.query<MessageRow>(`
        UPDATE talks.human_dm_messages
           SET body=$5,edited_at=clock_timestamp(),revision=revision+1
         WHERE tenant_id=$1 AND sender_user_id=$2 AND conversation_id=$3
           AND message_id=$4 AND deleted_at IS NULL AND revision=$6
           AND created_at>=clock_timestamp()-interval '15 minutes'
        RETURNING conversation_id,message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision`,
        [input.tenantId,input.userId,input.conversationId,input.messageId,input.text,input.expectedRevision]);
      return result.rows[0] ? message(result.rows[0]) : null;
    },
    async remove(input) {
      if (!await allowed(input.tenantId,input.userId,input.conversationId,false)) return null;
      const result = await pool.query<MessageRow>(`
        UPDATE talks.human_dm_messages
           SET body='',deleted_at=clock_timestamp(),revision=revision+1
         WHERE tenant_id=$1 AND sender_user_id=$2 AND conversation_id=$3
           AND message_id=$4 AND deleted_at IS NULL AND revision=$5
        RETURNING conversation_id,message_id,sender_user_id,body,created_at,edited_at,deleted_at,revision`,
        [input.tenantId,input.userId,input.conversationId,input.messageId,input.expectedRevision]);
      return result.rows[0] ? message(result.rows[0]) : null;
    },
  });
}
