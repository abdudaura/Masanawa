import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_PILOT_JOURNEY_FAMILIES = Object.freeze([
  "identity-memory",
  "skills-runtime-workflows",
  "channels-devices",
  "proactivity-presence",
  "agent-phone",
  "commerce-social-studio",
  "plugins-evaluation-learning",
]);

const SHA256 = /^[a-f0-9]{64}$/u;

function object(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name, max = 256) {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function hash(value, name) {
  const normalized = text(value, name, 64).toLowerCase();
  if (!SHA256.test(normalized)) {
    throw new TypeError(`${name} must be SHA-256 hex`);
  }
  return normalized;
}

function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function boolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
  return value;
}

function instant(value, name) {
  const normalized = text(value, name, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

function keyedEvidence(input, name) {
  const value = object(input, name);
  return Object.freeze({
    key: text(value.key, `${name}.key`, 96).toLowerCase(),
    passed: boolean(value.passed, `${name}.passed`),
    evidenceHash: hash(value.evidenceHash, `${name}.evidenceHash`),
  });
}

function uniqueByKey(items, name) {
  const keys = items.map((item) => item.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${name} contains duplicate keys`);
  }
}

export function normalizeProductionPilotEvidence(input) {
  const value = object(input, "pilot evidence");
  if (value.schemaVersion !== 1) {
    throw new TypeError("Unsupported pilot evidence schemaVersion");
  }
  if (value.environmentClass !== "production-like-pilot") {
    throw new TypeError("environmentClass must be production-like-pilot");
  }

  const startedAt = instant(value.startedAt, "startedAt");
  const completedAt = instant(value.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) {
    throw new RangeError("completedAt must be after startedAt");
  }

  if (!Array.isArray(value.journeyFamilies) || value.journeyFamilies.length > 64) {
    throw new RangeError("journeyFamilies is invalid");
  }
  const journeyFamilies = value.journeyFamilies.map((item) =>
    keyedEvidence(item, "journey family"),
  );
  uniqueByKey(journeyFamilies, "journeyFamilies");

  const parity = object(value.parityLedger, "parityLedger");
  const rollback = object(value.rollbackRehearsal, "rollbackRehearsal");
  const cutover = object(value.cutoverReadiness, "cutoverReadiness");

  return Object.freeze({
    schemaVersion: 1,
    pilotId: text(value.pilotId, "pilotId", 160),
    buildId: text(value.buildId, "buildId", 200),
    schemaId: text(value.schemaId, "schemaId", 200),
    releaseArtifactHash: hash(value.releaseArtifactHash, "releaseArtifactHash"),
    environmentClass: "production-like-pilot",
    startedAt,
    completedAt,
    minimumPilotMinutes: integer(
      value.minimumPilotMinutes,
      "minimumPilotMinutes",
      1,
      43_200,
    ),
    journeyFamilies: Object.freeze(journeyFamilies),
    parityLedger: Object.freeze({
      blockingOpen: integer(parity.blockingOpen, "parityLedger.blockingOpen", 0, 100_000),
      nonBlockingOpen: integer(parity.nonBlockingOpen, "parityLedger.nonBlockingOpen", 0, 100_000),
      evidenceHash: hash(parity.evidenceHash, "parityLedger.evidenceHash"),
    }),
    rollbackRehearsal: Object.freeze({
      completed: boolean(rollback.completed, "rollbackRehearsal.completed"),
      restored: boolean(rollback.restored, "rollbackRehearsal.restored"),
      targetBuildId: text(rollback.targetBuildId, "rollbackRehearsal.targetBuildId", 200),
      targetSchemaId: text(rollback.targetSchemaId, "rollbackRehearsal.targetSchemaId", 200),
      recoveryMinutes: integer(
        rollback.recoveryMinutes,
        "rollbackRehearsal.recoveryMinutes",
        0,
        10_080,
      ),
      maximumRecoveryMinutes: integer(
        rollback.maximumRecoveryMinutes,
        "rollbackRehearsal.maximumRecoveryMinutes",
        1,
        10_080,
      ),
      evidenceHash: hash(rollback.evidenceHash, "rollbackRehearsal.evidenceHash"),
    }),
    cutoverReadiness: Object.freeze({
      configFrozen: boolean(cutover.configFrozen, "cutoverReadiness.configFrozen"),
      migrationsFrozen: boolean(cutover.migrationsFrozen, "cutoverReadiness.migrationsFrozen"),
      credentialsReady: boolean(cutover.credentialsReady, "cutoverReadiness.credentialsReady"),
      devicesReady: boolean(cutover.devicesReady, "cutoverReadiness.devicesReady"),
      runbooksReady: boolean(cutover.runbooksReady, "cutoverReadiness.runbooksReady"),
      rollbackAuthorityReady: boolean(
        cutover.rollbackAuthorityReady,
        "cutoverReadiness.rollbackAuthorityReady",
      ),
      evidenceHash: hash(cutover.evidenceHash, "cutoverReadiness.evidenceHash"),
    }),
  });
}

export function qualifyProductionPilotEvidence(input) {
  const evidence = normalizeProductionPilotEvidence(input);
  const incomplete = [];
  const failed = [];

  const pilotMinutes = Math.floor(
    (Date.parse(evidence.completedAt) - Date.parse(evidence.startedAt)) / 60_000,
  );
  if (pilotMinutes < evidence.minimumPilotMinutes) {
    incomplete.push(
      `pilot-window-short:${pilotMinutes}<${evidence.minimumPilotMinutes}`,
    );
  }

  const journeys = new Map(evidence.journeyFamilies.map((item) => [item.key, item]));
  for (const key of REQUIRED_PILOT_JOURNEY_FAMILIES) {
    const item = journeys.get(key);
    if (!item) {
      incomplete.push(`missing-journey-family:${key}`);
    } else if (!item.passed) {
      failed.push(`journey-family-failed:${key}`);
    }
  }

  if (evidence.parityLedger.blockingOpen !== 0) {
    failed.push(`parity-blocking-open:${evidence.parityLedger.blockingOpen}`);
  }

  if (!evidence.rollbackRehearsal.completed) {
    incomplete.push("rollback-rehearsal-not-completed");
  } else {
    if (!evidence.rollbackRehearsal.restored) {
      failed.push("rollback-restore-failed");
    }
    if (evidence.rollbackRehearsal.targetBuildId === evidence.buildId) {
      failed.push("rollback-target-is-pilot-build");
    }
    if (evidence.rollbackRehearsal.targetSchemaId === evidence.schemaId) {
      failed.push("rollback-target-is-pilot-schema");
    }
    if (
      evidence.rollbackRehearsal.recoveryMinutes >
      evidence.rollbackRehearsal.maximumRecoveryMinutes
    ) {
      failed.push(
        `rollback-recovery-slo-exceeded:${evidence.rollbackRehearsal.recoveryMinutes}>${evidence.rollbackRehearsal.maximumRecoveryMinutes}`,
      );
    }
  }

  for (const [key, ready] of Object.entries({
    "config-frozen": evidence.cutoverReadiness.configFrozen,
    "migrations-frozen": evidence.cutoverReadiness.migrationsFrozen,
    "credentials-ready": evidence.cutoverReadiness.credentialsReady,
    "devices-ready": evidence.cutoverReadiness.devicesReady,
    "runbooks-ready": evidence.cutoverReadiness.runbooksReady,
    "rollback-authority-ready": evidence.cutoverReadiness.rollbackAuthorityReady,
  })) {
    if (!ready) incomplete.push(`cutover-not-ready:${key}`);
  }

  const status =
    failed.length > 0
      ? "FAILED"
      : incomplete.length > 0
        ? "INCOMPLETE"
        : "READY";

  return Object.freeze({
    status,
    pilotId: evidence.pilotId,
    buildId: evidence.buildId,
    schemaId: evidence.schemaId,
    pilotMinutes,
    minimumPilotMinutes: evidence.minimumPilotMinutes,
    parityBlockingOpen: evidence.parityLedger.blockingOpen,
    parityNonBlockingOpen: evidence.parityLedger.nonBlockingOpen,
    rollbackRecoveryMinutes: evidence.rollbackRehearsal.recoveryMinutes,
    rollbackMaximumRecoveryMinutes:
      evidence.rollbackRehearsal.maximumRecoveryMinutes,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyProductionPilotEvidence(filePath) {
  const content = await readFile(filePath, "utf8");
  return qualifyProductionPilotEvidence(JSON.parse(content));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("Pilot evidence JSON path is required");
    const result = await readAndQualifyProductionPilotEvidence(filePath);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Pilot qualification failed"}\n`,
    );
    process.exitCode = 1;
  }
}
