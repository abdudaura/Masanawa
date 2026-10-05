import { describe, expect, it } from "vitest";
import {
  createOwnerAccessService,
  type OwnerAccessAuthorizer,
  type OwnerAccessQuotePort,
  type OwnerAccessRequestPort,
} from "./owner_access.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const requesterUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

function build() {
  const authorizer: OwnerAccessAuthorizer = {
    async authorize(input) {
      expect(input.characterId).toBe(characterId);
      return { tenantId, userId: requesterUserId };
    },
  };
  const quotes: OwnerAccessQuotePort = {
    async quote(input) {
      return {
        requestId: "owner-request-123",
        ownerUserId: "user-owner",
        originatingCharacterId: input.characterId,
        modality: input.modality,
        durationMinutes: input.durationMinutes,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialDurationDays: 7,
        policyRevision: 1,
        trialPolicyRevision: 1,
        quoteExpiresAt: "2026-10-05T11:00:00Z",
      };
    },
  };
  const requests: OwnerAccessRequestPort = {
    async createFromQuote(input) {
      return {
        requestId: input.quoteId,
        requesterUserId,
        ownerUserId: "user-owner",
        originatingCharacterId: input.characterId,
        modality: "voice",
        durationMinutes: 20,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialPolicyRevision: 1,
        state: "requested",
        requestedAt: "2026-10-05T10:00:00Z",
        acceptBy: "2026-10-05T11:00:00Z",
        scheduledFor: null,
        startedAt: null,
        completedAt: null,
      };
    },
    async act(input) {
      return {
        requestId: input.requestId,
        requesterUserId,
        ownerUserId: input.actorUserId,
        originatingCharacterId: input.characterId,
        modality: "voice",
        durationMinutes: 20,
        priceCredits: 1000,
        platformFeeCredits: 100,
        ownerEarningCredits: 900,
        chargeMode: "paid",
        trialPolicyRevision: 1,
        state: input.action === "accept" ? "accepted" : "cancelled",
        requestedAt: "2026-10-05T10:00:00Z",
        acceptBy: "2026-10-05T11:00:00Z",
        scheduledFor: input.scheduledFor ?? null,
        startedAt: null,
        completedAt: null,
      };
    },
    async get() {
      return null;
    },
    async latestForRequester(input) {
      return {
        requestId: "owner-request-latest",
        requesterUserId: input.requesterUserId,
        ownerUserId: "user-owner",
        originatingCharacterId: input.characterId,
        modality: "voice",
        durationMinutes: 20,
        priceCredits: 0,
        platformFeeCredits: 0,
        ownerEarningCredits: 0,
        chargeMode: "trial",
        trialPolicyRevision: 1,
        state: "requested",
        requestedAt: "2026-10-05T10:00:00Z",
        acceptBy: "2026-10-05T11:00:00Z",
        scheduledFor: null,
        startedAt: null,
        completedAt: null,
      };
    },
  };
  return createOwnerAccessService({ authorizer, quotes, requests });
}

describe("owner access service", () => {
  it("returns a trial-aware quote", async () => {
    const quote = await build().quote({
      authorizationHeader: "Bearer user",
      characterId,
      modality: "voice",
      durationMinutes: 20,
    });
    expect(quote.chargeMode).toBe("trial");
    expect(quote.trialDurationDays).toBe(7);
    expect(quote.priceCredits).toBe(0);
  });

  it("reads the latest request only through the authenticated requester scope", async () => {
    const latest = await build().latest({
      authorizationHeader: "Bearer user",
      characterId,
    });
    expect(latest).toEqual(
      expect.objectContaining({
        requestId: "owner-request-latest",
        requesterUserId,
        originatingCharacterId: characterId,
      }),
    );
  });

  it("creates a request from an opaque server quote id only", async () => {
    const created = await build().request({
      authorizationHeader: "Bearer user",
      characterId,
      quoteId: "owner-request-123",
    });
    expect(created.requestId).toBe("owner-request-123");
    expect(created.originatingCharacterId).toBe(characterId);
  });
});
