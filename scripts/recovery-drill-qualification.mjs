#!/usr/bin/env node

import fs from "node:fs";

const REQUIRED_FAMILIES = Object.freeze([
  "database-restore",
  "migration-rollback",
  "data-export",
  "data-deletion",
  "credential-recovery",
  "device-recovery",
]);

function fail(message) {
  const error = new Error(message);
  error.name = "RecoveryDrillQualificationError";
  throw error;
}

function boundedString(value, name, min = 1, max = 512) {
  if (typeof value !== "string") fail(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    fail(`${name} is invalid`);
  }
  return normalized;
}

function finite(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${name} is invalid`);
  }
  return value;
}

function integer(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${name} is invalid`);
  }
  return value;
}

function instant(value, name) {
  const normalized = boundedString(value, name, 20, 40);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) fail(`${name} is not a valid instant`);
  return normalized;
}

function sha256(value, name) {
  const normalized = boundedString(value, name, 71, 71).toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/u.test(normalized)) {
    fail(`${name} must be sha256:<64 lowercase hex>`);
  }
  return normalized;
}

function boolean(value, name) {
  if (typeof value !== "boolean") fail(`${name} must be boolean`);
  return value;
}

function normalizeStep(step, index, drillId) {
  if (step === null || typeof step !== "object" || Array.isArray(step)) {
    fail(`${drillId}.steps[${index}] must be an object`);
  }
  const status = boundedString(step.status, `${drillId}.steps[${index}].status`, 2, 20).toLowerCase();
  if (status !== "passed" && status !== "failed") {
    fail(`${drillId}.steps[${index}].status is invalid`);
  }
  return Object.freeze({
    name: boundedString(step.name, `${drillId}.steps[${index}].name`, 2, 160),
    status,
    evidenceHash: sha256(step.evidenceHash, `${drillId}.steps[${index}].evidenceHash`),
  });
}

function normalizeCommon(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("drill must be an object");
  }
  const id = boundedString(input.id, "drill.id", 2, 120).toLowerCase();
  const family = boundedString(input.family, `${id}.family`, 2, 64).toLowerCase();
  if (!REQUIRED_FAMILIES.includes(family)) {
    fail(`${id}.family is unsupported`);
  }
  const startedAt = instant(input.startedAt, `${id}.startedAt`);
  const finishedAt = instant(input.finishedAt, `${id}.finishedAt`);
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(finishedAt);
  if (endMs <= startMs) fail(`${id} finishedAt must follow startedAt`);
  const durationSeconds = (endMs - startMs) / 1000;

  const steps = Array.isArray(input.steps)
    ? input.steps.map((step, index) => normalizeStep(step, index, id))
    : fail(`${id}.steps must be an array`);
  if (steps.length < 1 || steps.length > 128) {
    fail(`${id}.steps must contain 1..128 entries`);
  }
  const failedSteps = steps.filter((step) => step.status === "failed").length;

  return {
    id,
    family,
    startedAt,
    finishedAt,
    durationSeconds,
    environment: boundedString(input.environment, `${id}.environment`, 2, 80).toLowerCase(),
    sourceBuild: boundedString(input.sourceBuild, `${id}.sourceBuild`, 7, 128),
    sourceSchema: boundedString(input.sourceSchema, `${id}.sourceSchema`, 1, 128),
    sourceSnapshotHash: sha256(input.sourceSnapshotHash, `${id}.sourceSnapshotHash`),
    evidenceBundleHash: sha256(input.evidenceBundleHash, `${id}.evidenceBundleHash`),
    rtoSeconds: finite(input.rtoSeconds, `${id}.rtoSeconds`, { min: 0, max: 7 * 24 * 3600 }),
    rpoSeconds: finite(input.rpoSeconds, `${id}.rpoSeconds`, { min: 0, max: 7 * 24 * 3600 }),
    steps: Object.freeze(steps),
    failedSteps,
  };
}

function normalizeDatabaseRestore(input, common) {
  return Object.freeze({
    ...common,
    productionIsolated: boolean(input.productionIsolated, `${common.id}.productionIsolated`),
    restoreCompleted: boolean(input.restoreCompleted, `${common.id}.restoreCompleted`),
    integrityVerified: boolean(input.integrityVerified, `${common.id}.integrityVerified`),
    restoredSnapshotHash: sha256(input.restoredSnapshotHash, `${common.id}.restoredSnapshotHash`),
  });
}

function normalizeMigrationRollback(input, common) {
  return Object.freeze({
    ...common,
    forwardMigrationApplied: boolean(input.forwardMigrationApplied, `${common.id}.forwardMigrationApplied`),
    rollbackOrRestoreCompleted: boolean(input.rollbackOrRestoreCompleted, `${common.id}.rollbackOrRestoreCompleted`),
    compatibilityVerified: boolean(input.compatibilityVerified, `${common.id}.compatibilityVerified`),
    postRecoverySchema: boundedString(input.postRecoverySchema, `${common.id}.postRecoverySchema`, 1, 128),
  });
}

function normalizeDataExport(input, common) {
  return Object.freeze({
    ...common,
    requestedScope: boundedString(input.requestedScope, `${common.id}.requestedScope`, 2, 500),
    exportedRecordCount: integer(input.exportedRecordCount, `${common.id}.exportedRecordCount`, { min: 0 }),
    expectedRecordCount: integer(input.expectedRecordCount, `${common.id}.expectedRecordCount`, { min: 0 }),
    scopeVerified: boolean(input.scopeVerified, `${common.id}.scopeVerified`),
    exclusionsVerified: boolean(input.exclusionsVerified, `${common.id}.exclusionsVerified`),
  });
}

function normalizeDataDeletion(input, common) {
  return Object.freeze({
    ...common,
    requestedScope: boundedString(input.requestedScope, `${common.id}.requestedScope`, 2, 500),
    deletionVerified: boolean(input.deletionVerified, `${common.id}.deletionVerified`),
    protectedRetentionExplicit: boolean(
      input.protectedRetentionExplicit,
      `${common.id}.protectedRetentionExplicit`,
    ),
    residualUnexplainedCount: integer(
      input.residualUnexplainedCount,
      `${common.id}.residualUnexplainedCount`,
      { min: 0 },
    ),
  });
}

function normalizeCredentialRecovery(input, common) {
  return Object.freeze({
    ...common,
    oldCredentialRevoked: boolean(input.oldCredentialRevoked, `${common.id}.oldCredentialRevoked`),
    oldCredentialUseRejected: boolean(
      input.oldCredentialUseRejected,
      `${common.id}.oldCredentialUseRejected`,
    ),
    replacementCredentialAccepted: boolean(
      input.replacementCredentialAccepted,
      `${common.id}.replacementCredentialAccepted`,
    ),
    secretLeakObserved: boolean(input.secretLeakObserved, `${common.id}.secretLeakObserved`),
  });
}

function normalizeDeviceRecovery(input, common) {
  return Object.freeze({
    ...common,
    oldDeviceRevoked: boolean(input.oldDeviceRevoked, `${common.id}.oldDeviceRevoked`),
    oldDeviceAuthorityRejected: boolean(
      input.oldDeviceAuthorityRejected,
      `${common.id}.oldDeviceAuthorityRejected`,
    ),
    replacementRegistered: boolean(input.replacementRegistered, `${common.id}.replacementRegistered`),
    assignmentRebound: boolean(input.assignmentRebound, `${common.id}.assignmentRebound`),
    staleOperationRejected: boolean(
      input.staleOperationRejected,
      `${common.id}.staleOperationRejected`,
    ),
  });
}

function normalizeDrill(input) {
  const common = normalizeCommon(input);
  switch (common.family) {
    case "database-restore":
      return normalizeDatabaseRestore(input, common);
    case "migration-rollback":
      return normalizeMigrationRollback(input, common);
    case "data-export":
      return normalizeDataExport(input, common);
    case "data-deletion":
      return normalizeDataDeletion(input, common);
    case "credential-recovery":
      return normalizeCredentialRecovery(input, common);
    case "device-recovery":
      return normalizeDeviceRecovery(input, common);
    default:
      fail("unsupported recovery drill family");
  }
}

function normalizeThresholds(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("thresholds must be an object");
  }
  return Object.freeze({
    maxRtoSeconds: finite(input.maxRtoSeconds, "maxRtoSeconds", { min: 1, max: 7 * 24 * 3600 }),
    maxRpoSeconds: finite(input.maxRpoSeconds, "maxRpoSeconds", { min: 0, max: 7 * 24 * 3600 }),
    maxDrillAgeHours: finite(input.maxDrillAgeHours, "maxDrillAgeHours", { min: 1, max: 24 * 365 }),
  });
}

function evaluateDrill(drill, thresholds, generatedAt) {
  const failures = [];
  const incomplete = [];

  if (drill.failedSteps > 0) failures.push(`${drill.failedSteps} drill step(s) failed`);
  if (drill.rtoSeconds > thresholds.maxRtoSeconds) {
    failures.push(`RTO ${drill.rtoSeconds}s exceeds ${thresholds.maxRtoSeconds}s`);
  }
  if (drill.rpoSeconds > thresholds.maxRpoSeconds) {
    failures.push(`RPO ${drill.rpoSeconds}s exceeds ${thresholds.maxRpoSeconds}s`);
  }
  const ageHours = (Date.parse(generatedAt) - Date.parse(drill.finishedAt)) / 3_600_000;
  if (ageHours < 0) failures.push("drill evidence is from the future");
  if (ageHours > thresholds.maxDrillAgeHours) incomplete.push(`drill evidence age ${ageHours}h exceeds ${thresholds.maxDrillAgeHours}h`);

  if (drill.family === "database-restore") {
    if (!drill.productionIsolated) failures.push("restore was not isolated from production");
    if (!drill.restoreCompleted) failures.push("restore did not complete");
    if (!drill.integrityVerified) failures.push("restored data integrity was not verified");
    if (drill.restoredSnapshotHash !== drill.sourceSnapshotHash) {
      failures.push("restored snapshot hash does not match source snapshot hash");
    }
  } else if (drill.family === "migration-rollback") {
    if (!drill.forwardMigrationApplied) incomplete.push("forward migration was not exercised");
    if (!drill.rollbackOrRestoreCompleted) failures.push("rollback/restore did not complete");
    if (!drill.compatibilityVerified) failures.push("post-recovery compatibility was not verified");
    if (drill.postRecoverySchema !== drill.sourceSchema) {
      failures.push("post-recovery schema does not match source schema");
    }
  } else if (drill.family === "data-export") {
    if (!drill.scopeVerified) failures.push("export scope was not verified");
    if (!drill.exclusionsVerified) failures.push("export exclusions were not verified");
    if (drill.exportedRecordCount !== drill.expectedRecordCount) {
      failures.push("exported record count does not match expected record count");
    }
  } else if (drill.family === "data-deletion") {
    if (!drill.deletionVerified) failures.push("deletion was not verified");
    if (!drill.protectedRetentionExplicit) failures.push("protected retention exceptions were not explicit");
    if (drill.residualUnexplainedCount !== 0) {
      failures.push("unexplained residual records remain after deletion");
    }
  } else if (drill.family === "credential-recovery") {
    if (!drill.oldCredentialRevoked) failures.push("old credential was not revoked");
    if (!drill.oldCredentialUseRejected) failures.push("old credential remained usable");
    if (!drill.replacementCredentialAccepted) failures.push("replacement credential was not accepted");
    if (drill.secretLeakObserved) failures.push("secret leak observed during credential recovery");
  } else if (drill.family === "device-recovery") {
    if (!drill.oldDeviceRevoked) failures.push("old device was not revoked");
    if (!drill.oldDeviceAuthorityRejected) failures.push("old device authority remained usable");
    if (!drill.replacementRegistered) failures.push("replacement device was not registered");
    if (!drill.assignmentRebound) failures.push("assignment was not rebound to replacement device");
    if (!drill.staleOperationRejected) failures.push("stale operation was accepted after replacement");
  }

  return Object.freeze({
    id: drill.id,
    family: drill.family,
    state: failures.length > 0 ? "FAILED" : incomplete.length > 0 ? "INCOMPLETE" : "ACCEPTED",
    failures: Object.freeze(failures),
    incomplete: Object.freeze(incomplete),
    summary: drill,
  });
}

export function qualifyRecoveryDrills(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    fail("qualification input must be an object");
  }
  if (input.schemaVersion !== 1) fail("Unsupported qualification schema");
  const generatedAt = instant(input.generatedAt, "generatedAt");
  const thresholds = normalizeThresholds(input.thresholds);
  if (!Array.isArray(input.drills) || input.drills.length < 1 || input.drills.length > 100) {
    fail("drills must contain 1..100 entries");
  }

  const drills = input.drills.map(normalizeDrill);
  const ids = drills.map((drill) => drill.id);
  if (new Set(ids).size !== ids.length) fail("drill ids must be unique");

  const familyCounts = new Map();
  for (const drill of drills) familyCounts.set(drill.family, (familyCounts.get(drill.family) ?? 0) + 1);
  const duplicateFamilies = [...familyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([family]) => family);
  if (duplicateFamilies.length > 0) {
    fail(`duplicate recovery drill families: ${duplicateFamilies.join(",")}`);
  }

  const missingFamilies = REQUIRED_FAMILIES.filter((family) => !familyCounts.has(family));
  const results = drills.map((drill) => evaluateDrill(drill, thresholds, generatedAt));
  const failedCount = results.filter((result) => result.state === "FAILED").length;
  const incompleteCount =
    results.filter((result) => result.state === "INCOMPLETE").length + missingFamilies.length;

  return Object.freeze({
    schemaVersion: 1,
    generatedAt,
    state: failedCount > 0 ? "FAILED" : incompleteCount > 0 ? "INCOMPLETE" : "ACCEPTED",
    missingFamilies: Object.freeze(missingFamilies),
    acceptedCount: results.filter((result) => result.state === "ACCEPTED").length,
    incompleteCount,
    failedCount,
    results: Object.freeze(results),
  });
}

function main() {
  const [, , path] = process.argv;
  if (!path) {
    console.error("Usage: node scripts/recovery-drill-qualification.mjs <evidence.json>");
    process.exitCode = 1;
    return;
  }
  try {
    const input = JSON.parse(fs.readFileSync(path, "utf8"));
    const report = qualifyRecoveryDrills(input);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.state === "ACCEPTED" ? 0 : report.state === "INCOMPLETE" ? 2 : 3;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
