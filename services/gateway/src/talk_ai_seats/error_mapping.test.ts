import { describe, expect, it } from "vitest";
import { createTalkAiSeatService, TalkAiSeatError } from "./service.js";
import type { TalkAiSeatRepository } from "./model.js";

type FailingOperation = "candidates" | "quote" | "confirm" | "decide" | "sweep";

function failingService(operation: FailingOperation, error: unknown) {
  const fail = (name: FailingOperation) => {
    if (operation === name) throw error;
  };
  const repository: TalkAiSeatRepository = {
    async listCandidates() { fail("candidates"); return []; },
    async createQuote() {
      fail("quote");
      throw new Error("Unexpected successful quote fixture");
    },
    async confirm() {
      fail("confirm");
      throw new Error("Unexpected successful confirm fixture");
    },
    async hostDecision() {
      fail("decide");
      return { handled: false };
    },
    async sweepExpired() { fail("sweep"); return 0; },
    async readRuntimeSeat() { return null; },
  };
  return createTalkAiSeatService({
    repository,
    authorizer: {
      async authorize() {
        return { tenantId: "tenant-A", userId: "user-A" } as never;
      },
    },
    pricing: {
      expertPriceCredits: 100,
      twinPriceCredits: 120,
      hostShareBasisPoints: 2000,
      twinOwnerShareBasisPoints: 5000,
      quoteTtlSeconds: 120,
    },
    now: () => "2026-10-09T04:00:00.000Z",
  });
}

function perform(operation: FailingOperation, error: unknown): Promise<unknown> {
  const service = failingService(operation, error);
  const common = { authorizationHeader: "Bearer customer", talkId: "talk-1" };
  switch (operation) {
    case "candidates": return service.candidates(common);
    case "quote": return service.quote({ ...common, personaId: "expert-1", mode: "host_add" });
    case "confirm": return service.confirm({ ...common, quoteId: "quote-1" });
    case "decide": return service.decide({ ...common, requestId: "request-1", action: "accept" });
    case "sweep": return service.sweep(common);
  }
}

describe("F04 AI Seat public error boundaries", () => {
  it("does not leak PostgreSQL SQLSTATE, connection details or secrets from candidates", async () => {
    const error = Object.assign(new Error("password=not-for-client SQL SELECT private_table"), {
      code: "23505",
      detail: "SQL and driver internals",
    });
    await expect(perform("candidates", error)).rejects.toMatchObject({
      name: "TalkAiSeatError",
      code: "talks.ai_seat_failed",
      statusCode: 503,
      message: "talks.ai_seat_failed",
    });
  });

  it("does not turn a substring of an unknown provider message into a customer error", async () => {
    const error = new Error("internal capacity exhausted; api_key=secret-should-not-leak");
    await expect(perform("quote", error)).rejects.toMatchObject({
      code: "talks.ai_seat_failed", statusCode: 503,
    });
  });

  it("preserves explicit known business codes without exposing attached provider messages", async () => {
    const error = Object.assign(new Error("Sensitive provider response"), {
      code: "commerce.insufficient_balance",
    });
    await expect(perform("confirm", error)).rejects.toMatchObject({
      code: "commerce.insufficient_balance",
      statusCode: 409,
      message: "commerce.insufficient_balance",
    });
  });

  it("preserves not-live and not-found semantics from existing repository messages", async () => {
    await expect(perform("candidates", new Error("talks.not_live"))).rejects.toMatchObject({
      code: "talks.not_live", statusCode: 409,
    });
    await expect(perform("quote", new Error("talks.persona_not_found"))).rejects.toMatchObject({
      code: "talks.persona_not_found", statusCode: 404,
    });
  });

  it("converts revision-conflict text to stable public codes", async () => {
    await expect(perform("confirm", new Error("AI Seat quote revision conflict"))).rejects.toMatchObject({
      code: "talks.ai_seat_quote_revision_conflict", statusCode: 409,
    });
    await expect(perform("decide", new Error("Talk live revision conflict"))).rejects.toMatchObject({
      code: "talks.live_revision_conflict", statusCode: 409,
    });
  });

  it("does not infer a public error from a guessed namespace or an expired substring", async () => {
    await expect(perform("quote", Object.assign(new Error("wrong"), {
      code: "talks.credential_expired_please_send_password",
    }))).rejects.toMatchObject({
      code: "talks.ai_seat_failed", statusCode: 503,
    });
  });

  it("fails closed for unknown non-Error rejections on sweep", async () => {
    await expect(perform("sweep", { detail: "token=private" })).rejects.toMatchObject({
      code: "talks.ai_seat_failed", statusCode: 503,
    });
  });

  it("keeps authenticated Host denial and missing-commerce guard distinct", async () => {
    await expect(perform("decide", new Error("talks.host_forbidden"))).rejects.toMatchObject({
      code: "talks.host_forbidden", statusCode: 403,
    });
    await expect(perform("decide", new Error("talks.ai_commerce_required"))).rejects.toMatchObject({
      code: "talks.ai_commerce_required", statusCode: 503,
    });
  });

  it("retains service-owned canonical TalkAiSeatError without remapping", async () => {
    const trusted = new TalkAiSeatError("talks.ai_runtime_unavailable", 503);
    await expect(perform("confirm", trusted)).rejects.toBe(trusted);
  });
});
