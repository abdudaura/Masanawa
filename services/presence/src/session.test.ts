import { describe, expect, it } from "vitest";
import type { CharacterSession } from "@masanawa/agents";
import {
  activatePresenceSession,
  admitPresenceSession,
  assertPresenceCharacterSessionBridge,
  assertPresenceConnectionGeneration,
  closePresenceSession,
  reconnectPresenceSession,
} from "./session.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as never;
const userId = "user_00000000-0000-7000-8000-000000000002" as never;
const characterId =
  "character_00000000-0000-7000-8000-000000000003" as never;
const relationshipId =
  "relationship_00000000-0000-7000-8000-000000000004" as never;
const characterSessionId =
  "character-session_00000000-0000-7000-8000-000000000005" as never;
const presenceSessionId =
  "presence-session_00000000-0000-7000-8000-000000000006" as never;

function characterSession(
  overrides: Partial<CharacterSession> = {},
): CharacterSession {
  return {
    schemaVersion: 1,
    tenantId,
    userId,
    characterId,
    relationshipId,
    characterSessionId,
    characterVersionId:
      "character-version_00000000-0000-7000-8000-000000000007" as never,
    bindings: {
      channelSessionId: null,
      presenceSessionId: null,
      skillVersionIds: [],
      taskIds: [],
      workflowRunIds: [],
    },
    state: "active",
    revision: 3,
    createdAt: "2026-10-06T10:00:00.000Z" as never,
    updatedAt: "2026-10-06T10:00:00.000Z" as never,
    expiresAt: "2026-10-06T11:00:00.000Z" as never,
    closedAt: null,
    closeReason: null,
    successorSessionId: null,
    ...overrides,
  };
}

describe("PresenceSession CharacterSession bridge", () => {
  it("admits exact CharacterSession identity and returns a revision-bound binding plan", () => {
    const admitted = admitPresenceSession({
      presenceSessionId,
      characterSession: characterSession(),
      mode: "audio",
      admittedAt: "2026-10-06T10:05:00.000Z" as never,
    });

    expect(admitted.session).toMatchObject({
      tenantId,
      presenceSessionId,
      characterSessionId,
      userId,
      characterId,
      relationshipId,
      state: "admitted",
      connectionGeneration: 0,
      revision: 1,
    });
    expect(admitted.characterBinding).toEqual({
      tenantId,
      characterSessionId,
      presenceSessionId,
      expectedCharacterSessionRevision: 3,
    });
  });

  it("rejects closed, expired or differently bound CharacterSessions", () => {
    expect(() =>
      admitPresenceSession({
        presenceSessionId,
        characterSession: characterSession({
          expiresAt: "2026-10-06T10:04:59.000Z" as never,
        }),
        mode: "audio",
        admittedAt: "2026-10-06T10:05:00.000Z" as never,
      }),
    ).toThrow("not active");

    expect(() =>
      admitPresenceSession({
        presenceSessionId,
        characterSession: characterSession({
          bindings: {
            channelSessionId: null,
            presenceSessionId:
              "presence-session_00000000-0000-7000-8000-000000000999" as never,
            skillVersionIds: [],
            taskIds: [],
            workflowRunIds: [],
          },
        }),
        mode: "audio",
        admittedAt: "2026-10-06T10:05:00.000Z" as never,
      }),
    ).toThrow("another PresenceSession");
  });

  it("activates then reuses the same PresenceSession identity across reconnects", () => {
    const admitted = admitPresenceSession({
      presenceSessionId,
      characterSession: characterSession(),
      mode: "audio-video",
      admittedAt: "2026-10-06T10:05:00.000Z" as never,
    }).session;
    const active = activatePresenceSession({
      session: admitted,
      expectedRevision: 1,
      connectedAt: "2026-10-06T10:06:00.000Z" as never,
    });
    const reconnected = reconnectPresenceSession({
      session: active,
      expectedRevision: 2,
      reconnectedAt: "2026-10-06T10:10:00.000Z" as never,
    });

    expect(reconnected.presenceSessionId).toBe(presenceSessionId);
    expect(reconnected.characterSessionId).toBe(characterSessionId);
    expect(reconnected.connectionGeneration).toBe(2);
    expect(reconnected.revision).toBe(3);
  });

  it("fences stale transport callbacks by connection generation", () => {
    const admitted = admitPresenceSession({
      presenceSessionId,
      characterSession: characterSession(),
      mode: "audio",
      admittedAt: "2026-10-06T10:05:00.000Z" as never,
    }).session;
    const active = activatePresenceSession({
      session: admitted,
      expectedRevision: 1,
      connectedAt: "2026-10-06T10:06:00.000Z" as never,
    });
    const reconnected = reconnectPresenceSession({
      session: active,
      expectedRevision: 2,
      reconnectedAt: "2026-10-06T10:10:00.000Z" as never,
    });

    expect(() =>
      assertPresenceConnectionGeneration({
        session: reconnected,
        connectionGeneration: 1,
      }),
    ).toThrow("no longer current");
    expect(() =>
      assertPresenceConnectionGeneration({
        session: reconnected,
        connectionGeneration: 2,
      }),
    ).not.toThrow();
  });

  it("fails closed when Presence scope is moved to another CharacterSession identity", () => {
    const admitted = admitPresenceSession({
      presenceSessionId,
      characterSession: characterSession(),
      mode: "audio",
      admittedAt: "2026-10-06T10:05:00.000Z" as never,
    }).session;

    expect(() =>
      assertPresenceCharacterSessionBridge({
        presenceSession: admitted,
        characterSession: characterSession({
          userId: "user_00000000-0000-7000-8000-000000000099" as never,
        }),
        at: "2026-10-06T10:06:00.000Z" as never,
      }),
    ).toThrow("scope does not match");
  });

  it("makes close terminal and rejects stale revision updates", () => {
    const admitted = admitPresenceSession({
      presenceSessionId,
      characterSession: characterSession(),
      mode: "audio",
      admittedAt: "2026-10-06T10:05:00.000Z" as never,
    }).session;
    const active = activatePresenceSession({
      session: admitted,
      expectedRevision: 1,
      connectedAt: "2026-10-06T10:06:00.000Z" as never,
    });
    const closed = closePresenceSession({
      session: active,
      expectedRevision: 2,
      reason: "ended",
      closedAt: "2026-10-06T10:20:00.000Z" as never,
    });

    expect(closed.state).toBe("closed");
    expect(() =>
      reconnectPresenceSession({
        session: closed,
        expectedRevision: 3,
        reconnectedAt: "2026-10-06T10:21:00.000Z" as never,
      }),
    ).toThrow("Only active");
  });
});
