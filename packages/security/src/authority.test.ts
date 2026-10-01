import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  assertCurrentAuthority,
  createAuthorityContext,
  intersectCapabilities,
} from "./authority.js";

function context(policyRevision = "policy-1") {
  return createAuthorityContext({
    tenantId: createCanonicalId("tenant"),
    principal: { kind: "user", userId: createCanonicalId("user") },
    scopes: ["relationship:read"],
    capabilities: ["message.send", "memory.read"],
    resourceScope: {},
    policyRevision,
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
  });
}

describe("current authority", () => {
  it("rejects an authority prepared under a stale policy revision", async () => {
    await expect(
      assertCurrentAuthority(context(), {
        getPolicyRevision: () => "policy-2",
      }),
    ).rejects.toThrow(/stale policy revision/);
  });

  it("rejects an expired authority context", async () => {
    const expired = createAuthorityContext({
      tenantId: createCanonicalId("tenant"),
      principal: { kind: "user", userId: createCanonicalId("user") },
      scopes: [],
      capabilities: [],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: toInstant("2026-01-01T00:00:00Z"),
      expiresAt: toInstant("2026-01-01T01:00:00Z"),
    });

    await expect(
      assertCurrentAuthority(
        expired,
        { getPolicyRevision: () => "policy-1" },
        toInstant("2026-01-01T02:00:00Z"),
      ),
    ).rejects.toThrow(/expired/);
  });

  it("never expands delegated capabilities", () => {
    expect(
      intersectCapabilities(
        ["memory.read", "message.send"],
        ["message.send", "payment.charge"],
      ),
    ).toEqual(["message.send"]);
  });
});
