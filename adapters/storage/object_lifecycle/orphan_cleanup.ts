/**
 * AF15 private-object orphan cleanup boundary. This does not discover orphans by
 * scanning a bucket: only an authoritative metadata repository may nominate one.
 * No delete is possible without an atomic, reference/retention-checked lease.
 *
 * The repository MUST make claimForPurge an atomic compare-and-set against
 * current revision, referenced resources, unsettled financial/legal holds,
 * retention deadline and all concurrent publish/link operations. Linking an
 * object while it has an active purge lease MUST fail. A later retry may claim
 * an expired lease, but only after checking the same invariants again.
 */
export interface OrphanCandidate {
  readonly id: string;
  readonly objectKey: string;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly retainUntilMs: number;
}

export interface PurgeLease {
  readonly id: string;
  readonly objectKey: string;
  readonly leaseId: string;
  readonly expiresAtMs: number;
}

export interface OrphanMetadataRepository {
  listCandidates(input: Readonly<{ beforeMs: number; limit: number }>): Promise<readonly OrphanCandidate[]>;
  /** Return null if linked, held, expired, altered, already leased or contested. */
  claimForPurge(input: Readonly<{
    id: string;
    expectedRevision: number;
    objectKey: string;
    beforeMs: number;
    nowMs: number;
    leaseMs: number;
  }>): Promise<PurgeLease | null>;
  /** CAS by (id, leaseId); the object is already absent after deleteObject. */
  markPurged(lease: PurgeLease): Promise<void>;
  /** CAS by (id, leaseId), leave it retriable without losing financial holds. */
  markRetryable(lease: PurgeLease): Promise<void>;
}

export interface DeletableObjectStore {
  /** Deletion must be idempotent: deleting an already absent key succeeds. */
  deleteObject(objectKey: string): Promise<void>;
}

export interface OrphanCleanupOptions {
  readonly repository: OrphanMetadataRepository;
  readonly objects: DeletableObjectStore;
  /** Must be owner- or service-scoped prefixes ending in '/'. Never '*'. */
  readonly allowedPrefixes: readonly string[];
  readonly nowMs: number;
  /** Minimum age; at least one hour, typically 24h or longer per policy. */
  readonly minAgeMs: number;
  readonly maxCandidates?: number;
  readonly maxDeletes?: number;
  readonly leaseMs?: number;
  /** Explicit opt-in for real deletions; the safe default only inspects. */
  readonly allowDelete?: boolean;
}

export interface OrphanCleanupResult {
  readonly scanned: number;
  readonly eligible: number;
  readonly skipped: number;
  readonly leased: number;
  readonly deleted: number;
  readonly failed: number;
  readonly dryRun: boolean;
}

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;
function safeKey(key: string): boolean {
  return SAFE_KEY.test(key) && !key.split('/').some(s => !s || s === '.' || s === '..');
}
function boundedInt(v: number, min: number, max: number, field: string): number {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new TypeError("Invalid " + field);
  return v;
}

export async function runOrphanCleanup(input: OrphanCleanupOptions): Promise<OrphanCleanupResult> {
  const nowMs = boundedInt(input.nowMs, 1, Number.MAX_SAFE_INTEGER, 'nowMs');
  const minAgeMs = boundedInt(input.minAgeMs, 3_600_000, 365 * 86400_000, 'minAgeMs');
  const limit = boundedInt(input.maxCandidates ?? 20, 1, 100, 'maxCandidates');
  const maxDeletes = boundedInt(input.maxDeletes ?? 10, 1, 20, 'maxDeletes');
  const leaseMs = boundedInt(input.leaseMs ?? 60_000, 5_000, 300_000, 'leaseMs');
  const beforeMs = nowMs - minAgeMs;
  if (beforeMs <= 0) throw new TypeError('Cleanup clock precedes grace period');
  if (!input.repository || !input.objects || !Array.isArray(input.allowedPrefixes) ||
      input.allowedPrefixes.length === 0 || input.allowedPrefixes.length > 16 ||
      input.allowedPrefixes.some(p => !p.endsWith('/') || !safeKey(p.slice(0, -1)))) {
    throw new TypeError('Valid scoped object prefixes and adapters are required');
  }
  const candidates = await input.repository.listCandidates({ beforeMs, limit });
  if (!Array.isArray(candidates) || candidates.length > limit) {
    throw new TypeError('Repository returned an invalid or unbounded candidate page');
  }
  // Validate the WHOLE page before taking a lease or touching object storage.
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const c of candidates) {
    if (!c || !SAFE_ID.test(c.id) || !safeKey(c.objectKey) ||
        !input.allowedPrefixes.some(p => c.objectKey.startsWith(p)) ||
        !Number.isSafeInteger(c.revision) || c.revision < 0 ||
        !Number.isSafeInteger(c.createdAtMs) || c.createdAtMs < 1 ||
        !Number.isSafeInteger(c.retainUntilMs) || c.retainUntilMs < 1 ||
        ids.has(c.id) || keys.has(c.objectKey)) {
      throw new TypeError('Unsafe or duplicate orphan candidate page');
    }
    ids.add(c.id);
    keys.add(c.objectKey);
  }
  let eligible = 0, skipped = 0, leased = 0, deleted = 0, failed = 0;
  for (const c of candidates) {
    if (c.createdAtMs > beforeMs || c.retainUntilMs > nowMs) {
      skipped++;
      continue;
    }
    eligible++;
    if (!input.allowDelete || leased >= maxDeletes) continue;
    const lease = await input.repository.claimForPurge({
      id: c.id, expectedRevision: c.revision, objectKey: c.objectKey,
      beforeMs, nowMs, leaseMs,
    });
    if (!lease) { skipped++; continue; }
    // Guard against a broken repository returning another key or stale lease.
    if (lease.id !== c.id || lease.objectKey !== c.objectKey ||
        !SAFE_ID.test(lease.leaseId) || !Number.isSafeInteger(lease.expiresAtMs) ||
        lease.expiresAtMs <= nowMs || lease.expiresAtMs > nowMs + leaseMs) {
      throw new TypeError('Repository returned an invalid purge lease');
    }
    leased++;
    try {
      await input.objects.deleteObject(lease.objectKey);
    } catch {
      failed++;
      // Do not log keys or unknown provider error bodies. Failure to persist
      // retryability propagates: it must not be misreported as a clean sweep.
      await input.repository.markRetryable(lease);
      continue;
    }
    // This must be retriable after process restart if a DB write fails;
    // the object deletion is idempotent and the lease remains authoritative.
    await input.repository.markPurged(lease);
    deleted++;
  }
  return { scanned: candidates.length, eligible, skipped, leased, deleted, failed,
    dryRun: input.allowDelete !== true };
}
