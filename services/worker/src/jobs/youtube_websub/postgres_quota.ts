import type { Pool } from "@masanawa/postgres";
import type { YouTubeQuota } from "./reconcile.js";

/** Atomic budget for the single platform YouTube Data API key.
 * App-wide quota, not a per-tenant allowance that multiplies provider spend.
 * The limit is a configured policy <= 10,000 units, default 1,000/day.
 */
export function createPostgresYouTubeQuota(
  pool: Pool,
  options: { maxDailyUnits?: number } = {},
): YouTubeQuota {
  const cap=options.maxDailyUnits??1000;
  if(!Number.isInteger(cap)||cap<1||cap>10000) throw new RangeError("youtube_invalid_quota");
  return {
    async reserve(tenantId, units) {
      if(!tenantId.trim() || !Number.isInteger(units) || units<1 || units>cap) return false;
      const result=await pool.query(
        `INSERT INTO external_videos.youtube_api_quota_usage
           (utc_day, used_units, updated_at)
         VALUES ((clock_timestamp() AT TIME ZONE 'UTC')::date,$1,clock_timestamp())
         ON CONFLICT (utc_day) DO UPDATE
           SET used_units=external_videos.youtube_api_quota_usage.used_units+EXCLUDED.used_units,
               updated_at=clock_timestamp()
         WHERE external_videos.youtube_api_quota_usage.used_units+EXCLUDED.used_units <= $2
         RETURNING used_units`,
        [units,cap],
      );
      return result.rowCount===1;
    },
  };
}
