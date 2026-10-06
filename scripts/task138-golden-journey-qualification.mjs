import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_SOURCE_HEADS = Object.freeze([
  "social",
  "commerce",
  "studio",
  "character-consistency",
]);

export const REQUIRED_GOLDEN_JOURNEYS = Object.freeze([
  "social-publication",
  "commerce-purchase-fulfillment",
  "commerce-refund-reconciliation",
  "studio-production",
  "character-consistency",
  "cross-domain-replay-recovery",
]);

const GIT_SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function object(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name, max = 256) {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function gitSha(value, name) {
  const normalized = text(value, name, 40).toLowerCase();
  if (!GIT_SHA.test(normalized)) {
    throw new TypeError(`${name} must be a 40-character Git SHA`);
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
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

function normalizeSourceHeads(value) {
  const input = object(value, "sourceHeads");
  const normalized = {};
  for (const key of REQUIRED_SOURCE_HEADS) {
    normalized[key] = gitSha(input[key], `sourceHeads.${key}`);
  }
  return Object.freeze(normalized);
}

function normalizeJourney(value) {
  const input = object(value, "journey");
  const key = text(input.key, "journey.key", 96).toLowerCase();
  if (!REQUIRED_GOLDEN_JOURNEYS.includes(key)) {
    throw new TypeError(`journey.key is unsupported: ${key}`);
  }
  const source = text(input.source, "journey.source", 64).toLowerCase();
  if (!REQUIRED_SOURCE_HEADS.includes(source)) {
    throw new TypeError(`journey.source is unsupported: ${source}`);
  }
  return Object.freeze({
    key,
    source,
    sourceHead: gitSha(input.sourceHead, "journey.sourceHead"),
    passed: input.passed === true,
    retryRecoveryPassed: input.retryRecoveryPassed === true,
    authorizationPrivacyPassed: input.authorizationPrivacyPassed === true,
    evidenceHash: hash(input.evidenceHash, "journey.evidenceHash"),
  });
}

export function normalizeTask138Evidence(value) {
  const input = object(value, "Task 138 evidence");
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Task 138 evidence schemaVersion");
  }
  if (input.environmentClass !== "production-like") {
    throw new TypeError("environmentClass must be production-like");
  }
  const startedAt = instant(input.startedAt, "startedAt");
  const completedAt = instant(input.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) {
    throw new RangeError("completedAt must be after startedAt");
  }
  if (!Array.isArray(input.journeys) || input.journeys.length > 32) {
    throw new RangeError("journeys is invalid");
  }

  const journeys = input.journeys.map(normalizeJourney);
  const keys = journeys.map((journey) => journey.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("journeys contains duplicate keys");
  }

  return Object.freeze({
    schemaVersion: 1,
    candidateBuildId: text(input.candidateBuildId, "candidateBuildId", 200),
    environmentClass: "production-like",
    startedAt,
    completedAt,
    sourceHeads: normalizeSourceHeads(input.sourceHeads),
    journeys: Object.freeze(journeys),
    blockingParityOpen: integer(
      input.blockingParityOpen,
      "blockingParityOpen",
      0,
      100_000,
    ),
    parityEvidenceHash: hash(input.parityEvidenceHash, "parityEvidenceHash"),
  });
}

export function qualifyTask138Evidence(value) {
  const evidence = normalizeTask138Evidence(value);
  const incomplete = [];
  const failed = [];
  const byKey = new Map(evidence.journeys.map((journey) => [journey.key, journey]));

  for (const key of REQUIRED_GOLDEN_JOURNEYS) {
    const journey = byKey.get(key);
    if (!journey) {
      incomplete.push(`missing-journey:${key}`);
      continue;
    }

    if (journey.sourceHead !== evidence.sourceHeads[journey.source]) {
      failed.push(`source-head-mismatch:${key}`);
    }
    if (!journey.passed) {
      failed.push(`journey-failed:${key}`);
    }
    if (!journey.retryRecoveryPassed) {
      failed.push(`retry-recovery-failed:${key}`);
    }
    if (!journey.authorizationPrivacyPassed) {
      failed.push(`authorization-privacy-failed:${key}`);
    }
  }

  if (evidence.blockingParityOpen !== 0) {
    failed.push(`blocking-parity-open:${evidence.blockingParityOpen}`);
  }

  const status =
    failed.length > 0
      ? "FAILED"
      : incomplete.length > 0
        ? "INCOMPLETE"
        : "READY";

  return Object.freeze({
    status,
    candidateBuildId: evidence.candidateBuildId,
    requiredJourneys: REQUIRED_GOLDEN_JOURNEYS.length,
    suppliedJourneys: evidence.journeys.length,
    blockingParityOpen: evidence.blockingParityOpen,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyTask138Evidence(filePath) {
  const content = await readFile(filePath, "utf8");
  return qualifyTask138Evidence(JSON.parse(content));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const filePath = process.argv[2];
    if (!filePath) throw new Error("Task 138 evidence JSON path is required");
    const result = await readAndQualifyTask138Evidence(filePath);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Task 138 qualification failed"}\n`,
    );
    process.exitCode = 1;
  }
}
