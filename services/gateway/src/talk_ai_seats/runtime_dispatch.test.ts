import { describe, expect, it, vi } from "vitest";
import { createTalkAiSeatService } from "./service.js";
import type { TalkAiSeatRepository } from "./model.js";

function setup(status: "admitted" | "pending_host" = "admitted") {
  const requestId = "request_runtime_1";
  const repository: TalkAiSeatRepository = {
    async listCandidates() { return []; },
    async createQuote() { throw new Error("unused"); },
    async confirm() {
      return { requestId, status, displayName: "Gwani" };
    },
    async hostDecision() {
      return { handled: true, status: "admitted" };
    },
    async sweepExpired() { return 0; },
    async readRuntimeSeat({ tenantId, talkId }) {
      return {
        tenantId,
        talkId,
        seatId: "seat_" + requestId,
        personaId: "expert_gwani",
        kind: "expert",
      };
    },
  };
  const dispatch = vi.fn(async () => undefined);
  const service = createTalkAiSeatService({
    repository,
    runtimeDispatcher: { dispatch },
    pricing: {
      expertPriceCredits: 100,
      twinPriceCredits: 120,
      hostShareBasisPoints: 2000,
      twinOwnerShareBasisPoints: 5000,
      quoteTtlSeconds: 120,
    },
    authorizer: {
      async authorize() {
        return {
          tenantId: "tenant-1",
          userId: "user-1",
          profile: { name: "Viewer" },
        } as never;
      },
    },
  });
  return { service, dispatch };
}

describe("Talk AI Seat runtime dispatch integration", () => {
  it("dispatches a Host-added Seat immediately after admission", async () => {
    const { service, dispatch } = setup("admitted");
    await service.confirm({
      authorizationHeader: "Bearer user",
      talkId: "talk-1",
      quoteId: "quote-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat_request_runtime_1",
      personaId: "expert_gwani",
      kind: "expert",
    });
  });

  it("does not dispatch while a sponsored Seat is still pending Host approval", async () => {
    const { service, dispatch } = setup("pending_host");
    await service.confirm({
      authorizationHeader: "Bearer user",
      talkId: "talk-1",
      quoteId: "quote-1",
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches after the Host accepts a sponsored AI Seat", async () => {
    const { service, dispatch } = setup("pending_host");
    await service.decide({
      authorizationHeader: "Bearer host",
      talkId: "talk-1",
      requestId: "request_runtime_1",
      action: "accept",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("reports a dispatch outage as retryable after canonical admission", async () => {
    const { service, dispatch } = setup("admitted");
    dispatch.mockRejectedValueOnce(new Error("LiveKit unavailable"));
    await expect(service.confirm({
      authorizationHeader: "Bearer user",
      talkId: "talk-1",
      quoteId: "quote-1",
    })).rejects.toMatchObject({
      code: "talks.ai_runtime_unavailable",
      statusCode: 503,
    });
  });
});
