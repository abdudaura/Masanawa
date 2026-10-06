import test from "node:test";
import assert from "node:assert/strict";
import { qualifyRecoveryDrills } from "./recovery-drill-qualification.mjs";

const H = {
  a: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  b: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  c: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
};

function common(id, family, overrides = {}) {
  return {
    id,
    family,
    environment: "production-like",
    sourceBuild: "abcdef1234567890",
    sourceSchema: "schema-42",
    sourceSnapshotHash: H.a,
    evidenceBundleHash: H.b,
    startedAt: "2026-10-06T12:00:00.000Z",
    finishedAt: "2026-10-06T12:05:00.000Z",
    rtoSeconds: 300,
    rpoSeconds: 30,
    steps: [
      { name: "prepare", status: "passed", evidenceHash: H.b },
      { name: "verify", status: "passed", evidenceHash: H.c },
    ],
    ...overrides,
  };
}

function acceptedInput() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-06T13:00:00.000Z",
    thresholds: {
      maxRtoSeconds: 600,
      maxRpoSeconds: 60,
      maxDrillAgeHours: 24,
    },
    drills: [
      {
        ...common("db-restore", "database-restore"),
        productionIsolated: true,
        restoreCompleted: true,
        integrityVerified: true,
        restoredSnapshotHash: H.a,
      },
      {
        ...common("migration-rollback", "migration-rollback"),
        forwardMigrationApplied: true,
        rollbackOrRestoreCompleted: true,
        compatibilityVerified: true,
        postRecoverySchema: "schema-42",
      },
      {
        ...common("data-export", "data-export"),
        requestedScope: "tenant user-owned export",
        exportedRecordCount: 120,
        expectedRecordCount: 120,
        scopeVerified: true,
        exclusionsVerified: true,
      },
      {
        ...common("data-deletion", "data-deletion"),
        requestedScope: "tenant user-owned deletion",
        deletionVerified: true,
        protectedRetentionExplicit: true,
        residualUnexplainedCount: 0,
      },
      {
        ...common("credential-recovery", "credential-recovery"),
        oldCredentialRevoked: true,
        oldCredentialUseRejected: true,
        replacementCredentialAccepted: true,
        secretLeakObserved: false,
      },
      {
        ...common("device-recovery", "device-recovery"),
        oldDeviceRevoked: true,
        oldDeviceAuthorityRejected: true,
        replacementRegistered: true,
        assignmentRebound: true,
        staleOperationRejected: true,
      },
    ],
  };
}

test("complete recovery drill evidence is accepted", () => {
  const report = qualifyRecoveryDrills(acceptedInput());
  assert.equal(report.state, "ACCEPTED");
  assert.equal(report.acceptedCount, 6);
  assert.equal(report.failedCount, 0);
  assert.equal(report.incompleteCount, 0);
  assert.deepEqual(report.missingFamilies, []);
});

test("missing a required drill family is incomplete", () => {
  const input = acceptedInput();
  input.drills = input.drills.filter((drill) => drill.family !== "device-recovery");

  const report = qualifyRecoveryDrills(input);
  assert.equal(report.state, "INCOMPLETE");
  assert.deepEqual(report.missingFamilies, ["device-recovery"]);
  assert.equal(report.failedCount, 0);
});

test("RTO and RPO breaches fail the drill", () => {
  const input = acceptedInput();
  const restore = input.drills.find((drill) => drill.family === "database-restore");
  restore.rtoSeconds = 601;
  restore.rpoSeconds = 61;

  const report = qualifyRecoveryDrills(input);
  assert.equal(report.state, "FAILED");
  const result = report.results.find((item) => item.family === "database-restore");
  assert.ok(result.failures.some((item) => item.includes("RTO")));
  assert.ok(result.failures.some((item) => item.includes("RPO")));
});

test("database restore must be isolated and preserve snapshot integrity", () => {
  const input = acceptedInput();
  const restore = input.drills.find((drill) => drill.family === "database-restore");
  restore.productionIsolated = false;
  restore.restoredSnapshotHash = H.c;

  const report = qualifyRecoveryDrills(input);
  assert.equal(report.state, "FAILED");
  const result = report.results.find((item) => item.family === "database-restore");
  assert.ok(result.failures.some((item) => item.includes("not isolated")));
  assert.ok(result.failures.some((item) => item.includes("snapshot hash")));
});

test("migration rollback must restore compatible source schema", () => {
  const input = acceptedInput();
  const migration = input.drills.find((drill) => drill.family === "migration-rollback");
  migration.compatibilityVerified = false;
  migration.postRecoverySchema = "schema-43";

  const report = qualifyRecoveryDrills(input);
  const result = report.results.find((item) => item.family === "migration-rollback");
  assert.equal(result.state, "FAILED");
  assert.ok(result.failures.some((item) => item.includes("compatibility")));
  assert.ok(result.failures.some((item) => item.includes("source schema")));
});

test("data export must match expected scope count", () => {
  const input = acceptedInput();
  const exportDrill = input.drills.find((drill) => drill.family === "data-export");
  exportDrill.exportedRecordCount = 119;

  const report = qualifyRecoveryDrills(input);
  const result = report.results.find((item) => item.family === "data-export");
  assert.equal(result.state, "FAILED");
  assert.ok(result.failures.some((item) => item.includes("record count")));
});

test("data deletion fails with unexplained residual records", () => {
  const input = acceptedInput();
  const deletion = input.drills.find((drill) => drill.family === "data-deletion");
  deletion.residualUnexplainedCount = 1;

  const report = qualifyRecoveryDrills(input);
  const result = report.results.find((item) => item.family === "data-deletion");
  assert.equal(result.state, "FAILED");
  assert.ok(result.failures.some((item) => item.includes("residual")));
});

test("credential recovery requires old authority to be unusable before replacement acceptance", () => {
  const input = acceptedInput();
  const credential = input.drills.find((drill) => drill.family === "credential-recovery");
  credential.oldCredentialUseRejected = false;

  const report = qualifyRecoveryDrills(input);
  const result = report.results.find((item) => item.family === "credential-recovery");
  assert.equal(result.state, "FAILED");
  assert.ok(result.failures.some((item) => item.includes("remained usable")));
});

test("device recovery requires old device authority and stale operations to be rejected", () => {
  const input = acceptedInput();
  const device = input.drills.find((drill) => drill.family === "device-recovery");
  device.oldDeviceAuthorityRejected = false;
  device.staleOperationRejected = false;

  const report = qualifyRecoveryDrills(input);
  const result = report.results.find((item) => item.family === "device-recovery");
  assert.equal(result.state, "FAILED");
  assert.ok(result.failures.some((item) => item.includes("authority remained usable")));
  assert.ok(result.failures.some((item) => item.includes("stale operation")));
});

test("failed drill steps fail qualification even when summary flags look healthy", () => {
  const input = acceptedInput();
  input.drills[0].steps[1] = {
    name: "verify",
    status: "failed",
    evidenceHash: H.c,
  };

  const report = qualifyRecoveryDrills(input);
  assert.equal(report.state, "FAILED");
  assert.ok(report.results[0].failures.some((item) => item.includes("step")));
});

test("stale drill evidence is incomplete rather than accepted", () => {
  const input = acceptedInput();
  input.generatedAt = "2026-10-10T13:00:00.000Z";
  input.thresholds.maxDrillAgeHours = 24;

  const report = qualifyRecoveryDrills(input);
  assert.equal(report.state, "INCOMPLETE");
  assert.equal(report.failedCount, 0);
  assert.ok(report.results.every((item) => item.state === "INCOMPLETE"));
});

test("duplicate family evidence is rejected instead of cherry-picking a passing drill", () => {
  const input = acceptedInput();
  input.drills.push({
    ...input.drills[0],
    id: "db-restore-second",
  });

  assert.throws(
    () => qualifyRecoveryDrills(input),
    /duplicate recovery drill families/,
  );
});

test("invalid evidence hashes fail closed", () => {
  const input = acceptedInput();
  input.drills[0].evidenceBundleHash = "not-a-hash";

  assert.throws(
    () => qualifyRecoveryDrills(input),
    /sha256/,
  );
});
