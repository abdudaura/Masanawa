import type { DmMessage, DmThread, HumanDmRepository } from "./model.js";

interface Result<Row> { readonly rows: Row[]; readonly rowCount: number | null }
interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<Result<Row>>;
  release(): void;
}
export interface HumanDmSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<Result<Row>>;
  connect(): Promise<SqlClient>;
}
interface MessageRow extends Record<string, unknown> {
  conversation_id: string; message_id: string; sequence: string | number;
  sender_user_id: string; client_message_id: string; body: string;
  created_at: Date | string; edited_at: Date | string | null; deleted_at: Date | string | null;
}
interface ThreadRow extends Record<string, unknown> {
  conversation_id: string; other_user_id: string; other_handle: string | null;
  other_display_name: string | null; last_sequence: string | number;
  last_activity_at: Date | string; last_read_sequence: string | number;
  unread_count: string | number;
}
const iso = (value: string | Date) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
function seq(value: string | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("messages.sequence_out_of_bounds");
  return n;
}
function message(r: MessageRow): DmMessage {
  return Object.freeze({
    conversationId:r.conversation_id, messageId:r.message_id, sequence:seq(r.sequence),
    clientMessageId:r.client_message_id, senderUserId:r.sender_user_id,
    text:r.deleted_at ? null : r.body, createdAt:iso(r.created_at),
    editedAt:r.edited_at ? iso(r.edited_at) : null,
    deletedAt:r.deleted_at ? iso(r.deleted_at) : null,
  });
}
const messageColumns = "conversation_id,message_id,sequence,sender_user_id,client_message_id,body,created_at,edited_at,deleted_at";
// Exact same C01 admission rule for opening AND sending, fail closed for declined
// edges, reciprocal blocks, moderation restrictions and inactive accounts.
// On send, the SQL executes inside SERIALIZABLE and never trusts the client UI.
const admitted = `
  EXISTS (
    SELECT 1 FROM identity.users self
    JOIN identity.users peer ON peer.tenant_id=self.tenant_id AND peer.user_id=$3 AND peer.state='active'
    JOIN talks.public_profiles profile ON profile.tenant_id=peer.tenant_id AND profile.user_id=peer.user_id
    LEFT JOIN talks.human_dm_preferences pref
      ON pref.tenant_id=peer.tenant_id AND pref.user_id=peer.user_id
    LEFT JOIN talks.human_dm_contact_requests contact
      ON contact.tenant_id=self.tenant_id
     AND contact.first_user_id=LEAST($2,$3)
     AND contact.second_user_id=GREATEST($2,$3)
    WHERE self.tenant_id=$1 AND self.user_id=$2 AND self.state='active'
      AND $2<>$3
      AND (
        contact.status='accepted'
        OR (COALESCE(pref.admission_policy,'requests')='anyone'
            AND contact.status IS DISTINCT FROM 'declined')
      )
      AND NOT EXISTS (
        SELECT 1 FROM talks.safety_preferences block
        WHERE block.tenant_id=$1 AND block.blocked=true
          AND ((block.viewer_user_id=$2 AND block.subject_user_id=$3)
            OR (block.viewer_user_id=$3 AND block.subject_user_id=$2))
      )
      AND NOT EXISTS (
        SELECT 1 FROM talks.safety_enforcement restriction
        WHERE restriction.tenant_id=$1 AND restriction.target_kind='profile'
          AND restriction.target_id=profile.handle
          AND restriction.visibility IN ('restricted','blocked')
      )
  )
`;
async function serializable<T>(pool: HumanDmSqlPool, fn: (client: SqlClient) => Promise<T>): Promise<T> {
  for (let attempt=0; attempt<3; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code = (error as {code?:string})?.code;
      if ((code === "40001" || code === "40P01") && attempt < 2) continue;
      throw error;
    } finally {
      client.release();
    }
  }
  throw new Error("messages.transaction_exhausted");
}
export function createPostgresHumanDmRepository(pool: HumanDmSqlPool): HumanDmRepository {
  return Object.freeze<HumanDmRepository>({
    async open({tenantId,userId,otherUserId}) {
      return serializable(pool, async (client) => {
        const result = await client.query<{conversation_id:string} & Record<string,unknown>>(`
          INSERT INTO talks.human_dm_threads(tenant_id,first_user_id,second_user_id)
          SELECT $1,LEAST($2,$3),GREATEST($2,$3)
          WHERE ${admitted}
          ON CONFLICT (tenant_id,first_user_id,second_user_id)
          DO UPDATE SET last_sequence=talks.human_dm_threads.last_sequence
          RETURNING conversation_id
        `,[tenantId,userId,otherUserId]);
        return result.rows[0]?.conversation_id ?? null;
      });
    },
    async list({tenantId,userId,limit,before}) {
      const result = await pool.query<ThreadRow>(`
        SELECT t.conversation_id,
          CASE WHEN t.first_user_id=$2 THEN t.second_user_id ELSE t.first_user_id END AS other_user_id,
          p.handle AS other_handle, p.display_name AS other_display_name,
          t.last_sequence,t.last_activity_at,
          COALESCE(cursor.last_read_sequence,0) AS last_read_sequence,
          (SELECT COUNT(*)::bigint FROM talks.human_dm_messages msg
           WHERE msg.tenant_id=t.tenant_id AND msg.conversation_id=t.conversation_id
             AND msg.sequence>COALESCE(cursor.last_read_sequence,0)
             AND msg.sender_user_id<>$2) AS unread_count
        FROM talks.human_dm_threads t
        JOIN identity.users viewer ON viewer.tenant_id=t.tenant_id AND viewer.user_id=$2 AND viewer.state='active'
        LEFT JOIN talks.public_profiles p ON p.tenant_id=t.tenant_id AND p.user_id=
          CASE WHEN t.first_user_id=$2 THEN t.second_user_id ELSE t.first_user_id END
        LEFT JOIN talks.human_dm_read_cursors cursor
          ON cursor.tenant_id=t.tenant_id AND cursor.conversation_id=t.conversation_id AND cursor.user_id=$2
        WHERE t.tenant_id=$1 AND ($2=t.first_user_id OR $2=t.second_user_id)
          AND ($4::timestamptz IS NULL OR t.last_activity_at < $4::timestamptz)
        ORDER BY t.last_activity_at DESC,t.conversation_id DESC
        LIMIT $3
      `,[tenantId,userId,limit,before??null]);
      return Object.freeze(result.rows.map(r=>Object.freeze<DmThread>({
        conversationId:r.conversation_id,otherUserId:r.other_user_id,
        otherHandle:r.other_handle,otherDisplayName:r.other_display_name??"Unavailable person",
        lastSequence:seq(r.last_sequence),lastActivityAt:iso(r.last_activity_at),
        lastReadSequence:seq(r.last_read_sequence),unreadCount:seq(r.unread_count),
      })));
    },
    async history({tenantId,userId,conversationId,limit,beforeSequence}) {
      const valid = await pool.query<{conversation_id:string} & Record<string,unknown>>(`
        SELECT conversation_id FROM talks.human_dm_threads
        WHERE tenant_id=$1 AND conversation_id=$2 AND ($3=first_user_id OR $3=second_user_id)
          AND EXISTS (SELECT 1 FROM identity.users
             WHERE tenant_id=$1 AND user_id=$3 AND state='active')
      `,[tenantId,conversationId,userId]);
      if (!valid.rows.length) return null;
      const messages = await pool.query<MessageRow>(`
        SELECT ${messageColumns} FROM talks.human_dm_messages
        WHERE tenant_id=$1 AND conversation_id=$2
          AND ($3::bigint IS NULL OR sequence < $3::bigint)
        ORDER BY sequence DESC LIMIT $4
      `,[tenantId,conversationId,beforeSequence??null,limit]);
      return Object.freeze(messages.rows.map(message));
    },
    async send({tenantId,userId,conversationId,clientMessageId,text}) {
      return serializable(pool, async (client) => {
        // An advisory xact lock serializes sender rate accounting even when the
        // sender uses many threads at once. Retry of an ack-loss stays free.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))",
          [`dm-sender:${tenantId}:${userId}`]);
        const existing = await client.query<MessageRow>(`
          SELECT ${messageColumns} FROM talks.human_dm_messages
          WHERE tenant_id=$1 AND sender_user_id=$2 AND client_message_id=$3
        `,[tenantId,userId,clientMessageId]);
        const prior = existing.rows[0];
        if (prior) {
          return prior.conversation_id===conversationId && prior.body===text
            ? message(prior) : "conflict" as const;
        }
        const thread = await client.query<{other_user_id:string} & Record<string,unknown>>(`
          SELECT CASE WHEN first_user_id=$2 THEN second_user_id ELSE first_user_id END AS other_user_id
          FROM talks.human_dm_threads WHERE tenant_id=$1 AND conversation_id=$3
            AND ($2=first_user_id OR $2=second_user_id)
        `,[tenantId,userId,conversationId]);
        const peer=thread.rows[0]?.other_user_id;
        if (!peer) return "unavailable" as const;
        const eligible = await client.query<{allowed:boolean} & Record<string,unknown>>(
          `SELECT ${admitted} AS allowed`,[tenantId,userId,peer]);
        if (eligible.rows[0]?.allowed !== true) return "unavailable" as const;
        const recent = await client.query<{n:string} & Record<string,unknown>>(`
          SELECT COUNT(*)::text AS n FROM talks.human_dm_messages
          WHERE tenant_id=$1 AND sender_user_id=$2 AND created_at>clock_timestamp()-INTERVAL '1 minute'
        `,[tenantId,userId]);
        if (Number(recent.rows[0]?.n??0)>=30) return "rate_limited" as const;
        const updated = await client.query<{last_sequence:string} & Record<string,unknown>>(`
          UPDATE talks.human_dm_threads
          SET last_sequence=last_sequence+1,last_activity_at=clock_timestamp()
          WHERE tenant_id=$1 AND conversation_id=$2
            AND ($3=first_user_id OR $3=second_user_id)
          RETURNING last_sequence
        `,[tenantId,conversationId,userId]);
        const position=updated.rows[0]?.last_sequence;
        if (!position) return "unavailable" as const;
        const inserted=await client.query<MessageRow>(`
          INSERT INTO talks.human_dm_messages(tenant_id,conversation_id,sequence,sender_user_id,client_message_id,body)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${messageColumns}
        `,[tenantId,conversationId,position,userId,clientMessageId,text]);
        if (!inserted.rows[0]) throw new Error("messages.insert_failed");
        return message(inserted.rows[0]);
      });
    },
    async read({tenantId,userId,conversationId,upToSequence}) {
      const result=await pool.query<{last_read_sequence:string} & Record<string,unknown>>(`
        INSERT INTO talks.human_dm_read_cursors(tenant_id,conversation_id,user_id,last_read_sequence)
        SELECT t.tenant_id,t.conversation_id,$3,LEAST($4,t.last_sequence)
        FROM talks.human_dm_threads t
        JOIN identity.users viewer ON viewer.tenant_id=t.tenant_id AND viewer.user_id=$3 AND viewer.state='active'
        WHERE t.tenant_id=$1 AND t.conversation_id=$2
          AND ($3=t.first_user_id OR $3=t.second_user_id)
        ON CONFLICT(tenant_id,conversation_id,user_id)
        DO UPDATE SET last_read_sequence=GREATEST(
          talks.human_dm_read_cursors.last_read_sequence,EXCLUDED.last_read_sequence
        ),updated_at=clock_timestamp()
        RETURNING last_read_sequence
      `,[tenantId,conversationId,userId,upToSequence]);
      return result.rows[0]?seq(result.rows[0].last_read_sequence):null;
    },
    async edit({tenantId,userId,conversationId,messageId,text}) {
      return serializable(pool,async client => {
        const peer=await client.query<{other_user_id:string} & Record<string,unknown>>(`
          SELECT CASE WHEN first_user_id=$2 THEN second_user_id ELSE first_user_id END AS other_user_id
          FROM talks.human_dm_threads WHERE tenant_id=$1 AND conversation_id=$3
            AND ($2=first_user_id OR $2=second_user_id)
        `,[tenantId,userId,conversationId]);
        if (!peer.rows[0]) return null;
        const result=await client.query<MessageRow>(`
          UPDATE talks.human_dm_messages SET body=$5,edited_at=clock_timestamp()
          WHERE tenant_id=$1 AND conversation_id=$2 AND message_id=$3 AND sender_user_id=$4
            AND deleted_at IS NULL
            AND created_at >= clock_timestamp()-INTERVAL '15 minutes'
            AND ${admitted}
          RETURNING ${messageColumns}
        `,[tenantId,userId,peer.rows[0].other_user_id,conversationId,messageId,text]);
        return result.rows[0]?message(result.rows[0]):null;
      });
    },
    async remove({tenantId,userId,conversationId,messageId}) {
      const result=await pool.query<MessageRow>(`
        UPDATE talks.human_dm_messages m SET deleted_at=COALESCE(deleted_at,clock_timestamp())
        WHERE m.tenant_id=$1 AND m.conversation_id=$2 AND m.message_id=$3 AND m.sender_user_id=$4
          AND EXISTS (SELECT 1 FROM talks.human_dm_threads t
            WHERE t.tenant_id=m.tenant_id AND t.conversation_id=m.conversation_id
              AND ($4=t.first_user_id OR $4=t.second_user_id))
        RETURNING ${messageColumns}
      `,[tenantId,conversationId,messageId,userId]);
      return result.rows[0]?message(result.rows[0]):null;
    },
  });
}
