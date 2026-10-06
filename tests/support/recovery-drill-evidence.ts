export type RecoveryDrillKind =
  | "backup-restore"
  | "migration-recovery"
  | "data-export"
  | "data-deletion"
  | "credential-recovery"
  | "device-recovery";

export interface RecoveryCheckpointEvidence {
  readonly key: string;
  readonly passed: boolean;
  readonly evidenceRef: string;
}

export interface RecoveryDrillEvidence {
  readonly schemaVersion: 1;
  readonly drillId: string;
  readonly kind: RecoveryDrillKind;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly measuredRecoveryTimeMinutes: number;
  readonly measuredDataLossMinutes: number;
  readonly checkpoints: readonly RecoveryCheckpointEvidence[];
}

export interface RecoveryDrillPolicy {
  readonly maxRecoveryTimeMinutes: number;
  readonly maxDataLossMinutes: number;
}

export interface RecoveryDrillResult {
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly missingCheckpoints: readonly string[];
  readonly failedCheckpoints: readonly string[];
  readonly measuredRecoveryTimeMinutes: number;
  readonly measuredDataLossMinutes: number;
}

const requiredCheckpoints: Readonly<
  Record<RecoveryDrillKind, readonly string[]>
> = Object.freeze({
  "backup-restore": Object.freeze([
    "backup-created",
    "restore-completed",
    "integrity-verified",
    "schema-compatibility-verified",
    "tenant-ownership-verified",
    "ledger-event-continuity-verified",
    "object-references-verified",
    "stale-lease-resurrection-rejected",
  ]),
  "migration-recovery": Object.freeze([
    "preflight-backup-verified",
    "forward-migration-applied",
    "application-rollback-compatible",
    "recovery-plan-executed",
    "schema-readiness-verified",
    "data-integrity-verified",
  ]),
  "data-export": Object.freeze([
    "request-authorized",
    "tenant-scope-verified",
    "export-completeness-verified",
    "export-hash-verified",
    "cross-tenant-exclusion-verified",
  ]),
  "data-deletion": Object.freeze([
    "request-authorized",
    "retention-exceptions-classified",
    "private-payload-erasure-verified",
    "required-tombstones-preserved",
    "audit-evidence-preserved",
    "cross-tenant-nonimpact-verified",
  ]),
  "credential-recovery": Object.freeze([
    "old-generation-revoked",
    "new-generation-active",
    "old-credential-rejected",
    "new-credential-verified",
    "secret-nondisclosure-verified",
  ]),
  "device-recovery": Object.freeze([
    "old-device-revoked",
    "new-device-paired",
    "old-device-rejected",
    "assignments-revalidated",
    "pending-operation-custody-verified",
  ]),
});

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function instant(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 64);
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return date.toISOString();
}

function integer(
  value: number,
  name: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function checkpointKey(value: string): string {
  const normalized = bounded(value, "checkpoint.key", 3, 120).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("checkpoint.key is invalid");
  }
  return normalized;
}

export function evaluateRecoveryDrill(input: {
  readonly evidence: RecoveryDrillEvidence;
  readonly policy: RecoveryDrillPolicy;
}): RecoveryDrillResult {
  const evidence = input.evidence;
  if (evidence.schemaVersion !== 1) {
    throw new TypeError("Unsupported RecoveryDrillEvidence schemaVersion");
  }
  if (!(evidence.kind in requiredCheckpoints)) {
    throw new TypeError("Recovery drill kind is invalid");
  }
  if (!Array.isArray(evidence.checkpoints) || evidence.checkpoints.length < 1) {
    throw new RangeError("Recovery drill requires checkpoint evidence");
  }

  const startedAt = instant(evidence.startedAt, "startedAt");
  const completedAt = instant(evidence.completedAt, "completedAt");
  if (completedAt < startedAt) {
    throw new Error("completedAt cannot predate startedAt");
  }

  const measuredRecoveryTimeMinutes = integer(
    evidence.measuredRecoveryTimeMinutes,
    "measuredRecoveryTimeMinutes",
    0,
  );
  const measuredDataLossMinutes = integer(
    evidence.measuredDataLossMinutes,
    "measuredDataLossMinutes",
    0,
  );
  const maxRecoveryTimeMinutes = integer(
    input.policy.maxRecoveryTimeMinutes,
    "maxRecoveryTimeMinutes",
    0,
  );
  const maxDataLossMinutes = integer(
    input.policy.maxDataLossMinutes,
    "maxDataLossMinutes",
    0,
  );

  bounded(evidence.drillId, "drillId", 8, 180);

  const normalizedCheckpoints = evidence.checkpoints.map((checkpoint) => {
    if (typeof checkpoint.passed !== "boolean") {
      throw new TypeError("checkpoint.passed must be boolean");
    }
    return Object.freeze({
      key: checkpointKey(checkpoint.key),
      passed: checkpoint.passed,
      evidenceRef: bounded(
        checkpoint.evidenceRef,
        "checkpoint.evidenceRef",
        1,
        500,
      ),
    });
  });

  if (
    new Set(normalizedCheckpoints.map((checkpoint) => checkpoint.key)).size !==
    normalizedCheckpoints.length
  ) {
    throw new Error("Recovery drill contains duplicate checkpoints");
  }

  const byKey = new Map(
    normalizedCheckpoints.map((checkpoint) => [checkpoint.key, checkpoint] as const),
  );
  const required = requiredCheckpoints[evidence.kind];
  const missingCheckpoints = required.filter((key) => !byKey.has(key));
  const failedCheckpoints = required.filter(
    (key) => byKey.get(key)?.passed === false,
  );

  const failures: string[] = [];
  if (missingCheckpoints.length > 0) failures.push("missing-checkpoint");
  if (failedCheckpoints.length > 0) failures.push("failed-checkpoint");
  if (measuredRecoveryTimeMinutes > maxRecoveryTimeMinutes) {
    failures.push("rto-exceeded");
  }
  if (measuredDataLossMinutes > maxDataLossMinutes) {
    failures.push("rpo-exceeded");
  }

  return Object.freeze({
    passed: failures.length === 0,
    failures: Object.freeze(failures),
    missingCheckpoints: Object.freeze(missingCheckpoints),
    failedCheckpoints: Object.freeze(failedCheckpoints),
    measuredRecoveryTimeMinutes,
    measuredDataLossMinutes,
  });
}
