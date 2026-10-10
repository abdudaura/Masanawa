/** Durable, one-shot AF09 processing checkpoint. AF00 calls this from the
 * existing trusted worker after installing the reviewed append-only migration.
 * No timer, competing queue, client actor, or implied moderation capability.
 */
import type { Pool } from "pg";
import type { TenantDispatchResult } from "./processing_scheduler.js";

const validCursor = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v));
const validRevision = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0 &&
  (v as number) < Number.MAX_SAFE_INTEGER;

export interface ProcessingCheckpoint {
  tenantCursor: string | null;
  revision: number;
}
export interface ProcessingCheckpointStore {
  load(): Promise<ProcessingCheckpoint>;
  /** Optimistic fencing across parallel schedulers; stale ticks never roll
   * back a newer cursor. Worker item leases and settle-CAS still own posts. */
  advance(input: { expectedRevision: number; nextCursor: string | null }): Promise<boolean>;
}
export interface ProcessingCheckpointTick {
  before: ProcessingCheckpoint;
  nextCursor: string | null;
  committed: boolean;
  sweep: TenantDispatchResult;
}

type CheckpointRow = { tenant_cursor: string | null; revision: string | number };
function decodeRow(row: CheckpointRow | undefined): ProcessingCheckpoint {
  const raw = row?.revision;
  const revision = typeof raw === "string" && /^(0|[1-9][0-9]*)$/.test(raw)
    ? Number(raw) : raw;
  if (!row || !validCursor(row.tenant_cursor) || !validRevision(revision)) {
    throw new Error("audio_posts.invalid_processing_checkpoint");
  }
  return { tenantCursor: row.tenant_cursor, revision };
}

/** Singleton checkpoint is intentionally not account-scoped: the trusted
 * scheduler discovers tenant IDs from the canonical pending-post repository.
 * The backing table is a proposal until AF00's reviewed migration is applied.
 */
export function createPostgresProcessingCheckpointStore(
  pool: Pick<Pool, "query">,
): ProcessingCheckpointStore {
  return {
    async load() {
      await pool.query(
        "INSERT INTO social.audio_post_processing_checkpoint " +
        "(job_key,tenant_cursor,revision) VALUES ('published-audio',NULL,0) " +
        "ON CONFLICT (job_key) DO NOTHING",
      );
      const result = await pool.query<CheckpointRow>(
        "SELECT tenant_cursor,revision FROM social.audio_post_processing_checkpoint " +
        "WHERE job_key='published-audio'",
      );
      if (result.rows.length !== 1) {
        throw new Error("audio_posts.invalid_processing_checkpoint");
      }
      return decodeRow(result.rows[0]);
    },
    async advance({ expectedRevision, nextCursor }) {
      if (!validRevision(expectedRevision) || !validCursor(nextCursor)) {
        throw new Error("audio_posts.invalid_processing_checkpoint");
      }
      const result = await pool.query<CheckpointRow>(
        "UPDATE social.audio_post_processing_checkpoint " +
        "SET tenant_cursor=$1, revision=revision+1, updated_at=NOW() " +
        "WHERE job_key='published-audio' AND revision=$2 " +
        "RETURNING tenant_cursor,revision",
        [nextCursor, expectedRevision],
      );
      if (result.rows.length > 1) {
        throw new Error("audio_posts.invalid_processing_checkpoint");
      }
      if (!result.rows.length) return false;
      const confirmed = decodeRow(result.rows[0]);
      if (confirmed.tenantCursor !== nextCursor ||
          confirmed.revision !== expectedRevision + 1) {
        throw new Error("audio_posts.invalid_processing_checkpoint");
      }
      return true;
    },
  };
}

/** One bounded step; AF00 supplies one trusted schedule/stop lifecycle.
 * An exception before advance leaves the cursor unchanged and the next tick
 * safely retries under existing per-post leases and settlement CAS.
 * A stale concurrent scheduler reports conflict, never fictitious progress.
 */
export function createPublishedAudioProcessingTick(deps: {
  store: ProcessingCheckpointStore;
  dispatcher: { runOnce(cursor: string | null): Promise<TenantDispatchResult> };
}) {
  return async (): Promise<ProcessingCheckpointTick> => {
    const checkpoint = await deps.store.load();
    const before = decodeRow({
      tenant_cursor: checkpoint.tenantCursor, revision: checkpoint.revision,
    });
    const sweep = await deps.dispatcher.runOnce(before.tenantCursor);
    if (!sweep || !validCursor(sweep.tenantCursor) ||
        !Number.isSafeInteger(sweep.processedTenants) || sweep.processedTenants < 0 ||
        !Number.isSafeInteger(sweep.failedTenants) || sweep.failedTenants < 0) {
      throw new Error("audio_posts.invalid_processing_sweep");
    }
    // Advancing past an errored tenant is safe: the cursor wraps after the
    // final page, so its durable pending row is rediscovered next cycle.
    const committed = await deps.store.advance({
      expectedRevision: before.revision, nextCursor: sweep.tenantCursor,
    });
    return { before, nextCursor: sweep.tenantCursor, committed, sweep };
  };
}
