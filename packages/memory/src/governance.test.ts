import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { describe, expect, it } from "vitest";
import {
  assertMemoryScopePublicationAuthority,
  createMemoryScopePublicationApprovalBinding,
  memoryScopePublicationRequestFingerprint,
} from "./governance.js";

function publicationTarget() {
  const tenantId = createCanonicalId("tenant");
  const relationshipId = createCanonicalId("relationship");
  const worldId = createCanonicalId("world");
  const observedAt = toInstant("2026-10-02T05:00:00Z");
  return {
    tenantId,
    relationshipId,
    worldId,
    target: {
      tenantId,
      sourceMemoryRecordId: createCanonicalId("memory-record"),
      sourceMemoryRevisionId: createCanonicalId("memory-revision"),
      sourceScope: { kind: "relationship", relationshipId } as const,
      targetMemoryRecordId: createCanonicalId("memory-record"),
      targetMemoryRevisionId: createCanonicalId("memory-revision"),
      targetMemoryType: "fact" as const,
      targetScope: { kind: "world", worldId } as const,
      targetRevision: {
        content: "A deliberately published shared fact.",
        extractionMethod: "governance-test",
        observedAt,
        evidence: [
          {
            sourceKind: "operator" as const,
            sourceReference: "fixture:publication",
            sourceContentHash: "c".repeat(64),
            observedAt,
          },
        ],
      },
      reason: "Explicitly approved publication for shared continuity.",
    },
  };
}

describe("memory scope publication governance", () => {
  it("requires explicit source and target resource scope", () => {
    const { tenantId, relationshipId, worldId, target } = publicationTarget();
    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "memory-governance-test" },
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: {
        relationshipIds: [relationshipId],
        worldIds: [worldId],
      },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    expect(() =>
      assertMemoryScopePublicationAuthority(authority, target),
    ).not.toThrow();

    const missingSource = createAuthorityContext({
      tenantId,
      principal: authority.principal,
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    expect(() =>
      assertMemoryScopePublicationAuthority(missingSource, target),
    ).toThrow(/source Relationship/u);
  });

  it("binds approval to exact publication arguments", () => {
    const { tenantId, relationshipId, worldId, target } = publicationTarget();
    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "memory-governance-test" },
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: {
        relationshipIds: [relationshipId],
        worldIds: [worldId],
      },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    const operationId = createCanonicalId("operation");

    const binding = createMemoryScopePublicationApprovalBinding({
      ...target,
      operationId,
      authority,
    });

    expect(binding.operationId).toBe(operationId);
    expect(binding.action).toBe("memory.scope.publish");
    expect(binding.argumentsFingerprint).toHaveLength(64);

    expect(
      memoryScopePublicationRequestFingerprint(target),
    ).not.toBe(
      memoryScopePublicationRequestFingerprint({
        ...target,
        reason: "Changed governance reason.",
      }),
    );
  });

  it("forbids using lineage-style publication into another private scope", () => {
    const { tenantId, relationshipId, target } = publicationTarget();
    const otherRelationshipId = createCanonicalId("relationship");
    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "memory-governance-test" },
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: {
        relationshipIds: [relationshipId, otherRelationshipId],
      },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    expect(() =>
      assertMemoryScopePublicationAuthority(authority, {
        ...target,
        targetScope: {
          kind: "relationship",
          relationshipId: otherRelationshipId,
        },
      }),
    ).toThrow(/target must be Character-shared, World, or Organization/u);
  });
});
