import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyProductionPilotEvidence,
  REQUIRED_CUTOVER_CHECKS,
  REQUIRED_GOLDEN_JOURNEYS,
} from "./production-pilot-qualification.mjs";

const hash = (character) => character.repeat(64);

function passingEvidence() {
  return {
    schemaVersion: 1,
    pilotId: "pilot-2026-10-06-a",
    buildId: "git-b8d415f0",
    schemaId: "schema-2026-10-06",
    environmentClass: "production-like-pilot",
    startedAt: "2026-10-06T09:00:00.000Z",
    completedAt: "2026-10-06T11:00:00.000Z",
    journeys: REQUIRED_GOLDEN_JOURNEYS.map((id, index) => ({
      id,
      passed: true,
      securityPassed: true,
      restartPassed: true,
      evidenceHash: hash((index % 10).toString()),
    })),
    parity: {
      blockingOpen: 0,
      evidenceHash: hash("a"),
    },
    rollback: {
      executed: true,
      passed: true,
      maxRollbackMinutes: 30,
      actualRollbackMinutes: 12,
      evidenceHash: hash("b"),
    },
    cutoverChecks: REQUIRED_CUTOVER_CHECKS.map((key, index) => ({
      key,
      passed: true,
      evidenceHash: hash(String.fromCharCode(99 + index)),
    })),
  };
}

test("complete passing pilot evidence qualifies READY", () => {
  const result = qualifyProductionPilotEvidence(passingEvidence());
  assert.equal(result.status, "READY");
  assert.equal(result.goldenJourneysPassed, 12);
  assert.equal(result.blockingParityOpen, 0);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.incomplete, []);
});

test("missing journey and unexecuted rollback classify INCOMPLETE", () => {
  const evidence = passingEvidence();
  evidence.journeys = evidence.journeys.filter((item) => item.id !== "GJ-12");
  evidence.rollback.executed = false;
  evidence.rollback.passed = false;
  evidence.rollback.actualRollbackMinutes = null;

  const result = qualifyProductionPilotEvidence(evidence);
  assert.equal(result.status, "INCOMPLETE");
  assert(result.incomplete.includes("missing-journey:GJ-12"));
  assert(result.incomplete.includes("rollback-not-executed"));
  assert.deepEqual(result.failed, []);
});

test("failed journey, parity, rollback or cutover evidence classify FAILED", () => {
  const evidence = passingEvidence();
  evidence.journeys[0].securityPassed = false;
  evidence.parity.blockingOpen = 2;
  evidence.rollback.actualRollbackMinutes = 45;
  evidence.cutoverChecks.find((item) => item.key === "capacity").passed = false;

  const result = qualifyProductionPilotEvidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.failed.includes("journey-security-failed:GJ-01"));
  assert(result.failed.includes("parity-blocking-open:2"));
  assert(result.failed.includes("rollback-rto-exceeded:45>30"));
  assert(result.failed.includes("cutover-check-failed:capacity"));
});

test("missing required cutover evidence is incomplete, not silently passed", () => {
  const evidence = passingEvidence();
  evidence.cutoverChecks = evidence.cutoverChecks.filter(
    (item) => item.key !== "observability",
  );
  const result = qualifyProductionPilotEvidence(evidence);
  assert.equal(result.status, "INCOMPLETE");
  assert(result.incomplete.includes("missing-cutover-check:observability"));
});

test("malformed evidence hashes and non-production-like environment fail closed", () => {
  assert.throws(() =>
    qualifyProductionPilotEvidence({
      ...passingEvidence(),
      environmentClass: "production",
    }),
  );

  const badHash = passingEvidence();
  badHash.parity.evidenceHash = "not-a-hash";
  assert.throws(() => qualifyProductionPilotEvidence(badHash));
});
