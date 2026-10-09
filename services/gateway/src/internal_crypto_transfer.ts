import { parseCanonicalId } from "@masanawa/contracts";
import { normalizeCryptoAmount, normalizeCryptoAsset, normalizeCryptoNetwork } from "@masanawa/commerce";
import type { FinancialAuthorizer, FinancialService } from "./financial_service.js";
import type {
  InternalCryptoTransferStore, InternalTransferQuote, InternalTransferReceipt,
} from "@masanawa/postgres";

export class InternalCryptoTransferError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "InternalCryptoTransferError";
  }
}
export interface TransferRiskPolicy {
  // A configured real KYC/AML/limits + user/account status authority; no permissive default.
  assess(input: {
    tenantId: string; senderUserId: string; recipientUserId: string;
    asset: string; network: string | null; amount: string;
    operation: "internal-crypto-transfer";
  }): Promise<{ allowed: boolean; revision: string; fee: string }>;
}
export interface InternalCryptoTransferService {
  capabilities(input: { authorizationHeader: string | undefined }): Promise<{
    enabled: boolean; reason: string | null; routes: readonly {
      providerCode: string; asset: string; network: string | null;
    }[];
  }>;
  quote(input: {
    authorizationHeader: string | undefined; quoteRequestId: string;
    recipientUserId: string; providerCode: string; amount: string;
  }): Promise<InternalTransferQuote>;
  transfer(input: {
    authorizationHeader: string | undefined; quoteId: string; requestId: string;
    confirmed: boolean;
  }): Promise<InternalTransferReceipt>;
  readByRequest(input: {
    authorizationHeader: string | undefined; requestId: string;
  }): Promise<InternalTransferReceipt | null>;
  read(input: {
    authorizationHeader: string | undefined; transferId: string;
  }): Promise<InternalTransferReceipt | null>;
  history(input: {
    authorizationHeader: string | undefined; limit: number;
  }): Promise<readonly InternalTransferReceipt[]>;
}
function deny(code: string, statusCode = 403): never {
  throw new InternalCryptoTransferError(code, statusCode);
}
function requestId(value: string): string {
  try { return parseCanonicalId("request", value); }
  catch { return deny("crypto.internal.request_invalid", 400); }
}
function userId(value: string): string {
  try { return parseCanonicalId("user", value); }
  catch { return deny("crypto.internal.recipient_invalid", 400); }
}
export function createInternalCryptoTransferService(input: {
  authorizer: FinancialAuthorizer;
  financial: FinancialService;
  store: InternalCryptoTransferStore;
  policy?: TransferRiskPolicy;
}): InternalCryptoTransferService {
  async function admission(authHeader: string | undefined, recipient: string,
    code: string, amount: string) {
    const authority = await input.authorizer.authorize({ authorizationHeader: authHeader });
    const recipientUserId = userId(recipient);
    if (String(authority.userId) === recipientUserId)
      deny("crypto.internal.self_transfer", 400);
    const providerCode = normalizeCryptoAsset(code);
    const normalizedAmount = normalizeCryptoAmount(amount);
    // Qualified withdrawal routes require fresh provider account/custody evidence and
    // no uncovered platform crypto liability. Unavailable evidence always denies.
    const routes = await input.financial.listWithdrawalRoutes({ authorizationHeader: authHeader });
    const route = routes.find(r => r.providerCode === providerCode);
    if (!route) deny("crypto.internal.custody_unqualified", 503);
    const network = normalizeCryptoNetwork(route.network);
    if (!input.policy) deny("crypto.internal.policy_unavailable", 503);
    const result = await input.policy.assess({
      tenantId: authority.tenantId, senderUserId: authority.userId,
      recipientUserId, asset: providerCode, network, amount: normalizedAmount,
      operation: "internal-crypto-transfer",
    });
    // C06 v1 has no platform-fee posting leg. Never silently drop a configured
    // policy fee: zero-fee book transfers are the only safely balanced shape.
    if (result.allowed && result.fee !== "0")
      deny("crypto.internal.fee_policy_unsupported", 503);
    if (!result.allowed || typeof result.revision !== "string" ||
        result.revision.trim().length === 0 || result.revision.length > 128)
      deny("crypto.internal.policy_denied", 403);
    return { authority, recipientUserId, providerCode, network,
      normalizedAmount, revision: result.revision.trim() };
  }
  async function requalify(authHeader: string | undefined, quote: InternalTransferQuote) {
    const a = await admission(authHeader, quote.recipientUserId, quote.asset, quote.amount);
    if (a.network !== quote.network || a.revision !== quote.policyRevision)
      deny("crypto.internal.quote_stale", 409);
    return a;
  }
  return Object.freeze<InternalCryptoTransferService>({
    async capabilities(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      if (!input.policy) return { enabled: false,
        reason: "kyc_aml_limits_policy_not_configured", routes: [] };
      try {
        const eligible = await input.financial.listWithdrawalRoutes({
          authorizationHeader: request.authorizationHeader,
        });
        return { enabled: eligible.length > 0,
          reason: eligible.length === 0 ? "custody_route_not_qualified" : null,
          routes: eligible.map(route => ({
            providerCode: route.providerCode, asset: route.asset, network: route.network,
          })),
        };
      } catch {
        return { enabled: false, reason: "custody_evidence_unavailable", routes: [] };
      }
    },
    async quote(request) {
      const q = requestId(request.quoteRequestId);
      let terms;
      try {
        terms = await admission(request.authorizationHeader,
          request.recipientUserId, request.providerCode, request.amount);
      } catch (error) {
        if (error instanceof InternalCryptoTransferError) throw error;
        throw error;
      }
      return input.store.quote({
        tenantId: terms.authority.tenantId,
        senderUserId: terms.authority.userId, recipientUserId: terms.recipientUserId,
        quoteRequestId: q, asset: terms.providerCode, network: terms.network,
        amount: terms.normalizedAmount, policyRevision: terms.revision,
      });
    },
    async transfer(request) {
      if (request.confirmed !== true) deny("crypto.internal.fresh_approval_required", 403);
      const id = requestId(request.requestId);
      const quoteId = requestId(request.quoteId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      // A client can repeat an ambiguous request without a second debit, even
      // after quote expiry or loss of provider eligibility following commitment.
      const prior = await input.store.readByRequest({
        tenantId: authority.tenantId, senderUserId: authority.userId, requestId: id,
      });
      if (prior) {
        if (prior.quoteId !== quoteId) deny("crypto.internal.replay_conflict", 409);
        return prior;
      }
      // The quote cannot be read by its ID until the authenticated sender matches.
      const quote = await input.store.readQuote({
        tenantId: authority.tenantId, senderUserId: authority.userId, quoteId,
      });
      if (!quote) deny("crypto.internal.quote_not_found", 404);
      const qualified = await requalify(request.authorizationHeader, quote);
      if (String(qualified.authority.userId) !== String(authority.userId))
        deny("crypto.internal.authorization_changed", 401);
      return input.store.execute({
        tenantId: authority.tenantId, senderUserId: authority.userId,
        requestId: id, quoteId, policyRevision: qualified.revision,
      });
    },
    async readByRequest(request) {
      const auth = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      return input.store.readByRequest({
        tenantId: auth.tenantId, senderUserId: auth.userId,
        requestId: requestId(request.requestId),
      });
    },
    async read(request) {
      const auth = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      return input.store.read({
        tenantId: auth.tenantId, userId: auth.userId,
        transferId: requestId(request.transferId),
      });
    },
    async history(request) {
      const auth = await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      return input.store.history({
        tenantId: auth.tenantId, userId: auth.userId, limit: request.limit,
      });
    },
  });
}
