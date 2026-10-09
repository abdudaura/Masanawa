import type { Principal, SelectedMessage, SelectedMessageSource } from "./service.js";
interface QueryResult<T> { readonly rows: T[] }
export interface HumanAiSql {
  query<T extends Record<string, unknown>>(sql: string, values: unknown[]): Promise<QueryResult<T>>;
}
interface Row extends Record<string, unknown> {
  message_id: string; conversation_id: string; sender_user_id: string; body: string;
  sequence: string | number; edited_at: string | Date | null; peer_user_id: string;
}
/**
 * Adapt canonical C01/C02 tables; do not create a second DM store or use a
 * client-supplied message body. Permission and selection share ONE SQL snapshot.
 * Require accepted contact (stricter than basic C02 read) and no reciprocal block.
 */
export function createPostgresHumanAiSource(pool: HumanAiSql): SelectedMessageSource {
  return Object.freeze({
    async read({ tenantId, userId, conversationId, messageIds }: Principal & {
      conversationId: string; messageIds: readonly string[];
    }): Promise<readonly SelectedMessage[] | null> {
      const result = await pool.query<Row>(`
        SELECT m.message_id, m.conversation_id, m.sender_user_id, m.body,
               m.sequence, m.edited_at,
               CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END AS peer_user_id
          FROM talks.human_dm_messages m
          JOIN talks.human_dm_conversations c
            ON c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id
          JOIN talks.human_dm_contact_requests contact
            ON contact.tenant_id=c.tenant_id AND contact.first_user_id=c.first_user_id
              AND contact.second_user_id=c.second_user_id
              AND contact.status='accepted' AND contact.revoked_by IS NULL
          JOIN identity.users owner
            ON owner.tenant_id=c.tenant_id AND owner.user_id=$2 AND owner.state='active'
          JOIN identity.users peer
            ON peer.tenant_id=c.tenant_id
             AND peer.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id ELSE c.first_user_id END
             AND peer.state='active'
         WHERE c.tenant_id=$1 AND c.conversation_id=$3 AND $2 IN (c.first_user_id,c.second_user_id)
           AND m.message_id=ANY($4::uuid[]) AND m.deleted_at IS NULL AND m.body IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM talks.safety_preferences blocked
              WHERE blocked.tenant_id=c.tenant_id AND blocked.blocked=true
                AND ((blocked.viewer_user_id=c.first_user_id AND blocked.subject_user_id=c.second_user_id)
                  OR (blocked.viewer_user_id=c.second_user_id AND blocked.subject_user_id=c.first_user_id))
           )
           AND NOT EXISTS (
             SELECT 1 FROM talks.public_profiles profile
             JOIN talks.safety_enforcement s
               ON s.tenant_id=profile.tenant_id AND s.target_kind='profile'
                AND s.target_id=profile.handle AND s.visibility IN ('blocked','restricted')
             WHERE profile.tenant_id=c.tenant_id AND profile.user_id IN (c.first_user_id,c.second_user_id)
           )
         ORDER BY m.sequence ASC
      `, [tenantId, userId, conversationId, [...messageIds]]);
      if (result.rows.length !== messageIds.length) return null;
      return result.rows.map(row => ({
        messageId: row.message_id, conversationId:row.conversation_id,
        senderUserId:row.sender_user_id, body:row.body, sequence:String(row.sequence),
        editedAt:row.edited_at === null ? null : new Date(row.edited_at).toISOString(),
        peerUserId:row.peer_user_id,
      }));
    },
  });
}
