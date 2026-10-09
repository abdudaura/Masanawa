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
      fetchImpl: async () => new Response(JSON.stringify({ participants: [] }), { status: 200 }),
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

  it("mints Speaker credentials that can publish microphone audio", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => new Response(JSON.stringify({ participants: [] }), { status: 200 }),
      now: () => new Date("2026-10-07T10:00:00.000Z"),
    });
    const credentials = await issuer.mint({
      talkId: "talk_123",
      sessionId: "talk-live_speaker",
      userId: "user_speaker",
      role: "speaker",
      canPublishAudio: true,
    });
    const payload = credentials.participant_token.split(".")[1]!;
    const claims = decodePart(payload);
    expect(claims.video).toMatchObject({
      roomJoin: true,
      room: "talk_123",
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ["microphone"],
    });
  });

  it("mints listener credentials that cannot publish any track", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => new Response(JSON.stringify({ participants: [] }), { status: 200 }),
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

  it("evicts only superseded Host session identities before issuing a fresh publisher", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; auth: string }> = [];
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      now: () => new Date("2026-10-08T06:00:00.000Z"),
      fetchImpl: async (url, init) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          auth: String((init?.headers as Record<string, string>).authorization),
        });
        if (String(url).endsWith("/ListParticipants")) {
          return new Response(JSON.stringify({
            participants: [
              { identity: "user_host:talk-live_old" },
              { identity: "user_host:talk-live_new" },
              { identity: "user_other:talk-live_other" },
              { identity: "system-ai-worker" },
              { identity: "user_host:talk-live_old" },
            ],
          }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      },
    });
    const issued = await issuer.mint({
      talkId: "talk_123",
      sessionId: "talk-live_new",
      userId: "user_host",
      role: "host",
      canPublishAudio: true,
    });
    expect(issued.participant_identity).toBe("user_host:talk-live_new");
    expect(calls.map(call => call.url.split("/").at(-1))).toEqual([
      "ListParticipants", "RemoveParticipant",
    ]);
    expect(calls[0]?.body).toEqual({ room: "talk_123" });
    expect(calls[1]?.body).toMatchObject({
      room: "talk_123",
      identity: "user_host:talk-live_old",
      revoke_token_ts: Date.parse("2026-10-08T06:00:00.000Z"),
    });
    const token = calls[0]!.auth.replace("Bearer ", "");
    const [head, body, signature] = token.split(".");
    const grant = decodePart(body!);
    expect(grant.video).toMatchObject({ roomAdmin: true, room: "talk_123" });
    expect(signature).toBe(createHmac("sha256", "0123456789abcdef0123456789abcdef")
      .update(`${head}.${body}`, "utf8").digest("base64url"));
  });

  it("allows the first Host token when LiveKit reports the room does not yet exist", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => new Response(
        JSON.stringify({ code: "not_found", msg: "room not found" }),
        { status: 404 },
      ),
    });
    await expect(issuer.mint({
      talkId: "talk_empty", sessionId: "talk-live_initial",
      userId: "user_host", role: "host", canPublishAudio: true,
    })).resolves.toMatchObject({ room_name: "talk_empty" });
  });

  it("does not require RoomService administration for listeners or muted Speakers", async () => {
    let callCount = 0;
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test", apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => {
        callCount += 1;
        throw Error("should not call ListParticipants");
      },
    });
    await issuer.mint({
      talkId: "talk_1", userId: "user_listener", sessionId: "talk-live_listener",
      role: "listener", canPublishAudio: false,
    });
    await issuer.mint({
      talkId: "talk_1", userId: "user_speaker", sessionId: "talk-live_speaker",
      role: "speaker", canPublishAudio: false,
    });
    expect(callCount).toBe(0);
  });

  it("never mints Host publisher access when LiveKit admin listing fails", async () => {
    for (const [status, body] of [
      [401, "{}"], [403, "{}"], [500, "{}"],
      [404, JSON.stringify({ code: "not_found", msg: "endpoint not found" })],
      [200, JSON.stringify({ participants: "corrupt" })],
    ] as const) {
      const issuer = createLiveKitTalkMediaTokenIssuer({
        serverUrl: "wss://live.example.test",
        apiKey: "api-key",
        apiSecret: "0123456789abcdef0123456789abcdef",
        fetchImpl: async () => new Response(body, { status }),
      });
      await expect(issuer.mint({
        talkId: "talk_1", sessionId: "talk-live_new",
        userId: "user_host", role: "host", canPublishAudio: true,
      })).rejects.toThrow();
    }
  });

  it("classifies unavailable RoomService network and malformed JSON without granting audio", async () => {
    const networkIssuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test", apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => {
        throw new TypeError("ENETUNREACH");
      },
    });
    const input = {
      talkId: "talk_1", userId: "user_host",
      sessionId: "talk-live_new", role: "host" as const, canPublishAudio: true,
    };
    await expect(networkIssuer.mint(input)).rejects.toThrow(
      "talks.live.media_admin_list_failed",
    );
    const malformedIssuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test", apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => new Response("<not-json>", { status: 200 }),
    });
    await expect(malformedIssuer.mint(input)).rejects.toThrow(
      "talks.live.media_admin_invalid_participants",
    );
  });

  it("classifies a network outage during prior Host removal and never issues credentials", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test", apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async (url) => {
        if (String(url).endsWith("/ListParticipants")) {
          return new Response(JSON.stringify({
            participants: [{ identity: "user_host:talk-live_old" }],
          }), { status: 200 });
        }
        throw new TypeError("ECONNRESET");
      },
    });
    await expect(issuer.mint({
      talkId: "talk_1", userId: "user_host",
      sessionId: "talk-live_new", role: "host", canPublishAudio: true,
    })).rejects.toThrow("talks.live.media_admin_remove_failed");
  });

  it("does not mint a successor until all previous Host room tracks are evicted", async () => {
    const calls: string[] = [];
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async (url) => {
        calls.push(String(url).split("/").at(-1)!);
        if (String(url).endsWith("/ListParticipants")) {
          return new Response(JSON.stringify({
            participants: [{ identity: "user_host:talk-live_old" }],
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          code: "permission_denied", msg: "admin permission denied",
        }), { status: 403 });
      },
    });
    await expect(issuer.mint({
      talkId: "talk_1", sessionId: "talk-live_new",
      userId: "user_host", role: "host", canPublishAudio: true,
    })).rejects.toThrow("talks.live.media_admin_remove_failed");
    expect(calls).toEqual(["ListParticipants", "RemoveParticipant"]);
  });

  it("allows an empty protobuf JSON object for a room with no participants", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    await expect(issuer.mint({
      talkId: "talk_existing", sessionId: "talk-live_new",
      userId: "user_host", role: "host", canPublishAudio: false,
    })).resolves.toMatchObject({ room_name: "talk_existing" });
  });

  it("revokes superseded Hosts even when the replacement starts muted", async () => {
    const calls: string[] = [];
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response(
          String(url).endsWith("/ListParticipants")
            ? JSON.stringify({ participants: [{ identity: "user_host:talk-live_previous" }] })
            : "{}",
          { status: 200 },
        );
      },
    });
    const result = await issuer.mint({
      talkId: "talk_1", sessionId: "talk-live_new",
      userId: "user_host", role: "host", canPublishAudio: false,
    });
    expect(calls.map((url) => url.split("/").at(-1))).toEqual([
      "ListParticipants", "RemoveParticipant",
    ]);
    expect(decodePart(result.participant_token.split(".")[1]!).video)
      .toMatchObject({ canPublish: false });
  });

  it("accepts well-formed empty participant projections and tolerates removal races", async () => {
    const issuer = createLiveKitTalkMediaTokenIssuer({
      serverUrl: "wss://live.example.test", apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      fetchImpl: async (url) => {
        if (String(url).endsWith("/ListParticipants")) {
          return new Response(JSON.stringify({
            participants: [{ identity: "user_host:talk-live_old" }],
          }), { status: 200 });
        }
        return new Response(JSON.stringify({
          code: "not_found", msg: "participant not found",
        }), { status: 404 });
      },
    });
    await expect(issuer.mint({
      talkId: "talk_1", sessionId: "talk-live_new",
      userId: "user_host", role: "host", canPublishAudio: true,
    })).resolves.toMatchObject({ participant_identity: "user_host:talk-live_new" });
  });
});

