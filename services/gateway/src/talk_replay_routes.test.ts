import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerTalkReplayRoutes } from "./talk_replay_routes.js";
import type { TalkReplayService } from "./talk_replay/service.js";

function app() {
  const server = Fastify();
  const setPublished = vi.fn(async ({ talkId, published }) => ({
    talkId,
    status: published ? "published" as const : "private" as const,
    published,
    ...(published
      ? {
          playbackUrl: "https://signed.example/replay",
          playbackExpiresAt: "2026-10-07T10:05:00.000Z",
        }
      : {}),
  }));
  const service: TalkReplayService = {
    async requestForHost() {},
    async ensureStarted() {},
    async stopForTalk() {},
    async reconcile() { return null; },
    async view({ talkId }) {
      return {
        talkId,
        status: "published",
        published: true,
        durationSeconds: 91,
        playbackUrl: "https://signed.example/replay",
        playbackExpiresAt: "2026-10-07T10:05:00.000Z",
      };
    },
    setPublished,
  };
  registerTalkReplayRoutes(server, service);
  return { server, setPublished };
}

describe("Talk replay HTTP API", () => {
  it("returns only short-lived playback authorization from the replay service", async () => {
    const { server } = app();
    const response = await server.inject({
      method: "GET",
      url: "/talks/talk_123/replay",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      talkId: "talk_123",
      status: "published",
      published: true,
      durationSeconds: 91,
      playbackUrl: "https://signed.example/replay",
    });
  });

  it("lets the Host change replay publication without exposing storage internals", async () => {
    const { server, setPublished } = app();
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_123/replay/publication",
      headers: { authorization: "Bearer host" },
      payload: { published: false },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "private",
      published: false,
    });
    expect(setPublished).toHaveBeenCalledWith({
      authorizationHeader: "Bearer host",
      talkId: "talk_123",
      published: false,
    });
  });
});
