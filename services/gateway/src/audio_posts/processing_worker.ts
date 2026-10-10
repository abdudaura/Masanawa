import type { AudioPostProcessingQueue } from "@masanawa/contracts";
export type { PendingAudioPost, PendingPage, AudioPostProcessingQueue } from "@masanawa/contracts";
/** AF09: trusted background processing for durable, unpublished audio posts.
 * Gateway/worker composition must supply the existing verified moderation service;
 * this worker NEVER accepts an authenticated customer HTTP request or media URL.
 */
export type ProcessingResult = "published" | "failed";



export interface AudioPostSettler {
  settle(input: { tenantId: string; postId: string; expectedRevision: number }): Promise<{ status: string }>;
}
export interface ProcessingSweep {
  scanned: number;
  published: number;
  rejected: number;
  changed: number;
  leasedElsewhere: number;
  retryableErrors: number;
  nextCursor: string | null;
}
const safeId = (value: string): boolean =>
  typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);
/** Service-level CAS conflicts use a typed code; the canonical PostgreSQL
 * settle adapter currently throws its stable SQL-row-miss error instead.
 * Both mean the post was already edited/removed/published, not a media outage.
 * Do not broadly swallow SQL errors or treat arbitrary 'conflict' text as stale.
 */
const isChanged = (e: unknown): boolean =>
  (typeof e === "object" && e !== null && "code" in e && e.code === "CONFLICT") ||
  (e instanceof Error && e.message === "audio_posts.settle_conflict");

/**
 * One finite sweep. An external trusted scheduler supplies tenant IDs, an interval,
 * and the returned page cursor; no new job ledger or public worker route is created.
 * Processing remains durable in social.audio_posts. Crashes release PG advisory
 * locks, and existing service.settle revision-CAS prevents duplicate publication.
 */
export function createAudioPostProcessingWorker(deps: {
  queue: AudioPostProcessingQueue;
  settler: AudioPostSettler;
  onError: (event: { tenantId: string; postId: string; stage: "settle"; error: unknown }) => void;
  batchSize?: number;
}) {
  const batchSize = deps.batchSize ?? 20;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 30) {
    throw new Error("audio_posts.invalid_worker_batch_size");
  }
  return {
    async runOnce(input: { tenantId: string; cursor?: string | null }): Promise<ProcessingSweep> {
      if (!safeId(input.tenantId) ||
          (input.cursor !== undefined && input.cursor !== null &&
           (typeof input.cursor !== "string" || input.cursor.length < 1 || input.cursor.length > 256))) {
        throw new Error("audio_posts.invalid_worker_scope");
      }
      const page = await deps.queue.listPending({
        tenantId: input.tenantId, cursor: input.cursor ?? null, limit: batchSize,
      });
      if (!page || !Array.isArray(page.items) || page.items.length > batchSize ||
          (page.nextCursor !== null && (typeof page.nextCursor !== "string" || page.nextCursor.length > 256))) {
        throw new Error("audio_posts.invalid_pending_page");
      }
      const result: ProcessingSweep = {
        scanned: 0, published: 0, rejected: 0, changed: 0,
        leasedElsewhere: 0, retryableErrors: 0, nextCursor: page.nextCursor,
      };
      const seen = new Set<string>();
      for (const post of page.items) {
        if (!post || post.tenantId !== input.tenantId || !safeId(post.postId) ||
            !Number.isSafeInteger(post.revision) || post.revision < 0 ||
            typeof post.createdAt !== "string" || !Number.isFinite(Date.parse(post.createdAt)) ||
            seen.has(post.postId)) {
          throw new Error("audio_posts.invalid_pending_row");
        }
        seen.add(post.postId);
        result.scanned++;
        try {
          const outcome = await deps.queue.withLease({ tenantId: post.tenantId, postId: post.postId }, async () => {
            try {
              const settled = await deps.settler.settle({
                tenantId: post.tenantId, postId: post.postId, expectedRevision: post.revision,
              });
              if (settled.status !== "published" && settled.status !== "failed") {
                throw new Error("audio_posts.invalid_settle_result");
              }
              return settled.status as ProcessingResult;
            } catch (error) {
              if (isChanged(error)) return "changed" as const;
              throw error;
            }
          });
          if (outcome === null) result.leasedElsewhere++;
          else if (outcome === "published") result.published++;
          else if (outcome === "failed") result.rejected++;
          else if (outcome === "changed") result.changed++;
          else throw new Error("audio_posts.invalid_lease_result");
        } catch (error) {
          result.retryableErrors++;
          try { deps.onError({ tenantId: post.tenantId, postId: post.postId, stage: "settle", error }); }
          catch { /* Logging failure must not replace durable processing state. */ }
        }
      }
      return result;
    },
  };
}
