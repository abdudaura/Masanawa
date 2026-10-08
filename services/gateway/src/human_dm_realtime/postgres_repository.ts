/** C03: authoritatively read C02's durable journal, never message contents. */
export interface RealtimeEvent {
  readonly eventId: string;
  readonly conversationId: string;
  readonly kind: "message_added" | "message_changed" | "message_deleted" | "read_changed" | "access_changed";
  readonly actorUserId: string;
  readonly messageId: string | null;
  readonly messageSequence: string | null;
}
export interface SyncPage {
  readonly events: readonly RealtimeEvent[];
  readonly nextCursor: string;
  readonly hasMore: boolean;
  /** New sessions MUST load their C02 inbox/history before applying events. */
  readonly resetRequired: boolean;
}
export interface HumanDmRealtimeRepository {
  sync(input: { tenantId: string; userId: string; after: string; limit: number }): Promise<SyncPage>;
}
interface Result<R> { readonly rows: R[]; readonly rowCount: number | null }
export interface RealtimeSqlPool {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[]
  ): Promise<Result<R>>;
}
interface Row extends Record<string, unknown> {
  event_id: string | number;
  conversation_id: string;
  kind: RealtimeEvent["kind"];
  actor_user_id: string;
  message_id: string | null;
  message_sequence: string | number | null;
}

export function createPostgresHumanDmRealtimeRepository(
  pool: RealtimeSqlPool,
): HumanDmRealtimeRepository {
  return Object.freeze({
    async sync({ tenantId, userId, after, limit }) {
      // A revoked/blocked/deleted peer cannot receive another message event;
      // "access_changed" remains visible to the existing conversation member
      // precisely so their private local cache can be invalidated.
      const result = await pool.query<Row>(`
        SELECT e.event_id,e.conversation_id,e.kind,e.actor_user_id,
          e.message_id,e.message_sequence
        FROM talks.human_dm_events e
        JOIN talks.human_dm_conversations c
          ON c.tenant_id=e.tenant_id AND c.conversation_id=e.conversation_id
        JOIN identity.users me
          ON me.tenant_id=c.tenant_id AND me.user_id=$2 AND me.state='active'
        WHERE e.tenant_id=$1
          AND e.event_id>$3::bigint
          AND $2 IN(c.first_user_id,c.second_user_id)
          AND (
            e.kind='access_changed'
            OR (
              EXISTS (SELECT 1 FROM identity.users peer
                WHERE peer.tenant_id=c.tenant_id
                  AND peer.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id
                    ELSE c.first_user_id END AND peer.state='active')
              AND NOT EXISTS (SELECT 1 FROM talks.human_dm_contact_requests r
                WHERE r.tenant_id=c.tenant_id
                  AND r.first_user_id=c.first_user_id
                  AND r.second_user_id=c.second_user_id AND r.status='declined')
              AND NOT EXISTS (SELECT 1 FROM talks.safety_preferences sp
                WHERE sp.tenant_id=c.tenant_id AND sp.blocked=true
                  AND ((sp.viewer_user_id=c.first_user_id AND sp.subject_user_id=c.second_user_id)
                    OR (sp.viewer_user_id=c.second_user_id AND sp.subject_user_id=c.first_user_id)))
              AND NOT EXISTS (SELECT 1 FROM talks.safety_enforcement se
                JOIN talks.public_profiles p
                  ON p.tenant_id=se.tenant_id AND p.handle=se.target_id
                WHERE se.tenant_id=c.tenant_id AND se.target_kind='profile'
                  AND se.visibility IN ('blocked','restricted')
                  AND p.user_id IN (c.first_user_id,c.second_user_id))
            )
          )
        ORDER BY e.event_id ASC LIMIT $4
      `, [tenantId, userId, after, limit + 1]);
      const page = result.rows.slice(0, limit).map((row): RealtimeEvent =>
        Object.freeze({
          eventId: String(row.event_id), conversationId: row.conversation_id,
          kind: row.kind, actorUserId: row.actor_user_id,
          messageId: row.message_id,
          messageSequence: row.message_sequence === null ? null : String(row.message_sequence),
        }));
      return Object.freeze({
        events: Object.freeze(page),
        nextCursor: page.length ? page[page.length - 1]!.eventId : after,
        hasMore: result.rows.length > limit,
        resetRequired: false,
      });
    },
  });
}
