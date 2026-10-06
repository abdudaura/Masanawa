import { createCanonicalId } from "@masanawa/contracts";
import type { FinancialService } from "./financial_service.js";

export type AgentCryptoResult = Readonly<{
  reply: string;
  parts: readonly unknown[];
}>;

export interface AgentCryptoAssistant {
  readonly systemInstructions: readonly string[];
  afterInference(input: Readonly<{
    authorizationHeader: string | undefined;
    characterId: string;
    modelReply: string;
  }>): Promise<AgentCryptoResult | null>;
}

type Directive =
  | { type: "crypto.capabilities" }
  | { type: "crypto.routes" }
  | { type: "crypto.balance"; providerCode: string }
  | { type: "crypto.deposit"; providerCode: string; amount: string }
  | {
      type: "crypto.convert.quote";
      providerCode: string;
      targetProviderCode: string;
      amount: string;
    }
  | {
      type: "crypto.convert.confirm";
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
  | {
      type: "crypto.withdraw.confirm";
      providerCode: string;
      amount: string;
      destinationAddress: string;
    }
  | { type: "crypto.buy"; fiatAmount: string; fiatCurrency: string };

const TAG = /<masanawa_crypto>([\s\S]{1,5000}?)<\/masanawa_crypto>/u;

function result(reply: string, document?: unknown): AgentCryptoResult {
  return Object.freeze({
    reply,
    parts:
      document === undefined
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

function stringField(
  row: Record<string, unknown>,
  key: string,
  max = 512,
): string | null {
  const value = row[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return null;
  return normalized;
}

function parseDirective(reply: string): Directive | null {
  const match = TAG.exec(reply);
  if (!match?.[1]) return null;
  let decoded: unknown;
  try {
    decoded = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    return null;
  }
  const row = decoded as Record<string, unknown>;
  const type = stringField(row, "type", 64);
  if (type === "crypto.capabilities") return Object.freeze({ type });
  if (type === "crypto.routes") return Object.freeze({ type });
  if (type === "crypto.balance") {
    const providerCode = stringField(row, "providerCode", 32);
    return providerCode ? Object.freeze({ type, providerCode }) : null;
  }
  if (type === "crypto.deposit") {
    const providerCode = stringField(row, "providerCode", 32);
    const amount = stringField(row, "amount", 80);
    return providerCode && amount
      ? Object.freeze({ type, providerCode, amount })
      : null;
  }
  if (type === "crypto.buy") {
    const fiatAmount = stringField(row, "fiatAmount", 32);
    const fiatCurrency = stringField(row, "fiatCurrency", 32);
    return fiatAmount && fiatCurrency
      ? Object.freeze({ type, fiatAmount, fiatCurrency })
      : null;
  }
  if (type === "crypto.convert.quote" || type === "crypto.convert.confirm") {
    const providerCode = stringField(row, "providerCode", 32);
    const targetProviderCode = stringField(row, "targetProviderCode", 32);
    const amount = stringField(row, "amount", 80);
    return providerCode && targetProviderCode && amount
      ? Object.freeze({ type, providerCode, targetProviderCode, amount })
      : null;
  }
  if (type === "crypto.withdraw.quote" || type === "crypto.withdraw.confirm") {
    const providerCode = stringField(row, "providerCode", 32);
    const amount = stringField(row, "amount", 80);
    const destinationAddress = stringField(row, "destinationAddress", 512);
    return providerCode && amount && destinationAddress
      ? Object.freeze({ type, providerCode, amount, destinationAddress })
      : null;
  }
  return null;
}


export const CRYPTO_AGENT_SYSTEM_INSTRUCTIONS = Object.freeze([
  "Masanawa has a server-controlled crypto custody tool backed by NOWPayments. Never invent balances, addresses, routes, quotes, fees, confirmations, transaction IDs, provider status, or success.",
  "When the user asks which crypto assets/networks are available, append exactly one <masanawa_crypto>{\"type\":\"crypto.routes\"}</masanawa_crypto> directive.",
  "For a crypto balance, identify the provider code from live routes or prior chat context, then append <masanawa_crypto>{\"type\":\"crypto.balance\",\"providerCode\":\"...\"}</masanawa_crypto>.",
  "For a deposit, ask only for missing asset/network or amount, then append <masanawa_crypto>{\"type\":\"crypto.deposit\",\"providerCode\":\"...\",\"amount\":\"...\"}</masanawa_crypto>. The runtime returns the real deposit address and amount.",
  "For conversion, first quote with <masanawa_crypto>{\"type\":\"crypto.convert.quote\",\"providerCode\":\"...\",\"targetProviderCode\":\"...\",\"amount\":\"...\"}</masanawa_crypto>. Do not execute until the user explicitly confirms the quoted conversion. On confirmation, reuse the exact provider codes and amount from recent server-owned conversation context and append type crypto.convert.confirm.",
  "For withdrawal, first quote with type crypto.withdraw.quote and providerCode, amount, destinationAddress. Do not execute until the user explicitly confirms the exact quoted withdrawal. On confirmation, reuse the exact fields from recent server-owned conversation context and append type crypto.withdraw.confirm.",
  "For fiat crypto purchase, ask only for missing fiat amount/currency then append type crypto.buy with fiatAmount and fiatCurrency. If the provider requires a hosted invoice, return that link inside chat rather than claiming the purchase completed.",
  "Never expose the <masanawa_crypto> directive or explain it. Keep normal prose short and in the user's current language.",
]);

export function createAgentCryptoAssistant(input: Readonly<{
  financial: FinancialService;
}>): AgentCryptoAssistant {
  return Object.freeze({
    systemInstructions: CRYPTO_AGENT_SYSTEM_INSTRUCTIONS,

    async afterInference(request) {
      const directive = parseDirective(request.modelReply);
      if (!directive) return null;
      const authorizationHeader = request.authorizationHeader;

      if (directive.type === "crypto.capabilities") {
        const value = await input.financial.capabilities({ authorizationHeader });
        return result(
          `Crypto deposits are ${value.deposits ? "available" : "unavailable"}, conversions are ${value.conversions ? "available" : "unavailable"}, withdrawals are ${value.withdrawals ? "available" : "unavailable"}, and fiat purchase is ${value.fiatOnRamp ? "available" : "unavailable"}.`,
          value,
        );
      }

      if (directive.type === "crypto.routes") {
        const routes = await input.financial.listDepositRoutes({ authorizationHeader });
        if (routes.length === 0) return result("No crypto deposit routes are available right now.");
        const shown = routes.slice(0, 20);
        return result(
          `Available crypto routes include ${shown.map((item) => `${item.asset}${item.network ? ` on ${item.network}` : ""} (${item.providerCode})`).join(", ")}.`,
          { routes: shown },
        );
      }

      if (directive.type === "crypto.balance") {
        const value = await input.financial.readBalance({
          authorizationHeader,
          providerCode: directive.providerCode,
        });
        return result(
          `Your ${value.providerCode} balance is ${value.amount}.`,
          value,
        );
      }

      if (directive.type === "crypto.deposit") {
        const value = await input.financial.createDeposit({
          authorizationHeader,
          requestId: createCanonicalId("request"),
          providerCode: directive.providerCode,
          amount: directive.amount,
        });
        return result(
          value.payAddress
            ? `Send exactly ${value.providerPayAmount ?? value.amount} ${value.asset}${value.network ? ` on ${value.network}` : ""} to ${value.payAddress}. I will only report it credited after provider evidence is received.`
            : "The provider did not return a deposit address, so I did not claim a deposit was created.",
          value,
        );
      }

      if (directive.type === "crypto.convert.quote") {
        const value = await input.financial.quoteConversion({
          authorizationHeader,
          providerCode: directive.providerCode,
          targetProviderCode: directive.targetProviderCode,
          amount: directive.amount,
        });
        return result(
          `Convert ${value.amount} ${value.providerCode} to about ${value.estimatedTargetAmount} ${value.targetProviderCode}. Minimum is ${value.minimumAmount}. Confirm this conversion?`,
          value,
        );
      }

      if (directive.type === "crypto.convert.confirm") {
        const value = await input.financial.createConversion({
          authorizationHeader,
          requestId: createCanonicalId("request"),
          providerCode: directive.providerCode,
          targetProviderCode: directive.targetProviderCode,
          amount: directive.amount,
        });
        return result(
          value.outcomeUnknown
            ? "The conversion was submitted but its final outcome is not confirmed yet. I will not claim success until provider evidence arrives."
            : `Conversion status: ${value.status}.`,
          value,
        );
      }

      if (directive.type === "crypto.withdraw.quote") {
        const value = await input.financial.quoteWithdrawal({
          authorizationHeader,
          providerCode: directive.providerCode,
          amount: directive.amount,
          destinationAddress: directive.destinationAddress,
        });
        return result(
          `Withdraw ${value.amount} ${value.providerCode} to ${value.destinationAddress}. Network fee is ${value.networkFee}; estimated receive amount is ${value.estimatedReceiveAmount}. Confirm this withdrawal?`,
          value,
        );
      }

      if (directive.type === "crypto.withdraw.confirm") {
        const value = await input.financial.createWithdrawal({
          authorizationHeader,
          requestId: createCanonicalId("request"),
          providerCode: directive.providerCode,
          amount: directive.amount,
          destinationAddress: directive.destinationAddress,
        });
        return result(
          value.outcomeUnknown
            ? "The withdrawal was submitted but its final outcome is not confirmed yet. I will not claim success until provider evidence arrives."
            : `Withdrawal status: ${value.status}.`,
          value,
        );
      }

      const value = await input.financial.createFiatPurchase({
        authorizationHeader,
        requestId: createCanonicalId("request"),
        fiatAmount: directive.fiatAmount,
        fiatCurrency: directive.fiatCurrency,
      });
      return result(
        value.checkoutUrl
          ? `Your secure provider invoice is ready: ${value.checkoutUrl}. I will only report crypto credited after provider evidence is received.`
          : "The provider did not return a checkout link, so I did not claim a purchase was created.",
        value,
      );
    },
  });
}
