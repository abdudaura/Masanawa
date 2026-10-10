import type { Pool } from "@masanawa/postgres";
import { createPostgresYouTubeCatalogSink, createPostgresYouTubeSourceLoader } from "./postgres_catalog.js";
import { createPostgresYouTubeQuota } from "./postgres_quota.js";
import { createYouTubeReconciler } from "./reconcile.js";
import { runYoutubeOutboxBatch } from "./outbox_runner.js";
import { createYouTubeDataApi } from "./youtube_api.js";

/**
 * Bounded, single-process scheduler entry point for AF00's existing worker.
 * Disabled by default. A reviewed owner wires runOnce into its lifecycle;
 * this module never spawns another process, queue or timer.
 */
export function createYouTubeSyncRuntime(input: {
  readonly pool: Pool;
  readonly workerId: string;
  readonly apiKey: string | undefined;
  readonly enabled?: boolean;
  readonly maxDailyQuota?: number;
}) {
  if (!input.workerId.trim()) throw new TypeError("youtube_worker_id_required");
  if (input.enabled !== true) {
    return {
      enabled:false as const,
      runOnce:async () => ({claimed:0,acknowledged:0,retried:0,deadLetter:0}),
    };
  }
  if (!input.apiKey?.trim()) throw new TypeError("youtube_api_key_missing");
  const api=createYouTubeDataApi({apiKey:input.apiKey});
  const quota=createPostgresYouTubeQuota(input.pool,{
    maxDailyUnits:input.maxDailyQuota??1000,
  });
  const catalog=createPostgresYouTubeCatalogSink(input.pool);
  const loadSource=createPostgresYouTubeSourceLoader(input.pool);
  const reconciler=createYouTubeReconciler({api,quota,catalog});
  return {
    enabled:true as const,
    runOnce:() => runYoutubeOutboxBatch({
      pool:input.pool,workerId:input.workerId,
      loadSource,reconcile:(source)=>reconciler.reconcile(source),
      limit:5,leaseMs:120000,
    }),
  };
}
