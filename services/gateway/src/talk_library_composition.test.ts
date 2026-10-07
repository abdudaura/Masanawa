import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerTalkReplayRoutes } from "./talk_replay_routes.js";
import { registerTalkLibraryRoutes } from "./talk_library_routes.js";
import type { TalkReplayService } from "./talk_replay/service.js";
import type { TalkLibraryService } from "./talk_library/service.js";

const servers: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function fixture(includeLibrary: boolean) {
  const server = Fastify();
  servers.push(server);
  const myReplays = vi.fn(async () => ({ live: [], replays: [] }));
  const myLibrary = vi.fn(async () => ({ live: [], replays: [], drafts: [] }));
  const playback = vi.fn(async () => ({
    url: "https://media.example/replay.ogg",
    expiresAt: "2026-10-07T10:05:00.000Z",
    contentType: "audio/ogg",
  }));
  const replay = { myTalks: myReplays, playback } as unknown as TalkReplayService;
  const library = { myTalks: myLibrary } as unknown as TalkLibraryService;
  registerTalkReplayRoutes(server, replay, { includeMyTalks: !includeLibrary });
  if (includeLibrary) registerTalkLibraryRoutes(server, library);
  return { server, myReplays, myLibrary, playback };
}

describe("Talk replay and library route composition", () => {
  it("starts with both modules and sends My Talks to the canonical library", async () => {
    const { server, myReplays, myLibrary } = fixture(true);
    await server.ready();
    const response = await server.inject({
      method: "GET", url: "/me/talks",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ live: [], replays: [], drafts: [] });
    expect(myLibrary).toHaveBeenCalledExactlyOnceWith({
      authorizationHeader: "Bearer viewer",
    });
    expect(myReplays).not.toHaveBeenCalled();
  });

  it("preserves replay playback when the library owns My Talks", async () => {
    const { server, playback } = fixture(true);
    const response = await server.inject({
      method: "GET", url: "/talks/talk_1/replay/playback",
      headers: { authorization: "Bearer host" },
    });
    expect(response.statusCode).toBe(200);
    expect(playback).toHaveBeenCalledExactlyOnceWith({
      authorizationHeader: "Bearer host", talkId: "talk_1",
    });
  });

  it("preserves the replay-only My Talks contract and bounded limit", async () => {
    const { server, myReplays } = fixture(false);
    const response = await server.inject({
      method: "GET", url: "/me/talks?limit=12",
      headers: { authorization: "Bearer host" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ live: [], replays: [] });
    expect(myReplays).toHaveBeenCalledExactlyOnceWith({
      authorizationHeader: "Bearer host", limit: 12,
    });
    const invalid = await server.inject({ method: "GET", url: "/me/talks?limit=101" });
    expect(invalid.statusCode).toBe(400);
  });

  it("keeps My Talks enabled for standalone callers using the original signature", async () => {
    const server = Fastify();
    servers.push(server);
    const myTalks = vi.fn(async () => ({ live: [], replays: [] }));
    registerTalkReplayRoutes(server, { myTalks } as unknown as TalkReplayService);
    expect((await server.inject({ method: "GET", url: "/me/talks" })).statusCode).toBe(200);
    expect(myTalks).toHaveBeenCalledExactlyOnceWith({
      authorizationHeader: undefined, limit: 60,
    });
  });
});
