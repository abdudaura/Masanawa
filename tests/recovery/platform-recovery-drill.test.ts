import { describe, expect, it } from "vitest";
import {
  evaluateRecoveryDrill,
  type RecoveryCheckpointEvidence,
  type RecoveryDrillEvidence,
} from "../support/recovery-drill-evidence.js";

function checkpoints(keys: readonly string[]): RecoveryCheckpointEvidence[] {
  return keys.map((key) => ({
    key,
    passed: true,
    evidenceRef: `evidence://${key}`,
  }));
}

describe("Task 148 platform recovery drill evidence", () => {
  it("passes a complete backup/restore drill within RTO/RPO", () => {
    const evidence: RecoveryDrillEvidence = {
      schemaVersion: 1,
      drillId: "drill-backup-001",
      kind: "backup-restore",
      startedAt: "2026-10-06T08:00:00Z",
      completedAt: "2026-10-06T08:20:00Z",
      measuredRecoveryTimeMinutes: 20,
      measuredDataLossMinutes: 2,
      checkpoints: checkpoints([
        "backup-created",
        "restore-completed",
        "integrity-verified",
        "schema-compatibility-verified",
        "tenant-ownership-verified",
        "ledger-event-continuity-verified",
        "object-references-verified",
        "stale-lease-resurrection-rejected",
      ]),
    };

    expect(
      evaluateRecoveryDrill({
        evidence,
        policy: {
          maxRecoveryTimeMinutes: 30,
          maxDataLossMinutes: 5,
        },
      }),
    ).toEqual({
      passed: true,
      failures: [],
      missingCheckpoints: [],
      failedCheckpoints: [],
      measuredRecoveryTimeMinutes: 20,
      measuredDataLossMinutes: 2,
    });
  });

  it("fails a restore that omits tenant/ledger/lease integrity checks", () => {
    const result = evaluateRecoveryDrill({
      evidence: {
        schemaVersion: 1,
        drillId: "drill-backup-002",
        kind: "backup-restore",
        startedAt: "2026-10-06T08:00:00Z",
        completedAt: "2026-10-06T08:20:00Z",
        measuredRecoveryTimeMinutes: 20,
        measuredDataLossMinutes: 2,
        checkpoints: checkpoints([
          "backup-created",
          "restore-completed",
          "integrity-verified",
          "schema-compatibility-verified",
          "object-references-verified",
        ]),
      },
      policy: {
        maxRecoveryTimeMinutes: 30,
        maxDataLossMinutes: 5,
      },
    });

    expect(result).toMatchObject({
      passed: false,
      failures: ["missing-checkpoint"],
      missingCheckpoints: expect.arrayContaining([
        "tenant-ownership-verified",
        "ledger-event-continuity-verified",
        "stale-lease-resurrection-rejected",
      ]),
    });
  });

  it("treats migration recovery as forward-migration plus compatible application recovery, not destructive down-migration", () => {
    expect(
      evaluateRecoveryDrill({
        evidence: {
          schemaVersion: 1,
          drillId: "drill-migration-001",
          kind: "migration-recovery",
          startedAt: "2026-10-06T09:00:00Z",
          completedAt: "2026-10-06T09:15:00Z",
          measuredRecoveryTimeMinutes: 15,
          measuredDataLossMinutes: 0,
          checkpoints: checkpoints([
            "preflight-backup-verified",
            "forward-migration-applied",
            "application-rollback-compatible",
            "recovery-plan-executed",
            "schema-readiness-verified",
            "data-integrity-verified",
          ]),
        },
        policy: {
          maxRecoveryTimeMinutes: 30,
          maxDataLossMinutes: 0,
        },
      }),
    ).toMatchObject({ passed: true });
  });

  it("requires deletion drills to preserve structural/audit evidence while verifying private payload erasure", () => {
    const result = evaluateRecoveryDrill({
      evidence: {
        schemaVersion: 1,
        drillId: "drill-delete-001",
        kind: "data-deletion",
        startedAt: "2026-10-06T10:00:00Z",
        completedAt: "2026-10-06T10:05:00Z",
        measuredRecoveryTimeMinutes: 5,
        measuredDataLossMinutes: 0,
        checkpoints: checkpoints([
          "request-authorized",
          "retention-exceptions-classified",
          "private-payload-erasure-verified",
          "required-tombstones-preserved",
          "audit-evidence-preserved",
          "cross-tenant-nonimpact-verified",
        ]),
      },
      policy: {
        maxRecoveryTimeMinutes: 15,
        maxDataLossMinutes: 0,
      },
    });

    expect(result.passed).toBe(true);
  });

  it("requires old credential/device access to be demonstrably rejected after recovery", () => {
    for (const evidence of [
      {
        schemaVersion: 1 as const,
        drillId: "drill-credential-001",
        kind: "credential-recovery" as const,
        startedAt: "2026-10-06T11:00:00Z",
        completedAt: "2026-10-06T11:03:00Z",
        measuredRecoveryTimeMinutes: 3,
        measuredDataLossMinutes: 0,
        checkpoints: checkpoints([
          "old-generation-revoked",
          "new-generation-active",
          "old-credential-rejected",
          "new-credential-verified",
          "secret-nondisclosure-verified",
        ]),
      },
      {
        schemaVersion: 1 as const,
        drillId: "drill-device-001",
        kind: "device-recovery" as const,
        startedAt: "2026-10-06T11:00:00Z",
        completedAt: "2026-10-06T11:08:00Z",
        measuredRecoveryTimeMinutes: 8,
        measuredDataLossMinutes: 0,
        checkpoints: checkpoints([
          "old-device-revoked",
          "new-device-paired",
          "old-device-rejected",
          "assignments-revalidated",
          "pending-operation-custody-verified",
        ]),
      },
    ]) {
      expect(
        evaluateRecoveryDrill({
          evidence,
          policy: {
            maxRecoveryTimeMinutes: 15,
            maxDataLossMinutes: 0,
          },
        }),
      ).toMatchObject({ passed: true });
    }
  });

  it("fails drills that exceed RTO or RPO even when checkpoints pass", () => {
    const result = evaluateRecoveryDrill({
      evidence: {
        schemaVersion: 1,
        drillId: "drill-export-001",
        kind: "data-export",
        startedAt: "2026-10-06T12:00:00Z",
        completedAt: "2026-10-06T13:00:00Z",
        measuredRecoveryTimeMinutes: 60,
        measuredDataLossMinutes: 10,
        checkpoints: checkpoints([
          "request-authorized",
          "tenant-scope-verified",
          "export-completeness-verified",
          "export-hash-verified",
          "cross-tenant-exclusion-verified",
        ]),
      },
      policy: {
        maxRecoveryTimeMinutes: 30,
        maxDataLossMinutes: 5,
      },
    });

    expect(result).toMatchObject({
      passed: false,
      failures: expect.arrayContaining(["rto-exceeded", "rpo-exceeded"]),
    });
  });
});
