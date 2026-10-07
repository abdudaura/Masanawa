import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoChatAction, CryptoChatActionRepository } from "@masanawa/commerce";
import type { FinancialService } from "./financial_service.js";
import { createAgentCryptoAssistant } from "./agent_crypto_assistant.js";

describe("Agent crypto assistant", () => {
  it("confirms the persisted quote with the exact same canonical request id", async () => {
    const scope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const requestId = createCanonicalId("request");
    const action: CryptoChatAction = {
      tenantId: scope.tenantId,
      userId: scope.userId,
      characterId: scope.characterId,
      requestId,
      kind: "convert",
      providerCode: "USDTTRC20",
      targetProviderCode: "BTC",
      amount: "10",
      destinationAddress: null,
      quoteSummary: "10 USDTTRC20 → BTC",
      state: "pending",
      createdAt: toInstant("2026-10-07T12:00:00.000Z"),
      expiresAt: toInstant("2026-10-07T12:05:00.000Z"),
      updatedAt: toInstant("2026-10-07T12:00:00.000Z"),
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
    const financial = {
      createConversion,
    } as unknown as FinancialService;
    const pending: CryptoChatActionRepository = {
      async put() {},
      async readCurrent() { return action; },
      async claim() { return { ...action, state: "executing" }; },
      async complete() {},
    };

    const assistant = createAgentCryptoAssistant({ financial, pending });
    const result = await assistant.beforeInference({
      authorizationHeader: "Bearer user",
      characterId: scope.characterId,
      scope,
      text: "confirm",
    });

    expect(result?.reply).toContain("Conversion submitted");
    expect(createConversion).toHaveBeenCalledTimes(1);
    expect(createConversion.mock.calls[0]![0].requestId).toBe(requestId);
  });
});
