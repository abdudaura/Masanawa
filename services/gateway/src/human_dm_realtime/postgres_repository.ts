/** C03 metadata-only projection from the authoritative C02 journal. */
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
  /** C02 full inbox/history resnapshot is mandatory before persisting nextCursor. */
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
  event_id: string | number | null;
  conversation_id: string | null;
  kind: RealtimeEvent["kind"] | null;
  actor_user_id: string | null;
  message_id: string | null;
  message_sequence: string | number | null;
  trimmed_through: string | number;
}

export function createPostgresHumanDmRealtimeRepository(
  pool: RealtimeSqlPool,
): HumanDmRealtimeRepository {
  return Object.freeze<HumanDmRealtimeRepository>({
    async sync({ tenantId, userId, after, limit }) {
      // A SINGLE statement/snapshot reads the prune watermark AND permitted
      // events. Splitting this into two independent reads would permit a
      // concurrent trim between them and silently skip an offline event.
      const result = await pool.query<Row>(`
        WITH watermark AS (
          SELECT COALESCE((
            SELECT trimmed_through_id
              FROM talks.human_dm_event_watermarks
              WHERE tenant_id=$1 AND user_id=$2
          ),0)::bigint AS trimmed
        )
        SELECT e.event_id,e.conversation_id,e.kind,e.actor_user_id,
          e.message_id,e.message_sequence,
          watermark.trimmed::text AS trimmed_through
        FROM watermark
        LEFT JOIN LATERAL (
          SELECT e.event_id,e.conversation_id,e.kind,e.actor_user_id,
            e.message_id,e.message_sequence
          FROM talks.human_dm_events e
          JOIN talks.human_dm_conversations c
            ON c.tenant_id=e.tenant_id AND c.conversation_id=e.conversation_id
          JOIN identity.users me
            ON me.tenant_id=c.tenant_id AND me.user_id=$2
              AND me.state='active'
          WHERE e.tenant_id=$1 AND e.recipient_user_id=$2
            AND e.event_id>$3::bigint
            AND $3::bigint >= watermark.trimmed
            AND $2 IN(c.first_user_id,c.second_user_id)
            AND (
              e.kind='access_changed'
              OR (
                EXISTS (SELECT 1 FROM identity.users peer
                  WHERE peer.tenant_id=c.tenant_id
                    AND peer.user_id=CASE WHEN c.first_user_id=$2 THEN c.second_user_id
                      ELSE c.first_user_id END AND peer.state='active')
                AND NOT EXISTS (SELECT 1 FROM talks.human_dm_contact_requests revoked
                  WHERE revoked.tenant_id=c.tenant_id
                    AND revoked.first_user_id=c.first_user_id
                    AND revoked.second_user_id=c.second_user_id
                    AND revoked.status='declined')
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
        ) e ON TRUE
        ORDER BY e.event_id ASC NULLS LAST
      `, [tenantId, userId, after, limit + 1]);
      const trimmedThrough = String(result.rows[0]?.trimmed_through ?? "0");
      if (BigInt(after) < BigInt(trimmedThrough)) {
        // Never treat an expired cursor as "up to date". The client must
        // reload C02's authoritative inbox/history BEFORE acknowledging this.
        return Object.freeze({
          events: Object.freeze([]), nextCursor: trimmedThrough,
          hasMore: false, resetRequired: true,
        });
      }
      const page = result.rows.filter((row) => row.event_id !== null)
        .slice(0, limit).map((row): RealtimeEvent =>
          Object.freeze({
            eventId: String(row.event_id),
            conversationId: row.conversation_id!,
            kind: row.kind!,
            actorUserId: row.actor_user_id!,
            messageId: row.message_id,
            messageSequence: row.message_sequence === null ? null
              : String(row.message_sequence),
          }));
      return Object.freeze({
        events: Object.freeze(page),
        nextCursor: page.length ? page[page.length - 1]!.eventId : after,
        hasMore: result.rows.filter((row) => row.event_id !== null).length > limit,
        resetRequired: false,
      });
    },
  });
}
