import { describe, expect, it } from "vitest";
import {
  projectPublicTwinProfile,
  type TwinPublicProfile,
} from "../../packages/identity/src/twin-profile.js";
import {
  assertMemoryAllowedInPublicTwinRepresentation,
  filterPublicTwinRepresentationMemory,
} from "../../packages/memory/src/representation.js";
import type {
  MemoryRecordSnapshot,
  MemoryScope,
} from "../../packages/memory/src/model.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const characterId = "character_00000000-0000-4000-8000-000000000002" as never;
const ownerUserId = "user_00000000-0000-4000-8000-000000000003" as never;

const profile: TwinPublicProfile = {
  tenantId,
  characterId,
  ownerUserId,
  publicId: "privacy-safe-twin",
  displayName: "Privacy Safe Twin",
  bio: "Public representation",
  interests: ["learning"],
  languages: ["English"],
  avatarUrl: null,
  discoverable: true,
  revision: 1,
  createdAt: "2026-10-06T09:00:00.000Z" as never,
  updatedAt: "2026-10-06T09:00:00.000Z" as never,
};

function snapshot(
  suffix: string,
  scope: MemoryScope,
  content: string,
): MemoryRecordSnapshot {
  const recordId =
    `memory-record_00000000-0000-4000-8000-${suffix.padStart(12, "0")}` as never;
  const revisionId =
    `memory-revision_00000000-0000-4000-8000-${suffix.padStart(12, "0")}` as never;
  return {
    record: {
      tenantId,
      memoryRecordId: recordId,
      memoryType: "fact",
      scope,
      lifecycleState: "active",
      currentRevisionId: revisionId,
      revision: 1,
      lifecycleRevision: 1,
      createdAt: "2026-10-06T09:00:00.000Z" as never,
      updatedAt: "2026-10-06T09:00:00.000Z" as never,
    },
    currentRevision: {
      tenantId,
      memoryRevisionId: revisionId,
      memoryRecordId: recordId,
      revisionNumber: 1,
      content,
      payload: {},
      confidence: 1,
      extraction: { method: "owner-approved", modelVersion: null },
      eventTime: null,
      observedAt: "2026-10-06T09:00:00.000Z" as never,
      validFrom: null,
      validTo: null,
      expiresAt: null,
      createdAt: "2026-10-06T09:00:00.000Z" as never,
      evidence: [],
    },
  };
}

describe("TWIN-107 public Twin privacy acceptance", () => {
  it("projects no private owner identity into the public Twin profile", () => {
    const projection = projectPublicTwinProfile(profile);
    expect(projection).not.toBeNull();

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain(String(ownerUserId));
    expect(serialized).not.toContain("ownerUserId");
    expect(serialized).not.toContain("revision");
    expect(projection).toMatchObject({
      characterId,
      publicId: "privacy-safe-twin",
      representationLabel: "AI twin",
      ownerPresence: "not-present",
    });
  });

  it("admits only explicitly shared memory for this exact public Twin", () => {
    const shared = snapshot(
      "101",
      { kind: "character-shared", characterId },
      "Owner-approved public representation fact",
    );

    expect(() =>
      assertMemoryAllowedInPublicTwinRepresentation({
        boundary: { tenantId, characterId },
        snapshot: shared,
      }),
    ).not.toThrow();

    expect(
      filterPublicTwinRepresentationMemory({
        boundary: { tenantId, characterId },
        snapshots: [shared],
      }),
    ).toEqual([shared]);
  });

  it.each([
    [
      "owner-private character memory",
      { kind: "character-private", characterId } as const,
    ],
    [
      "relationship memory",
      {
        kind: "relationship",
        relationshipId:
          "relationship_00000000-0000-4000-8000-000000000201" as never,
      } as const,
    ],
    [
      "session memory",
      {
        kind: "session",
        characterSessionId:
          "character-session_00000000-0000-4000-8000-000000000202" as never,
      } as const,
    ],
    [
      "another Twin's shared memory",
      {
        kind: "character-shared",
        characterId:
          "character_00000000-0000-4000-8000-000000000203" as never,
      } as const,
    ],
  ])("rejects %s from public representation", (_label, scope) => {
    const privateSnapshot = snapshot(
      "301",
      scope,
      "This content must never reach a public Twin response",
    );

    expect(() =>
      filterPublicTwinRepresentationMemory({
        boundary: { tenantId, characterId },
        snapshots: [privateSnapshot],
      }),
    ).toThrow("only explicitly shared memory");
  });

  it("rejects cross-tenant memory even when its scope names the same Character", () => {
    const shared = snapshot(
      "401",
      { kind: "character-shared", characterId },
      "Cross-tenant data",
    );
    const crossTenant = {
      ...shared,
      record: {
        ...shared.record,
        tenantId:
          "tenant_00000000-0000-4000-8000-000000000999" as never,
      },
      currentRevision: {
        ...shared.currentRevision,
        tenantId:
          "tenant_00000000-0000-4000-8000-000000000999" as never,
      },
    } satisfies MemoryRecordSnapshot;

    expect(() =>
      assertMemoryAllowedInPublicTwinRepresentation({
        boundary: { tenantId, characterId },
        snapshot: crossTenant,
      }),
    ).toThrow("different tenant");
  });

  it("fails the whole public projection batch when any private memory is mixed in", () => {
    const shared = snapshot(
      "501",
      { kind: "character-shared", characterId },
      "Allowed public fact",
    );
    const ownerPrivate = snapshot(
      "502",
      { kind: "character-private", characterId },
      "Private owner fact",
    );

    expect(() =>
      filterPublicTwinRepresentationMemory({
        boundary: { tenantId, characterId },
        snapshots: [shared, ownerPrivate],
      }),
    ).toThrow("only explicitly shared memory");
  });
});
