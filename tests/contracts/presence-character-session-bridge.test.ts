import { describe, expect, it } from "vitest";
import {
  assertPresenceCharacterSessionBridge,
  normalizePresenceSession,
  presenceBindingPatch,
  transitionPresenceSession,
  type CharacterSessionBridgeSnapshot,
  type PresenceSession,
} from "../../services/presence/src/index.js";

const presence: PresenceSession = {
  schemaVersion: 1,
  presenceSessionId:
    "presence-session_0199f0a0-0000-7000-8000-000000000901",
  tenantId: "tenant_0199f0a0-0000-7000-8000-000000000902",
  userId: "user_0199f0a0-0000-7000-8000-000000000903",
  relationshipId:
    "relationship_0199f0a0-0000-7000-8000-000000000904",
  characterId:
    "character_0199f0a0-0000-7000-8000-000000000905",
  characterSessionId:
    "character-session_0199f0a0-0000-7000-8000-000000000906",
  state: "connecting",
  transportSessionRef: null,
  createdAt: "2026-10-06T10:00:00Z",
  updatedAt: "2026-10-06T10:00:00Z",
  endedAt: null,
  failureReason: null,
  revision: 1,
};

const characterSession: CharacterSessionBridgeSnapshot = {
  schemaVersion: 1,
  tenantId: presence.tenantId,
  userId: presence.userId,
  relationshipId: presence.relationshipId,
  characterId: presence.characterId,
  characterSessionId: presence.characterSessionId,
  state: "active",
  bindings: { presenceSessionId: null },
};

describe("PresenceSession / CharacterSession bridge", () => {
  it("normalizes an ephemeral PresenceSession without durable business state", () => {
    const normalized = normalizePresenceSession(presence);
    expect(normalized).toMatchObject({
      state: "connecting",
      characterSessionId: presence.characterSessionId,
      transportSessionRef: null,
    });
    expect(JSON.stringify(normalized)).not.toContain("workflowRun");
    expect(JSON.stringify(normalized)).not.toContain("ledger");
    expect(JSON.stringify(normalized)).not.toContain("memory");
  });

  it("builds a CharacterSession binding patch only after exact scope validation", () => {
    expect(
      presenceBindingPatch({ presence, characterSession }),
    ).toEqual({
      presenceSessionId: presence.presenceSessionId,
    });
  });

  it("rejects cross-tenant, cross-user, Relationship or Character mismatches", () => {
    for (const session of [
      { ...characterSession, tenantId: "tenant_other" },
      { ...characterSession, userId: "user_other" },
      { ...characterSession, relationshipId: "relationship_other" },
      { ...characterSession, characterId: "character_other" },
    ]) {
      expect(() =>
        assertPresenceCharacterSessionBridge({
          presence,
          characterSession: session,
        }),
      ).toThrow("scope does not match");
    }
  });

  it("rejects a closed CharacterSession", () => {
    expect(() =>
      assertPresenceCharacterSessionBridge({
        presence,
        characterSession: { ...characterSession, state: "closed" },
      }),
    ).toThrow("requires an active CharacterSession");
  });

  it("cannot overwrite a different existing Presence binding", () => {
    expect(() =>
      assertPresenceCharacterSessionBridge({
        presence,
        characterSession: {
          ...characterSession,
          bindings: {
            presenceSessionId:
              "presence-session_0199f0a0-0000-7000-8000-000000000999",
          },
        },
      }),
    ).toThrow("already bound to a different PresenceSession");
  });

  it("supports connecting -> active -> ended lifecycle with immutable revisions", () => {
    const active = transitionPresenceSession({
      current: presence,
      nextState: "active",
      occurredAt: "2026-10-06T10:00:01Z",
      transportSessionRef: "live-room:opaque-1",
    });
    expect(active).toMatchObject({
      state: "active",
      revision: 2,
      transportSessionRef: "live-room:opaque-1",
      endedAt: null,
    });

    const ended = transitionPresenceSession({
      current: active,
      nextState: "ended",
      occurredAt: "2026-10-06T10:10:00Z",
    });
    expect(ended).toMatchObject({
      state: "ended",
      revision: 3,
      endedAt: "2026-10-06T10:10:00.000Z",
    });

    expect(() =>
      transitionPresenceSession({
        current: ended,
        nextState: "failed",
        occurredAt: "2026-10-06T10:11:00Z",
        failureReason: "late failure",
      }),
    ).toThrow("terminal PresenceSession cannot transition again");
  });

  it("requires explicit failure evidence for a failed PresenceSession", () => {
    expect(() =>
      transitionPresenceSession({
        current: presence,
        nextState: "failed",
        occurredAt: "2026-10-06T10:00:02Z",
      }),
    ).toThrow("failureReason");
  });
});
