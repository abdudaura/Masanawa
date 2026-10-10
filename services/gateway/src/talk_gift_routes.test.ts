import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import type {
  TalkGiftActivitySink,
  TalkGiftCatalogSource,
  TalkGiftExecutor,
  TalkGiftRepository,
} from "./talk_gifts/model.js";
import { createTalkGiftService } from "./talk_gifts/service.js";
import { registerTalkGiftRoutes } from "./talk_gift_routes.js";

function app(input: Readonly<{
  viewerUserId?: string;
  replayed?: boolean;
  fail?: Error;
  activityFail?: boolean;
  catalogSource?: TalkGiftCatalogSource;
}> = {}) {
  const activity: Parameters<TalkGiftActivitySink["append"]>[0][] = [];
  const executions: Parameters<TalkGiftExecutor["execute"]>[0][] = [];

  const repository: TalkGiftRepository = {
    async resolveTarget({ tenantId, talkId }) {
      expect(tenantId).toBe("tenant_1");
      if (talkId === "talk_missing") return null;
      return Object.freeze({
        talkId,
        talkTitle: "Can AI create more jobs?",
        hostUserId: "host_1",
        hostName: "Amina",
      });
    },
  };

  const executor: TalkGiftExecutor = {
    async execute(request) {
      executions.push(request);
      if (input.fail) throw input.fail;
      return Object.freeze({
        giftId: "ledger_1",
        amountCredits: request.amountCredits,
        status: "completed" as const,
        completedAt: "2026-10-07T10:00:00.000Z",
        replayed: input.replayed ?? false,
      });
    },
  };

  const server = Fastify();
  registerTalkGiftRoutes(
    server,
    createTalkGiftService({
      repository,
      authorizer: {
        async authorize({ authorizationHeader }) {
          if (authorizationHeader !== "Bearer viewer") {
            throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
          }
          return {
            tenantId: "tenant_1" as never,
            userId: (input.viewerUserId ?? "listener_1") as never,
            profile: {
              tenantId: "tenant_1" as never,
              userId: (input.viewerUserId ?? "listener_1") as never,
              name: "Listener",
              email: null,
              phone: null,
              locale: "en",
              createdAt: "2026-10-07T00:00:00.000Z",
            },
          };
        },
      },
      executor,
      ...(input.catalogSource === undefined ? {} : { catalogSource: input.catalogSource }),
      activity: {
        async append(event) {
          if (input.activityFail) throw new Error('activity unavailable');
          activity.push(event);
        },
      },
    }),
  );

  return { server, activity, executions };
}

describe("Talk Host gift route", () => {
  it("resolves the real Host server-side and sends exact Credits", async () => {
    const { server, activity, executions } = app();

    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-1",
        amountCredits: 100,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      giftId: "ledger_1",
      talkId: "talk_12345678",
      recipientUserId: "host_1",
      recipientName: "Amina",
      amountCredits: 100,
      status: "completed",
      completedAt: "2026-10-07T10:00:00.000Z",
    });
    expect(executions).toEqual([
      {
        tenantId: "tenant_1",
        requestId: "gift-request-1",
        senderUserId: "listener_1",
        recipientUserId: "host_1",
        amountCredits: 100,
      },
    ]);
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      recipientUserId: "host_1",
      senderUserId: "listener_1",
      talkId: "talk_12345678",
      amountCredits: 100,
    });
  });

  it("rejects client-supplied recipient authority", async () => {
    const { server, executions } = app();
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-1",
        amountCredits: 100,
        recipientUserId: "attacker_selected",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(executions).toHaveLength(0);
  });

  it("forbids gifting your own Talk", async () => {
    const { server, executions } = app({ viewerUserId: "host_1" });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-self",
        amountCredits: 50,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(executions).toHaveLength(0);
  });

  it("does not append duplicate Activity on an idempotent replay", async () => {
    const { server, activity } = app({ replayed: true });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-replay",
        amountCredits: 500,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(activity).toHaveLength(0);
  });

  it("does not turn a completed ledger gift into failure if Activity is down", async () => {
    const { server, executions } = app({ activityFail: true });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-activity-down",
        amountCredits: 100,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(executions).toHaveLength(1);
    expect(response.json()).toMatchObject({
      giftId: "ledger_1",
      amountCredits: 100,
      status: "completed",
    });
  });

  it("returns a friendly conflict for insufficient Credits", async () => {
    const { server } = app({ fail: new Error("Insufficient customer-credit balance") });
    const response = await server.inject({
      method: "POST",
      url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "gift-request-low-balance",
        amountCredits: 1000,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "talks.gift.insufficient_credits",
    });
  });

  it("serves only server-priced options to signed-in eligible viewers", async () => {
    const { server } = app();
    const unauthenticated = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
    });
    expect(unauthenticated.statusCode).toBe(401);

    const response = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      talkId: "talk_12345678",
      currency: "Credits",
      items: [
        { id: "applause", name: "Applause", visual: "applause", amountCredits: 50, available: true },
        { id: "heart", name: "Heart", visual: "heart", amountCredits: 100, available: true },
        { id: "flower", name: "Flower", visual: "flower", amountCredits: 150, available: true },
        { id: "spark", name: "Spark", visual: "spark", amountCredits: 250, available: true },
        { id: "crown", name: "Crown", visual: "crown", amountCredits: 500, available: true },
        { id: "celebration", name: "Celebration", visual: "celebration", amountCredits: 1000, available: true },
      ],
    });
    const own = app({ viewerUserId: "host_1" });
    expect((await own.server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    })).statusCode).toBe(409);
    expect((await server.inject({
      method: "GET", url: "/talks/talk_missing/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    })).statusCode).toBe(404);
  });

  it("binds item identity to exact authoritative Credits before any transfer", async () => {
    const { server, executions } = app();
    async function send(catalogItemId: string, amountCredits: number) {
      return server.inject({
        method: "POST", url: "/talks/talk_12345678/gifts",
        headers: { authorization: "Bearer viewer" },
        payload: { requestId: "item-test-1", catalogItemId, amountCredits },
      });
    }
    const wrongPrice = await send("heart", 50);
    expect(wrongPrice.statusCode).toBe(409);
    expect(wrongPrice.json()).toMatchObject({ message: "talks.gift.price_changed" });
    expect((await send("unknown", 100)).statusCode).toBe(409);
    expect(executions).toHaveLength(0);

    const paid = await send("heart", 100);
    expect(paid.statusCode).toBe(200);
    expect(paid.json()).toMatchObject({
      giftId: "ledger_1", catalogItemId: "heart",
      amountCredits: 100, status: "completed",
    });
    expect(executions).toHaveLength(1);
    expect(executions[0]?.amountCredits).toBe(100);
  });

  it("rejects recipient and catalog client-authority injection", async () => {
    const { server, executions } = app();
    const injected = await server.inject({
      method: "POST", url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: {
        requestId: "item-test-2", catalogItemId: "heart",
        amountCredits: 100, currency: "USD", recipientUserId: "attacker",
      },
    });
    expect(injected.statusCode).toBe(400);
    expect(executions).toHaveLength(0);
  });

  it("rejects arbitrary legacy amounts without a matching server catalog price", async () => {
    const { server, executions } = app();
    const response = await server.inject({
      method: "POST", url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: { requestId: "legacy-arbitrary", amountCredits: 123 },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: "talks.gift.option_unavailable" });
    expect(executions).toHaveLength(0);
  });

  it("reprices a stale catalog choice before any ledger execution", async () => {
    let currentPrice = 100;
    const { server, executions } = app({
      catalogSource: {
        async load({ tenantId, talkId }) {
          expect(tenantId).toBe("tenant_1");
          expect(talkId).toBe("talk_12345678");
          return [{ id: "heart", name: "Heart", visual: "heart" as const,
            amountCredits: currentPrice, available: true }];
        },
      },
    });
    const catalog = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().items[0].amountCredits).toBe(100);

    currentPrice = 125;
    const stale = await server.inject({
      method: "POST", url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: { requestId: "repriced-1", catalogItemId: "heart", amountCredits: 100 },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().message).toBe("talks.gift.price_changed");
    expect(executions).toHaveLength(0);

    const refreshed = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    });
    expect(refreshed.json().items[0].amountCredits).toBe(125);
  });

  it("a catalog source outage never falls back to six artificial options", async () => {
    const { server, executions } = app({
      catalogSource: {
        async load() { throw new Error("authoritative gift policy unavailable"); },
      },
    });
    const catalog = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    });
    expect(catalog.statusCode).toBe(500);
    const post = await server.inject({
      method: "POST", url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: { requestId: "outage-1", catalogItemId: "heart", amountCredits: 100 },
    });
    expect(post.statusCode).toBe(500);
    expect(executions).toHaveLength(0);
  });

  it("an empty qualified catalog blocks gifts without inventing availability", async () => {
    const { server, executions } = app({
      catalogSource: { async load() { return []; } },
    });
    const response = await server.inject({
      method: "GET", url: "/talks/talk_12345678/gifts/catalog",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([]);
    const gift = await server.inject({
      method: "POST", url: "/talks/talk_12345678/gifts",
      headers: { authorization: "Bearer viewer" },
      payload: { requestId: "none-1", catalogItemId: "heart", amountCredits: 100 },
    });
    expect(gift.statusCode).toBe(409);
    expect(executions).toHaveLength(0);
  });

});
