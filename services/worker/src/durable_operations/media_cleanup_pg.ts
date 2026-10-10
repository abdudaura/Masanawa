/** AF15 PostgreSQL implementation of the canonical MediaCleanupRepository.
 *
 * This is deliberately NOT a second cleanup executor. Production remains
 * disabled until AF00 installs the matching append-only schema, attaches all
 * media producers to the reference fence and registers worker composition.
 *
 * Required DB invariant: every live reference insert/update must lock the
 * parent ops.media_cleanup_objects row and reject status != 'active'. Deletion
 * eligibility is denied unless both link_guard_installed and
 * domain_refs_reconciled were explicitly attested inside that DB row.
 */
import type { CleanupCandidate, CleanupPreflight, MediaCleanupRepository, MediaKind } from "./media_cleanup.js";
import { validCleanupCandidate } from "./media_cleanup.js";

type PgResult<T> = Readonly<{ rows: T[]; rowCount: number | null }>;
export interface CleanupPgClient {
  query<T extends object = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<PgResult<T>>;
}
export interface CleanupPgPool {
  connect(): Promise<CleanupPgClient & Readonly<{ release(): void }>>;
}

type ClaimedRow = {
  tenant_id: string; object_key: string; object_version: string | null;
  kind: MediaKind; lease_token: string; reference_revision: number;
  created_at_ms: string | number; retain_until_ms: string | number;
};
type PreflightRow = {
  reference_revision: number; created_at_ms: string | number; retain_until_ms: string | number;
  active_references: number; active_holds: number; immutable: boolean;
  link_guard_installed: boolean; domain_refs_reconciled: boolean;
};

const CLAIM_SQL = `
WITH eligible AS (
  SELECT o.tenant_id, o.object_key
  FROM ops.media_cleanup_objects AS o
  WHERE o.status = 'pending'
    AND o.delete_approved IS TRUE
    AND o.link_guard_installed IS TRUE
    AND o.domain_refs_reconciled IS TRUE
    AND o.immutable IS TRUE
    AND o.created_at <= to_timestamp($1::double precision / 1000.0) - interval '24 hours'
    AND o.retain_until <= to_timestamp($1::double precision / 1000.0)
    AND o.object_version IS NOT NULL OR FALSE
  ORDER BY o.retain_until ASC, o.tenant_id ASC, o.object_key ASC
  LIMIT $2
  FOR UPDATE OF o SKIP LOCKED
)
UPDATE ops.media_cleanup_objects AS o
SET status = 'deleting', lease_token = replace(gen_random_uuid()::text, '-', ''),
    lease_owner = $3, lease_expires_at = to_timestamp($1::double precision / 1000.0) + interval '10 minutes',
    reference_revision = o.reference_revision + 1,
    updated_at = to_timestamp($1::double precision / 1000.0)
FROM eligible AS e
WHERE o.tenant_id = e.tenant_id AND o.object_key = e.object_key
  AND NOT EXISTS (
    SELECT 1 FROM ops.media_cleanup_references r
    WHERE r.tenant_id = o.tenant_id AND r.object_key = o.object_key AND r.active IS TRUE
  )
  AND NOT EXISTS (
    SELECT 1 FROM ops.media_cleanup_holds h
    WHERE h.tenant_id = o.tenant_id AND h.object_key = o.object_key AND h.active IS TRUE
  )
RETURNING o.tenant_id, o.object_key, o.object_version, o.kind, o.lease_token,
          o.reference_revision,
          floor(extract(epoch from o.created_at) * 1000)::bigint AS created_at_ms,
          floor(extract(epoch from o.retain_until) * 1000)::bigint AS retain_until_ms`;

const PREFLIGHT_SQL = `
SELECT o.reference_revision,
  floor(extract(epoch from o.created_at) * 1000)::bigint AS created_at_ms,
  floor(extract(epoch from o.retain_until) * 1000)::bigint AS retain_until_ms,
  (SELECT count(*)::int FROM ops.media_cleanup_references r
   WHERE r.tenant_id = o.tenant_id AND r.object_key = o.object_key AND r.active IS TRUE) AS active_references,
  (SELECT count(*)::int FROM ops.media_cleanup_holds h
   WHERE h.tenant_id = o.tenant_id AND h.object_key = o.object_key AND h.active IS TRUE) AS active_holds,
  o.immutable, o.link_guard_installed, o.domain_refs_reconciled
FROM ops.media_cleanup_objects o
WHERE o.tenant_id = $1 AND o.object_key = $2
 AND o.object_version IS NOT DISTINCT FROM $3::text
 AND o.status = 'deleting' AND o.lease_token = $4
 AND o.reference_revision = $5
 AND o.lease_expires_at > clock_timestamp()
 AND o.delete_approved IS TRUE
FOR UPDATE OF o`;

const COMPLETE_SQL = `
UPDATE ops.media_cleanup_objects AS o
SET status = 'deleted', lease_token = NULL, lease_owner = NULL,
    lease_expires_at = NULL, updated_at = clock_timestamp()
WHERE o.tenant_id = $1 AND o.object_key = $2
 AND o.object_version IS NOT DISTINCT FROM $3::text
 AND o.status = 'deleting' AND o.lease_token = $4 AND o.reference_revision = $5
 AND o.lease_expires_at > clock_timestamp()
 AND o.immutable IS TRUE AND o.link_guard_installed IS TRUE
 AND o.domain_refs_reconciled IS TRUE AND o.delete_approved IS TRUE
 AND o.created_at <= clock_timestamp() - interval '24 hours'
 AND o.retain_until <= clock_timestamp()
 AND NOT EXISTS (SELECT 1 FROM ops.media_cleanup_references r
    WHERE r.tenant_id = o.tenant_id AND r.object_key = o.object_key AND r.active IS TRUE)
 AND NOT EXISTS (SELECT 1 FROM ops.media_cleanup_holds h
    WHERE h.tenant_id = o.tenant_id AND h.object_key = o.object_key AND h.active IS TRUE)
RETURNING o.object_key`;

const STOP_SQL = `
UPDATE ops.media_cleanup_objects
SET status = 'quarantined', stop_reason = $6, lease_token = NULL,
    lease_owner = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
WHERE tenant_id = $1 AND object_key = $2 AND object_version IS NOT DISTINCT FROM $3::text
  AND status = 'deleting' AND lease_token = $4 AND reference_revision = $5`;

function ms(value: string | number): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("media_cleanup.invalid_db_timestamp");
  return n;
}
function identity(candidate: CleanupCandidate): readonly unknown[] {
  return [candidate.tenantId, candidate.objectKey, candidate.objectVersion,
    candidate.leaseToken, candidate.referenceRevision];
}
/** Scoped adapter: it cannot execute arbitrary SQL or configure migration/startup. */
export function createPgMediaCleanupRepository(pool: CleanupPgPool): MediaCleanupRepository {
  if (!pool || typeof pool.connect !== "function") throw new TypeError("media_cleanup.invalid_pool");
  async function withClient<T>(fn: (client: CleanupPgClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try { return await fn(client); } finally { client.release(); }
  }
  return {
    async claim({ workerId, nowMs, max }) {
      if (!/^[A-Za-z0-9_-]{16,128}$/u.test(workerId) ||
          !Number.isSafeInteger(nowMs) || nowMs < 86_400_000 ||
          !Number.isSafeInteger(max) || max < 1 || max > 50) {
        throw new TypeError("media_cleanup.invalid_claim");
      }
      return withClient(async db => {
        const result = await db.query<ClaimedRow>(CLAIM_SQL, [nowMs, max, workerId]);
        const candidates = result.rows.map((row): CleanupCandidate => ({
          tenantId: row.tenant_id, objectKey: row.object_key,
          objectVersion: row.object_version, kind: row.kind, leaseToken: row.lease_token,
          referenceRevision: Number(row.reference_revision),
          createdAtMs: ms(row.created_at_ms), retainUntilMs: ms(row.retain_until_ms),
        }));
        // A broken database mapper is not permission to delete. An invalid
        // claim remains fenced/quarantinable; never return it to object storage.
        if (candidates.length > max || candidates.some(c => !validCleanupCandidate(c))) {
          throw new Error("media_cleanup.invalid_database_claim");
        }
        return candidates;
      });
    },
    async preflight(candidate): Promise<CleanupPreflight> {
      if (!validCleanupCandidate(candidate)) return { state: "blocked" };
      return withClient(async db => {
        const res = await db.query<PreflightRow>(PREFLIGHT_SQL, identity(candidate));
        if (res.rows.length !== 1) return { state: "lease-lost" };
        const row = res.rows[0];
        const safe = row.link_guard_installed === true && row.domain_refs_reconciled === true &&
          row.immutable === true && Number(row.reference_revision) === candidate.referenceRevision &&
          ms(row.created_at_ms) === candidate.createdAtMs && ms(row.retain_until_ms) === candidate.retainUntilMs &&
          candidate.createdAtMs <= Date.now() - 86_400_000 && candidate.retainUntilMs <= Date.now() &&
          Number(row.active_references) === 0 && Number(row.active_holds) === 0;
        return safe ? { state: "ready", referenceRevision: candidate.referenceRevision,
          activeReferences: 0, activeHolds: 0, immutable: true } : { state: "blocked" };
      });
    },
    async complete(candidate) {
      if (!validCleanupCandidate(candidate)) return false;
      return withClient(async db => {
        const res = await db.query(COMPLETE_SQL, identity(candidate));
        return res.rowCount === 1 && res.rows.length === 1;
      });
    },
    async stop(candidate, reason) {
      if (!validCleanupCandidate(candidate)) return; // must not mutate unknown tenant/key
      if (!["blocked", "invalid", "uncertain", "completed-but-unrecorded"].includes(reason)) {
        throw new TypeError("media_cleanup.invalid_stop_reason");
      }
      await withClient(db => db.query(STOP_SQL, [...identity(candidate), reason]).then(() => undefined));
    },
  };
}
