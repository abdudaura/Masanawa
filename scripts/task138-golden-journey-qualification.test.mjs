import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyTask138Evidence,
  REQUIRED_GOLDEN_JOURNEYS,
  REQUIRED_SOURCE_HEADS,
} from "./task138-golden-journey-qualification.mjs";

const git = (character) => character.repeat(40);
const hash = (character) => character.repeat(64);

function passingEvidence() {
  const sourceHeads = {
    social: git("a"),
    commerce: git("b"),
    studio: git("c"),
    "character-consistency": git("d"),
  };
  const sourceByJourney = {
    "social-publication": "social",
    "commerce-purchase-fulfillment": "commerce",
    "commerce-refund-reconciliation": "commerce",
    "studio-production": "studio",
    "character-consistency": "character-consistency",
    "cross-domain-replay-recovery": "commerce",
  };
  return {
    schemaVersion: 1,
    candidateBuildId: "task138-candidate-a",
    environmentClass: "production-like",
    startedAt: "2026-10-06T12:00:00.000Z",
    completedAt: "2026-10-06T13:00:00.000Z",
    sourceHeads,
    journeys: REQUIRED_GOLDEN_JOURNEYS.map((key, index) => {
      const source = sourceByJourney[key];
      return {
        key,
        source,
        sourceHead: sourceHeads[source],
        passed: true,
        retryRecoveryPassed: true,
        authorizationPrivacyPassed: true,
        evidenceHash: hash("0123456789abcdef"[index]),
      };
    }),
    blockingParityOpen: 0,
    parityEvidenceHash: hash("f"),
  };
}

test("complete exact-head Task 138 evidence qualifies READY", () => {
  const result = qualifyTask138Evidence(passingEvidence());
  assert.equal(result.status, "READY");
  assert.equal(result.requiredJourneys, 6);
  assert.equal(result.suppliedJourneys, 6);
  assert.deepEqual(result.incomplete, []);
  assert.deepEqual(result.failed, []);
});

test("missing required journey is INCOMPLETE rather than accepted", () => {
  const evidence = passingEvidence();
  evidence.journeys = evidence.journeys.filter(
    (journey) => journey.key !== "studio-production",
  );
  const result = qualifyTask138Evidence(evidence);
  assert.equal(result.status, "INCOMPLETE");
  assert(result.incomplete.includes("missing-journey:studio-production"));
});

test("changed upstream head fails exact evidence binding", () => {
  const evidence = passingEvidence();
  evidence.journeys.find(
    (journey) => journey.key === "social-publication",
  ).sourceHead = git("e");
  const result = qualifyTask138Evidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.failed.includes("source-head-mismatch:social-publication"));
});

test("functional, recovery and authorization/privacy failures fail independently", () => {
  const evidence = passingEvidence();
  evidence.journeys.find(
    (journey) => journey.key === "commerce-purchase-fulfillment",
  ).passed = false;
  evidence.journeys.find(
    (journey) => journey.key === "studio-production",
  ).retryRecoveryPassed = false;
  evidence.journeys.find(
    (journey) => journey.key === "character-consistency",
  ).authorizationPrivacyPassed = false;

  const result = qualifyTask138Evidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(
    result.failed.includes("journey-failed:commerce-purchase-fulfillment"),
  );
  assert(result.failed.includes("retry-recovery-failed:studio-production"));
  assert(
    result.failed.includes(
      "authorization-privacy-failed:character-consistency",
    ),
  );
});

test("blocking parity prevents READY", () => {
  const evidence = passingEvidence();
  evidence.blockingParityOpen = 2;
  const result = qualifyTask138Evidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.failed.includes("blocking-parity-open:2"));
});

test("duplicate journeys and malformed hashes fail closed", () => {
  const duplicate = passingEvidence();
  duplicate.journeys.push({ ...duplicate.journeys[0] });
  assert.throws(() => qualifyTask138Evidence(duplicate));

  const malformed = passingEvidence();
  malformed.parityEvidenceHash = "bad";
  assert.throws(() => qualifyTask138Evidence(malformed));
});

test("non-production-like evidence is rejected", () => {
  const evidence = passingEvidence();
  evidence.environmentClass = "unit-test";
  assert.throws(() => qualifyTask138Evidence(evidence));
});

test("required source head set remains stable and complete", () => {
  assert.deepEqual(REQUIRED_SOURCE_HEADS, [
    "social",
    "commerce",
    "studio",
    "character-consistency",
  ]);
});
