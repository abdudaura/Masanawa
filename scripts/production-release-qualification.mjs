import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_HEALTH_CHECKS = Object.freeze([
  "availability",
  "latency",
  "errors",
  "queues",
  "realtime",
  "channels",
  "commerce",
  "devices",
]);

export const REQUIRED_AUDIT_FAMILIES = Object.freeze([
  "identity-memory",
  "skills-runtime-workflows",
  "channels-devices",
  "proactivity-presence",
  "commerce-social-studio",
  "plugins-evaluation-learning",
  "security-performance-observability-recovery",
  "pilot-cutover",
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

function unique(items, name) {
  const keys = items.map((item) => item.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${name} contains duplicate keys`);
  }
}

export function normalizeProductionReleaseEvidence(input) {
  const value = object(input, "release evidence");
  if (value.schemaVersion !== 1) {
    throw new TypeError("Unsupported release evidence schemaVersion");
  }
  if (value.environmentClass !== "production") {
    throw new TypeError("environmentClass must be production");
  }

  const releasedAt = instant(value.releasedAt, "releasedAt");
  const observedUntil = instant(value.observedUntil, "observedUntil");
  if (Date.parse(observedUntil) <= Date.parse(releasedAt)) {
    throw new RangeError("observedUntil must be after releasedAt");
  }

  const pilot = object(value.pilot, "pilot");
  const pilotStatus = text(pilot.status, "pilot.status", 16).toUpperCase();
  if (!["READY", "INCOMPLETE", "FAILED"].includes(pilotStatus)) {
    throw new TypeError("pilot.status is invalid");
  }

  const cutover = object(value.cutover, "cutover");
  const rollback = object(value.rollback, "rollback");

  if (!Array.isArray(value.healthChecks) || value.healthChecks.length > 64) {
    throw new RangeError("healthChecks is invalid");
  }
  if (!Array.isArray(value.auditFamilies) || value.auditFamilies.length > 64) {
    throw new RangeError("auditFamilies is invalid");
  }

  const healthChecks = value.healthChecks.map((item) =>
    keyedEvidence(item, "health check"),
  );
  const auditFamilies = value.auditFamilies.map((item) =>
    keyedEvidence(item, "audit family"),
  );
  unique(healthChecks, "healthChecks");
  unique(auditFamilies, "auditFamilies");

  return Object.freeze({
    schemaVersion: 1,
    releaseId: text(value.releaseId, "releaseId", 160),
    buildId: text(value.buildId, "buildId", 200),
    schemaId: text(value.schemaId, "schemaId", 200),
    releaseArtifactHash: hash(value.releaseArtifactHash, "releaseArtifactHash"),
    environmentClass: "production",
    releasedAt,
    observedUntil,
    minimumObservationMinutes: integer(
      value.minimumObservationMinutes,
      "minimumObservationMinutes",
      1,
      10_080,
    ),
    pilot: Object.freeze({
      status: pilotStatus,
      buildId: text(pilot.buildId, "pilot.buildId", 200),
      schemaId: text(pilot.schemaId, "pilot.schemaId", 200),
      evidenceHash: hash(pilot.evidenceHash, "pilot.evidenceHash"),
    }),
    cutover: Object.freeze({
      completed: boolean(cutover.completed, "cutover.completed"),
      evidenceHash: hash(cutover.evidenceHash, "cutover.evidenceHash"),
    }),
    healthChecks: Object.freeze(healthChecks),
    parityBlockingOpen: integer(
      value.parityBlockingOpen,
      "parityBlockingOpen",
      0,
      100_000,
    ),
    activeSeverityOneIncidents: integer(
      value.activeSeverityOneIncidents,
      "activeSeverityOneIncidents",
      0,
      100_000,
    ),
    rollback: Object.freeze({
      available: boolean(rollback.available, "rollback.available"),
      targetBuildId: text(rollback.targetBuildId, "rollback.targetBuildId", 200),
      evidenceHash: hash(rollback.evidenceHash, "rollback.evidenceHash"),
    }),
    auditFamilies: Object.freeze(auditFamilies),
  });
}

export function qualifyProductionReleaseEvidence(input) {
  const evidence = normalizeProductionReleaseEvidence(input);
  const incomplete = [];
  const failed = [];

  if (evidence.pilot.status === "FAILED") {
    failed.push("pilot-failed");
  } else if (evidence.pilot.status !== "READY") {
    incomplete.push("pilot-not-ready");
  }
  if (evidence.pilot.buildId !== evidence.buildId) {
    failed.push("pilot-build-mismatch");
  }
  if (evidence.pilot.schemaId !== evidence.schemaId) {
    failed.push("pilot-schema-mismatch");
  }

  if (!evidence.cutover.completed) incomplete.push("cutover-not-completed");

  const observationMinutes = Math.floor(
    (Date.parse(evidence.observedUntil) - Date.parse(evidence.releasedAt)) / 60_000,
  );
  if (observationMinutes < evidence.minimumObservationMinutes) {
    incomplete.push(
      `observation-window-short:${observationMinutes}<${evidence.minimumObservationMinutes}`,
    );
  }

  const healthByKey = new Map(evidence.healthChecks.map((item) => [item.key, item]));
  for (const key of REQUIRED_HEALTH_CHECKS) {
    const check = healthByKey.get(key);
    if (!check) {
      incomplete.push(`missing-health-check:${key}`);
    } else if (!check.passed) {
      failed.push(`health-check-failed:${key}`);
    }
  }

  if (evidence.parityBlockingOpen !== 0) {
    failed.push(`parity-blocking-open:${evidence.parityBlockingOpen}`);
  }
  if (evidence.activeSeverityOneIncidents !== 0) {
    failed.push(
      `active-severity-one-incidents:${evidence.activeSeverityOneIncidents}`,
    );
  }

  if (!evidence.rollback.available) failed.push("rollback-unavailable");
  if (evidence.rollback.targetBuildId === evidence.buildId) {
    failed.push("rollback-target-is-release-build");
  }

  const auditByKey = new Map(evidence.auditFamilies.map((item) => [item.key, item]));
  for (const key of REQUIRED_AUDIT_FAMILIES) {
    const audit = auditByKey.get(key);
    if (!audit) {
      incomplete.push(`missing-audit-family:${key}`);
    } else if (!audit.passed) {
      failed.push(`audit-family-failed:${key}`);
    }
  }

  const status =
    failed.length > 0
      ? "FAILED"
      : incomplete.length > 0
        ? "INCOMPLETE"
        : "READY";

  return Object.freeze({
    status,
    releaseId: evidence.releaseId,
    buildId: evidence.buildId,
    schemaId: evidence.schemaId,
    observationMinutes,
    minimumObservationMinutes: evidence.minimumObservationMinutes,
    parityBlockingOpen: evidence.parityBlockingOpen,
    activeSeverityOneIncidents: evidence.activeSeverityOneIncidents,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyProductionReleaseEvidence(filePath) {
  const content = await readFile(filePath, "utf8");
  return qualifyProductionReleaseEvidence(JSON.parse(content));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("Release evidence JSON path is required");
    const result = await readAndQualifyProductionReleaseEvidence(filePath);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Release qualification failed"}\n`,
    );
    process.exitCode = 1;
  }
}
