import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_AGENT_RUNTIME_SCENARIOS = Object.freeze([
  "foreground-conversation",
  "research-multistep",
  "delegated-specialist",
  "budget-enforcement",
  "cancellation-stale-result",
  "telemetry-diagnostics",
  "provider-replacement",
  "model-replacement",
]);

const GIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

const object = (value, name) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
};

const text = (value, name, max = 256) => {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
};

const git = (value, name) => {
  const normalized = text(value, name, 40).toLowerCase();
  if (!GIT.test(normalized)) throw new TypeError(`${name} must be a 40-character Git SHA`);
  return normalized;
};

const hash = (value, name) => {
  const normalized = text(value, name, 64).toLowerCase();
  if (!SHA256.test(normalized)) throw new TypeError(`${name} must be SHA-256 hex`);
  return normalized;
};

const count = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
};

const time = (value, name) => {
  const normalized = text(value, name, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
};

function normalizeScenario(value) {
  const input = object(value, "scenario");
  const key = text(input.key, "scenario.key", 96).toLowerCase();
  if (!REQUIRED_AGENT_RUNTIME_SCENARIOS.includes(key)) {
    throw new TypeError(`unsupported scenario: ${key}`);
  }
  return Object.freeze({
    key,
    runtimeHead: git(input.runtimeHead, "scenario.runtimeHead"),
    providerHead: git(input.providerHead, "scenario.providerHead"),
    passed: input.passed === true,
    authorizationLineagePassed: input.authorizationLineagePassed === true,
    deterministicReplayPassed: input.deterministicReplayPassed === true,
    evidenceHash: hash(input.evidenceHash, "scenario.evidenceHash"),
  });
}

export function normalizeTask082Evidence(value) {
  const input = object(value, "Task 082 evidence");
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported Task 082 evidence schemaVersion");
  if (input.environmentClass !== "production-like") {
    throw new TypeError("environmentClass must be production-like");
  }
  const startedAt = time(input.startedAt, "startedAt");
  const completedAt = time(input.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) {
    throw new RangeError("completedAt must be after startedAt");
  }
  if (!Array.isArray(input.scenarios) || input.scenarios.length > 32) {
    throw new RangeError("scenarios is invalid");
  }
  const scenarios = input.scenarios.map(normalizeScenario);
  const keys = scenarios.map((scenario) => scenario.key);
  if (new Set(keys).size !== keys.length) throw new Error("scenarios contains duplicate keys");
  return Object.freeze({
    schemaVersion: 1,
    candidateBuildId: text(input.candidateBuildId, "candidateBuildId", 200),
    environmentClass: "production-like",
    startedAt,
    completedAt,
    runtimeHead: git(input.runtimeHead, "runtimeHead"),
    providerHead: git(input.providerHead, "providerHead"),
    scenarios: Object.freeze(scenarios),
    blockingRuntimeIssues: count(input.blockingRuntimeIssues, "blockingRuntimeIssues"),
    summaryEvidenceHash: hash(input.summaryEvidenceHash, "summaryEvidenceHash"),
  });
}

export function qualifyTask082Evidence(value) {
  const evidence = normalizeTask082Evidence(value);
  const incomplete = [];
  const failed = [];
  const byKey = new Map(evidence.scenarios.map((scenario) => [scenario.key, scenario]));

  for (const key of REQUIRED_AGENT_RUNTIME_SCENARIOS) {
    const scenario = byKey.get(key);
    if (!scenario) {
      incomplete.push(`missing-scenario:${key}`);
      continue;
    }
    if (scenario.runtimeHead !== evidence.runtimeHead) failed.push(`runtime-head-mismatch:${key}`);
    if (scenario.providerHead !== evidence.providerHead) failed.push(`provider-head-mismatch:${key}`);
    if (!scenario.passed) failed.push(`scenario-failed:${key}`);
    if (!scenario.authorizationLineagePassed) failed.push(`authorization-lineage-failed:${key}`);
    if (!scenario.deterministicReplayPassed) failed.push(`deterministic-replay-failed:${key}`);
  }

  if (evidence.blockingRuntimeIssues !== 0) {
    failed.push(`blocking-runtime-issues:${evidence.blockingRuntimeIssues}`);
  }

  const status = failed.length ? "FAILED" : incomplete.length ? "INCOMPLETE" : "READY";
  return Object.freeze({
    status,
    candidateBuildId: evidence.candidateBuildId,
    requiredScenarios: REQUIRED_AGENT_RUNTIME_SCENARIOS.length,
    suppliedScenarios: evidence.scenarios.length,
    blockingRuntimeIssues: evidence.blockingRuntimeIssues,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyTask082Evidence(filePath) {
  return qualifyTask082Evidence(JSON.parse(await readFile(filePath, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("Task 082 evidence JSON path is required");
    const result = await readAndQualifyTask082Evidence(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Task 082 qualification failed"}\n`);
    process.exitCode = 1;
  }
}
