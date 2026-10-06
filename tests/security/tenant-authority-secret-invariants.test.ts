import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  type Instant,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  assertCharacterSessionAccess,
  emptyCharacterSessionBindings,
} from "@masanawa/agents";
import {
  CredentialSecret,
  createAuthorityContext,
} from "@masanawa/security";

const at = "2026-10-06T12:00:00.000Z" as Instant;

function authority(input: {
  tenantId: TenantId;
  userId: UserId;
  relationshipId: RelationshipId;
  capabilities?: readonly string[];
  expiresAt?: Instant;
}) {
  return createAuthorityContext({
    tenantId: input.tenantId,
    principal: { kind: "user", userId: input.userId },
    scopes: ["agents.session"],
    capabilities: input.capabilities ?? ["agents.session.read"],
    resourceScope: {
      relationshipIds: [input.relationshipId],
    },
    policyRevision: "security-test-r1",
    approvalIds: [],
    delegationChain: [],
    issuedAt: "2026-10-06T11:00:00.000Z" as Instant,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    requestId: "security-test-request",
    correlationId: "security-test-correlation",
  });
}

describe("production security invariants", () => {
  it("denies cross-Tenant CharacterSession access even when user/capability/resource otherwise match", () => {
    const tenantA = createCanonicalId("tenant");
    const tenantB = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const relationshipId = createCanonicalId("relationship");
    const characterId = createCanonicalId("character");

    const context = authority({
      tenantId: tenantA,
      userId,
      relationshipId,
    });

    expect(() =>
      assertCharacterSessionAccess(
        context,
        {
          tenantId: tenantB,
          userId,
          relationshipId,
          characterId,
        },
        "read",
        emptyCharacterSessionBindings,
        at,
      ),
    ).toThrow("does not allow");
  });

  it("does not let manage-other capability override Tenant isolation", () => {
    const tenantA = createCanonicalId("tenant");
    const tenantB = createCanonicalId("tenant");
    const actorUserId = createCanonicalId("user");
    const targetUserId = createCanonicalId("user");
    const relationshipId = createCanonicalId("relationship");
    const characterId = createCanonicalId("character");

    const context = authority({
      tenantId: tenantA,
      userId: actorUserId,
      relationshipId,
      capabilities: [
        "agents.session.read",
        "agents.session.manage-other",
      ],
    });

    expect(() =>
      assertCharacterSessionAccess(
        context,
        {
          tenantId: tenantB,
          userId: targetUserId,
          relationshipId,
          characterId,
        },
        "read",
        emptyCharacterSessionBindings,
        at,
      ),
    ).toThrow("does not allow");
  });

  it("denies expired authority even when Tenant and resources match", () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const relationshipId = createCanonicalId("relationship");
    const characterId = createCanonicalId("character");

    const context = authority({
      tenantId,
      userId,
      relationshipId,
      expiresAt: "2026-10-06T11:59:59.999Z" as Instant,
    });

    expect(() =>
      assertCharacterSessionAccess(
        context,
        {
          tenantId,
          userId,
          relationshipId,
          characterId,
        },
        "read",
        emptyCharacterSessionBindings,
        at,
      ),
    ).toThrow("does not allow");
  });

  it("keeps credential material out of string JSON and inspection surfaces", () => {
    const canary = "task145-secret-canary-never-serialize";
    const secret = CredentialSecret.fromString(canary);

    expect(secret.use((value) => value)).toBe(canary);

    const surfaces = [
      String(secret),
      JSON.stringify(secret),
      JSON.stringify({ secret }),
      inspect(secret),
      inspect({ secret }, { depth: 4 }),
      `credential=${secret}`,
    ];

    for (const rendered of surfaces) {
      expect(rendered).not.toContain(canary);
    }
    expect(surfaces.join("\n")).toContain("[REDACTED]");
  });

  it("does not expose private secret fields through ordinary enumeration", () => {
    const canary = "task145-enumeration-canary";
    const secret = CredentialSecret.fromString(canary);

    expect(Object.keys(secret)).toEqual([]);
    expect(Object.values(secret)).toEqual([]);
    expect(Object.entries(secret)).toEqual([]);
    expect(JSON.stringify(Object.assign({}, secret))).not.toContain(canary);
  });
});
