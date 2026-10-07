import { describe, expect, it } from "vitest";
import type { MobilePushSender } from "../mobile_push.js";
import { createTalkPushDeliveryRuntime } from "./runtime.js";

describe("Talk push runtime composition", () => {
  const sender: MobilePushSender = {
    async send() {
      return { attempted: 1, delivered: 1 };
    },
  };
  const dedupe = {
    async claim() {
      return true;
    },
  };

  it("stays unavailable when Firebase delivery is not configured", () => {
    expect(createTalkPushDeliveryRuntime({ dedupe })).toBeUndefined();
  });

  it("stays unavailable without durable dedupe", () => {
    expect(createTalkPushDeliveryRuntime({ sender })).toBeUndefined();
  });

  it("composes existing FCM sender with durable Talk dedupe", async () => {
    const runtime = createTalkPushDeliveryRuntime({ sender, dedupe });
    expect(runtime).toBeDefined();

    await expect(runtime!.deliver({
      event: {
        schemaVersion: 1,
        eventId: "event_replay_1",
        tenantId: "tenant_1",
        recipientUserId: "user_1",
        kind: "replay_ready",
        talkId: "talk_1",
        actorDisplayName: null,
        createdAt: "2026-10-07T12:00:00.000Z",
      },
      pushEnabled: true,
      quietHours: false,
    })).resolves.toEqual({
      disposition: "sent",
      attempted: 1,
      delivered: 1,
    });
  });
});
