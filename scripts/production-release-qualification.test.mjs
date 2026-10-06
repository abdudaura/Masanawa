import assert from "node:assert/strict";
import test from "node:test";
import {
  qualifyProductionReleaseEvidence,
  REQUIRED_AUDIT_FAMILIES,
  REQUIRED_HEALTH_CHECKS,
} from "./production-release-qualification.mjs";

const hash = (character) => character.repeat(64);

function passingEvidence() {
  return {
    schemaVersion: 1,
    releaseId: "release-2026-10-06-a",
    buildId: "git-release-build",
    schemaId: "schema-2026-10-06",
    releaseArtifactHash: hash("a"),
    environmentClass: "production",
    releasedAt: "2026-10-06T10:00:00.000Z",
    observedUntil: "2026-10-06T11:30:00.000Z",
    minimumObservationMinutes: 60,
    pilot: {
      status: "READY",
      buildId: "git-release-build",
      schemaId: "schema-2026-10-06",
      evidenceHash: hash("b"),
    },
    cutover: {
      completed: true,
      evidenceHash: hash("c"),
    },
    healthChecks: REQUIRED_HEALTH_CHECKS.map((key, index) => ({
      key,
      passed: true,
      evidenceHash: hash("0123456789abcdef"[index]),
    })),
    parityBlockingOpen: 0,
    activeSeverityOneIncidents: 0,
    rollback: {
      available: true,
      targetBuildId: "git-previous-stable-build",
      evidenceHash: hash("e"),
    },
    auditFamilies: REQUIRED_AUDIT_FAMILIES.map((key, index) => ({
      key,
      passed: true,
      evidenceHash: hash("89abcdef01234567"[index]),
    })),
  };
}

test("complete release evidence qualifies READY", () => {
  const result = qualifyProductionReleaseEvidence(passingEvidence());
  assert.equal(result.status, "READY");
  assert.equal(result.observationMinutes, 90);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.incomplete, []);
});

test("missing health and audit evidence remains INCOMPLETE", () => {
  const evidence = passingEvidence();
  evidence.healthChecks = evidence.healthChecks.filter(
    (item) => item.key !== "realtime",
  );
  evidence.auditFamilies = evidence.auditFamilies.filter(
    (item) => item.key !== "pilot-cutover",
  );

  const result = qualifyProductionReleaseEvidence(evidence);
  assert.equal(result.status, "INCOMPLETE");
  assert(result.incomplete.includes("missing-health-check:realtime"));
  assert(result.incomplete.includes("missing-audit-family:pilot-cutover"));
});

test("pilot must be READY and bound to the exact release build and schema", () => {
  const evidence = passingEvidence();
  evidence.pilot.status = "INCOMPLETE";
  evidence.pilot.buildId = "git-other-build";
  evidence.pilot.schemaId = "schema-other";

  const result = qualifyProductionReleaseEvidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.incomplete.includes("pilot-not-ready"));
  assert(result.failed.includes("pilot-build-mismatch"));
  assert(result.failed.includes("pilot-schema-mismatch"));
});

test("short observation window and incomplete cutover do not silently pass", () => {
  const evidence = passingEvidence();
  evidence.cutover.completed = false;
  evidence.observedUntil = "2026-10-06T10:30:00.000Z";

  const result = qualifyProductionReleaseEvidence(evidence);
  assert.equal(result.status, "INCOMPLETE");
  assert(result.incomplete.includes("cutover-not-completed"));
  assert(result.incomplete.includes("observation-window-short:30<60"));
});

test("blocking parity, sev-1 incidents, health failure and lost rollback fail release", () => {
  const evidence = passingEvidence();
  evidence.parityBlockingOpen = 2;
  evidence.activeSeverityOneIncidents = 1;
  evidence.rollback.available = false;
  evidence.healthChecks.find((item) => item.key === "commerce").passed = false;

  const result = qualifyProductionReleaseEvidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.failed.includes("parity-blocking-open:2"));
  assert(result.failed.includes("active-severity-one-incidents:1"));
  assert(result.failed.includes("rollback-unavailable"));
  assert(result.failed.includes("health-check-failed:commerce"));
});

test("rollback target cannot be the release build itself", () => {
  const evidence = passingEvidence();
  evidence.rollback.targetBuildId = evidence.buildId;

  const result = qualifyProductionReleaseEvidence(evidence);
  assert.equal(result.status, "FAILED");
  assert(result.failed.includes("rollback-target-is-release-build"));
});

test("malformed hashes, duplicate keys and non-production evidence fail closed", () => {
  const wrongEnvironment = passingEvidence();
  wrongEnvironment.environmentClass = "production-like-pilot";
  assert.throws(() => qualifyProductionReleaseEvidence(wrongEnvironment));

  const badHash = passingEvidence();
  badHash.releaseArtifactHash = "not-a-hash";
  assert.throws(() => qualifyProductionReleaseEvidence(badHash));

  const duplicate = passingEvidence();
  duplicate.healthChecks.push({ ...duplicate.healthChecks[0] });
  assert.throws(() => qualifyProductionReleaseEvidence(duplicate));
});
