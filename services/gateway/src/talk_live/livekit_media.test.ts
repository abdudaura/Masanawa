import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLiveKitTalkMediaTokenIssuer } from "./livekit_media.js";

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("LiveKit Talk media token issuer", () => {
  it("mints Host microphone-publish credentials with opaque room/identity", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      now: () => new Date("2026-10-07T10:00:00.000Z"),
      ttlSeconds: 300,
    });
    const credentials = await issuer.mint({
      talkId: "talk_123",
      sessionId: "talk-live_abc",
      userId: "user_opaque",
      role: "host",
      canPublishAudio: true,
    });
    const [header, payload, signature] = credentials.participant_token.split(".");
    expect(header).toBeTruthy();
    expect(payload).toBeTruthy();
    expect(signature).toBeTruthy();
    const claims = decodePart(payload!);
    expect(claims).toMatchObject({
      iss: "api-key",
      sub: "user_opaque:talk-live_abc",
      video: {
        roomJoin: true,
        room: "talk_123",
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: ["microphone"],
      },
    });
    const expected = createHmac("sha256", "0123456789abcdef0123456789abcdef")
      .update(`${header}.${payload}`, "utf8")
      .digest("base64url");
    expect(signature).toBe(expected);
    expect(credentials.server_url).toBe("wss://live.example.test");
  });

  it("mints listener credentials that cannot publish any track", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      now: () => new Date("2026-10-07T10:00:00.000Z"),
    });
    const credentials = await issuer.mint({
      talkId: "talk_123",
      sessionId: "talk-live_listener",
      userId: "user_listener",
      role: "listener",
      canPublishAudio: false,
    });
    const payload = credentials.participant_token.split(".")[1]!;
    const claims = decodePart(payload);
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: "talk_123",
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    });
    expect(JSON.stringify(claims.video)).not.toContain("canPublishSources");
  });
});
