import type { HumanContact, HumanContactPolicy, HumanContactRepository, HumanContactRequest } from "./model.js";

interface SqlResult<Row> { readonly rows: Row[]; readonly rowCount: number | null }
export interface HumanContactSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface LookupRow extends Record<string, unknown> {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  admission_policy: HumanContactPolicy;
  status: "pending" | "accepted" | "declined" | null;
  requested_by: string | null;
}
interface RequestRow extends Record<string, unknown> {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  status: "pending" | "accepted" | "declined";
  requested_by: string;
  updated_at: string | Date;
}

const visibleTarget = `
  FROM talks.public_profiles p
  JOIN identity.users target
    ON target.tenant_id = p.tenant_id
   AND target.user_id = p.user_id
   AND target.state = 'active'
  JOIN identity.users viewer
    ON viewer.tenant_id = p.tenant_id
   AND viewer.user_id = $2
   AND viewer.state = 'active'
  LEFT JOIN talks.human_dm_preferences pref
    ON pref.tenant_id = p.tenant_id AND pref.user_id = p.user_id
  LEFT JOIN talks.human_dm_contact_requests edge
    ON edge.tenant_id = p.tenant_id
   AND edge.first_user_id = LEAST(p.user_id, $2)
   AND edge.second_user_id = GREATEST(p.user_id, $2)
  WHERE p.tenant_id = $1
    AND p.handle = $3
    AND p.user_id <> $2
    AND NOT EXISTS (
      SELECT 1 FROM talks.safety_preferences sp
       WHERE sp.tenant_id = p.tenant_id AND sp.blocked = true
         AND ((sp.viewer_user_id = p.user_id AND sp.subject_user_id = $2)
           OR (sp.viewer_user_id = $2 AND sp.subject_user_id = p.user_id))
    )
    AND NOT EXISTS (
      SELECT 1 FROM talks.safety_enforcement se
       WHERE se.tenant_id = p.tenant_id AND se.target_kind = 'profile'
         AND se.target_id = p.handle AND se.visibility IN ('restricted','blocked')
    )
`;

/**
 * C01 repo: tenant/user permission checks are evaluated on every lookup, request and
 * response. A public handle is not a grant to send private DMs. No phonebook upload.
 */
export function createPostgresHumanContactRepository(pool: HumanContactSqlPool): HumanContactRepository {
  return Object.freeze<HumanContactRepository>({
    async lookup({ tenantId, viewerId, handle }) {
      const result = await pool.query<LookupRow>(`
        SELECT p.user_id, p.handle, p.display_name, p.avatar_url,
               COALESCE(pref.admission_policy,'requests') AS admission_policy,
               edge.status, edge.requested_by
        ${visibleTarget}
        LIMIT 1
      `, [tenantId, viewerId, handle]);
      const row = result.rows[0];
      if (!row) return null;
      const status = row.status === "accepted" ? "accepted"
        : row.status === "pending"
          ? row.requested_by === viewerId ? "outgoing" : "incoming"
          : row.status === "declined" ? "declined" : "none";
      return Object.freeze<HumanContact>({
        userId: row.user_id,
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status,
        canMessage: row.status === "accepted" || row.admission_policy === "anyone",
      });
    },

    async getOwnPolicy({ tenantId, userId }) {
      const r = await pool.query<{ policy: HumanContactPolicy } & Record<string, unknown>>(`
        SELECT COALESCE(p.admission_policy,'requests') AS policy
          FROM identity.users u
          LEFT JOIN talks.human_dm_preferences p
            ON p.tenant_id = u.tenant_id AND p.user_id = u.user_id
         WHERE u.tenant_id=$1 AND u.user_id=$2 AND u.state='active'
      `, [tenantId, userId]);
      // No policy is returned for inactive/deleted accounts.
      if (!r.rows[0]) throw new Error("messages.owner_unavailable");
      return r.rows[0].policy;
    },

    async setOwnPolicy({ tenantId, userId, policy }) {
      const result = await pool.query<{ admission_policy: HumanContactPolicy } & Record<string, unknown>>(`
        INSERT INTO talks.human_dm_preferences (tenant_id,user_id,admission_policy)
        SELECT tenant_id,user_id,$3 FROM identity.users
         WHERE tenant_id=$1 AND user_id=$2 AND state='active'
        ON CONFLICT (tenant_id,user_id)
        DO UPDATE SET admission_policy=excluded.admission_policy, updated_at=clock_timestamp()
        RETURNING admission_policy
      `, [tenantId, userId, policy]);
      if (!result.rows[0]) throw new Error("messages.owner_unavailable");
      return result.rows[0].admission_policy;
    },

    async request({ tenantId, requesterId, handle }) {
      // A single upsert is atomic on the unique user pair even when two devices
      // request concurrently. A replay must never reset a decline/acceptance or
      // generate an additional contact request.
      const result = await pool.query<{
        status: "pending" | "accepted" | "declined";
        requested_by: string;
      } & Record<string, unknown>>(`
        WITH permitted AS MATERIALIZED (
          SELECT p.user_id, COALESCE(pref.admission_policy,'requests') AS admission_policy
          ${visibleTarget}
            AND COALESCE(pref.admission_policy,'requests') <> 'nobody'
          LIMIT 1
        ),
        upserted AS (
          INSERT INTO talks.human_dm_contact_requests
             (tenant_id,first_user_id,second_user_id,requested_by,status)
          SELECT $1, LEAST($2,user_id), GREATEST($2,user_id), $2,
                 CASE WHEN admission_policy='anyone' THEN 'accepted' ELSE 'pending' END
            FROM permitted
          ON CONFLICT (tenant_id,first_user_id,second_user_id)
          DO UPDATE SET status=talks.human_dm_contact_requests.status
          RETURNING status, requested_by
        )
        SELECT status, requested_by FROM upserted
      `, [tenantId, requesterId, handle]);
      const row = result.rows[0];
      if (!row) return "unavailable";
      if (row.status === "accepted") return "accepted";
      if (row.status === "pending" && row.requested_by === requesterId) return "pending";
      return "existing";
    },

    async respond({ tenantId, recipientId, requesterId, accept }) {
      // Only the original RECIPIENT of an already pending request can respond.
      // Require both canonical identities still active and no block in either direction.
      const result = await pool.query<Record<string, unknown>>(`
        UPDATE talks.human_dm_contact_requests e
           SET status=$4, updated_at=clock_timestamp()
         WHERE e.tenant_id=$1
           AND e.first_user_id=LEAST($2,$3)
           AND e.second_user_id=GREATEST($2,$3)
           AND e.requested_by=$3
           AND $2<>$3
           AND (e.status='pending' OR e.status=$4
             OR (e.status='declined' AND $4='accepted')
             OR (e.status='accepted' AND $4='declined'))
           AND EXISTS (
             SELECT 1 FROM identity.users u
              WHERE u.tenant_id=$1 AND u.user_id=$2 AND u.state='active'
           )
           AND EXISTS (
             SELECT 1 FROM identity.users u
              WHERE u.tenant_id=$1 AND u.user_id=$3 AND u.state='active'
           )
           AND NOT EXISTS (
             SELECT 1 FROM talks.safety_preferences sp
              WHERE sp.tenant_id=$1 AND sp.blocked=true
                AND ((sp.viewer_user_id=$2 AND sp.subject_user_id=$3)
                  OR (sp.viewer_user_id=$3 AND sp.subject_user_id=$2))
           )
        RETURNING e.first_user_id
      `, [tenantId, recipientId, requesterId, accept ? "accepted" : "declined"]);
      return (result.rowCount ?? result.rows.length) > 0;
    },

    async revoke({ tenantId, actorId, otherUserId }) {
      const result = await pool.query<Record<string, unknown>>(`
        UPDATE talks.human_dm_contact_requests e
           SET status='declined',
               updated_at=CASE WHEN e.status='declined' THEN e.updated_at ELSE clock_timestamp() END
         WHERE e.tenant_id=$1
           AND e.first_user_id=LEAST($2,$3)
           AND e.second_user_id=GREATEST($2,$3)
           AND $2<>$3
           AND ($2=e.first_user_id OR $2=e.second_user_id)
        RETURNING e.first_user_id
      `, [tenantId, actorId, otherUserId]);
      return (result.rowCount ?? result.rows.length) > 0;
    },

    async list({ tenantId, userId, limit }) {
      const result = await pool.query<RequestRow>(`
        SELECT other.user_id, other.handle, other.display_name, other.avatar_url,
               edge.status, edge.requested_by, edge.updated_at
          FROM talks.human_dm_contact_requests edge
          JOIN talks.public_profiles other
            ON other.tenant_id=edge.tenant_id
           AND other.user_id=CASE WHEN edge.first_user_id=$2
                                  THEN edge.second_user_id ELSE edge.first_user_id END
          JOIN identity.users recipient
            ON recipient.tenant_id=other.tenant_id AND recipient.user_id=other.user_id
           AND recipient.state='active'
          JOIN identity.users viewer
            ON viewer.tenant_id=edge.tenant_id AND viewer.user_id=$2
           AND viewer.state='active'
         WHERE edge.tenant_id=$1
           AND (edge.first_user_id=$2 OR edge.second_user_id=$2)
           AND (edge.status IN ('pending','accepted')
             OR (edge.status='declined' AND edge.requested_by<>$2))
           AND NOT EXISTS (
             SELECT 1 FROM talks.safety_preferences sp
              WHERE sp.tenant_id=$1 AND sp.blocked=true
                AND ((sp.viewer_user_id=$2 AND sp.subject_user_id=other.user_id)
                   OR (sp.viewer_user_id=other.user_id AND sp.subject_user_id=$2))
           )
           AND NOT EXISTS (
             SELECT 1 FROM talks.safety_enforcement se
              WHERE se.tenant_id=$1 AND se.target_kind='profile'
                AND se.target_id=other.handle
                AND se.visibility IN ('restricted','blocked')
           )
         ORDER BY edge.updated_at DESC, other.user_id ASC
         LIMIT $3
      `, [tenantId, userId, limit]);
      return Object.freeze(result.rows.map(row => Object.freeze<HumanContactRequest>({
        userId: row.user_id,
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status: row.status === "accepted" ? "accepted" : row.requested_by === userId ? "outgoing" : "incoming",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString(),
      })));
    },
  });
}
