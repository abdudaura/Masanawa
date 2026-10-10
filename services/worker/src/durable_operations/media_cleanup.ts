/** AF15: a fail-closed, restart-safe executor for an EXISTING durable media tombstone.
 * This module does not create a media authority, database schema, scheduler, or S3 client.
 * Repository adapters must atomically prevent new references to tombstoned objects.
 */
export type MediaKind = "avatar" | "voice_note" | "room_audio" | "audio_post" | "escrow_evidence";
export type CleanupCandidate = Readonly<{
  tenantId: string;
  objectKey: string;
  /** Immutable provider version or immutable, content-addressed object key. */
  objectVersion: string | null;
  kind: MediaKind;
  leaseToken: string;
  referenceRevision: number;
  /** Authoritative metadata ages; repository must atomically recheck these and holds. */
  createdAtMs: number;
  retainUntilMs: number;
}>;

export type CleanupPreflight =
  | Readonly<{ state: "ready"; referenceRevision: number; activeReferences: 0; activeHolds: 0; immutable: true }>
  | Readonly<{ state: "blocked" | "lease-lost" }>;

export interface MediaCleanupRepository {
  /** Atomic DB tombstone + lease claim. Must exclude retention holds, open escrow,
   * live references and too-new orphans. Must prevent new references while tombstoned. */
  claim(input: Readonly<{ workerId: string; nowMs: number; max: number }>): Promise<readonly CleanupCandidate[]>;
  /** Recheck canonical resource references, holds, tenant and lease immediately before deletion. */
  preflight(candidate: CleanupCandidate): Promise<CleanupPreflight>;
  /** Lease-fenced, idempotent durable completion; false means lease lost. */
  complete(candidate: CleanupCandidate): Promise<boolean>;
  /** Lease-fenced durable stop. Unknown outcome MUST stay quarantined for readback/review. */
  stop(candidate: CleanupCandidate, reason: "blocked" | "invalid" | "uncertain" | "completed-but-unrecorded"): Promise<void>;
}

export interface ImmutableObjectDeleter {
  /** DELETE only the exact tenant object and pinned version/content-addressed key.
   * `absent` is idempotent success. Must not follow redirects or delete prefixes. */
  deleteExact(candidate: CleanupCandidate): Promise<"deleted" | "absent">;
}

export interface CleanupBatchResult {
  readonly claimed: number;
  readonly deleted: number;
  readonly absent: number;
  readonly blocked: number;
  readonly leaseLost: number;
  readonly quarantined: number;
  readonly dryRun: boolean;
}

const TENANT = /^tenant_[A-Za-z0-9-]{12,100}$/u;
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/u;
const VERSION = /^[A-Za-z0-9_+=./:-]{1,128}$/u;
const KINDS: ReadonlySet<string> = new Set<MediaKind>([
  "avatar", "voice_note", "room_audio", "audio_post", "escrow_evidence",
]);

/** Validate before using any storage credentials. Reject URLs, traversal, wildcard deletes,
 * cross-tenant paths, mutable references, control characters and malformed lease fences. */
export function validCleanupCandidate(value: CleanupCandidate): boolean {
  if (!TENANT.test(value.tenantId) || !TOKEN.test(value.leaseToken) ||
      !Number.isSafeInteger(value.referenceRevision) || value.referenceRevision < 1 ||
      !Number.isSafeInteger(value.createdAtMs) || value.createdAtMs < 1 ||
      !Number.isSafeInteger(value.retainUntilMs) || value.retainUntilMs < 1 ||
      !KINDS.has(value.kind) || typeof value.objectKey !== "string" ||
      value.objectKey.length > 512 || value.objectKey.length < 5 ||
      value.objectKey.startsWith("/") || value.objectKey.endsWith("/") ||
      value.objectKey.includes("\\") || /[\u0000-\u001f\u007f*?%#]/u.test(value.objectKey)) {
    return false;
  }
  const segments = value.objectKey.split("/");
  if (segments.some(s => s.length === 0 || s === "." || s === ".." || s.length > 180) ||
      !segments.includes(value.tenantId) ||
      // A second tenant namespace would let a forged key cross a storage boundary.
      segments.some(segment => TENANT.test(segment) && segment !== value.tenantId)) return false;
  // Prevent deleting a mutable key: require provider version OR a checksum-bearing key.
  if (value.objectVersion === null) {
    return /(?:^|\/)sha256-[0-9a-f]{64}(?:\.[A-Za-z0-9]{1,8})?$/u.test(value.objectKey);
  }
  return typeof value.objectVersion === "string" && VERSION.test(value.objectVersion) &&
    !value.objectVersion.includes("..") && !value.objectVersion.includes("//");
}

/** One bounded batch; no internal automatic retries of uncertain provider writes. */
export async function runMediaCleanupBatch(input: Readonly<{
  workerId: string;
  max: number;
  nowMs: number;
  /** Deletion is disabled without an exact boolean opt-in. */
  allowDelete?: boolean;
  /** Minimum object age: 24 hours by default, never below one hour. */
  minAgeMs?: number;
  repository: MediaCleanupRepository;
  storage: ImmutableObjectDeleter;
  shouldStop?: () => boolean;
}>): Promise<CleanupBatchResult> {
  const minAgeMs = input.minAgeMs ?? 86_400_000;
  if (!TOKEN.test(input.workerId) || !Number.isSafeInteger(input.nowMs) || input.nowMs < minAgeMs ||
      !Number.isSafeInteger(minAgeMs) || minAgeMs < 3_600_000 || minAgeMs > 365 * 86_400_000 ||
      !Number.isSafeInteger(input.max) || input.max < 1 || input.max > 50) {
    throw new TypeError("media_cleanup.invalid_batch_options");
  }
  // Dry-run does not claim/tombstone or access storage: claiming has DB side effects.
  const zero = { claimed: 0, deleted: 0, absent: 0, blocked: 0, leaseLost: 0, quarantined: 0 };
  if (input.allowDelete !== true) return { ...zero, dryRun: true };
  // A real repository must claim/tombstone before this API can be called.
  if (input.shouldStop?.()) return { ...zero, dryRun: false };
  const candidates = await input.repository.claim({ workerId: input.workerId, nowMs: input.nowMs, max: input.max });
  // Reject structurally corrupt responses before touching *any* provider object.
  // Per-object invalid keys are still quarantined by the normal loop.
  if (!Array.isArray(candidates) || candidates.length > input.max ||
      candidates.some(candidate => candidate === null || typeof candidate !== "object" || Array.isArray(candidate))) {
    throw new Error("media_cleanup.invalid_claim_response");
  }
  // Detect duplicate claims across the full batch before any irreversible action.
  const identities = new Set<string>();
  for (const c of candidates) {
    if (!validCleanupCandidate(c)) continue; // the normal loop quarantines invalid rows
    const identity = `${c.tenantId}\u0000${c.objectKey}\u0000${c.objectVersion ?? ""}`;
    if (identities.has(identity)) throw new Error("media_cleanup.duplicate_claim_response");
    identities.add(identity);
  }
  let deleted = 0, absent = 0, blocked = 0, leaseLost = 0, quarantined = 0;
  for (const candidate of candidates) {
    if (input.shouldStop?.()) break; // remaining candidates retain durable leases for recovery
    if (!validCleanupCandidate(candidate)) {
      quarantined++;
      await input.repository.stop(candidate, "invalid");
      continue;
    }
    // Even a repository bug cannot advance a too-young or retained candidate.
    // The atomic repository preflight must independently revalidate age, holds
    // and reference state against live DB rows before any provider deletion.
    if (candidate.createdAtMs > input.nowMs - minAgeMs ||
        candidate.retainUntilMs > input.nowMs) {
      blocked++;
      await input.repository.stop(candidate, "blocked");
      continue;
    }
    let preflight: CleanupPreflight;
    try { preflight = await input.repository.preflight(candidate); }
    catch { quarantined++; await input.repository.stop(candidate, "uncertain"); continue; }
    if (!preflight || typeof preflight !== "object") {
      quarantined++;
      await input.repository.stop(candidate, "invalid");
      continue;
    }
    if (preflight.state === "lease-lost") { leaseLost++; continue; }
    if (preflight.state === "blocked") { blocked++; await input.repository.stop(candidate, "blocked"); continue; }
    if (preflight.state !== "ready" || preflight.referenceRevision !== candidate.referenceRevision ||
        preflight.activeReferences !== 0 || preflight.activeHolds !== 0 || preflight.immutable !== true) {
      quarantined++;
      await input.repository.stop(candidate, "invalid");
      continue;
    }
    // Preflight may await DB I/O. A drain/kill signal arriving while it was
    // pending must not start a new irreversible object deletion. Retain the
    // existing durable claim for lease-based recovery; do not mark it complete.
    if (input.shouldStop?.()) break;
    let outcome: "deleted" | "absent";
    try {
      outcome = await input.storage.deleteExact(candidate);
      if (outcome !== "deleted" && outcome !== "absent") throw new Error("invalid storage outcome");
    } catch {
      quarantined++;
      await input.repository.stop(candidate, "uncertain");
      continue;
    }
    try {
      const committed = await input.repository.complete(candidate);
      if (!committed) { leaseLost++; continue; }
      if (outcome === "deleted") deleted++; else absent++;
    } catch {
      quarantined++;
      await input.repository.stop(candidate, "completed-but-unrecorded");
    }
  }
  return { claimed: candidates.length, deleted, absent, blocked, leaseLost, quarantined, dryRun: false };
}
