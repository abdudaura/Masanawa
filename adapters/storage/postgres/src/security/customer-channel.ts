import type { Pool } from "pg";
import {
  normalizeCustomerChannelLink,
  type CustomerChannelLink,
  type CustomerChannelRepository,
} from "@masanawa/security";

type ReadLinkInput = Parameters<CustomerChannelRepository["readLink"]>[0];
type SetCharacterSessionInput =
  Parameters<CustomerChannelRepository["setCharacterSession"]>[0];
type ClaimMessageInput =
  Parameters<CustomerChannelRepository["claimMessage"]>[0];
type CompleteMessageInput =
  Parameters<CustomerChannelRepository["completeMessage"]>[0];
type MarkDeliveredInput =
  Parameters<CustomerChannelRepository["markDelivered"]>[0];
type FailMessageInput =
  Parameters<CustomerChannelRepository["failMessage"]>[0];

export function createPostgresCustomerChannelRepository(
  pool: Pool,
): CustomerChannelRepository {
  return Object.freeze({
    async readLink(input: ReadLinkInput) {
      const result = await pool.query<{
        channel: "whatsapp" | "telegram";
        external_user_id: string;
        chat_id: string;
        tenant_id: string;
        user_id: string;
        character_id: string;
        character_session_id: string | null;
        updated_at: Date | string;
      }>(
        `SELECT channel,external_user_id,chat_id,tenant_id,user_id,character_id,
                character_session_id,updated_at
           FROM security.customer_channel_links
          WHERE channel=$1 AND external_user_id=$2`,
        [input.channel,input.externalUserId],
      );
      const row = result.rows[0];
      return row
        ? normalizeCustomerChannelLink({
            channel: row.channel,
            externalUserId: row.external_user_id,
            chatId: row.chat_id,
            tenantId: row.tenant_id as never,
            userId: row.user_id as never,
            characterId: row.character_id as never,
            characterSessionId: row.character_session_id as never,
            updatedAt: (row.updated_at instanceof Date
              ? row.updated_at
              : new Date(row.updated_at)).toISOString(),
          })
        : null;
    },

    async putLink(value: CustomerChannelLink) {
      const link = normalizeCustomerChannelLink(value);
      await pool.query(
        `INSERT INTO security.customer_channel_links(
           channel,external_user_id,chat_id,tenant_id,user_id,character_id,
           character_session_id,updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (channel,external_user_id)
         DO UPDATE SET chat_id=EXCLUDED.chat_id,tenant_id=EXCLUDED.tenant_id,
           user_id=EXCLUDED.user_id,character_id=EXCLUDED.character_id,
           character_session_id=EXCLUDED.character_session_id,
           updated_at=EXCLUDED.updated_at`,
        [
          link.channel,link.externalUserId,link.chatId,link.tenantId,link.userId,
          link.characterId,link.characterSessionId,link.updatedAt,
        ],
      );
    },

    async setCharacterSession(input: SetCharacterSessionInput) {
      await pool.query(
        `UPDATE security.customer_channel_links
            SET character_session_id=$4,updated_at=$5
          WHERE channel=$1 AND external_user_id=$2 AND character_id=$3`,
        [
          input.channel,input.externalUserId,input.characterId,
          input.characterSessionId,input.updatedAt,
        ],
      );
    },

    async claimMessage(input: ClaimMessageInput) {
      const inserted = await pool.query(
        `INSERT INTO security.customer_channel_messages(
           channel,message_id,external_user_id,state,reply,received_at,updated_at
         ) VALUES ($1,$2,$3,'processing',NULL,$4,$4)
         ON CONFLICT (channel,message_id) DO NOTHING
         RETURNING message_id`,
        [input.channel,input.messageId,input.externalUserId,input.receivedAt],
      );
      if (inserted.rowCount === 1) {
        return Object.freeze({ state: "claimed" as const, reply: null });
      }
      const existing = await pool.query<{ state: string; reply: string | null }>(
        `SELECT state,reply FROM security.customer_channel_messages
          WHERE channel=$1 AND message_id=$2`,
        [input.channel,input.messageId],
      );
      const row = existing.rows[0];
      if (row?.state === "failed") {
        const reclaimed = await pool.query(
          `UPDATE security.customer_channel_messages
              SET state='processing',reply=NULL,updated_at=$3
            WHERE channel=$1 AND message_id=$2 AND state='failed'
            RETURNING message_id`,
          [input.channel,input.messageId,input.receivedAt],
        );
        if (reclaimed.rowCount === 1) {
          return Object.freeze({ state: "claimed" as const, reply: null });
        }
      }
      return Object.freeze({
        state:
          row?.state === "delivered"
            ? ("delivered" as const)
            : row?.state === "completed"
              ? ("completed" as const)
              : ("processing" as const),
        reply: row?.reply ?? null,
      });
    },

    async completeMessage(input: CompleteMessageInput) {
      await pool.query(
        `UPDATE security.customer_channel_messages
            SET state='completed',reply=$3,updated_at=$4
          WHERE channel=$1 AND message_id=$2`,
        [input.channel,input.messageId,input.reply,input.completedAt],
      );
    },

    async markDelivered(input: MarkDeliveredInput) {
      await pool.query(
        `UPDATE security.customer_channel_messages
            SET state='delivered',updated_at=$3
          WHERE channel=$1 AND message_id=$2 AND state='completed'`,
        [input.channel,input.messageId,input.deliveredAt],
      );
    },

    async failMessage(input: FailMessageInput) {
      await pool.query(
        `UPDATE security.customer_channel_messages
            SET state='failed',updated_at=$3
          WHERE channel=$1 AND message_id=$2`,
        [input.channel,input.messageId,input.failedAt],
      );
    },
  });
}
