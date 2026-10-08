import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { FinancialAuthorizer, FinancialService } from "./financial_service.js";
import type { InternalCryptoTransferStore, InternalTransferQuote, InternalTransferReceipt } from "@masanawa/postgres";
import { createInternalCryptoTransferService, InternalCryptoTransferError, type TransferRiskPolicy } from "./internal_crypto_transfer.js";
import { createGatewayApp } from "./app.js";

const tenantId = createCanonicalId("tenant");
const senderUserId = createCanonicalId("user");
const recipientUserId = createCanonicalId("user");
const quoteId = createCanonicalId("request");
const quoteRequestId = createCanonicalId("request");
const requestId = createCanonicalId("request");

function fixture(options: { policy?: boolean; custody?: boolean; admitted?: boolean } = {}) {
  const quote: InternalTransferQuote = {
    quoteId, quoteRequestId, senderUserId, recipientUserId,
    asset: "USDTTRC20", network: "tron", amount: "5", fee: "0",
    policyRevision: "verified-revision-1",
    createdAt: "2026-10-08T00:00:00.000Z", expiresAt: "2026-10-08T00:02:00.000Z",
  };
  const receipt: InternalTransferReceipt = {
    transferId: createCanonicalId("request"), quoteId, requestId,
    senderUserId, recipientUserId, asset: "USDTTRC20", network: "tron",
    amount: "5", fee: "0", completedAt: "2026-10-08T00:00:30.000Z",
    status: "completed", kind: "internal-book-transfer",
  };
  let posted = false;
  const authorizer: FinancialAuthorizer = {
    async authorize({ authorizationHeader }) {
      if (authorizationHeader !== "Bearer good") throw new Error("financial.auth.unauthorized");
      return { tenantId, userId: senderUserId };
    },
  };
  const financial = {
    listWithdrawalRoutes: vi.fn(async () =>
      options.custody === false ? [] :
        [{ providerCode: "USDTTRC20", asset: "USDT", network: "tron" }]),
  } as unknown as FinancialService;
  const policy: TransferRiskPolicy = {
    assess: vi.fn(async () => ({
      allowed: options.admitted !== false, revision: "verified-revision-1", fee: "0",
    })),
  };
  const store: InternalCryptoTransferStore = {
    quote: vi.fn(async () => quote),
    readQuote: vi.fn(async () => quote),
    readByRequest: vi.fn(async () => posted ? receipt : null),
    execute: vi.fn(async () => { posted = true; return receipt; }),
    read: vi.fn(async () => receipt),
    history: vi.fn(async () => [receipt]),
  };
  return { quote, receipt, store, policy, authorizer, financial,
    service: createInternalCryptoTransferService({
      authorizer, financial, store,
      ...(options.policy === false ? {} : { policy }),
    }),
  };
}

describe("C06 internal crypto transfer security", () => {
  it("does not expose live send capability without configured KYC/AML limits policy", async () => {
    const { service } = fixture({ policy: false });
    expect(await service.capabilities({ authorizationHeader: "Bearer good" })).toEqual({
      enabled: false, reason: "kyc_aml_limits_policy_not_configured", routes: [],
    });
    await expect(service.quote({
      authorizationHeader: "Bearer good", quoteRequestId,
      recipientUserId, providerCode: "USDTTRC20", amount: "5",
    })).rejects.toMatchObject({ code: "crypto.internal.policy_unavailable", statusCode: 503 });
  });

  it("denies anonymous, self, unqualified custody route and policy-rejected requests", async () => {
    const { service } = fixture();
    await expect(service.quote({
      authorizationHeader: undefined, quoteRequestId,
      recipientUserId, providerCode: "USDTTRC20", amount: "5",
    })).rejects.toThrow("financial.auth.unauthorized");
    await expect(service.quote({
      authorizationHeader: "Bearer good", quoteRequestId,
      recipientUserId: senderUserId, providerCode: "USDTTRC20", amount: "5",
    })).rejects.toBeInstanceOf(InternalCryptoTransferError);
    const unqualified = fixture({ custody: false }).service;
    await expect(unqualified.quote({
      authorizationHeader: "Bearer good", quoteRequestId,
      recipientUserId, providerCode: "USDTTRC20", amount: "5",
    })).rejects.toMatchObject({ code: "crypto.internal.custody_unqualified" });
    const rejected = fixture({ admitted: false }).service;
    await expect(rejected.quote({
      authorizationHeader: "Bearer good", quoteRequestId,
      recipientUserId, providerCode: "USDTTRC20", amount: "5",
    })).rejects.toMatchObject({ code: "crypto.internal.policy_denied" });
  });

  it("requires affirmative approval and returns exact receipt for idempotent retry", async () => {
    const { service, receipt, store } = fixture();
    const first = await service.quote({
      authorizationHeader: "Bearer good", quoteRequestId, recipientUserId,
      providerCode: "USDTTRC20", amount: "5",
    });
    expect(first.quoteId).toBe(quoteId);
    await expect(service.transfer({
      authorizationHeader: "Bearer good", quoteId, requestId, confirmed: false,
    })).rejects.toMatchObject({ code: "crypto.internal.fresh_approval_required" });
    expect(await service.transfer({
      authorizationHeader: "Bearer good", quoteId, requestId, confirmed: true,
    })).toEqual(receipt);
    expect(await service.transfer({
      authorizationHeader: "Bearer good", quoteId, requestId, confirmed: true,
    })).toEqual(receipt);
    expect(store.execute).toHaveBeenCalledTimes(1);
    await expect(service.transfer({
      authorizationHeader: "Bearer good", quoteId: createCanonicalId("request"),
      requestId, confirmed: true,
    })).rejects.toMatchObject({ code: "crypto.internal.replay_conflict" });
  });

  it("does not leak another user's receipts over the HTTP layer", async () => {
    const fx = fixture();
    const app = createGatewayApp({ internalCryptoTransfers: fx.service });
    try {
      const response = await app.inject({
        method: "GET", url: "/v1/financial/crypto/internal/history",
        headers: { authorization: "Bearer bad" },
      });
      expect(response.statusCode).toBe(401);
      const capability = await app.inject({
        method: "GET", url: "/v1/financial/crypto/internal/capabilities",
        headers: { authorization: "Bearer good" },
      });
      expect(capability.statusCode).toBe(200);
      const bad = await app.inject({
        method: "POST", url: "/v1/financial/crypto/internal/transfers",
        headers: { authorization: "Bearer good" },
        payload: { requestId, quoteId, confirmed: false },
      });
      expect(bad.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
