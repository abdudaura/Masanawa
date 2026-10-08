import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createCanonicalId } from "@masanawa/contracts";
import { registerTalkAiSeatRoutes } from "./talk_ai_seat_routes.js";
import { createTalkAiSeatService } from "./talk_ai_seats/service.js";
import type { TalkAiSeatRepository } from "./talk_ai_seats/model.js";

const tenantId = createCanonicalId("tenant");
const viewerId = createCanonicalId("user");
const hostId = createCanonicalId("user");

function repository(confirmationStatus: "admitted" | "pending_host" = "pending_host", twinOwnerUserId: string = createCanonicalId("user")): TalkAiSeatRepository {
  return {
    async listCandidates() {
      return [
        {
          personaId: "expert_gwani",
          displayName: "Gwani",
          kind: "expert",
          subtitle: "Masanawa Expert",
          avatarUrl: null,
          topics: ["Business"],
          isAvailable: true,
          twinOwnerUserId: null,
        },
        {
          personaId: "twin_amira",
          displayName: "Amira Twin",
          kind: "twin",
          subtitle: "Creator Twin",
          avatarUrl: null,
          topics: ["Culture"],
          isAvailable: true,
          twinOwnerUserId,
        },
      ];
    },
    async createQuote(input) {
      const quoteId = createCanonicalId("quote");
      const priceCredits = input.personaId === "expert_gwani" ? 100 : 120;
      return {
        requestId: createCanonicalId("request"),
        displayName:
          input.personaId === "expert_gwani" ? "Gwani" : "Amira Twin",
        quote: {
          schemaVersion: 1,
          tenantId: input.tenantId as never,
          quoteId,
          talkId: input.talkId,
          personaId: input.personaId,
          personaKind:
            input.personaId === "expert_gwani" ? "expert" : "twin",
          mode: input.mode,
          payerUserId: input.payerUserId as never,
          hostUserId:
            input.mode === "host_add"
              ? (input.payerUserId as never)
              : hostId,
          twinOwnerUserId:
            input.personaId === "expert_gwani"
              ? null
              : createCanonicalId("user"),
          priceCredits,
          hostShareCredits: 20,
          twinOwnerShareCredits:
            input.personaId === "expert_gwani" ? 0 : 60,
          platformShareCredits:
            input.personaId === "expert_gwani" ? 80 : 40,
          state: "quoted",
          revision: 1,
          createdAt: "2026-10-07T10:00:00.000Z" as never,
          updatedAt: "2026-10-07T10:00:00.000Z" as never,
          expiresAt: "2026-10-07T10:02:00.000Z" as never,
          admittedAt: null,
          declinedAt: null,
          expiredAt: null,
        },
      };
    },
    async confirm() {
      return {
        requestId: createCanonicalId("request"),
        status: confirmationStatus,
        displayName: "Gwani",
      };
    },
    async hostDecision() {
      return { handled: false };
    },
    async sweepExpired() {
      return 0;
    },
    async readRuntimeSeat({ tenantId, talkId, requestId }) {
      return {
        tenantId,
        talkId,
        seatId: `seat_${requestId}`,
        personaId: "expert_gwani",
        kind: "expert",
      };
    },
  };
}

function app(authenticated = true, confirmationStatus: "admitted" | "pending_host" = "pending_host", twinOwnerUserId?: string) {
  const server = Fastify();
  const service = createTalkAiSeatService({
    repository: repository(confirmationStatus, twinOwnerUserId),
    pricing: {
      expertPriceCredits: 100,
      twinPriceCredits: 120,
      hostShareBasisPoints: 2000,
      twinOwnerShareBasisPoints: 5000,
      quoteTtlSeconds: 120,
    },
    now: () => "2026-10-07T10:00:00.000Z",
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (!authenticated || authorizationHeader !== "Bearer viewer") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId,
          userId: viewerId,
          profile: {
            tenantId,
            userId: viewerId,
            name: "Viewer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
  });
  registerTalkAiSeatRoutes(server, service);
  return server;
}

describe("Talk AI Seat API", () => {
  it("returns the mobile candidate projection with server fee labels", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/talks/talk_1/ai-seats",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        personaId: "expert_gwani",
        kind: "expert",
        seatFeeLabel: "100 Credits",
        isAvailable: true,
        isOwnedByViewer: false,
      }),
      expect.objectContaining({
        personaId: "twin_amira",
        kind: "twin",
        seatFeeLabel: "120 Credits",
        isOwnedByViewer: false,
      }),
    ]);
  });

  it("marks only a Twin owned by the authenticated viewer as mine", async () => {
    const response = await app(true, "pending_host", viewerId).inject({
      method: "GET",
      url: "/talks/talk_1/ai-seats",
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json() as Array<{ kind: string; isOwnedByViewer: boolean }>;
    expect(rows.find((row) => row.kind === "expert")?.isOwnedByViewer).toBe(false);
    expect(rows.find((row) => row.kind === "twin")?.isOwnedByViewer).toBe(true);
  });

  it("creates a sponsored quote that explicitly requires Host approval", async () => {
    const response = await app().inject({
      method: "POST",
      url: "/talks/talk_1/ai-seat-quotes",
      headers: { authorization: "Bearer viewer" },
      payload: { personaId: "expert_gwani", mode: "sponsor" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      personaId: "expert_gwani",
      kind: "expert",
      mode: "sponsor",
      totalLabel: "100 Credits",
      requiresHostApproval: true,
    });
  });

  it("creates a Host-added quote without a second Host approval step", async () => {
    const response = await app().inject({
      method: "POST",
      url: "/talks/talk_1/ai-seat-quotes",
      headers: { authorization: "Bearer viewer" },
      payload: { personaId: "expert_gwani", mode: "host_add" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      mode: "host_add",
      requiresHostApproval: false,
    });
  });

  it("returns the canonical confirmation status and friendly message", async () => {
    const quoteId = createCanonicalId("quote");
    const response = await app().inject({
      method: "POST",
      url: `/talks/talk_1/ai-seat-quotes/${quoteId}/confirm`,
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "pending_host",
    });
    expect(response.json().message).toContain("Host");
  });

  it("returns an admitted confirmation without inventing a second Host approval", async () => {
    const response = await app(true, "admitted").inject({
      method: "POST",
      url: `/talks/talk_1/ai-seat-quotes/${createCanonicalId("quote")}/confirm`,
      headers: { authorization: "Bearer viewer" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "admitted" });
    expect(response.json().message).not.toContain("waiting for");
  });

  it("requires the customer session on all AI Seat routes", async () => {
    const response = await app(false).inject({
      method: "GET",
      url: "/talks/talk_1/ai-seats",
    });
    expect(response.statusCode).toBe(401);
  });
});

