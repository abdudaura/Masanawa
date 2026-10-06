import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_AGENT_PHONE_SCENARIOS = Object.freeze([
  "outbound-cellular-call",
  "inbound-cellular-routing",
  "duplex-audio-media",
  "connectivity-loss-reconnect",
  "ambiguous-call-reconciliation",
  "device-replacement-revocation",
]);

const GIT = /^[a-f0-9]{40}$/u;
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

function git(value, name) {
  const normalized = text(value, name, 40).toLowerCase();
  if (!GIT.test(normalized)) throw new TypeError(`${name} must be a 40-character Git SHA`);
  return normalized;
}

function hash(value, name) {
  const normalized = text(value, name, 64).toLowerCase();
  if (!SHA256.test(normalized)) throw new TypeError(`${name} must be SHA-256 hex`);
  return normalized;
}

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function time(value, name) {
  const normalized = text(value, name, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

function normalizeScenario(value) {
  const input = object(value, "scenario");
  const key = text(input.key, "scenario.key", 96).toLowerCase();
  if (!REQUIRED_AGENT_PHONE_SCENARIOS.includes(key)) {
    throw new TypeError(`unsupported scenario: ${key}`);
  }
  return Object.freeze({
    key,
    presenceHead: git(input.presenceHead, "scenario.presenceHead"),
    deviceHead: git(input.deviceHead, "scenario.deviceHead"),
    omniSipHead: git(input.omniSipHead, "scenario.omniSipHead"),
    routingHead: git(input.routingHead, "scenario.routingHead"),
    passed: input.passed === true,
    realDevicePassed: input.realDevicePassed === true,
    noBlindRetryPassed: input.noBlindRetryPassed === true,
    evidenceHash: hash(input.evidenceHash, "scenario.evidenceHash"),
  });
}

export function normalizeTask130Evidence(value) {
  const input = object(value, "Task 130 evidence");
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported Task 130 evidence schemaVersion");
  if (input.environmentClass !== "physical-device") {
    throw new TypeError("environmentClass must be physical-device");
  }

  const startedAt = time(input.startedAt, "startedAt");
  const completedAt = time(input.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) {
    throw new RangeError("completedAt must be after startedAt");
  }
  if (!Array.isArray(input.scenarios) || input.scenarios.length > 24) {
    throw new RangeError("scenarios is invalid");
  }

  const scenarios = input.scenarios.map(normalizeScenario);
  const keys = scenarios.map((scenario) => scenario.key);
  if (new Set(keys).size !== keys.length) throw new Error("scenarios contains duplicate keys");

  return Object.freeze({
    schemaVersion: 1,
    candidateBuildId: text(input.candidateBuildId, "candidateBuildId", 200),
    deviceModel: text(input.deviceModel, "deviceModel", 160),
    deviceBuildId: text(input.deviceBuildId, "deviceBuildId", 200),
    environmentClass: "physical-device",
    startedAt,
    completedAt,
    presenceHead: git(input.presenceHead, "presenceHead"),
    deviceHead: git(input.deviceHead, "deviceHead"),
    omniSipHead: git(input.omniSipHead, "omniSipHead"),
    routingHead: git(input.routingHead, "routingHead"),
    scenarios: Object.freeze(scenarios),
    blockingDeviceIssues: integer(input.blockingDeviceIssues, "blockingDeviceIssues"),
    summaryEvidenceHash: hash(input.summaryEvidenceHash, "summaryEvidenceHash"),
  });
}

export function qualifyTask130Evidence(value) {
  const evidence = normalizeTask130Evidence(value);
  const incomplete = [];
  const failed = [];
  const byKey = new Map(evidence.scenarios.map((scenario) => [scenario.key, scenario]));

  for (const key of REQUIRED_AGENT_PHONE_SCENARIOS) {
    const scenario = byKey.get(key);
    if (!scenario) {
      incomplete.push(`missing-scenario:${key}`);
      continue;
    }
    if (scenario.presenceHead !== evidence.presenceHead) failed.push(`presence-head-mismatch:${key}`);
    if (scenario.deviceHead !== evidence.deviceHead) failed.push(`device-head-mismatch:${key}`);
    if (scenario.omniSipHead !== evidence.omniSipHead) failed.push(`omnisip-head-mismatch:${key}`);
    if (scenario.routingHead !== evidence.routingHead) failed.push(`routing-head-mismatch:${key}`);
    if (!scenario.passed) failed.push(`scenario-failed:${key}`);
    if (!scenario.realDevicePassed) failed.push(`real-device-failed:${key}`);
    if (!scenario.noBlindRetryPassed) failed.push(`blind-retry-safety-failed:${key}`);
  }

  if (evidence.blockingDeviceIssues !== 0) {
    failed.push(`blocking-device-issues:${evidence.blockingDeviceIssues}`);
  }

  const status = failed.length ? "FAILED" : incomplete.length ? "INCOMPLETE" : "READY";
  return Object.freeze({
    status,
    candidateBuildId: evidence.candidateBuildId,
    deviceModel: evidence.deviceModel,
    deviceBuildId: evidence.deviceBuildId,
    requiredScenarios: REQUIRED_AGENT_PHONE_SCENARIOS.length,
    suppliedScenarios: evidence.scenarios.length,
    blockingDeviceIssues: evidence.blockingDeviceIssues,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyTask130Evidence(filePath) {
  return qualifyTask130Evidence(JSON.parse(await readFile(filePath, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("Task 130 evidence JSON path is required");
    const result = await readAndQualifyTask130Evidence(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Task 130 qualification failed"}\n`);
    process.exitCode = 1;
  }
}
