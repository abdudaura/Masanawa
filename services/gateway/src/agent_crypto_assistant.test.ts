import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoChatAction, CryptoChatActionRepository } from "@masanawa/commerce";
import type { FinancialService } from "./financial_service.js";
import {
  createAgentCryptoAssistant,
  cryptoQuoteConfirmationCode,
} from "./agent_crypto_assistant.js";

const scope = {
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  characterId: createCanonicalId("character"),
  relationshipId: createCanonicalId("relationship"),
};

function fixture(kind: "convert" | "withdraw" = "convert") {
  const requestId = createCanonicalId("request");
  const now = Date.now();
  const action: CryptoChatAction = {
    tenantId: scope.tenantId,
    userId: scope.userId,
    characterId: scope.characterId,
    requestId,
    kind,
    providerCode: "USDTTRC20",
    targetProviderCode: kind === "convert" ? "BTC" : null,
    amount: "10",
    destinationAddress: kind === "withdraw" ? "TRecipient1234" : null,
    quoteSummary: kind === "convert"
      ? "10 USDTTRC20 → BTC"
      : "Withdraw 10 USDTTRC20 to TRecipient1234",
    state: "pending",
    createdAt: toInstant(new Date(now).toISOString()),
    expiresAt: toInstant(new Date(now + 5 * 60 * 1000).toISOString()),
    updatedAt: toInstant(new Date(now).toISOString()),
  };

  const createConversion = vi.fn(async (input: {
    requestId: string;
    providerCode: string;
    targetProviderCode: string;
    amount: string;
  }) => ({
    requestId: input.requestId,
    asset: input.providerCode,
    network: "tron",
    amount: input.amount,
    targetAsset: input.targetProviderCode,
    targetNetwork: null,
    targetAmount: "0.0001",
    status: "processing" as const,
    providerConversionId: "provider-conversion",
    outcomeUnknown: false,
  }));
  const createWithdrawal = vi.fn(async (input: {
    requestId: string;
    providerCode: string;
    amount: string;
    destinationAddress: string;
  }) => ({
    requestId: input.requestId,
    amount: input.amount,
    asset: input.providerCode,
    status: "processing" as const,
    destinationAddress: input.destinationAddress,
  }));
  const quoteConversion = vi.fn(async () => ({
    providerCode: "USDTTRC20",
    targetProviderCode: "BTC",
    amount: "10",
    estimatedTargetAmount: "0.0001",
    minimumAmount: "1",
  }));
  const quoteWithdrawal = vi.fn(async () => ({
    providerCode: "USDTTRC20",
    amount: "10",
    estimatedReceiveAmount: "9.5",
    networkFee: "0.5",
  }));
  const financial = {
    createConversion,
    createWithdrawal,
    quoteConversion,
    quoteWithdrawal,
  } as unknown as FinancialService;

  let current: CryptoChatAction | null = action;
  let claimed = false;
  const pending: CryptoChatActionRepository = {
    put: vi.fn(async (next: CryptoChatAction) => { current = next; claimed = false; }),
    readCurrent: vi.fn(async () => current),
    claim: vi.fn(async (_scope: Parameters<CryptoChatActionRepository["claim"]>[0],
      id: Parameters<CryptoChatActionRepository["claim"]>[1]) => {
      if (!current || current.requestId !== id || claimed) return null;
      claimed = true;
      return { ...current, state: "executing" as const };
    }),
    complete: vi.fn(async () => { current = null; }),
  };
  const assistant = createAgentCryptoAssistant({ financial, pending });
  const before = (text: string) => assistant.beforeInference({
    authorizationHeader: "Bearer account",
    characterId: scope.characterId,
    scope,
    text,
  });
  const after = (modelReply: string) => assistant.afterInference({
    authorizationHeader: "Bearer account",
    characterId: scope.characterId,
    scope,
    modelReply,
  });
  return {
    action, assistant, pending, createConversion, createWithdrawal,
    quoteConversion, quoteWithdrawal, before, after,
    setCurrent(next: CryptoChatAction | null) { current = next; },
  };
}

function actionTag(type: "crypto.confirm" | "crypto.cancel" | "crypto.convert.quote" | "crypto.withdraw.quote"): string {
  const payload = type === "crypto.convert.quote"
    ? { type, providerCode: "USDTTRC20", targetProviderCode: "BTC", amount: "10" }
    : type === "crypto.withdraw.quote"
      ? { type, providerCode: "USDTTRC20", amount: "10", destinationAddress: "TRecipient1234" }
      : { type };
  return "<masanawa_crypto_action>" + JSON.stringify(payload) + "</masanawa_crypto_action>";
}

describe("Agent crypto assistant exact consent", () => {
  it("requires authenticated user text containing the current quote reference, not a vague yes", async () => {
    const f = fixture();
    for (const text of ["yes", "confirm", "yes confirm", "proceed",
      "go ahead", "do it", "continue", "okay", "ok"]) {
      const response = await f.before(text);
      expect(response?.reply).toContain("Saying \"yes\" does not authorize");
    }
    expect(await f.before("Confirm crypto")).toBeNull();
    expect(await f.before("confirm crypto 123")).toBeNull();
    expect(f.createConversion).not.toHaveBeenCalled();
    expect(f.createWithdrawal).not.toHaveBeenCalled();
    const code = cryptoQuoteConfirmationCode(f.action.requestId);
    expect(code).toMatch(/^[0-9]{6}$/u);
    expect(await f.before("  CONFIRM   crypto   " + code + "  ")).toMatchObject({
      reply: expect.stringContaining("Conversion submitted"),
    });
    expect(f.createConversion).toHaveBeenCalledTimes(1);
    expect(f.createConversion.mock.calls[0]![0].requestId).toBe(f.action.requestId);
  });

  it("denies the wrong code without claiming or executing the current quote", async () => {
    const f = fixture("withdraw");
    const code = cryptoQuoteConfirmationCode(f.action.requestId);
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    const result = await f.before("confirm crypto " + wrong);
    expect(result?.reply).toContain("does not match");
    expect(result?.reply).toContain("No transaction was sent");
    expect(f.pending.claim).not.toHaveBeenCalled();
    expect(f.createWithdrawal).not.toHaveBeenCalled();
    expect(f.pending.complete).not.toHaveBeenCalled();
  });

  it("rejects a stale confirmation reference after a new quote replaces it", async () => {
    const f = fixture("withdraw");
    const previousCode = cryptoQuoteConfirmationCode(f.action.requestId);
    const nextId = createCanonicalId("request");
    const next = { ...f.action, requestId: nextId };
    f.setCurrent(next);
    const old = await f.before("confirm crypto " + previousCode);
    if (cryptoQuoteConfirmationCode(nextId) !== previousCode) {
      expect(old?.reply).toContain("does not match");
      expect(f.pending.claim).not.toHaveBeenCalled();
    }
    expect(f.createWithdrawal).not.toHaveBeenCalled();
  });

  it("model-originated confirm and cancel never execute or change a pending quote", async () => {
    const f = fixture("withdraw");
    for (const directive of [actionTag("crypto.confirm"), actionTag("crypto.cancel")]) {
      const reply = await f.after(directive);
      expect(reply?.reply).toContain("Pending withdrawal");
      expect(reply?.reply).toContain("Confirm crypto");
      expect(reply?.reply).toContain(cryptoQuoteConfirmationCode(f.action.requestId));
    }
    expect(f.createWithdrawal).not.toHaveBeenCalled();
    expect(f.pending.complete).not.toHaveBeenCalled();
    expect(f.pending.claim).not.toHaveBeenCalled();
  });

  it("only direct authenticated user cancellation can dismiss the current quote", async () => {
    const f = fixture();
    expect(await f.before("cancel")).toBeNull();
    expect(await f.before("stop")).toBeNull();
    expect(f.pending.complete).not.toHaveBeenCalled();
    expect((await f.before("Cancel crypto"))?.reply).toContain("Cancelled");
    expect(f.pending.complete).toHaveBeenCalledTimes(1);
    expect(f.createConversion).not.toHaveBeenCalled();
  });

  it("atomic request claiming blocks a second approval of the same quote", async () => {
    const f = fixture();
    const cmd = "confirm crypto " + cryptoQuoteConfirmationCode(f.action.requestId);
    const a = await f.before(cmd);
    expect(a?.reply).toContain("Conversion submitted");
    const b = await f.before(cmd);
    expect(b?.reply).toMatch(/(no pending|expired)/iu);
    expect(f.createConversion).toHaveBeenCalledTimes(1);
    expect(f.pending.claim).toHaveBeenCalledTimes(1);
  });

  it("quote model response includes an explicit user-spoken code and exact request id", async () => {
    const f = fixture();
    const reply = await f.after(actionTag("crypto.convert.quote"));
    expect(f.quoteConversion).toHaveBeenCalledTimes(1);
    const document = (reply?.parts[0] as { document: Record<string, unknown> }).document;
    expect(document.type).toBe("crypto.conversion.quote");
    expect(document.requestId).toBeDefined();
    expect(document.confirmationCode).toBe(cryptoQuoteConfirmationCode(
      document.requestId as CryptoChatAction["requestId"],
    ));
    expect(reply?.reply).toContain("Confirm crypto " + document.confirmationCode);
    expect(reply?.reply).not.toContain("Confirm?");
    const approved = await f.before("Confirm crypto " + document.confirmationCode);
    expect(approved?.reply).toContain("Conversion submitted");
    expect(f.createConversion).toHaveBeenCalledTimes(1);
    expect(f.createConversion.mock.calls[0]![0].requestId).toBe(document.requestId);
  });

  it("withdrawal quote displays destination and reference, with no automatic payout", async () => {
    const f = fixture("withdraw");
    const reply = await f.after(actionTag("crypto.withdraw.quote"));
    expect(f.quoteWithdrawal).toHaveBeenCalledTimes(1);
    expect(reply?.reply).toContain("TRecipient1234");
    const document = (reply?.parts[0] as { document: Record<string, unknown> }).document;
    expect(document.type).toBe("crypto.withdrawal.quote");
    expect(document.confirmationCode).toBe(cryptoQuoteConfirmationCode(
      document.requestId as CryptoChatAction["requestId"],
    ));
    expect(f.createWithdrawal).not.toHaveBeenCalled();
    const approved = await f.before("Confirm crypto " + document.confirmationCode);
    expect(approved?.reply).toContain("Withdrawal submitted");
    expect(f.createWithdrawal).toHaveBeenCalledTimes(1);
    expect(f.createWithdrawal.mock.calls[0]![0].requestId).toBe(document.requestId);
  });

  it("cannot approve an expired/absent or no-longer-claimable quote", async () => {
    const f = fixture();
    const code = cryptoQuoteConfirmationCode(f.action.requestId);
    f.setCurrent(null);
    const response = await f.before("confirm crypto " + code);
    expect(response?.reply).toContain("no pending");
    expect(f.createConversion).not.toHaveBeenCalled();
    const inferred = await f.after(actionTag("crypto.confirm"));
    expect(inferred?.reply).toContain("no pending");
  });
});

