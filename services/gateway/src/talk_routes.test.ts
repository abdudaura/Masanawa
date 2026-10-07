import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkRoutes } from "./talk_routes.js";
import { createTalkService } from "./talks/service.js";
import type {
  TalkCommentRecord,
  TalkRecord,
  TalkRepository,
} from "./talks/model.js";

function fixtureRepository(): TalkRepository {
  const talks = new Map<string, TalkRecord>();
  const comments = new Map<string, TalkCommentRecord[]>();
  return {
    async createTalk(input) {
      const record: TalkRecord = Object.freeze({
        tenantId: input.tenantId,
        talkId: input.talkId,
        hostUserId: input.hostUserId,
        hostName: input.hostName,
        title: input.title,
        topic: input.topic,
        summary: "",
        state: "live",
        listenerCount: 0,
        durationSeconds: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      talks.set(record.talkId, record);
      return record;
    },
    async listTalks(input) {
      return [...talks.values()]
        .filter((talk) => talk.tenantId === input.tenantId)
        .filter((talk) => input.feed === "explore" || talk.state === "live")
        .map((talk) => ({
          talk,
          commentCount: comments.get(talk.talkId)?.length ?? 0,
          reactionCount: 0,
          followedHost: false,
        }));
    },
    async getTalk(input) {
      const talk = talks.get(input.talkId);
      return talk && talk.tenantId === input.tenantId
        ? { talk, commentCount: comments.get(talk.talkId)?.length ?? 0 }
        : null;
    },
    async listComments(input) {
      return comments.get(input.talkId) ?? [];
    },
    async addComment(input) {
      const talk = talks.get(input.talkId);
      if (!talk || talk.tenantId !== input.tenantId) return null;
      const record: TalkCommentRecord = Object.freeze({ ...input });
      comments.set(input.talkId, [...(comments.get(input.talkId) ?? []), record]);
      return record;
    },
  };
}

function app() {
  const server = Fastify();
  let sequence = 0;
  const service = createTalkService({
    repository: fixtureRepository(),
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer human") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant_test" as never,
          userId: "user_human" as never,
          profile: {
            tenantId: "tenant_test" as never,
            userId: "user_human" as never,
            name: "Human Host",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    now: () => "2026-10-07T09:30:00.000Z",
    createId: (kind) => `${kind === "talk" ? "talk" : "talk-comment"}_test_${++sequence}`,
  });
  registerTalkRoutes(server, service);
  return server;
}

describe("Talk HTTP API", () => {
  it("requires a human authenticated session to create a live Talk", async () => {
    const server = app();
    const denied = await server.inject({
      method: "POST",
      url: "/talks",
      payload: { topic: "Economy" },
    });
    expect(denied.statusCode).toBe(401);

    const created = await server.inject({
      method: "POST",
      url: "/talks",
      headers: { authorization: "Bearer human" },
      payload: { topic: " Nigerian economy ", title: "Economy Today" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      title: "Economy Today",
      topic: "Nigerian economy",
      hostName: "Human Host",
      isLive: true,
      listenerCount: 0,
      commentCount: 0,
      participants: [
        { id: "user_human", name: "Human Host", kind: "human", isHost: true },
      ],
    });
  });

  it("serves the mobile feed/detail contract and persists public comments", async () => {
    const server = app();
    const created = await server.inject({
      method: "POST",
      url: "/talks",
      headers: { authorization: "Bearer human" },
      payload: { topic: "Football" },
    });
    const talkId = created.json().id as string;

    const comment = await server.inject({
      method: "POST",
      url: `/talks/${talkId}/comments`,
      headers: { authorization: "Bearer human" },
      payload: { body: "Great point." },
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({
      authorName: "Human Host",
      body: "Great point.",
      likeCount: 0,
    });

    const feed = await server.inject({
      method: "GET",
      url: "/talks?feed=live",
      headers: { authorization: "Bearer human" },
    });
    expect(feed.statusCode).toBe(200);
    expect(feed.json()).toHaveLength(1);
    expect(feed.json()[0]).toMatchObject({ id: talkId, commentCount: 1, isLive: true });

    const detail = await server.inject({
      method: "GET",
      url: `/talks/${talkId}`,
      headers: { authorization: "Bearer human" },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      talk: { id: talkId, commentCount: 1 },
      comments: [{ body: "Great point." }],
    });
  });

  it("returns not found for an unknown Talk", async () => {
    const server = app();
    const missing = await server.inject({
      method: "GET",
      url: "/talks/talk_missing",
      headers: { authorization: "Bearer human" },
    });
    expect(missing.statusCode).toBe(404);
  });
});
