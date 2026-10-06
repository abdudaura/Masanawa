import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyTask096Evidence,
  REQUIRED_WORKFLOW_SCENARIOS,
} from "./task096-workflow-qualification.mjs";

const git = (c) => c.repeat(40);
const hash = (c) => c.repeat(64);

function passingEvidence() {
  return {
    schemaVersion: 1,
    candidateBuildId: "workflow-candidate-a",
    environmentClass: "production-like",
    startedAt: "2026-10-06T12:00:00.000Z",
    completedAt: "2026-10-06T13:00:00.000Z",
    workflowHead: git("a"),
    operationHead: git("b"),
    scenarios: REQUIRED_WORKFLOW_SCENARIOS.map((key, index) => ({
      key,
      workflowHead: git("a"),
      operationHead: git("b"),
      passed: true,
      restartRecoveryPassed: true,
      noDuplicateEffectPassed: true,
      evidenceHash: hash("0123456789abcdef"[index]),
    })),
    blockingRecoveryIssues: 0,
    recoveryEvidenceHash: hash("f"),
  };
}

test("complete workflow recovery evidence qualifies READY", () => {
  const r = qualifyTask096Evidence(passingEvidence());
  assert.equal(r.status, "READY");
  assert.equal(r.requiredScenarios, 8);
  assert.deepEqual(r.incomplete, []);
  assert.deepEqual(r.failed, []);
});

test("missing scenario is INCOMPLETE", () => {
  const e = passingEvidence();
  e.scenarios = e.scenarios.filter((s) => s.key !== "checkpoint-restart");
  const r = qualifyTask096Evidence(e);
  assert.equal(r.status, "INCOMPLETE");
  assert(r.incomplete.includes("missing-scenario:checkpoint-restart"));
});

test("source-head substitutions fail closed", () => {
  const e = passingEvidence();
  e.scenarios[0].workflowHead = git("c");
  e.scenarios[1].operationHead = git("d");
  const r = qualifyTask096Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("workflow-head-mismatch:admission-replay"));
  assert(r.failed.includes("operation-head-mismatch:lease-fencing-crash-recovery"));
});

test("restart or duplicate-effect safety failures fail independently", () => {
  const e = passingEvidence();
  e.scenarios[2].restartRecoveryPassed = false;
  e.scenarios[7].noDuplicateEffectPassed = false;
  const r = qualifyTask096Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("restart-recovery-failed:checkpoint-restart"));
  assert(
    r.failed.includes(
      "duplicate-effect-safety-failed:ambiguous-operation-reconciliation",
    ),
  );
});

test("functional failure and blocking recovery issue prevent READY", () => {
  const e = passingEvidence();
  e.scenarios[3].passed = false;
  e.blockingRecoveryIssues = 1;
  const r = qualifyTask096Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("scenario-failed:retry-dead-letter-recovery"));
  assert(r.failed.includes("blocking-recovery-issues:1"));
});

test("duplicates, malformed evidence and non-production-like input reject", () => {
  const duplicate = passingEvidence();
  duplicate.scenarios.push({ ...duplicate.scenarios[0] });
  assert.throws(() => qualifyTask096Evidence(duplicate));

  const badHash = passingEvidence();
  badHash.recoveryEvidenceHash = "bad";
  assert.throws(() => qualifyTask096Evidence(badHash));

  const wrongEnvironment = passingEvidence();
  wrongEnvironment.environmentClass = "unit-test";
  assert.throws(() => qualifyTask096Evidence(wrongEnvironment));
});
