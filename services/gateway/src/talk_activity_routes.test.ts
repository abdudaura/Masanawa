import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerTalkActivityRoutes } from "./talk_activity_routes.js";
import { createTalkActivityService } from "./talk_activity/service.js";
import type { TalkActivityRepository } from "./talk_activity/model.js";

function repository(): TalkActivityRepository {
  return {
    async markRead(input) {
      return input.tenantId === "tenant_1" &&
        input.userId === "user_1" && input.activityId === "activity_1";
    },
    async list(input) {
      return [
        {
          tenantId: input.tenantId,
          activityId: "activity_1",
          userId: input.userId,
          kind: input.filter === "money" ? "earning" : "talk_invitation",
          title: input.filter === "money" ? "You earned from a Talk" : "You were invited",
          detail: "Safe public detail",
          createdAt: "2026-10-07T09:00:00.000Z",
          talkId: input.filter === "money" ? null : "talk_1",
          profilePublicId: null,
          personaId: null,
          transactionId: input.filter === "money" ? "txn_1" : null,
          amountLabel: input.filter === "money" ? "₦250" : null,
          requiresAction: input.filter !== "money",
          actionLabel: input.filter !== "money" ? "View Talk" : null,
          unread: true,
        },
      ];
    },
    async append(input) {
      return {
        tenantId: input.tenantId,
        activityId: input.activityId,
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        createdAt: input.createdAt,
        talkId: input.talkId ?? null,
        profilePublicId: input.profilePublicId ?? null,
        personaId: input.personaId ?? null,
        transactionId: input.transactionId ?? null,
        amountLabel: input.amountLabel ?? null,
        requiresAction: input.requiresAction ?? false,
        actionLabel: input.actionLabel ?? null,
        unread: input.unread ?? true,
      };
    },
  };
}

function createApp() {
  const app = Fastify();
  const service = createTalkActivityService({
    repository: repository(),
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer customer") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant_1" as never,
          userId: "user_1" as never,
          profile: {
            tenantId: "tenant_1" as never,
            userId: "user_1" as never,
            name: "Customer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
  });
  registerTalkActivityRoutes(app, service);
  return app;
}

describe("Talk Activity API", () => {
  it("requires the authenticated customer session", async () => {
    const response = await createApp().inject({ method: "GET", url: "/activity" });
    expect(response.statusCode).toBe(401);
  });

  it("returns the exact mobile activity projection", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/activity?filter=talks&limit=30",
      headers: { authorization: "Bearer customer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: "activity_1",
        kind: "talk_invitation",
        title: "You were invited",
        detail: "Safe public detail",
        createdAt: "2026-10-07T09:00:00.000Z",
        talkId: "talk_1",
        requiresAction: true,
        actionLabel: "View Talk",
        unread: true,
      },
    ]);
  });

  it("rejects unauthenticated activity read mutations before storage", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/activity/activity_1/read",
    });
    expect(response.statusCode).toBe(401);
  });

  it("marks only the signed-in account's activity as read", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/activity/activity_1/read",
      headers: { authorization: "Bearer customer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: "activity_1", unread: false });
  });

  it("conceals another customer's or missing activity ID", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/activity/activity_foreign/read",
      headers: { authorization: "Bearer customer" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("user_1");
    expect(response.body).not.toContain("tenant_1");
  });

  it("keeps money labels display-only and does not expose ledger internals", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/activity?filter=money",
      headers: { authorization: "Bearer customer" },
    });
    expect(response.json()[0]).toMatchObject({
      kind: "earning",
      transactionId: "txn_1",
      amountLabel: "₦250",
    });
    expect(response.body).not.toContain("ledger");
  });
});
