import { describe, expect, it, vi } from "vitest";
import { createLiveKitTalkReplayEgress } from "./livekit_egress.js";

describe("LiveKit Talk replay Egress", () => {
  it("uses unified StartEgress with mixed audio-only TemplateSource", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        room_name: "talk_live_1",
        template: { audio_only: true },
        outputs: [{ file: { file_type: "MP4", filepath: "talk-replays/x.mp4" } }],
      });
      expect(body).not.toHaveProperty("layout");
      const auth = new Headers(init?.headers).get("authorization");
      expect(auth).toMatch(/^Bearer /u);
      return new Response(
        JSON.stringify({
          egress_id: "EG_1",
          status: "EGRESS_STARTING",
          started_at: "1791367200000000000",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const egress = createLiveKitTalkReplayEgress({
      serverUrl: "wss://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      bucket: "replays",
      region: "ams3",
      accessKey: "storage-key",
      secret: "storage-secret",
      endpoint: "https://ams3.digitaloceanspaces.com",
      forcePathStyle: false,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => new Date("2026-10-07T10:00:00.000Z"),
    });

    const info = await egress.start({
      talkId: "talk_live_1",
      objectKey: "talk-replays/x.mp4",
    });

    expect(info.egressId).toBe("EG_1");
    expect(info.status).toBe("starting");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://live.example.test/twirp/livekit.Egress/StartEgress",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps terminal Egress states without exposing provider details", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              egress_id: "EG_2",
              status: "EGRESS_COMPLETE",
              started_at: "1791367200000000000",
              ended_at: "1791367260000000000",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const egress = createLiveKitTalkReplayEgress({
      serverUrl: "https://live.example.test",
      apiKey: "api-key",
      apiSecret: "0123456789abcdef0123456789abcdef",
      bucket: "replays",
      region: "ams3",
      accessKey: "storage-key",
      secret: "storage-secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(egress.inspect({ egressId: "EG_2" })).resolves.toMatchObject({
      egressId: "EG_2",
      status: "complete",
    });
  });
});
