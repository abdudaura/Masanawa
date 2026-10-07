import {
  createCanonicalId,
  type CharacterSessionScope,
} from "@masanawa/agents";
import type {
  CryptoChatAction,
  CryptoChatActionRepository,
} from "@masanawa/commerce";
import type { FinancialService } from "./financial_service.js";

export type AgentCryptoResult = Readonly<{
  reply: string;
  parts: readonly unknown[];
}>;

export interface AgentCryptoAssistant {
  readonly systemInstructions: readonly string[];
  beforeInference(input: Readonly<{
    authorizationHeader: string | undefined;
    characterId: string;
    scope: CharacterSessionScope;
    text: string;
  }>): Promise<AgentCryptoResult | null>;
  afterInference(input: Readonly<{
    authorizationHeader: string | undefined;
    characterId: string;
    scope: CharacterSessionScope;
    modelReply: string;
  }>): Promise<AgentCryptoResult | null>;
}

type Directive =
  | { type: "crypto.capabilities" }
  | { type: "crypto.routes"; operation: "deposit" | "convert" | "withdraw" }
  | { type: "crypto.balance"; providerCode: string }
  | { type: "crypto.history" }
  | { type: "crypto.deposit"; providerCode: string; amount: string }
  | { type: "crypto.buy"; fiatAmount: string; fiatCurrency: string }
  | {
      type: "crypto.convert.quote";
      providerCode: string;
      targetProviderCode: string;
      amount: string;
    }
  | {
      type: "crypto.withdraw.quote";
      providerCode: string;
      amount: string;
      destinationAddress: string;
    }
  | { type: "crypto.confirm" }
  | { type: "crypto.cancel" };

const TAG =
  /<masanawa_crypto_action>([\s\S]{1,5000}?)<\/masanawa_crypto_action>/u;

export const CRYPTO_AGENT_SYSTEM_INSTRUCTIONS = Object.freeze([
  "Masanawa has server-controlled NOWPayments crypto custody. Never claim a crypto operation happened unless the runtime returns evidence.",
  "Never invent supported tokens or networks. Ethereum-mainnet ERC-20 routes are excluded by platform policy; use only live routes returned by the runtime.",
  "When the user asks which tokens/networks are supported append: <masanawa_crypto_action>{\"type\":\"crypto.routes\",\"operation\":\"deposit|convert|withdraw\"}</masanawa_crypto_action>.",
  "For a token balance append: <masanawa_crypto_action>{\"type\":\"crypto.balance\",\"providerCode\":\"exact provider code\"}</masanawa_crypto_action>.",
  "For recent crypto activity append: <masanawa_crypto_action>{\"type\":\"crypto.history\"}</masanawa_crypto_action>.",
  "For receiving/depositing crypto, ask only for token/network and amount if missing, then append: <masanawa_crypto_action>{\"type\":\"crypto.deposit\",\"providerCode\":\"exact provider code\",\"amount\":\"decimal amount\"}</masanawa_crypto_action>.",
  "For buying crypto with fiat, ask only for fiat amount/currency if missing, then append: <masanawa_crypto_action>{\"type\":\"crypto.buy\",\"fiatAmount\":\"decimal\",\"fiatCurrency\":\"NGN\"}</masanawa_crypto_action>.",
  "For conversion, ask only for source route, target route and amount. Then append a quote directive: <masanawa_crypto_action>{\"type\":\"crypto.convert.quote\",\"providerCode\":\"source\",\"targetProviderCode\":\"target\",\"amount\":\"decimal\"}</masanawa_crypto_action>. The runtime will ask for confirmation.",
  "For withdrawal, ask only for route, amount and destination address. Then append a quote directive: <masanawa_crypto_action>{\"type\":\"crypto.withdraw.quote\",\"providerCode\":\"route\",\"amount\":\"decimal\",\"destinationAddress\":\"address\"}</masanawa_crypto_action>. The runtime will validate and ask for confirmation.",
  "If the user confirms the current pending crypto quote append: <masanawa_crypto_action>{\"type\":\"crypto.confirm\"}</masanawa_crypto_action>.",
  "If the user cancels the pending crypto quote append: <masanawa_crypto_action>{\"type\":\"crypto.cancel\"}</masanawa_crypto_action>.",
  "For capability questions append: <masanawa_crypto_action>{\"type\":\"crypto.capabilities\"}</masanawa_crypto_action>.",
  "Do not expose the machine action tag in ordinary prose.",
]);

function result(reply: string, document?: unknown): AgentCryptoResult {
  return Object.freeze({
    reply,
    parts: document === undefined
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({
            kind: "work",
            title: "Crypto",
            body: reply,
            document,
          }),
        ]),
  });
}

function string(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === "string" ? row[key].trim() : "";
}

function parseDirective(reply: string): Directive | null {
  const match = TAG.exec(reply);
  if (!match?.[1]) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  const type = string(row, "type");

  if (type === "crypto.capabilities" || type === "crypto.history" ||
      type === "crypto.confirm" || type === "crypto.cancel") {
    return { type } as Directive;
  }
  if (type === "crypto.routes") {
    const operation = string(row, "operation");
    if (["deposit","convert","withdraw"].includes(operation)) {
      return { type, operation: operation as "deposit" | "convert" | "withdraw" };
    }
  }
  if (type === "crypto.balance") {
    const providerCode = string(row, "providerCode");
    if (providerCode) return { type, providerCode };
  }
  if (type === "crypto.deposit") {
    const providerCode = string(row, "providerCode");
    const amount = string(row, "amount");
    if (providerCode && amount) return { type, providerCode, amount };
  }
  if (type === "crypto.buy") {
    const fiatAmount = string(row, "fiatAmount");
    const fiatCurrency = string(row, "fiatCurrency");
    if (fiatAmount && fiatCurrency) return { type, fiatAmount, fiatCurrency };
  }
  if (type === "crypto.convert.quote") {
    const providerCode = string(row, "providerCode");
    const targetProviderCode = string(row, "targetProviderCode");
    const amount = string(row, "amount");
    if (providerCode && targetProviderCode && amount) {
      return { type, providerCode, targetProviderCode, amount };
    }
  }
  if (type === "crypto.withdraw.quote") {
    const providerCode = string(row, "providerCode");
    const amount = string(row, "amount");
    const destinationAddress = string(row, "destinationAddress");
    if (providerCode && amount && destinationAddress) {
      return { type, providerCode, amount, destinationAddress };
    }
  }
  return null;
}

function scope(input: CharacterSessionScope) {
  return Object.freeze({
    tenantId: input.tenantId,
    userId: input.userId,
    characterId: input.characterId,
  });
}

function now(): string {
  return new Date().toISOString();
}

function confirmationPhrase(text: string): "confirm" | "cancel" | null {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (["confirm","yes","yes confirm","proceed","go ahead","do it","continue"].includes(normalized)) {
    return "confirm";
  }
  if (["cancel","stop","never mind","nevermind","do not proceed"].includes(normalized)) {
    return "cancel";
  }
  return null;
}

export function createAgentCryptoAssistant(input: Readonly<{
  financial: FinancialService;
  pending: CryptoChatActionRepository;
}>): AgentCryptoAssistant {
  async function completePending(
    authorizationHeader: string | undefined,
    action: CryptoChatAction,
  ): Promise<AgentCryptoResult> {
    const claimed = await input.pending.claim(
      scope(action),
      action.requestId,
      now() as never,
    );
    if (!claimed) return result("That crypto quote expired. Ask me for a new quote.");

    if (claimed.kind === "convert") {
      if (!claimed.targetProviderCode) {
        throw new Error("crypto.chat.target_missing");
      }
      const view = await input.financial.createConversion({
        authorizationHeader,
        requestId: claimed.requestId,
        providerCode: claimed.providerCode,
        targetProviderCode: claimed.targetProviderCode,
        amount: claimed.amount,
      });
      await input.pending.complete(scope(claimed), claimed.requestId, now() as never);
      const receive = view.targetAmount ? ` Target amount: ${view.targetAmount} ${view.targetAsset}.` : "";
      return result(
        `Conversion submitted: ${view.amount} ${view.asset} → ${view.targetAsset}. Status: ${view.status}.${receive}`,
        { type: "crypto.conversion", ...view },
      );
    }

    if (!claimed.destinationAddress) {
      throw new Error("crypto.chat.destination_missing");
    }
    const view = await input.financial.createWithdrawal({
      authorizationHeader,
      requestId: claimed.requestId,
      providerCode: claimed.providerCode,
      amount: claimed.amount,
      destinationAddress: claimed.destinationAddress,
    });
    await input.pending.complete(scope(claimed), claimed.requestId, now() as never);
    return result(
      `Withdrawal submitted: ${view.amount} ${view.asset}. Status: ${view.status}.`,
      { type: "crypto.withdrawal", ...view },
    );
  }

  async function execute(
    authorizationHeader: string | undefined,
    sessionScope: CharacterSessionScope,
    directive: Directive,
  ): Promise<AgentCryptoResult> {
    const currentScope = scope(sessionScope);

    if (directive.type === "crypto.capabilities") {
      const capabilities = await input.financial.capabilities({ authorizationHeader });
      const available = [
        capabilities.deposits ? "deposits" : null,
        capabilities.conversions ? "conversions" : null,
        capabilities.withdrawals ? "withdrawals" : null,
        capabilities.fiatOnRamp ? "fiat buy" : null,
      ].filter(Boolean);
      return result(
        available.length
          ? `Crypto currently supports: ${available.join(", ")}.`
          : "Crypto provider operations are not available right now.",
        { type: "crypto.capabilities", ...capabilities },
      );
    }

    if (directive.type === "crypto.routes") {
      const deposits = await input.financial.listDepositRoutes({ authorizationHeader });
      const routes = directive.operation === "convert"
        ? await input.financial.listConversionRoutes({ authorizationHeader })
        : directive.operation === "withdraw"
          ? deposits.filter((route) => route.operations.withdraw === true)
          : deposits;
      if (routes.length === 0) {
        return result(`No qualified ${directive.operation} routes are available right now.`);
      }
      const compact = routes.slice(0, 30).map((route) =>
        route.network ? `${route.providerCode} (${route.asset} on ${route.network})` : route.providerCode,
      );
      return result(
        `Qualified ${directive.operation} routes: ${compact.join(", ")}${routes.length > compact.length ? " …" : ""}`,
        { type: "crypto.routes", operation: directive.operation, routes },
      );
    }

    if (directive.type === "crypto.balance") {
      const balance = await input.financial.readBalance({
        authorizationHeader,
        providerCode: directive.providerCode,
      });
      return result(
        `Your ${balance.providerCode} balance is ${balance.amount}.`,
        { type: "crypto.balance", ...balance },
      );
    }

    if (directive.type === "crypto.history") {
      const intents = await input.financial.listHistory({
        authorizationHeader,
        limit: 10,
      });
      if (intents.length === 0) return result("You have no crypto activity yet.");
      return result(
        intents.map((item) =>
          `${item.operation}: ${item.amount} ${item.asset} · ${item.status}`,
        ).join("\n"),
        { type: "crypto.history", intents },
      );
    }

    if (directive.type === "crypto.deposit") {
      const view = await input.financial.createDeposit({
        authorizationHeader,
        requestId: createCanonicalId("request"),
        providerCode: directive.providerCode,
        amount: directive.amount,
      });
      const address = view.payAddress ?? "pending provider address";
      const amount = view.providerPayAmount ?? view.amount;
      return result(
        `Send exactly ${amount} ${view.asset} to:\n${address}\nI will track the deposit automatically.`,
        { type: "crypto.deposit", ...view },
      );
    }

    if (directive.type === "crypto.buy") {
      const view = await input.financial.createFiatPurchase({
        authorizationHeader,
        requestId: createCanonicalId("request"),
        fiatAmount: directive.fiatAmount,
        fiatCurrency: directive.fiatCurrency,
      });
      return result(
        view.checkoutUrl
          ? `Your secure provider invoice is ready. Open it to complete payment: ${view.checkoutUrl}`
          : `Your crypto purchase is ${view.status}. I will keep tracking it.`,
        { type: "crypto.buy", ...view },
      );
    }

    if (directive.type === "crypto.convert.quote") {
      const quote = await input.financial.quoteConversion({
        authorizationHeader,
        providerCode: directive.providerCode,
        targetProviderCode: directive.targetProviderCode,
        amount: directive.amount,
      });
      const timestamp = Date.now();
      const action: CryptoChatAction = {
        ...currentScope,
        requestId: createCanonicalId("request"),
        kind: "convert",
        providerCode: quote.providerCode,
        targetProviderCode: quote.targetProviderCode,
        amount: quote.amount,
        destinationAddress: null,
        quoteSummary: `${quote.amount} ${quote.providerCode} → about ${quote.estimatedTargetAmount} ${quote.targetProviderCode}`,
        state: "pending",
        createdAt: new Date(timestamp).toISOString() as never,
        expiresAt: new Date(timestamp + 5 * 60 * 1000).toISOString() as never,
        updatedAt: new Date(timestamp).toISOString() as never,
      };
      await input.pending.put(action);
      return result(
        `${action.quoteSummary}. Minimum: ${quote.minimumAmount}. Confirm?`,
        { type: "crypto.conversion.quote", ...quote, expiresAt: action.expiresAt },
      );
    }

    if (directive.type === "crypto.withdraw.quote") {
      const quote = await input.financial.quoteWithdrawal({
        authorizationHeader,
        providerCode: directive.providerCode,
        amount: directive.amount,
        destinationAddress: directive.destinationAddress,
      });
      const timestamp = Date.now();
      const action: CryptoChatAction = {
        ...currentScope,
        requestId: createCanonicalId("request"),
        kind: "withdraw",
        providerCode: quote.providerCode,
        targetProviderCode: null,
        amount: quote.amount,
        destinationAddress: directive.destinationAddress,
        quoteSummary:
          `Withdraw ${quote.amount} ${quote.providerCode}; estimated receive ${quote.estimatedReceiveAmount}; network fee ${quote.networkFee}`,
        state: "pending",
        createdAt: new Date(timestamp).toISOString() as never,
        expiresAt: new Date(timestamp + 5 * 60 * 1000).toISOString() as never,
        updatedAt: new Date(timestamp).toISOString() as never,
      };
      await input.pending.put(action);
      return result(
        `${action.quoteSummary}. Destination: ${directive.destinationAddress}. Confirm?`,
        { type: "crypto.withdrawal.quote", ...quote, expiresAt: action.expiresAt },
      );
    }

    if (directive.type === "crypto.cancel") {
      const pending = await input.pending.readCurrent(currentScope, now() as never);
      if (!pending) return result("There is no pending crypto action to cancel.");
      await input.pending.complete(currentScope, pending.requestId, now() as never);
      return result("Cancelled. No crypto action was sent.");
    }

    const pending = await input.pending.readCurrent(currentScope, now() as never);
    if (!pending) return result("There is no pending crypto quote to confirm.");
    return completePending(authorizationHeader, pending);
  }

  return Object.freeze({
    systemInstructions: CRYPTO_AGENT_SYSTEM_INSTRUCTIONS,

    async beforeInference(request) {
      const phrase = confirmationPhrase(request.text);
      if (!phrase) return null;
      const pending = await input.pending.readCurrent(
        scope(request.scope),
        now() as never,
      );
      if (!pending) return null;
      return phrase === "cancel"
        ? execute(request.authorizationHeader, request.scope, { type: "crypto.cancel" })
        : completePending(request.authorizationHeader, pending);
    },

    async afterInference(request) {
      const directive = parseDirective(request.modelReply);
      if (!directive) return null;
      return execute(request.authorizationHeader, request.scope, directive);
    },
  });
}
