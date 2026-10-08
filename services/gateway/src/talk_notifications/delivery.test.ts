import { describe, expect, it, vi } from "vitest";
import { createTalkPushDelivery } from "./delivery.js";
import type { TalkNotificationEvent } from "./policy.js";

const event: TalkNotificationEvent = {
  schemaVersion: 1,
  eventId: "event-1",
  tenantId: "tenant-1",
  recipientUserId: "user-1",
  kind: "followed_host_live",
  talkId: "talk-1",
  actorDisplayName: "Amina",
  createdAt: "2026-10-07T10:00:00Z",
};

describe("Talk push delivery", () => {
  it("claims dedupe before calling the sender", async () => {
    const claim = vi.fn(async () => true);
    const send = vi.fn(async () => ({ attempted: 1, delivered: 1 }));
    const delivery = createTalkPushDelivery({
      dedupe: { claim },
      sender: { send },
    });

    const result = await delivery.deliver({
      event,
      pushEnabled: true,
      quietHours: false,
    });

    expect(claim).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      title: "A Host you follow is live",
      body: "A new Talk has started.",
      data: { kind: "followed_host_live", eventId: "event-1", talkId: "talk-1" },
      scope: { tenantId: "tenant-1", userId: "user-1" },
    }));
    expect(JSON.stringify(send.mock.calls)).not.toContain("Amina");
    expect(result).toEqual({ disposition: "sent", attempted: 1, delivered: 1 });
  });

  it("does not deliver duplicate events", async () => {
    const send = vi.fn(async () => ({ attempted: 1, delivered: 1 }));
    const delivery = createTalkPushDelivery({
      dedupe: { claim: async () => false },
      sender: { send },
    });

    const result = await delivery.deliver({
      event,
      pushEnabled: true,
      quietHours: false,
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.disposition).toBe("duplicate");
  });

  it("skips non-urgent quiet-hours events before claiming dedupe", async () => {
    const claim = vi.fn(async () => true);
    const send = vi.fn(async () => ({ attempted: 1, delivered: 1 }));
    const delivery = createTalkPushDelivery({
      dedupe: { claim },
      sender: { send },
    });

    const result = await delivery.deliver({
      event: { ...event, kind: "replay_ready" },
      pushEnabled: true,
      quietHours: true,
    });

    expect(claim).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(result.disposition).toBe("skipped");
  });
});
