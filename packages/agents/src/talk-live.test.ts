import { describe, expect, it } from "vitest";
import {
  assertAiAudioTurnAllowed,
  assertSeatAudioFrameAllowed,
  assertTalkLiveSession,
  createTalkLiveSession,
  isPublicAudioBroadcastAllowed,
  transitionTalkLiveSession,
  type TalkId,
  type TalkLivePolicy,
  type TalkPersonaId,
  type TalkSeatId,
} from "./talk-live.js";

const policy: TalkLivePolicy = {
  maxActiveSeats: 4,
  maxAiSeats: 2,
  hostReconnectGraceMs: 10_000,
};

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const hostUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const listenerUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const talkId = "talk_00000000-0000-4000-8000-000000000004" as TalkId;
const hostSeatId = "seat_host" as TalkSeatId;
const startedAt = "2026-10-07T09:00:00.000Z" as never;

function fixture() {
  return createTalkLiveSession({ tenantId, talkId, hostUserId, hostSeatId, startedAt }, policy);
}

function at(value: string) {
  return value as never;
}

describe("Talk live-audio runtime", () => {
  it("starts only with a connected real human Host and permits public/AI audio", () => {
    const session = fixture();
    expect(session.state).toBe("live");
    expect(session.aiTurns).toBe("enabled");
    expect(session.seats).toEqual([
      expect.objectContaining({
        seatId: hostSeatId,
        kind: "human",
        role: "host",
        userId: hostUserId,
        connected: true,
      }),
    ]);
    expect(isPublicAudioBroadcastAllowed(session)).toBe(true);
    expect(() => assertAiAudioTurnAllowed(session)).not.toThrow();
    expect(() => assertSeatAudioFrameAllowed(session, hostSeatId)).not.toThrow();
  });

  it("pauses public audio and AI turns immediately when the Host disconnects", () => {
    const original = fixture();
    const disconnected = transitionTalkLiveSession(
      original,
      { type: "host_disconnected", expectedRevision: original.revision },
      at("2026-10-07T09:00:05.000Z"),
      policy,
    ).session;

    expect(disconnected.state).toBe("host_reconnecting");
    expect(disconnected.aiTurns).toBe("paused");
    expect(disconnected.hostReconnectDeadline).toBe("2026-10-07T09:00:15.000Z");
    expect(disconnected.seats[0]).toEqual(expect.objectContaining({ connected: false }));
    expect(isPublicAudioBroadcastAllowed(disconnected)).toBe(false);
    expect(() => assertAiAudioTurnAllowed(disconnected)).toThrow("human Host");
    expect(() => assertSeatAudioFrameAllowed(disconnected, hostSeatId)).toThrow("Host is absent");
  });

  it("resumes only when the same human Host returns inside the grace window", () => {
    const original = fixture();
    const disconnected = transitionTalkLiveSession(
      original,
      { type: "host_disconnected", expectedRevision: original.revision },
      at("2026-10-07T09:00:05.000Z"),
      policy,
    ).session;
    const reconnected = transitionTalkLiveSession(
      disconnected,
      { type: "host_reconnected", expectedRevision: disconnected.revision },
      at("2026-10-07T09:00:14.999Z"),
      policy,
    ).session;

    expect(reconnected.state).toBe("live");
    expect(reconnected.aiTurns).toBe("enabled");
    expect(reconnected.hostReconnectDeadline).toBeNull();
    expect(reconnected.seats[0]).toEqual(expect.objectContaining({ connected: true }));
    expect(() => assertAiAudioTurnAllowed(reconnected)).not.toThrow();
  });

  it("ends instead of becoming an AI-only Talk when Host grace expires", () => {
    const original = fixture();
    const disconnected = transitionTalkLiveSession(
      original,
      { type: "host_disconnected", expectedRevision: original.revision },
      at("2026-10-07T09:00:05.000Z"),
      policy,
    ).session;

    expect(() =>
      transitionTalkLiveSession(
        disconnected,
        { type: "host_reconnected", expectedRevision: disconnected.revision },
        at("2026-10-07T09:00:15.000Z"),
        policy,
      ),
    ).toThrow("expired");

    const ended = transitionTalkLiveSession(
      disconnected,
      { type: "host_grace_expired", expectedRevision: disconnected.revision },
      at("2026-10-07T09:00:15.000Z"),
      policy,
    ).session;

    expect(ended.state).toBe("ended");
    expect(ended.aiTurns).toBe("paused");
    expect(ended.endReason).toBe("host_grace_expired");
    expect(ended.endedAt).toBe("2026-10-07T09:00:15.000Z");
    expect(() =>
      transitionTalkLiveSession(
        ended,
        { type: "host_reconnected", expectedRevision: ended.revision },
        at("2026-10-07T09:00:16.000Z"),
        policy,
      ),
    ).toThrow("Ended Talk");
  });

  it("admits human Seats without commerce and AI Seats only with opaque authorization", () => {
    let session = fixture();
    const humanSeatId = "seat_human" as TalkSeatId;
    session = transitionTalkLiveSession(
      session,
      {
        type: "human_seat_admitted",
        expectedRevision: session.revision,
        seatId: humanSeatId,
        userId: listenerUserId,
      },
      at("2026-10-07T09:00:01.000Z"),
      policy,
    ).session;

    expect(session.seats[1]).toEqual(expect.objectContaining({
      kind: "human",
      role: "speaker",
      userId: listenerUserId,
    }));
    expect(JSON.stringify(session.seats[1])).not.toContain("commercialAuthorizationId");

    expect(() =>
      transitionTalkLiveSession(
        session,
        {
          type: "ai_seat_admitted",
          expectedRevision: session.revision,
          seatId: "seat_ai_bad" as TalkSeatId,
          kind: "expert",
          personaId: "persona_economist" as TalkPersonaId,
          commercialAuthorizationId: "   ",
        },
        at("2026-10-07T09:00:02.000Z"),
        policy,
      ),
    ).toThrow("commercial authorization");

    session = transitionTalkLiveSession(
      session,
      {
        type: "ai_seat_admitted",
        expectedRevision: session.revision,
        seatId: "seat_ai_1" as TalkSeatId,
        kind: "expert",
        personaId: "persona_economist" as TalkPersonaId,
        commercialAuthorizationId: "seat-auth-1",
      },
      at("2026-10-07T09:00:02.000Z"),
      policy,
    ).session;
    session = transitionTalkLiveSession(
      session,
      {
        type: "ai_seat_admitted",
        expectedRevision: session.revision,
        seatId: "seat_ai_2" as TalkSeatId,
        kind: "twin",
        personaId: "persona_twin" as TalkPersonaId,
        commercialAuthorizationId: "seat-auth-2",
      },
      at("2026-10-07T09:00:03.000Z"),
      policy,
    ).session;

    expect(session.seats).toHaveLength(4);
    expect(session.seats.filter((seat) => seat.kind !== "human")).toHaveLength(2);
  });

  it("enforces revision custody, Seat capacity, and Host immovability", () => {
    const session = fixture();

    expect(() =>
      transitionTalkLiveSession(
        session,
        { type: "host_disconnected", expectedRevision: session.revision + 1 },
        at("2026-10-07T09:00:01.000Z"),
        policy,
      ),
    ).toThrow("revision conflict");

    expect(() =>
      transitionTalkLiveSession(
        session,
        { type: "seat_removed", expectedRevision: session.revision, seatId: hostSeatId },
        at("2026-10-07T09:00:01.000Z"),
        policy,
      ),
    ).toThrow("Host Seat cannot be removed");

    const tinyPolicy: TalkLivePolicy = { ...policy, maxActiveSeats: 2, maxAiSeats: 1 };
    let tiny = createTalkLiveSession({ tenantId, talkId, hostUserId, hostSeatId, startedAt }, tinyPolicy);
    tiny = transitionTalkLiveSession(
      tiny,
      {
        type: "human_seat_admitted",
        expectedRevision: tiny.revision,
        seatId: "seat_only" as TalkSeatId,
        userId: listenerUserId,
      },
      at("2026-10-07T09:00:01.000Z"),
      tinyPolicy,
    ).session;
    expect(() =>
      transitionTalkLiveSession(
        tiny,
        {
          type: "ai_seat_admitted",
          expectedRevision: tiny.revision,
          seatId: "seat_overflow" as TalkSeatId,
          kind: "expert",
          personaId: "persona_economist" as TalkPersonaId,
          commercialAuthorizationId: "seat-auth-3",
        },
        at("2026-10-07T09:00:02.000Z"),
        tinyPolicy,
      ),
    ).toThrow("Seat capacity");
  });

  it("rejects malformed persisted state where AI occupies the Host role", () => {
    const session = fixture();
    const invalid = {
      ...session,
      seats: [
        {
          ...session.seats[0]!,
          kind: "expert",
          role: "host",
          personaId: "persona_fake" as TalkPersonaId,
          commercialAuthorizationId: "fake-auth",
        },
      ],
    };
    expect(() => assertTalkLiveSession(invalid as never, policy)).toThrow("human Host");
  });

  it("does not admit new Seats while Host is absent", () => {
    const original = fixture();
    const disconnected = transitionTalkLiveSession(
      original,
      { type: "host_disconnected", expectedRevision: original.revision },
      at("2026-10-07T09:00:01.000Z"),
      policy,
    ).session;

    expect(() =>
      transitionTalkLiveSession(
        disconnected,
        {
          type: "human_seat_admitted",
          expectedRevision: disconnected.revision,
          seatId: "seat_waiting" as TalkSeatId,
          userId: listenerUserId,
        },
        at("2026-10-07T09:00:02.000Z"),
        policy,
      ),
    ).toThrow("Host is absent");
  });
});
