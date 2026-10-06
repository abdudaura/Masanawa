import { describe, expect, it, vi } from "vitest";
import {
  createAgentCryptoAssistant,
} from "./agent_crypto_assistant.js";
import type { FinancialService } from "./financial_service.js";

function service(overrides: Partial<FinancialService>): FinancialService {
  return overrides as FinancialService;
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
    const quoteWithdrawal = vi.fn(async () => Object.freeze({
      providerCode: "USDTTRC20",
      amount: "10",
      destinationAddress: "TExample",
      minimumAmount: "2",
      networkFee: "1",
      networkFeeMode: "sender" as const,
      feePayer: "user" as const,
      estimatedReceiveAmount: "9",
      addressValidated: true as const,
      quotedAt: "2026-10-06T18:00:00.000Z" as never,
    }));
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

  it("dispatches a withdrawal only from the explicit confirm directive", async () => {
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
      financial: service({ createWithdrawal }),
    });

    const result = await assistant.afterInference({
      authorizationHeader: "Bearer customer",
      characterId: "character_gwani",
      modelReply:
        '<masanawa_crypto>{"type":"crypto.withdraw.confirm","providerCode":"USDTTRC20","amount":"10","destinationAddress":"TExample"}</masanawa_crypto>',
    });

    expect(createWithdrawal).toHaveBeenCalledOnce();
    expect(result?.reply).toContain("processing");
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
