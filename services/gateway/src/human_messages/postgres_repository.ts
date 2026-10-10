import type { HumanDmConversation, HumanDmMessage, HumanDmRepository } from "./model.js";

interface Result<Row> { readonly rows: Row[]; readonly rowCount: number | null }
interface Query {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<Result<Row>>;
}
interface Client extends Query { release(): void }
export interface HumanDmPool extends Query { connect(): Promise<Client> }
interface MessageRow extends Record<string, unknown> {
  conversation_id: string; message_id: string; sequence: string | number;
  sender_user_id: string; client_request_id: string; body: string | null;
  created_at: Date | string; edited_at: Date | string | null; deleted_at: Date | string | null;
}
function iso(value: Date | string | null) { return value === null ? null : new Date(value).toISOString(); }
function message(row: MessageRow): HumanDmMessage {
  return { conversationId:row.conversation_id, messageId:row.message_id,
    sequence:String(row.sequence), senderUserId:row.sender_user_id,
    clientRequestId:row.client_request_id, body:row.body,
    createdAt:iso(row.created_at)!, editedAt:iso(row.edited_at), deletedAt:iso(row.deleted_at) };
}
const messageFields = `m.conversation_id,m.message_id,m.sequence,m.sender_user_id,
  m.client_request_id,m.body,m.created_at,m.edited_at,m.deleted_at`;
// Shared actor/pair policy: every human DM mutation must check this in the
// SAME SQL statement as the write (no stale permission preflight).
const eligibleMember = `
    $2 IN (c.first_user_id,c.second_user_id)
    AND EXISTS (SELECT 1 FROM identity.users a WHERE a.tenant_id=$1
      AND a.user_id=c.first_user_id AND a.state='active')
    AND EXISTS (SELECT 1 FROM identity.users b WHERE b.tenant_id=$1
      AND b.user_id=c.second_user_id AND b.state='active')
    AND NOT EXISTS (
      SELECT 1 FROM talks.human_dm_contact_requests revoked
       WHERE revoked.tenant_id=c.tenant_id
         AND revoked.first_user_id=c.first_user_id
         AND revoked.second_user_id=c.second_user_id
         AND revoked.status='declined')
    AND NOT EXISTS (
      SELECT 1 FROM talks.safety_preferences sp WHERE sp.tenant_id=$1 AND sp.blocked=true
       AND ((sp.viewer_user_id=c.first_user_id AND sp.subject_user_id=c.second_user_id)
         OR (sp.viewer_user_id=c.second_user_id AND sp.subject_user_id=c.first_user_id)))
    AND NOT EXISTS (
      SELECT 1 FROM talks.safety_enforcement se
       JOIN talks.public_profiles pp ON pp.tenant_id=se.tenant_id
         AND pp.handle=se.target_id
       WHERE se.tenant_id=$1 AND se.target_kind='profile'
         AND se.visibility IN ('restricted','blocked')
         AND pp.user_id IN (c.first_user_id,c.second_user_id))
`;
const eligibleReader = `
    c.tenant_id=$1 AND c.conversation_id=$3
    AND ${eligibleMember}
`;
const sendPermission = `
    AND COALESCE((SELECT e.status FROM talks.human_dm_contact_requests e
      WHERE e.tenant_id=c.tenant_id
        AND e.first_user_id=c.first_user_id AND e.second_user_id=c.second_user_id),'none')<>'declined'
    AND (
      EXISTS (SELECT 1 FROM talks.human_dm_contact_requests e
        WHERE e.tenant_id=c.tenant_id AND e.first_user_id=c.first_user_id
          AND e.second_user_id=c.second_user_id AND e.status='accepted')
      OR COALESCE((SELECT p.admission_policy FROM talks.human_dm_preferences p
        WHERE p.tenant_id=$1
          AND p.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END),'requests')='anyone'
      OR (
        COALESCE((SELECT p.admission_policy FROM talks.human_dm_preferences p
          WHERE p.tenant_id=$1 AND p.user_id=CASE WHEN c.first_user_id=$2
            THEN c.second_user_id ELSE c.first_user_id END),'requests')<>'nobody'
        AND EXISTS (SELECT 1 FROM talks.human_dm_messages prior
          WHERE prior.tenant_id=c.tenant_id AND prior.conversation_id=c.conversation_id
            AND prior.sender_user_id<>$2)
      )
    )
`;
async function transact<T>(pool: HumanDmPool, cb:(q:Client)=>Promise<T>):Promise<T> {
  const c=await pool.connect();
  try {
    await c.query("BEGIN");
    const result=await cb(c);
    await c.query("COMMIT"); return result;
  } catch (e) { try { await c.query("ROLLBACK"); } catch { /* original error takes priority */ } throw e; }
  finally { c.release(); }
}
async function activeAndOrderedLocks(q:Query,tenant:string,first:string,second:string) {
  // Serializes a sender's rate budget across different conversations and prevents
  // deadlocks when A and B send simultaneously.
  await q.query(
    `SELECT user_id FROM identity.users WHERE tenant_id=$1 AND user_id IN ($2,$3)
       ORDER BY user_id FOR UPDATE`, [tenant,first,second]);
}
async function conversationAllowed(q:Query,tenant:string,user:string,conversation:string,send:boolean) {
  const r=await q.query<{conversation_id:string}&Record<string,unknown>>(
    `SELECT c.conversation_id FROM talks.human_dm_conversations c
      WHERE ${eligibleReader} ${send?sendPermission:""} LIMIT 1`,
    [tenant,user,conversation]);
  return r.rows.length===1;
}
export function createPostgresHumanDmRepository(pool:HumanDmPool):HumanDmRepository {
  return Object.freeze({
    async open({tenantId,userId,otherUserId}) {
      if(userId===otherUserId) return null;
      return transact(pool,async q=>{
        await activeAndOrderedLocks(q,tenantId,userId,otherUserId);
        const eligible=await q.query<Record<string,unknown>>(`
          SELECT 1 FROM identity.users me JOIN identity.users peer
            ON peer.tenant_id=me.tenant_id AND peer.user_id=$3 AND peer.state='active'
          LEFT JOIN talks.human_dm_preferences p ON p.tenant_id=peer.tenant_id AND p.user_id=peer.user_id
          LEFT JOIN talks.human_dm_contact_requests e ON e.tenant_id=me.tenant_id
            AND e.first_user_id=LEAST($2,$3) AND e.second_user_id=GREATEST($2,$3)
          WHERE me.tenant_id=$1 AND me.user_id=$2 AND me.state='active'
            AND COALESCE(e.status,'none') <> 'declined'
            AND (e.status='accepted' OR COALESCE(p.admission_policy,'requests')='anyone')
            AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences s
              WHERE s.tenant_id=$1 AND s.blocked=true
                AND ((s.viewer_user_id=$2 AND s.subject_user_id=$3)
                  OR (s.viewer_user_id=$3 AND s.subject_user_id=$2)))
            AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement s
              JOIN talks.public_profiles pp ON pp.tenant_id=s.tenant_id AND pp.handle=s.target_id
              WHERE s.tenant_id=$1 AND s.target_kind='profile'
                AND s.visibility IN ('blocked','restricted') AND pp.user_id IN ($2,$3))
          LIMIT 1`,[tenantId,userId,otherUserId]);
        if(!eligible.rows.length) return null;
        const r=await q.query<{conversation_id:string}&Record<string,unknown>>(`
          INSERT INTO talks.human_dm_conversations(tenant_id,first_user_id,second_user_id)
          VALUES ($1,LEAST($2,$3),GREATEST($2,$3))
          ON CONFLICT(tenant_id,first_user_id,second_user_id)
          DO UPDATE SET first_user_id=EXCLUDED.first_user_id
          RETURNING conversation_id`,[tenantId,userId,otherUserId]);
        return r.rows[0]?.conversation_id ?? null;
      });
    },
    async inbox({tenantId,userId,limit,before}) {
      const r=await pool.query<{
        conversation_id:string;other_user_id:string;other_display_name:string;
        other_avatar_url:string|null;last_sequence:string|number;
        preview:string|null;updated_at:Date|string;unread_count:string|number;
      }&Record<string,unknown>>(`
        SELECT c.conversation_id,
          CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END AS other_user_id,
          c.last_sequence,c.updated_at,l.body AS preview,
          COALESCE(other_profile.display_name,
            CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END) AS other_display_name,
          other_profile.avatar_url AS other_avatar_url,
          (SELECT count(*)::int FROM talks.human_dm_messages unread
           WHERE unread.tenant_id=c.tenant_id AND unread.conversation_id=c.conversation_id
             AND unread.sender_user_id<>$2
             AND unread.sequence>COALESCE(rd.last_read_sequence,0)) AS unread_count
        FROM talks.human_dm_conversations c
        LEFT JOIN talks.public_profiles other_profile
          ON other_profile.tenant_id=c.tenant_id
          AND other_profile.user_id=CASE WHEN c.first_user_id=$2
            THEN c.second_user_id ELSE c.first_user_id END
        LEFT JOIN talks.human_dm_reads rd ON rd.tenant_id=c.tenant_id
          AND rd.conversation_id=c.conversation_id AND rd.user_id=$2
        LEFT JOIN LATERAL (
          SELECT body FROM talks.human_dm_messages lm
            WHERE lm.tenant_id=c.tenant_id AND lm.conversation_id=c.conversation_id
            ORDER BY sequence DESC LIMIT 1) l ON true
        WHERE c.tenant_id=$1 AND $2 IN(c.first_user_id,c.second_user_id)
          AND c.last_sequence>0 AND ($3::bigint IS NULL OR c.last_sequence<$3::bigint)
          AND EXISTS (SELECT 1 FROM identity.users a WHERE a.tenant_id=c.tenant_id
                AND a.user_id=c.first_user_id AND a.state='active')
          AND EXISTS (SELECT 1 FROM identity.users b WHERE b.tenant_id=c.tenant_id
                AND b.user_id=c.second_user_id AND b.state='active')
          AND NOT EXISTS (SELECT 1 FROM talks.human_dm_contact_requests revoked
              WHERE revoked.tenant_id=c.tenant_id AND revoked.first_user_id=c.first_user_id
                AND revoked.second_user_id=c.second_user_id AND revoked.status='declined')
          AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp
              WHERE sp.tenant_id=c.tenant_id AND sp.blocked=true
                AND ((sp.viewer_user_id=c.first_user_id AND sp.subject_user_id=c.second_user_id)
                  OR (sp.viewer_user_id=c.second_user_id AND sp.subject_user_id=c.first_user_id)))
          AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement se
              JOIN talks.public_profiles pp ON pp.tenant_id=se.tenant_id AND pp.handle=se.target_id
              WHERE se.tenant_id=c.tenant_id AND se.target_kind='profile'
                AND se.visibility IN ('blocked','restricted')
                AND pp.user_id IN (c.first_user_id,c.second_user_id))
        ORDER BY c.last_sequence DESC LIMIT $4
      `,[tenantId,userId,before??null,limit]);
      return r.rows.map(x=>Object.freeze<HumanDmConversation>({
        conversationId:x.conversation_id,otherUserId:x.other_user_id,
        otherDisplayName:x.other_display_name,otherAvatarUrl:x.other_avatar_url,
        lastSequence:String(x.last_sequence),preview:x.preview,updatedAt:iso(x.updated_at)!,
        unreadCount:Number(x.unread_count),
      }));
    },
    async history({tenantId,userId,conversationId,limit,before}) {
      if(!(await conversationAllowed(pool,tenantId,userId,conversationId,false))) return null;
      const r=await pool.query<MessageRow>(`
        SELECT ${messageFields} FROM talks.human_dm_messages m
        JOIN talks.human_dm_conversations c ON c.tenant_id=m.tenant_id
          AND c.conversation_id=m.conversation_id
        WHERE ${eligibleReader} AND ($4::bigint IS NULL OR m.sequence<$4::bigint)
        ORDER BY m.sequence DESC LIMIT $5
      `,[tenantId,userId,conversationId,before??null,limit]);
      return r.rows.map(message);
    },
    async send({tenantId,userId,conversationId,clientRequestId,body,sha256}) {
      return transact(pool,async q=>{
        const pair=await q.query<{first_user_id:string;second_user_id:string}&Record<string,unknown>>(
          `SELECT first_user_id,second_user_id FROM talks.human_dm_conversations
            WHERE tenant_id=$1 AND conversation_id=$2 AND $3 IN(first_user_id,second_user_id)`,
          [tenantId,conversationId,userId]);
        const c=pair.rows[0];
        if(!c) return "forbidden" as const;
        await activeAndOrderedLocks(q,tenantId,c.first_user_id,c.second_user_id);
        const permitted=await q.query<{conversation_id:string}&Record<string,unknown>>(
          `SELECT c.conversation_id FROM talks.human_dm_conversations c
             WHERE ${eligibleReader} ${sendPermission} FOR UPDATE OF c`,
          [tenantId,userId,conversationId]);
        if(!permitted.rows.length) return "forbidden" as const;
        const existing=await q.query<(MessageRow&{original_sha256:string})>(`
          SELECT ${messageFields},m.original_sha256
          FROM talks.human_dm_messages m
          WHERE m.tenant_id=$1 AND m.conversation_id=$2
            AND m.sender_user_id=$3 AND m.client_request_id=$4 LIMIT 1
        `,[tenantId,conversationId,userId,clientRequestId]);
        if(existing.rows[0]) return existing.rows[0].original_sha256===sha256?
          message(existing.rows[0]):"conflict" as const;
        const rate=await q.query<{count:string|number}&Record<string,unknown>>(`
          SELECT count(*) AS count FROM talks.human_dm_messages
          WHERE tenant_id=$1 AND sender_user_id=$2
            AND created_at>clock_timestamp()-interval '60 seconds'
        `,[tenantId,userId]);
        if(Number(rate.rows[0]?.count??0)>=30) return "rate_limited" as const;
        const sent=await q.query<MessageRow>(`
          INSERT INTO talks.human_dm_messages
           (tenant_id,conversation_id,sender_user_id,client_request_id,original_sha256,body)
          VALUES($1,$2,$3,$4,$5,$6)
          RETURNING conversation_id,message_id,sequence,sender_user_id,
            client_request_id,body,created_at,edited_at,deleted_at
        `,[tenantId,conversationId,userId,clientRequestId,sha256,body]);
        const row=sent.rows[0]!;
        await q.query(`
          UPDATE talks.human_dm_conversations SET last_sequence=$3,updated_at=clock_timestamp()
          WHERE tenant_id=$1 AND conversation_id=$2`,
          [tenantId,conversationId,String(row.sequence)]);
        return message(row);
      });
    },
    async edit({tenantId,userId,messageId,body}) {
      // The old read-authorize-then-UPDATE sequence allowed a block/decline or
      // account deactivation between statements under READ COMMITTED.
      // Join the conversation and enforce the C01/safety policy on the UPDATE.
      const r=await pool.query<MessageRow>(`
        UPDATE talks.human_dm_messages m
          SET body=$4,edited_at=clock_timestamp()
        FROM talks.human_dm_conversations c
        WHERE m.tenant_id=$1 AND m.message_id=$3 AND m.sender_user_id=$2
          AND c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id
          AND c.tenant_id=$1 AND ${eligibleMember}
          AND m.deleted_at IS NULL
          AND m.created_at>clock_timestamp()-interval '15 minutes'
        RETURNING ${messageFields}
      `,[tenantId,userId,messageId,body]);
      return r.rows[0]?message(r.rows[0]):null;
    },
    async remove({tenantId,userId,messageId}) {
      // A tombstone write must not use a preflight grant. Repeated deletes
      // return the existing tombstone only while the actor is still eligible.
      const values=[tenantId,userId,messageId];
      const deleted=await pool.query<MessageRow>(`
        UPDATE talks.human_dm_messages m
          SET body=NULL,deleted_at=clock_timestamp()
        FROM talks.human_dm_conversations c
        WHERE m.tenant_id=$1 AND m.message_id=$3 AND m.sender_user_id=$2
          AND c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id
          AND c.tenant_id=$1 AND ${eligibleMember}
          AND m.deleted_at IS NULL
        RETURNING ${messageFields}
      `,values);
      if(deleted.rows[0]) return message(deleted.rows[0]);
      const existing=await pool.query<MessageRow>(`
        SELECT ${messageFields}
        FROM talks.human_dm_messages m
        JOIN talks.human_dm_conversations c
          ON c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id
        WHERE m.tenant_id=$1 AND m.message_id=$3 AND m.sender_user_id=$2
          AND c.tenant_id=$1 AND ${eligibleMember}
          AND m.deleted_at IS NOT NULL
      `,values);
      return existing.rows[0]?message(existing.rows[0]):null;
    },
    async read({tenantId,userId,conversationId,throughSequence}) {
      // A separate permission preflight followed by a blind UPSERT is unsafe:
      // revocation can commit between the two READ COMMITTED statements.
      // Admission and cursor advancement must happen in ONE SQL statement.
      // Reuse the same C01 reciprocal-block, account-state and moderation
      // predicates as history/send; no stale Flutter/agent grant is trusted.
      const r=await pool.query<{last_read_sequence:string|number}&Record<string,unknown>>(`
        INSERT INTO talks.human_dm_reads(tenant_id,conversation_id,user_id,last_read_sequence)
        SELECT c.tenant_id,c.conversation_id,$2,LEAST(c.last_sequence,$4::bigint)
        FROM talks.human_dm_conversations c
        WHERE ${eligibleReader}
        ON CONFLICT(tenant_id,conversation_id,user_id)
        DO UPDATE SET last_read_sequence=GREATEST(
          talks.human_dm_reads.last_read_sequence,EXCLUDED.last_read_sequence),
          updated_at=clock_timestamp()
        RETURNING last_read_sequence
      `,[tenantId,userId,conversationId,throughSequence]);
      return r.rows[0]?String(r.rows[0].last_read_sequence):null;
    },
  });
}
