import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  approvePendingApproval,
  assertApprovalMatches,
  createApprovalBinding,
  createPendingApproval,
} from "./approval.js";

function binding(argumentsValue: unknown) {
  return createApprovalBinding({
    operationId: createCanonicalId("operation"),
    tenantId: createCanonicalId("tenant"),
    principal: { kind: "user", userId: createCanonicalId("user") },
    action: "commerce.purchase",
    actionVersion: "1",
    resourceKey: "bundle:mtn:1gb",
    arguments: argumentsValue,
    riskClass: "financial",
  });
}

describe("approval binding", () => {
  it("canonicalizes object-key order", () => {
    const operationId = createCanonicalId("operation");
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const base = {
      operationId,
      tenantId,
      principal: { kind: "user" as const, userId },
      action: "tool.call",
      actionVersion: "1",
      resourceKey: "resource",
      riskClass: "consequential",
    };

    expect(
      createApprovalBinding({ ...base, arguments: { a: 1, b: 2 } }).argumentsFingerprint,
    ).toBe(
      createApprovalBinding({ ...base, arguments: { b: 2, a: 1 } }).argumentsFingerprint,
    );
  });

  it("invalidates approval when exact arguments change", () => {
    const approvedBinding = binding({ amount: 1000, phone: "08000000000" });
    const approval = approvePendingApproval(
      createPendingApproval({
        kind: "once",
        binding: approvedBinding,
        policyRevision: "policy-1",
        requestedAt: toInstant("2026-10-01T00:00:00Z"),
        expiresAt: toInstant("2026-10-02T00:00:00Z"),
      }),
      { kind: "operator", userId: createCanonicalId("user") },
      toInstant("2026-10-01T01:00:00Z"),
    );

    const changed = {
      ...approvedBinding,
      argumentsFingerprint: "different",
    };

    expect(() =>
      assertApprovalMatches(approval, changed, toInstant("2026-10-01T02:00:00Z")),
    ).toThrow(/changed argumentsFingerprint/);
  });
});
