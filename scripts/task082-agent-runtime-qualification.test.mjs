import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyTask082Evidence,
  REQUIRED_AGENT_RUNTIME_SCENARIOS,
} from "./task082-agent-runtime-qualification.mjs";

const git = (c) => c.repeat(40);
const hash = (c) => c.repeat(64);

function passingEvidence() {
  return {
    schemaVersion: 1,
    candidateBuildId: "agent-runtime-candidate-a",
    environmentClass: "production-like",
    startedAt: "2026-10-06T12:00:00.000Z",
    completedAt: "2026-10-06T13:00:00.000Z",
    runtimeHead: git("a"),
    providerHead: git("b"),
    scenarios: REQUIRED_AGENT_RUNTIME_SCENARIOS.map((key, index) => ({
      key,
      runtimeHead: git("a"),
      providerHead: git("b"),
      passed: true,
      authorizationLineagePassed: true,
      deterministicReplayPassed: true,
      evidenceHash: hash("0123456789abcdef"[index]),
    })),
    blockingRuntimeIssues: 0,
    summaryEvidenceHash: hash("f"),
  };
}

test("complete agent runtime evidence qualifies READY", () => {
  const r = qualifyTask082Evidence(passingEvidence());
  assert.equal(r.status, "READY");
  assert.equal(r.requiredScenarios, 8);
  assert.deepEqual(r.incomplete, []);
  assert.deepEqual(r.failed, []);
});

test("missing runtime scenario is INCOMPLETE", () => {
  const e = passingEvidence();
  e.scenarios = e.scenarios.filter((s) => s.key !== "research-multistep");
  const r = qualifyTask082Evidence(e);
  assert.equal(r.status, "INCOMPLETE");
  assert(r.incomplete.includes("missing-scenario:research-multistep"));
});

test("runtime and provider substitutions fail exact binding", () => {
  const e = passingEvidence();
  e.scenarios[0].runtimeHead = git("c");
  e.scenarios[1].providerHead = git("d");
  const r = qualifyTask082Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("runtime-head-mismatch:foreground-conversation"));
  assert(r.failed.includes("provider-head-mismatch:research-multistep"));
});

test("authorization lineage and deterministic replay fail independently", () => {
  const e = passingEvidence();
  e.scenarios[2].authorizationLineagePassed = false;
  e.scenarios[4].deterministicReplayPassed = false;
  const r = qualifyTask082Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("authorization-lineage-failed:delegated-specialist"));
  assert(r.failed.includes("deterministic-replay-failed:cancellation-stale-result"));
});

test("functional failure and blocking issue prevent READY", () => {
  const e = passingEvidence();
  e.scenarios[3].passed = false;
  e.blockingRuntimeIssues = 2;
  const r = qualifyTask082Evidence(e);
  assert.equal(r.status, "FAILED");
  assert(r.failed.includes("scenario-failed:budget-enforcement"));
  assert(r.failed.includes("blocking-runtime-issues:2"));
});

test("duplicate, malformed and non-production-like evidence reject", () => {
  const duplicate = passingEvidence();
  duplicate.scenarios.push({ ...duplicate.scenarios[0] });
  assert.throws(() => qualifyTask082Evidence(duplicate));

  const malformed = passingEvidence();
  malformed.summaryEvidenceHash = "bad";
  assert.throws(() => qualifyTask082Evidence(malformed));

  const wrongEnvironment = passingEvidence();
  wrongEnvironment.environmentClass = "unit-test";
  assert.throws(() => qualifyTask082Evidence(wrongEnvironment));
});
