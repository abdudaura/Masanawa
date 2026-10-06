import { describe, expect, it, vi } from "vitest";
import {
  createAgentCryptoAssistant,
} from "./agent_crypto_assistant.js";
import type { FinancialService } from "./financial_service.js";

function service(overrides: Partial<FinancialService>): FinancialService {
  return overrides as FinancialService;
}

function withdrawalQuote(networkFee = "1") {
  return Object.freeze({
    providerCode: "USDTTRC20",
    amount: "10",
    destinationAddress: "TExample",
    minimumAmount: "2",
    networkFee,
    networkFeeMode: "sender" as const,
    feePayer: "user" as const,
    estimatedReceiveAmount: networkFee === "1" ? "9" : "8",
    addressValidated: true as const,
    quotedAt: "2026-10-06T18:00:00.000Z" as never,
  });
}

function quoteHistory(document = withdrawalQuote()) {
  return Object.freeze([
    Object.freeze({
      direction: "assistant" as const,
      parts: Object.freeze([
        Object.freeze({
          kind: "work",
          title: "Crypto",
          body: "Verified quote",
          document,
        }),
      ]),
    }),
  ]);
}

describe("Agent crypto assistant", () => {
  it("executes route discovery without exposing the machine directive", async () => {
    const listDepositRoutes = vi.fn(async () => Object.freeze([
      Object.freeze({
        providerCode: "USDTTRC20",
        asset: "USDT",
        network: "TRC20",
      }),
    ]));
    const assistant = createAgentCryptoAssistant({
      financial: service({ listDepositRoutes }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        'I can check that. <masanawa_crypto>{"type":"crypto.routes"}</masanawa_crypto>',
    });

    expect(listDepositRoutes).toHaveBeenCalledOnce();
    expect(result?.reply).toContain("USDT");
    expect(result?.reply).not.toContain("masanawa_crypto");
  });

  it("quotes a withdrawal without dispatching it", async () => {
    const quoteWithdrawal = vi.fn(async () => withdrawalQuote());
    const createWithdrawal = vi.fn();
    const assistant = createAgentCryptoAssistant({
      financial: service({ quoteWithdrawal, createWithdrawal }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        '<masanawa_crypto>{"type":"crypto.withdraw.quote","providerCode":"USDTTRC20","amount":"10","destinationAddress":"TExample"}</masanawa_crypto>',
    });

    expect(quoteWithdrawal).toHaveBeenCalledOnce();
    expect(createWithdrawal).not.toHaveBeenCalled();
    expect(result?.reply).toContain("Confirm this withdrawal?");
  });

  it("rejects a direct confirm without a prior server quote", async () => {
    const quoteWithdrawal = vi.fn();
    const createWithdrawal = vi.fn();
    const assistant = createAgentCryptoAssistant({
      financial: service({ quoteWithdrawal, createWithdrawal }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        '<masanawa_crypto>{"type":"crypto.withdraw.confirm","providerCode":"USDTTRC20","amount":"10","destinationAddress":"TExample"}</masanawa_crypto>',
      history: constHistory([]),
    });

    expect(quoteWithdrawal).not.toHaveBeenCalled();
    expect(createWithdrawal).not.toHaveBeenCalled();
    expect(result?.reply).toContain("verified withdrawal quote");
  });

  it("dispatches only after a matching quote is revalidated unchanged", async () => {
    const quoteWithdrawal = vi.fn(async () => withdrawalQuote());
    const createWithdrawal = vi.fn(async () => Object.freeze({
      requestId: "request_00000000-0000-4000-8000-000000000001" as never,
      asset: "USDT",
      network: "TRC20",
      amount: "10",
      destinationAddress: "TExample",
      status: "processing" as const,
      providerPayoutId: "payout-1",
      verificationRequired: false,
      outcomeUnknown: false,
    }));
    const assistant = createAgentCryptoAssistant({
      financial: service({ quoteWithdrawal, createWithdrawal }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        '<masanawa_crypto>{"type":"crypto.withdraw.confirm","providerCode":"USDTTRC20","amount":"10","destinationAddress":"TExample"}</masanawa_crypto>',
      history: quoteHistory(),
    });

    expect(quoteWithdrawal).toHaveBeenCalledOnce();
    expect(createWithdrawal).toHaveBeenCalledOnce();
    expect(result?.reply).toContain("processing");
  });

  it("requires a fresh confirmation when the live quote changed", async () => {
    const quoteWithdrawal = vi.fn(async () => withdrawalQuote("2"));
    const createWithdrawal = vi.fn();
    const assistant = createAgentCryptoAssistant({
      financial: service({ quoteWithdrawal, createWithdrawal }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        '<masanawa_crypto>{"type":"crypto.withdraw.confirm","providerCode":"USDTTRC20","amount":"10","destinationAddress":"TExample"}</masanawa_crypto>',
      history: quoteHistory(withdrawalQuote("1")),
    });

    expect(quoteWithdrawal).toHaveBeenCalledOnce();
    expect(createWithdrawal).not.toHaveBeenCalled();
    expect(result?.reply).toContain("quote changed");
    expect(result?.reply).toContain("Confirm the new quote");
  });

  it("does nothing when the model emits no valid crypto action", async () => {
    const assistant = createAgentCryptoAssistant({
      financial: service({}),
    });
    await expect(assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply: "Which network would you like to use?",
    })).resolves.toBeNull();
  });
});

function constHistory<T>(value: readonly T[]): readonly T[] {
  return value;
}
