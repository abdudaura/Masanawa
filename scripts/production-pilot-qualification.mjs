import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_GOLDEN_JOURNEYS = Object.freeze(
  Array.from({ length: 12 }, (_, index) =>
    `GJ-${String(index + 1).padStart(2, "0")}`,
  ),
);

export const REQUIRED_CUTOVER_CHECKS = Object.freeze([
  "security",
  "recovery",
  "observability",
  "capacity",
  "data-migration",
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
  if (
    !normalized ||
    normalized.length > max ||
    /[\r\n\0]/u.test(normalized)
  ) {
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

function instant(value, name) {
  const normalized = text(value, name, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

function normalizeJourney(input) {
  const value = object(input, "journey");
  const id = text(value.id, "journey.id", 16);
  if (!/^GJ-\d{2}$/u.test(id)) throw new TypeError("journey.id is invalid");
  return Object.freeze({
    id,
    passed: value.passed === true,
    securityPassed: value.securityPassed === true,
    restartPassed: value.restartPassed === true,
    evidenceHash: hash(value.evidenceHash, "journey.evidenceHash"),
  });
}

function normalizeCutoverCheck(input) {
  const value = object(input, "cutover check");
  return Object.freeze({
    key: text(value.key, "cutover.key", 64).toLowerCase(),
    passed: value.passed === true,
    evidenceHash: hash(value.evidenceHash, "cutover.evidenceHash"),
  });
}

export function normalizeProductionPilotEvidence(input) {
  const value = object(input, "pilot evidence");
  if (value.schemaVersion !== 1) {
    throw new TypeError("Unsupported pilot evidence schemaVersion");
  }

  const startedAt = instant(value.startedAt, "startedAt");
  const completedAt = instant(value.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) {
    throw new RangeError("completedAt must be after startedAt");
  }

  if (value.environmentClass !== "production-like-pilot") {
    throw new TypeError("environmentClass must be production-like-pilot");
  }

  if (!Array.isArray(value.journeys) || value.journeys.length > 64) {
    throw new RangeError("journeys is invalid");
  }
  const journeys = value.journeys.map(normalizeJourney);
  const journeyIds = journeys.map((item) => item.id);
  if (new Set(journeyIds).size !== journeyIds.length) {
    throw new Error("journeys contains duplicate IDs");
  }

  const parity = object(value.parity, "parity");
  const rollback = object(value.rollback, "rollback");
  if (!Array.isArray(value.cutoverChecks) || value.cutoverChecks.length > 32) {
    throw new RangeError("cutoverChecks is invalid");
  }
  const cutoverChecks = value.cutoverChecks.map(normalizeCutoverCheck);
  const cutoverKeys = cutoverChecks.map((item) => item.key);
  if (new Set(cutoverKeys).size !== cutoverKeys.length) {
    throw new Error("cutoverChecks contains duplicate keys");
  }

  const maxRollbackMinutes = integer(
    rollback.maxRollbackMinutes,
    "rollback.maxRollbackMinutes",
    1,
    1_440,
  );
  const actualRollbackMinutes =
    rollback.actualRollbackMinutes === null ||
    rollback.actualRollbackMinutes === undefined
      ? null
      : integer(
          rollback.actualRollbackMinutes,
          "rollback.actualRollbackMinutes",
          0,
          1_440,
        );

  return Object.freeze({
    schemaVersion: 1,
    pilotId: text(value.pilotId, "pilotId", 160),
    buildId: text(value.buildId, "buildId", 200),
    schemaId: text(value.schemaId, "schemaId", 200),
    environmentClass: "production-like-pilot",
    startedAt,
    completedAt,
    journeys: Object.freeze(journeys),
    parity: Object.freeze({
      blockingOpen: integer(parity.blockingOpen, "parity.blockingOpen", 0, 100_000),
      evidenceHash: hash(parity.evidenceHash, "parity.evidenceHash"),
    }),
    rollback: Object.freeze({
      executed: rollback.executed === true,
      passed: rollback.passed === true,
      maxRollbackMinutes,
      actualRollbackMinutes,
      evidenceHash: hash(rollback.evidenceHash, "rollback.evidenceHash"),
    }),
    cutoverChecks: Object.freeze(cutoverChecks),
  });
}

export function qualifyProductionPilotEvidence(input) {
  const evidence = normalizeProductionPilotEvidence(input);
  const incomplete = [];
  const failed = [];

  const journeyById = new Map(evidence.journeys.map((journey) => [journey.id, journey]));
  for (const id of REQUIRED_GOLDEN_JOURNEYS) {
    const journey = journeyById.get(id);
    if (!journey) {
      incomplete.push(`missing-journey:${id}`);
      continue;
    }
    if (!journey.passed) failed.push(`journey-failed:${id}`);
    if (!journey.securityPassed) failed.push(`journey-security-failed:${id}`);
    if (!journey.restartPassed) failed.push(`journey-restart-failed:${id}`);
  }

  if (evidence.parity.blockingOpen !== 0) {
    failed.push(`parity-blocking-open:${evidence.parity.blockingOpen}`);
  }

  if (!evidence.rollback.executed) {
    incomplete.push("rollback-not-executed");
  } else if (!evidence.rollback.passed) {
    failed.push("rollback-failed");
  } else if (evidence.rollback.actualRollbackMinutes === null) {
    incomplete.push("rollback-duration-missing");
  } else if (
    evidence.rollback.actualRollbackMinutes >
    evidence.rollback.maxRollbackMinutes
  ) {
    failed.push(
      `rollback-rto-exceeded:${evidence.rollback.actualRollbackMinutes}>${evidence.rollback.maxRollbackMinutes}`,
    );
  }

  const cutoverByKey = new Map(
    evidence.cutoverChecks.map((check) => [check.key, check]),
  );
  for (const key of REQUIRED_CUTOVER_CHECKS) {
    const check = cutoverByKey.get(key);
    if (!check) {
      incomplete.push(`missing-cutover-check:${key}`);
      continue;
    }
    if (!check.passed) failed.push(`cutover-check-failed:${key}`);
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
    goldenJourneysPassed:
      REQUIRED_GOLDEN_JOURNEYS.length -
      failed.filter((reason) => reason.startsWith("journey-")).length -
      incomplete.filter((reason) => reason.startsWith("missing-journey:")).length,
    goldenJourneysRequired: REQUIRED_GOLDEN_JOURNEYS.length,
    blockingParityOpen: evidence.parity.blockingOpen,
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
    process.stderr.write(`${error instanceof Error ? error.message : "Pilot qualification failed"}\n`);
    process.exitCode = 1;
  }
}
