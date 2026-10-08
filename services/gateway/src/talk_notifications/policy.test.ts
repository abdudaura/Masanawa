import { describe, expect, it } from "vitest";
import {
  createTalkPushIntent,
  normalizeTalkNotificationEvent,
  shouldSendTalkPush,
  talkPushDedupeKey,
  type TalkNotificationEvent,
} from "./policy.js";

function event(
  kind: TalkNotificationEvent["kind"],
  overrides: Partial<TalkNotificationEvent> = {},
): TalkNotificationEvent {
  return {
    schemaVersion: 1,
    eventId: `event-${kind}`,
    tenantId: "tenant-1",
    recipientUserId: "user-1",
    kind,
    talkId: "talk-1",
    actorDisplayName: "Amina",
    createdAt: "2026-10-07T10:00:00Z",
    ...overrides,
  };
}

describe("Talk notification policy", () => {
  it("normalizes event identity and produces recipient-scoped dedupe", () => {
    const normalized = normalizeTalkNotificationEvent(event("replay_ready"));
    expect(normalized.createdAt).toBe("2026-10-07T10:00:00.000Z");
    expect(talkPushDedupeKey(normalized)).toContain("tenant-1:user-1:event-replay_ready");
  });

  it("deep-links Talk events without leaking private financial metadata", () => {
    const intent = createTalkPushIntent(event("earning_available"));
    expect(intent.data).toEqual({
      kind: "earning_available",
      eventId: "event-earning_available",
      talkId: "talk-1",
    });
    expect(JSON.stringify(intent)).not.toMatch(/amount|transaction|balance/i);
    expect(intent.title).toBe("New earnings");
    expect(intent.body).toBe("Your Talk earnings have an update.");
  });

  it("keeps gift lockscreen copy generic", () => {
    const intent = createTalkPushIntent(event("gift_received"));
    expect(intent.body).toBe("You received a gift in a Talk.");
    expect(intent.body).not.toMatch(/credit|₦|ngn|usd|transaction/i);
  });

  it("never exposes a financial hold or release on lock screen", () => {
    const intent = createTalkPushIntent(event("ai_seat_declined"));
    expect(intent.body).toBe("Your AI Seat invitation has an update.");
    expect(intent.data).not.toHaveProperty("transactionId");
  });

  it("marks time-sensitive participation and live events high priority", () => {
    for (const kind of [
      "talk_invitation",
      "raise_hand_accepted",
      "ai_seat_sponsored",
      "ai_seat_accepted",
      "followed_host_live",
      "platform_notice",
    ] as const) {
      expect(createTalkPushIntent(event(kind)).priority).toBe("high");
    }
  });

  it("respects disabled push and only lets urgent events through quiet hours", () => {
    expect(shouldSendTalkPush({
      event: event("talk_invitation"),
      pushEnabled: false,
      quietHours: false,
    })).toBe(false);

    expect(shouldSendTalkPush({
      event: event("replay_ready"),
      pushEnabled: true,
      quietHours: true,
    })).toBe(false);

    expect(shouldSendTalkPush({
      event: event("followed_host_live"),
      pushEnabled: true,
      quietHours: true,
    })).toBe(true);
  });


  it("strips human-controlled names and does not include private names or payment-like bait for every event kind", () => {
    const lowerTrustName = "Amina 07010102053 · ₦95,000 Bank login: https://bad.example/\\nALERT";
    const kinds: readonly TalkNotificationEvent["kind"][] = [
      "talk_invitation", "raise_hand_accepted", "raise_hand_declined",
      "ai_seat_sponsored", "ai_seat_accepted", "ai_seat_declined",
      "followed_host_live", "replay_ready", "gift_received",
      "earning_available", "platform_notice",
    ];
    for (const kind of kinds) {
      const raw = event(kind, { actorDisplayName: lowerTrustName });
      const normalized = normalizeTalkNotificationEvent(raw);
      const intent = createTalkPushIntent(raw);
      expect(normalized.actorDisplayName).toBeNull();
      const serialized = JSON.stringify(intent);
      expect(serialized).not.toContain(lowerTrustName);
      expect(serialized).not.toMatch(/Amina|07010102053|95,000|bad\\.example|Bank login|\\nALERT/);
      expect(Object.keys(intent.data).sort()).toEqual(["eventId", "kind", "talkId"]);
      expect(intent.body.length).toBeGreaterThan(0);
    }
  });

  it("rejects malformed event fields instead of creating unsafe payloads", () => {
    expect(() => createTalkPushIntent(event("platform_notice", {
      eventId: "",
    }))).toThrow("eventId");

    // Profile display names are lower-trust data and must not be a
    // notification-delivery precondition or appear in a remote preview.
    expect(createTalkPushIntent(event("talk_invitation", {
      actorDisplayName: "x".repeat(500),
    })).body).toBe("You have a Talk invitation.");
  });
});
