import { normalizeCryptoAmount, normalizeCryptoAsset, type InternalTransferReceipt } from "@masanawa/commerce";
import { parseCanonicalId } from "@masanawa/contracts";
import type { InternalTransferRepository } from "@masanawa/postgres";
import type { CreditRecipientResolver } from "./credit_transfer.js";
import type { FinancialAuthorizer, FinancialService } from "./financial_service.js";

export interface InternalCryptoTransferService {
  available(input: { authorizationHeader?: string }): Promise<boolean>;
  quote(input: { authorizationHeader?: string; requestId: string;
    recipient: string; providerCode: string; amount: string }): Promise<InternalTransferReceipt>;
  confirm(input: { authorizationHeader?: string; requestId: string;
    confirmationToken: string }): Promise<InternalTransferReceipt>;
  read(input: { authorizationHeader?: string; requestId: string }): Promise<InternalTransferReceipt | null>;
}
export function createInternalCryptoTransferService(input: {
  authorizer: FinancialAuthorizer;
  recipients: CreditRecipientResolver;
  repository: InternalTransferRepository;
  financial: FinancialService;
  enabled: boolean;
}): InternalCryptoTransferService {
  async function qualify(authorizationHeader: string | undefined, providerCode: string) {
    if (!input.enabled) throw new Error("crypto.transfer.not_qualified");
    const capabilities = await input.financial.capabilities({ authorizationHeader });
    if (!capabilities.deposits) throw new Error("crypto.transfer.custody_unavailable");
    const routes = await input.financial.listDepositRoutes({ authorizationHeader });
    const route = routes.find(item => item.providerCode === providerCode);
    if (!route || route.network?.toLowerCase() === "erc20") {
      throw new Error("crypto.transfer.route_unavailable");
    }
    return { asset: normalizeCryptoAsset(route.asset), network: route.network };
  }
  return {
    async available(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      if (!input.enabled) return false;
      try {
        const capabilities = await input.financial.capabilities({authorizationHeader:request.authorizationHeader});
        if (!capabilities.deposits) return false;
        const routes = await input.financial.listDepositRoutes({authorizationHeader:request.authorizationHeader});
        return routes.some(route => route.network?.toLowerCase() !== "erc20");
      } catch { return false; }
    },
    async quote(request) {
      const authorizationHeader = request.authorizationHeader;
      const actor = await input.authorizer.authorize({ authorizationHeader });
      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = request.providerCode.trim().toUpperCase();
      const assetRoute = await qualify(authorizationHeader, providerCode);
      const recipient = await input.recipients.resolve({
        tenantId: actor.tenantId, senderUserId: actor.userId,
        recipient: request.recipient,
      });
      return input.repository.quote({
        tenantId: actor.tenantId,
        senderUserId: actor.userId,
        recipientUserId: recipient.recipientUserId,
        recipientLabel: request.recipient.trim(),
        requestId, asset: assetRoute.asset, network: assetRoute.network,
        amount: normalizeCryptoAmount(request.amount),
      });
    },
    async read(request) {
      const actor = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      return input.repository.read({
        tenantId: actor.tenantId, senderUserId: actor.userId,
        requestId: parseCanonicalId("request", request.requestId),
      });
    },
    async confirm(request) {
      const actor = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const requestId = parseCanonicalId("request", request.requestId);
      const quote = await input.repository.read({
        tenantId: actor.tenantId, senderUserId: actor.userId, requestId,
      });
      if (!quote) throw new Error("crypto.transfer.quote_not_found");
      if (quote.status === "completed") return quote;
      if (quote.status !== "quoted") throw new Error("crypto.transfer.quote_unavailable");
      // Requalify against live provider/market evidence before committing funds.
      const routes = await input.financial.listDepositRoutes({
        authorizationHeader: request.authorizationHeader,
      });
      const capabilities = await input.financial.capabilities({
        authorizationHeader: request.authorizationHeader,
      });
      if (!input.enabled || !capabilities.deposits ||
          !routes.some(route => route.asset === quote.asset && route.network === quote.network &&
            route.network?.toLowerCase() !== "erc20")) {
        throw new Error("crypto.transfer.route_unavailable");
      }
      return input.repository.confirm({
        tenantId: actor.tenantId, senderUserId: actor.userId,
        requestId, confirmationToken: request.confirmationToken,
      });
    },
  };
}
