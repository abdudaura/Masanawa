import type { ProfileAvatarRepository } from "./service.js";

export interface AvatarSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: unknown[],
  ): Promise<{ readonly rows: Row[]; readonly rowCount: number | null }>;
}

export function createPostgresAvatarRepository(pool: AvatarSqlPool): ProfileAvatarRepository {
  return Object.freeze<ProfileAvatarRepository>({
    async current({ tenantId, userId }) {
      const result = await pool.query<{ avatar_url: string | null }>(
        "SELECT avatar_url FROM talks.public_profiles WHERE tenant_id=$1 AND user_id=$2",
        [tenantId, userId],
      );
      return result.rows[0] === undefined
        ? { exists: false, url: null }
        : { exists: true, url: result.rows[0].avatar_url };
    },
    async stage(input) {
      // A staged SHA may be retried or reselected after becoming orphaned.
      // Refresh its lease *on every accepted stage*, never reuse a historic
      // created_at timestamp as the live upload's cleanup deadline.
      // Refuse deleting/active rows and owner/URL mismatches before S3 PUT.
      const result = await pool.query<{ object_key: string }>(
        `INSERT INTO talks.profile_avatar_objects
          (tenant_id,user_id,object_key,public_url,state)
         VALUES ($1,$2,$3,$4,'staged')
         ON CONFLICT (object_key) DO UPDATE
           SET state='staged',updated_at=clock_timestamp()
         WHERE talks.profile_avatar_objects.state IN ('orphaned','staged')
           AND talks.profile_avatar_objects.tenant_id=EXCLUDED.tenant_id
           AND talks.profile_avatar_objects.user_id=EXCLUDED.user_id
           AND talks.profile_avatar_objects.public_url=EXCLUDED.public_url
         RETURNING object_key`,
        [input.tenantId, input.userId, input.key, input.url],
      );
      return result.rowCount === 1;
    },
    async attach(input) {
      // Single statement scopes profile mutation and durable lifecycle.
      // CAS prevents a late upload from overwriting another device's avatar.
      const result = await pool.query<{ changed: boolean }>(
        `WITH updated AS (
          UPDATE talks.public_profiles
             SET avatar_url=$4,updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2
             AND avatar_url IS NOT DISTINCT FROM $3
             AND EXISTS (SELECT 1 FROM talks.profile_avatar_objects
               WHERE tenant_id=$1 AND user_id=$2 AND object_key=$5
                 AND state='staged')
           RETURNING user_id
        ), activated AS (
          UPDATE talks.profile_avatar_objects
             SET state='active',updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2 AND object_key=$5
             AND state='staged' AND EXISTS (SELECT 1 FROM updated)
           RETURNING object_key
        ), old_objects AS (
          UPDATE talks.profile_avatar_objects
             SET state='orphaned',updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2 AND state='active'
             AND object_key<>$5 AND EXISTS (SELECT 1 FROM activated)
           RETURNING object_key
        )
        SELECT EXISTS(SELECT 1 FROM activated) AS changed`,
        [input.tenantId, input.userId, input.expectedUrl, input.url, input.key],
      );
      return result.rows[0]?.changed === true;
    },
    async remove(input) {
      const result = await pool.query<{ changed: boolean }>(
        `WITH updated AS (
          UPDATE talks.public_profiles
             SET avatar_url=NULL,updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2
             AND avatar_url IS NOT DISTINCT FROM $3
           RETURNING user_id
        ), orphaned AS (
          UPDATE talks.profile_avatar_objects
             SET state='orphaned',updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2 AND state='active'
             AND public_url=$3 AND EXISTS (SELECT 1 FROM updated)
           RETURNING object_key
        )
        SELECT EXISTS(SELECT 1 FROM updated) AS changed`,
        [input.tenantId, input.userId, input.expectedUrl],
      );
      return result.rows[0]?.changed === true;
    },
    async claimGarbage(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new TypeError("profiles.avatar.invalid_cleanup_batch");
      }
      const result = await pool.query<{ object_key: string; tenant_id: string; user_id: string }>(
        `WITH candidates AS (
          SELECT object_key FROM talks.profile_avatar_objects
           WHERE (state='orphaned' OR
                (state='staged' AND updated_at < clock_timestamp()-interval '1 hour') OR
                (state='deleting' AND updated_at < clock_timestamp()-interval '15 minutes'))
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT $1
        )
        UPDATE talks.profile_avatar_objects avatar
           SET state='deleting',updated_at=clock_timestamp()
          FROM candidates
         WHERE avatar.object_key=candidates.object_key
         RETURNING avatar.object_key,avatar.tenant_id,avatar.user_id`,
        [limit],
      );
      return result.rows.map(row => ({
        key: row.object_key, tenantId: row.tenant_id, userId: row.user_id,
      }));
    },
    async finalizeDeleted(key) {
      await pool.query(
        "DELETE FROM talks.profile_avatar_objects WHERE object_key=$1 AND state='deleting'",
        [key],
      );
    },
    async releaseFailedDeletion(key) {
      await pool.query(
        `UPDATE talks.profile_avatar_objects
           SET state='orphaned',updated_at=clock_timestamp(),attempts=attempts+1
         WHERE object_key=$1 AND state='deleting'`,
        [key],
      );
    },
  });
}
