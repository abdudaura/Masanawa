import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type {
  TalkPollRepository,
  TalkPollView,
} from "./talk_polls/model.js";
import { createTalkPollService } from "./talk_polls/service.js";
import { registerTalkPollRoutes } from "./talk_poll_routes.js";

function poll(myOptionId?: string): TalkPollView {
  return Object.freeze({
    pollId: "poll_1",
    question: "Which topic next?",
    status: "open" as const,
    options: Object.freeze([
      Object.freeze({ optionId: "option_1", label: "Jobs", voteCount: 2 }),
      Object.freeze({ optionId: "option_2", label: "Education", voteCount: 1 }),
    ]),
    totalVotes: 3,
    ...(myOptionId ? { myOptionId } : {}),
    createdAt: "2026-10-07T11:30:00.000Z",
  });
}

function app() {
  const calls: Array<{ type: string; input: unknown }> = [];
  const repository: TalkPollRepository = {
    async current(input) {
      calls.push({ type: "current", input });
      return poll();
    },
    async create(input) {
      calls.push({ type: "create", input });
      return poll();
    },
    async vote(input) {
      calls.push({ type: "vote", input });
      return poll(input.optionId);
    },
    async close(input) {
      calls.push({ type: "close", input });
      return Object.freeze({ ...poll(), status: "closed" as const, closedAt: input.now });
    },
  };

  const server = Fastify();
  registerTalkPollRoutes(
    server,
    createTalkPollService({
      repository,
      now: () => "2026-10-07T11:31:00.000Z",
      authorizer: {
        async authorize({ authorizationHeader }) {
          if (authorizationHeader !== "Bearer listener" &&
              authorizationHeader !== "Bearer host") {
            throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
          }
          const userId = authorizationHeader === "Bearer host"
            ? "host_1"
            : "listener_1";
          return {
            tenantId: "tenant_1" as never,
            userId: userId as never,
            profile: {
              tenantId: "tenant_1" as never,
              userId: userId as never,
              name: userId === "host_1" ? "Host" : "Listener",
              email: null,
              phone: null,
              locale: "en",
              createdAt: "2026-10-07T00:00:00.000Z",
            },
          };
        },
      },
    }),
  );
  return { server, calls };
}

describe("Talk poll routes", () => {
  it("loads aggregate-only current poll state for an authenticated viewer", async () => {
    const { server, calls } = app();
    const response = await server.inject({
      method: "GET",
      url: "/talks/talk_1/poll",
      headers: { authorization: "Bearer listener" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      pollId: "poll_1",
      totalVotes: 3,
      options: [
        { optionId: "option_1", label: "Jobs", voteCount: 2 },
        { optionId: "option_2", label: "Education", voteCount: 1 },
      ],
    });
    expect(response.json()).not.toHaveProperty("voters");
    expect(calls[0]).toMatchObject({
      type: "current",
      input: { tenantId: "tenant_1", userId: "listener_1", talkId: "talk_1" },
    });
  });

  it("lets the Host create a bounded poll and normalizes labels", async () => {
    const { server, calls } = app();
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/polls",
      headers: { authorization: "Bearer host" },
      payload: {
        question: "  Which   topic next? ",
        options: [" Jobs ", " Education "],
      },
    });

    expect(response.statusCode).toBe(201);
    const create = calls.find((entry) => entry.type === "create");
    expect(create).toBeDefined();
    expect(create!.input).toMatchObject({
      tenantId: "tenant_1",
      hostUserId: "host_1",
      talkId: "talk_1",
      question: "Which topic next?",
    });
    const input = create!.input as { options: Array<{ optionId: string; label: string }> };
    expect(input.options.map((item) => item.label)).toEqual(["Jobs", "Education"]);
    expect(new Set(input.options.map((item) => item.optionId)).size).toBe(2);
  });

  it("records one viewer choice and returns refreshed aggregates", async () => {
    const { server, calls } = app();
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/polls/poll_1/vote",
      headers: { authorization: "Bearer listener" },
      payload: { optionId: "option_2" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ myOptionId: "option_2" });
    expect(calls.find((entry) => entry.type === "vote")).toMatchObject({
      input: {
        tenantId: "tenant_1",
        userId: "listener_1",
        talkId: "talk_1",
        pollId: "poll_1",
        optionId: "option_2",
      },
    });
  });

  it("lets the Host close the active poll", async () => {
    const { server, calls } = app();
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_1/polls/poll_1/close",
      headers: { authorization: "Bearer host" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "closed" });
    expect(calls.find((entry) => entry.type === "close")).toBeDefined();
  });

  it("rejects duplicate or oversized option sets before repository writes", async () => {
    const { server, calls } = app();
    const duplicate = await server.inject({
      method: "POST",
      url: "/talks/talk_1/polls",
      headers: { authorization: "Bearer host" },
      payload: {
        question: "Choose",
        options: ["Same", " same "],
      },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(calls.find((entry) => entry.type === "create")).toBeUndefined();

    const tooMany = await server.inject({
      method: "POST",
      url: "/talks/talk_1/polls",
      headers: { authorization: "Bearer host" },
      payload: {
        question: "Choose",
        options: ["A", "B", "C", "D", "E"],
      },
    });
    expect(tooMany.statusCode).toBe(400);
  });
});
