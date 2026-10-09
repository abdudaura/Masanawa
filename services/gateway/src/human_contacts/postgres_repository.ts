import type { HumanContact, HumanContactPolicy, HumanContactPreferences, HumanContactRepository, HumanContactRequest, HumanContactPageAfter } from "./model.js";

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
  revoked_by: string | null;
  request_revision: string | number | null;
}
interface RequestRow extends Record<string, unknown> {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  status: "pending" | "accepted" | "declined";
  requested_by: string;
  updated_at: string | Date;
  request_revision: string | number;
  revoked_by: string | null;
  cursor_updated_at: string;
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
    AND COALESCE(pref.discoverable_by_handle, true) = true
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
    -- An active identity is not necessarily allowed to initiate discovery:
    -- moderation may restrict the VIEWER's own public profile. Check the
    -- originator as well as the target at the SQL authorization boundary.
    AND NOT EXISTS (
      SELECT 1 FROM talks.public_profiles viewer_profile
      JOIN talks.safety_enforcement viewer_moderation
        ON viewer_moderation.tenant_id = viewer_profile.tenant_id
       AND viewer_moderation.target_kind = 'profile'
       AND viewer_moderation.target_id = viewer_profile.handle
       AND viewer_moderation.visibility IN ('restricted','blocked')
      WHERE viewer_profile.tenant_id = p.tenant_id
        AND viewer_profile.user_id = $2
    )
`;

async function queryContactRows(pool: HumanContactSqlPool, tenantId: string, userId: string, limit: number, after: HumanContactPageAfter | null): Promise<readonly RequestRow[]> {
  const result = await pool.query<RequestRow>(`
        SELECT other.user_id, other.handle, other.display_name, other.avatar_url,
               edge.status, edge.requested_by, edge.updated_at, edge.request_revision, edge.revoked_by,
               to_char(edge.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_updated_at
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
             OR (edge.status='declined' AND edge.revoked_by IS NULL AND edge.requested_by<>$2)
             OR (edge.status='declined' AND edge.revoked_by=$2))
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
           -- Restrict a moderated VIEWER too. Otherwise an already-restricted
           -- profile can still enumerate previously admitted contacts/pages.
           AND NOT EXISTS (
             SELECT 1 FROM talks.public_profiles viewer_profile
             JOIN talks.safety_enforcement viewer_moderation
               ON viewer_moderation.tenant_id=viewer_profile.tenant_id
              AND viewer_moderation.target_kind='profile'
              AND viewer_moderation.target_id=viewer_profile.handle
              AND viewer_moderation.visibility IN ('restricted','blocked')
             WHERE viewer_profile.tenant_id=edge.tenant_id
               AND viewer_profile.user_id=$2
           )
           AND ($4::timestamptz IS NULL OR edge.updated_at < $4::timestamptz
                OR (edge.updated_at = $4::timestamptz AND other.user_id > $5::text))
         ORDER BY edge.updated_at DESC, other.user_id ASC
         LIMIT $3
      `, [tenantId, userId, limit, after?.updatedAt ?? null, after?.userId ?? null]);
  return result.rows;
}
function presentContact(row: RequestRow, userId: string): HumanContactRequest {
  return Object.freeze<HumanContactRequest>({
        userId: row.user_id,
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status: row.revoked_by === userId ? "revoked"
          : row.status === "accepted" ? "accepted"
          : row.status === "declined" ? "declined"
          : row.requested_by === userId ? "outgoing" : "incoming",
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString(),
        requestRevision: String(row.request_revision),
      });
}

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
               edge.status, edge.requested_by, edge.revoked_by, edge.request_revision
        ${visibleTarget}
        LIMIT 1
      `, [tenantId, viewerId, handle]);
      const row = result.rows[0];
      if (!row) return null;
      const status = row.revoked_by === viewerId ? "revoked"
        : row.status === "accepted" ? "accepted"
        : row.status === "pending"
          ? row.requested_by === viewerId ? "outgoing" : "incoming"
          : row.status === "declined" ? "declined" : "none";
      return Object.freeze<HumanContact>({
        userId: row.user_id,
        handle: row.handle,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status,
        requestRevision: row.request_revision == null ? null : String(row.request_revision),
        canMessage: row.status === "accepted" || (row.admission_policy === "anyone" && row.status !== "declined"),
      });
    },

    async getOwnPreferences({ tenantId, userId }) {
      const r = await pool.query<{
        policy: HumanContactPolicy;
        discoverable_by_handle: boolean;
      } & Record<string, unknown>>(`
        SELECT COALESCE(p.admission_policy,'requests') AS policy,
               COALESCE(p.discoverable_by_handle,true) AS discoverable_by_handle
          FROM identity.users u
          LEFT JOIN talks.human_dm_preferences p
            ON p.tenant_id = u.tenant_id AND p.user_id = u.user_id
         WHERE u.tenant_id=$1 AND u.user_id=$2 AND u.state='active'
      `, [tenantId, userId]);
      if (!r.rows[0]) throw new Error("messages.owner_unavailable");
      return Object.freeze<HumanContactPreferences>({
        policy: r.rows[0].policy,
        discoverableByHandle: r.rows[0].discoverable_by_handle,
      });
    },

    async setOwnPreferences({ tenantId, userId, policy, discoverableByHandle }) {
      // Supplying one optional field does NOT reset the user's other preference.
      const result = await pool.query<{
        admission_policy: HumanContactPolicy;
        discoverable_by_handle: boolean;
      } & Record<string, unknown>>(`
        INSERT INTO talks.human_dm_preferences
          (tenant_id,user_id,admission_policy,discoverable_by_handle)
        SELECT tenant_id,user_id,COALESCE($3::text,'requests'),COALESCE($4::boolean,true)
          FROM identity.users
         WHERE tenant_id=$1 AND user_id=$2 AND state='active'
        ON CONFLICT (tenant_id,user_id)
        DO UPDATE SET
          admission_policy=COALESCE($3::text,talks.human_dm_preferences.admission_policy),
          discoverable_by_handle=COALESCE($4::boolean,talks.human_dm_preferences.discoverable_by_handle),
          updated_at=clock_timestamp()
        RETURNING admission_policy,discoverable_by_handle
      `, [tenantId, userId, policy ?? null, discoverableByHandle ?? null]);
      const row = result.rows[0];
      if (!row) throw new Error("messages.owner_unavailable");
      return Object.freeze<HumanContactPreferences>({
        policy: row.admission_policy,
        discoverableByHandle: row.discoverable_by_handle,
      });
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
          DO UPDATE SET
            requested_by=CASE
              WHEN talks.human_dm_contact_requests.revoked_by=EXCLUDED.requested_by THEN EXCLUDED.requested_by
              ELSE talks.human_dm_contact_requests.requested_by END,
            status=CASE
              WHEN talks.human_dm_contact_requests.revoked_by=EXCLUDED.requested_by THEN 'pending'
              ELSE talks.human_dm_contact_requests.status END,
            revoked_by=CASE
              WHEN talks.human_dm_contact_requests.revoked_by=EXCLUDED.requested_by THEN NULL
              ELSE talks.human_dm_contact_requests.revoked_by END,
            request_revision=CASE
              WHEN talks.human_dm_contact_requests.revoked_by=EXCLUDED.requested_by
                THEN talks.human_dm_contact_requests.request_revision+1
              ELSE talks.human_dm_contact_requests.request_revision END,
            updated_at=CASE
              WHEN talks.human_dm_contact_requests.revoked_by=EXCLUDED.requested_by THEN clock_timestamp()
              ELSE talks.human_dm_contact_requests.updated_at END
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

    async respond({ tenantId, recipientId, requesterId, requestRevision, accept }) {
      // Only the original RECIPIENT of an already pending request can respond.
      // Require both canonical identities still active and no block in either direction.
      const result = await pool.query<Record<string, unknown>>(`
        UPDATE talks.human_dm_contact_requests e
           SET status=$4,
               -- A retry of the same terminal response must not reshuffle contact pages.
               updated_at=CASE WHEN e.status=$4 THEN e.updated_at ELSE clock_timestamp() END
         WHERE e.tenant_id=$1
           AND e.first_user_id=LEAST($2,$3)
           AND e.second_user_id=GREATEST($2,$3)
           AND e.requested_by=$3
           -- A revocation invalidates any earlier response authority.
           AND e.revoked_by IS NULL
           AND e.request_revision=$5::bigint
           AND $2<>$3
           -- A fresh response acts only on a pending invitation. A repeated exact
           -- response is idempotent; an old response cannot flip final consent.
           AND (e.status='pending' OR e.status=$4)
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
           -- Moderation may intervene after invitation; reauthorize both profiles.
           AND NOT EXISTS (
             SELECT 1 FROM talks.public_profiles p
             JOIN talks.safety_enforcement se
               ON se.tenant_id=p.tenant_id
              AND se.target_kind='profile'
              AND se.target_id=p.handle
              AND se.visibility IN ('restricted','blocked')
             WHERE p.tenant_id=$1 AND p.user_id IN ($2,$3)
           )
        RETURNING e.first_user_id
      `, [tenantId, recipientId, requesterId, accept ? "accepted" : "declined", requestRevision]);
      return (result.rowCount ?? result.rows.length) > 0;
    },

    async revoke({ tenantId, actorId, otherUserId }) {
      const result = await pool.query<Record<string, unknown>>(`
        UPDATE talks.human_dm_contact_requests e
           SET status='declined',
               revoked_by=$2,
               updated_at=CASE WHEN e.revoked_by=$2 THEN e.updated_at ELSE clock_timestamp() END
         WHERE e.tenant_id=$1
           AND e.first_user_id=LEAST($2,$3)
           AND e.second_user_id=GREATEST($2,$3)
           AND $2<>$3
           AND ($2=e.first_user_id OR $2=e.second_user_id)
           -- A token issued before account disablement must not mutate contact
           -- consent. Recheck the ACTOR in the write statement, while still
           -- allowing an active user to revoke a now-disabled peer.
           AND EXISTS (
             SELECT 1 FROM identity.users actor
              WHERE actor.tenant_id=e.tenant_id
                AND actor.user_id=$2 AND actor.state='active'
           )
           AND (e.revoked_by IS NULL OR e.revoked_by=$2)
        RETURNING e.first_user_id
      `, [tenantId, actorId, otherUserId]);
      return (result.rowCount ?? result.rows.length) > 0;
    },

    async list({ tenantId, userId, limit }) {
      const rows = await queryContactRows(pool, tenantId, userId, limit, null);
      return Object.freeze(rows.map(row => presentContact(row, userId)));
    },
    async listPage({ tenantId, userId, limit, after }) {
      const rows = await queryContactRows(pool, tenantId, userId, limit + 1, after);
      const visible = rows.slice(0, limit);
      const last = visible[visible.length - 1];
      return {
        contacts: Object.freeze(visible.map(row => presentContact(row, userId))),
        next: rows.length > limit && last
          ? { updatedAt: last.cursor_updated_at, userId: last.user_id }
          : null,
      };
    },
  });
}
