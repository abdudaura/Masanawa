import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const REQUIRED_WORKFLOW_SCENARIOS = Object.freeze([
  "admission-replay",
  "lease-fencing-crash-recovery",
  "checkpoint-restart",
  "retry-dead-letter-recovery",
  "human-approval-restart",
  "schedule-timer-restart",
  "cancellation-supersession-recovery",
  "ambiguous-operation-reconciliation",
]);

const GIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

const obj = (v, n) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new TypeError(`${n} must be an object`);
  return v;
};
const txt = (v, n, max = 256) => {
  if (typeof v !== "string") throw new TypeError(`${n} must be a string`);
  const x = v.trim();
  if (!x || x.length > max || /[\r\n\0]/u.test(x)) throw new TypeError(`${n} is invalid`);
  return x;
};
const git = (v, n) => {
  const x = txt(v, n, 40).toLowerCase();
  if (!GIT.test(x)) throw new TypeError(`${n} must be a 40-character Git SHA`);
  return x;
};
const hash = (v, n) => {
  const x = txt(v, n, 64).toLowerCase();
  if (!SHA256.test(x)) throw new TypeError(`${n} must be SHA-256 hex`);
  return x;
};
const count = (v, n) => {
  if (!Number.isSafeInteger(v) || v < 0 || v > 100000) throw new RangeError(`${n} is invalid`);
  return v;
};
const time = (v, n) => {
  const x = txt(v, n, 64);
  const d = new Date(x);
  if (!Number.isFinite(d.getTime())) throw new TypeError(`${n} is invalid`);
  return d.toISOString();
};

function scenario(v) {
  const x = obj(v, "scenario");
  const key = txt(x.key, "scenario.key", 96).toLowerCase();
  if (!REQUIRED_WORKFLOW_SCENARIOS.includes(key)) throw new TypeError(`unsupported scenario: ${key}`);
  return Object.freeze({
    key,
    workflowHead: git(x.workflowHead, "scenario.workflowHead"),
    operationHead: git(x.operationHead, "scenario.operationHead"),
    passed: x.passed === true,
    restartRecoveryPassed: x.restartRecoveryPassed === true,
    noDuplicateEffectPassed: x.noDuplicateEffectPassed === true,
    evidenceHash: hash(x.evidenceHash, "scenario.evidenceHash"),
  });
}

export function normalizeTask096Evidence(v) {
  const x = obj(v, "Task 096 evidence");
  if (x.schemaVersion !== 1) throw new TypeError("Unsupported Task 096 evidence schemaVersion");
  if (x.environmentClass !== "production-like") throw new TypeError("environmentClass must be production-like");
  const startedAt = time(x.startedAt, "startedAt");
  const completedAt = time(x.completedAt, "completedAt");
  if (Date.parse(completedAt) <= Date.parse(startedAt)) throw new RangeError("completedAt must be after startedAt");
  if (!Array.isArray(x.scenarios) || x.scenarios.length > 32) throw new RangeError("scenarios is invalid");
  const scenarios = x.scenarios.map(scenario);
  const keys = scenarios.map((s) => s.key);
  if (new Set(keys).size !== keys.length) throw new Error("scenarios contains duplicate keys");
  return Object.freeze({
    schemaVersion: 1,
    candidateBuildId: txt(x.candidateBuildId, "candidateBuildId", 200),
    environmentClass: "production-like",
    startedAt,
    completedAt,
    workflowHead: git(x.workflowHead, "workflowHead"),
    operationHead: git(x.operationHead, "operationHead"),
    scenarios: Object.freeze(scenarios),
    blockingRecoveryIssues: count(x.blockingRecoveryIssues, "blockingRecoveryIssues"),
    recoveryEvidenceHash: hash(x.recoveryEvidenceHash, "recoveryEvidenceHash"),
  });
}

export function qualifyTask096Evidence(v) {
  const e = normalizeTask096Evidence(v);
  const incomplete = [];
  const failed = [];
  const byKey = new Map(e.scenarios.map((s) => [s.key, s]));
  for (const key of REQUIRED_WORKFLOW_SCENARIOS) {
    const s = byKey.get(key);
    if (!s) { incomplete.push(`missing-scenario:${key}`); continue; }
    if (s.workflowHead !== e.workflowHead) failed.push(`workflow-head-mismatch:${key}`);
    if (s.operationHead !== e.operationHead) failed.push(`operation-head-mismatch:${key}`);
    if (!s.passed) failed.push(`scenario-failed:${key}`);
    if (!s.restartRecoveryPassed) failed.push(`restart-recovery-failed:${key}`);
    if (!s.noDuplicateEffectPassed) failed.push(`duplicate-effect-safety-failed:${key}`);
  }
  if (e.blockingRecoveryIssues !== 0) failed.push(`blocking-recovery-issues:${e.blockingRecoveryIssues}`);
  const status = failed.length ? "FAILED" : incomplete.length ? "INCOMPLETE" : "READY";
  return Object.freeze({
    status,
    candidateBuildId: e.candidateBuildId,
    requiredScenarios: REQUIRED_WORKFLOW_SCENARIOS.length,
    suppliedScenarios: e.scenarios.length,
    blockingRecoveryIssues: e.blockingRecoveryIssues,
    incomplete: Object.freeze(incomplete.sort()),
    failed: Object.freeze(failed.sort()),
  });
}

export async function readAndQualifyTask096Evidence(path) {
  return qualifyTask096Evidence(JSON.parse(await readFile(path, "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("Task 096 evidence JSON path is required");
    const result = await readAndQualifyTask096Evidence(process.argv[2]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== "READY") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Task 096 qualification failed"}\n`);
    process.exitCode = 1;
  }
}
