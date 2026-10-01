import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { describe, expect, it } from "vitest";
import {
  assertWorldCanonAuthority,
  createWorldCanonApprovalBinding,
  worldEventResourceKey,
} from "./governance.js";

describe("world canon governance", () => {
  const tenantId = createCanonicalId("tenant");
  const worldId = createCanonicalId("world");
  const eventId = createCanonicalId("world-event");
  const operationId = createCanonicalId("operation");
  const approvalId = createCanonicalId("approval");

  function authority(
    capabilities: readonly string[] = ["world.canon.approve"],
    worlds: readonly typeof worldId[] = [worldId],
    approvals: readonly typeof approvalId[] = [approvalId],
  ) {
    return createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "world-operator" },
      scopes: [],
      capabilities,
      resourceScope: { worldIds: worlds },
      policyRevision: "policy-1",
      approvalIds: approvals,
      delegationChain: [],
      issuedAt: toInstant("2026-10-01T15:00:00Z"),
      expiresAt: toInstant("2026-10-01T16:00:00Z"),
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
  }

  it("binds approval to exact action, event resource and arguments", () => {
    const binding = createWorldCanonApprovalBinding({
      tenantId,
      worldId,
      worldEventId: eventId,
      decision: "approve",
      operationId,
      authority: authority(),
    });

    expect(binding).toMatchObject({
      operationId,
      tenantId,
      action: "world.canon.approve",
      actionVersion: "1",
      resourceKey: worldEventResourceKey(worldId, eventId),
      riskClass: "consequential",
    });
    expect(binding.argumentsFingerprint).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("rejects missing capability, wrong World scope and unadmitted approval", () => {
    const target = {
      tenantId,
      worldId,
      worldEventId: eventId,
      decision: "approve" as const,
    };

    expect(() =>
      assertWorldCanonAuthority(authority([]), target),
    ).toThrowError(
      expect.objectContaining({ code: "world.governance_capability_missing" }),
    );

    expect(() =>
      assertWorldCanonAuthority(
        authority(
          ["world.canon.approve"],
          [createCanonicalId("world")],
        ),
        target,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "world.governance_scope_mismatch" }),
    );

    expect(() =>
      assertWorldCanonAuthority(
        authority(["world.canon.approve"], [worldId], []),
        target,
        approvalId,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "world.governance_approval_not_admitted",
      }),
    );
  });
});
