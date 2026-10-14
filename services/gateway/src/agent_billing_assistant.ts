import type { BillingCheckoutService } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import type { BillingWalletService, BillingWalletView } from "./billing_wallet.js";

export type AgentBillingResult = Readonly<{
  reply: string;
  parts: readonly unknown[];
}>;

export interface AgentBillingAssistant {
  readonly systemInstructions: readonly string[];
  beforeInference(input: Readonly<{
    authorizationHeader: string | undefined;
    characterId: string;
    text: string;
  }>): Promise<AgentBillingResult | null>;
  afterInference(input: Readonly<{
    authorizationHeader: string | undefined;
    characterId: string;
    modelReply: string;
  }>): Promise<AgentBillingResult | null>;
}

type BillCategory = Readonly<{ code: string; name: string }>;
type BillBiller = Readonly<{ billerCode: string; name: string }>;
type BillItem = Readonly<{
  billerCode: string;
  itemCode: string;
  name: string;
  amount: string;
}>;

type Directive =
  | { type: "wallet.balance" }
  | { type: "wallet.fund"; amount: string }
  | { type: "billing.confirm" }
  | {
      type: "billing.quote";
      service: "airtime" | "data" | "electricity" | "tv";
      provider: string;
      recipient: string;
      amount?: string;
      plan?: string;
    };

const TAG = /<masanawa_action>([\s\S]{1,4000}?)<\/masanawa_action>/u;

function result(reply: string, document?: unknown): AgentBillingResult {
  return Object.freeze({
    reply,
    parts: document === undefined
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({
            kind: "work",
            title: "Billing",
            body: reply,
            document,
          }),
        ]),
  });
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
  if (row.type === "wallet.balance") return Object.freeze({ type: "wallet.balance" });
  if (row.type === "wallet.fund" && typeof row.amount === "string") {
    return Object.freeze({ type: "wallet.fund", amount: row.amount.trim() });
  }
  if (row.type === "billing.confirm") {
    return Object.freeze({ type: "billing.confirm" });
  }
  if (
    row.type === "billing.quote" &&
    ["airtime","data","electricity","tv"].includes(String(row.service)) &&
    typeof row.provider === "string" &&
    typeof row.recipient === "string" &&
    (row.amount === undefined || typeof row.amount === "string")
  ) {
    return Object.freeze({
      type: "billing.quote",
      service: row.service as "airtime" | "data" | "electricity" | "tv",
      provider: row.provider.trim(),
      recipient: row.recipient.trim(),
      ...(typeof row.amount === "string" && row.amount.trim()
        ? { amount: row.amount.trim() }
        : {}),
      ...(typeof row.plan === "string" && row.plan.trim()
        ? { plan: row.plan.trim() }
        : {}),
    });
  }
  return null;
}

function list<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? value as readonly T[] : Object.freeze([]);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function bestBiller(billers: readonly BillBiller[], provider: string): BillBiller | null {
  const wanted = normalize(provider);
  if (!wanted) return null;
  const exact = billers.find((item) => normalize(item.name) === wanted);
  if (exact) return exact;
  return billers.find((item) =>
    normalize(item.name).includes(wanted) || wanted.includes(normalize(item.name)),
  ) ?? null;
}

function bestItem(
  items: readonly BillItem[],
  directive: Extract<Directive, { type: "billing.quote" }>,
): BillItem | null {
  if (directive.service === "airtime") {
    return items.find((item) => Number(item.amount) === 0) ??
      items.find((item) => normalize(item.name).includes("airtime")) ??
      items[0] ??
      null;
  }

  const plan = normalize(directive.plan ?? "");
  if (plan) {
    const tokens = plan.split(" ").filter(Boolean);
    const match = items.find((item) => {
      const name = normalize(item.name);
      return tokens.every((token) => name.includes(token));
    });
    if (match) return match;
  }

  if (directive.service === "electricity") {
    return items.find((item) => Number(item.amount) === 0) ?? items[0] ?? null;
  }
  return null;
}

function categoryCode(service: Extract<Directive, { type: "billing.quote" }>["service"]): string {
  switch (service) {
    case "airtime": return "AIRTIME";
    case "data": return "MOBILEDATA";
    case "electricity": return "UTILITYBILLS";
    case "tv": return "CABLEBILLS";
  }
}

function confirmationReply(view: { quote: { itemName: string; customerId: string; totalAmountKobo: number } }): string {
  const total = (view.quote.totalAmountKobo / 100).toFixed(2);
  return `${view.quote.itemName} for ${view.quote.customerId} will cost ₦${total}. Confirm?`;
}

function walletReply(view: BillingWalletView): string {
  if (view.phase === "awaiting-funds" && view.funding) {
    return `Your balance is ₦${view.balance}. Transfer exactly ₦${Number(view.funding.amountKobo / 100).toFixed(2)} to ${view.funding.bankName}, account ${view.funding.accountNumber}. I will continue the purchase automatically when the transfer is verified.`;
  }
  if (view.phase === "fulfilled") {
    return `Done. The bill was completed successfully. Your wallet balance is ₦${view.balance}.`;
  }
  if (view.phase === "failed") {
    return `The bill did not complete, so the reserved money was returned to your wallet. Your balance is ₦${view.balance}.`;
  }
  return `Your bill is being processed. Your available wallet balance is ₦${view.balance}.`;
}

export const BILLING_AGENT_SYSTEM_INSTRUCTIONS = Object.freeze([
  "Masanawa has a server-controlled NGN wallet and bill-payment tool. Never claim a payment happened unless the runtime returns evidence.",
  "For balance requests, append exactly: <masanawa_action>{\"type\":\"wallet.balance\"}</masanawa_action>.",
  "For requests to add/fund/deposit money, ask only for amount if missing. When known append: <masanawa_action>{\"type\":\"wallet.fund\",\"amount\":\"5000\"}</masanawa_action>.",
  "Only mobile data bundles can be bought. Do not offer airtime, electricity, cable or TV bills. For data bundles identify network, phone recipient and preferred plan. The provider catalog determines price.",
  "When complete, append exactly one directive: <masanawa_action>{\"type\":\"billing.quote\",\"service\":\"data\",\"provider\":\"network name\",\"recipient\":\"phone number\",\"plan\":\"bundle/package\"}</masanawa_action>.",
  "If the user says yes/confirm/proceed to the current pending bill, including by voice, append exactly: <masanawa_action>{\"type\":\"billing.confirm\"}</masanawa_action>.",
  "Never ask the user to open a browser or Flutterwave checkout. Funding uses a temporary bank account shown inside Masanawa.",
  "A complete purchase requires one explicit confirmation. Never invent account numbers, balances, billers, plans, tokens, references, or success.",
  "Understand Nigerian English and Hausa data bundle requests. Explain politely that other bill services are currently unavailable.",
]);

export function createAgentBillingAssistant(input: Readonly<{
  checkout: BillingCheckoutService;
  billing: BillingFinancialService;
  wallet: BillingWalletService;
}>): AgentBillingAssistant {

  async function executeDirective(
    authorizationHeader: string | undefined,
    characterId: string,
    directive: Directive,
  ): Promise<AgentBillingResult> {
    if (directive.type === "wallet.balance") {
      const balance = await input.wallet.balance({ authorizationHeader });
      return result(`Your Masanawa wallet balance is ₦${balance.balance}.`);
    }

    if (directive.type === "wallet.fund") {
      const view = await input.wallet.createFunding({
        authorizationHeader,
        amount: directive.amount,
        originatingCharacterId: characterId,
      });
      return result(walletReply(view), view.document);
    }

    if (directive.type === "billing.confirm") {
      const history = await input.checkout.list({
        authorizationHeader,
        limit: 10,
      });
      const pending = history.find((entry) =>
        entry.phase === "quoted" &&
        entry.quote.originatingCharacterId === characterId &&
        Date.parse(entry.quote.expiresAt) > Date.now(),
      );
      if (!pending) return result("There is no pending bill to confirm.");
      const view = await input.wallet.confirmAndPurchase({
        authorizationHeader,
        quoteId: pending.quote.quoteId,
        quoteRevision: pending.quote.revision,
      });
      return result(walletReply(view), view.document);
    }

    if (directive.service !== "data") {
      return result("Masanawa currently supports data bundles only. Airtime, electricity and TV purchases are unavailable.");
    }
    const code = categoryCode(directive.service);
    const categories = list<BillCategory>(
      (await input.billing.listCategories({ authorizationHeader })) as unknown,
    );
    if (!categories.some((category) => category.code === code)) {
      return result(`That ${directive.service} service is not available on the live billing account right now.`);
    }

    const billers = list<BillBiller>(
      (await input.billing.listBillers({
        authorizationHeader,
        categoryCode: code,
      })) as unknown,
    );
    const biller = bestBiller(billers, directive.provider);
    if (!biller) {
      return result(
        directive.service === "airtime" || directive.service === "data"
          ? "Which network should I use: MTN, Airtel, Glo, or 9mobile?"
          : `I could not match "${directive.provider}" to a live provider. Please tell me the provider/company name.`,
      );
    }

    const items = list<BillItem>(
      (await input.billing.listItems({
        authorizationHeader,
        billerCode: biller.billerCode,
      })) as unknown,
    );
    const item = bestItem(items, directive);
    if (!item) {
      return result(
        directive.service === "data"
          ? "Which data bundle do you want? You can say the size or plan, for example 1GB."
          : directive.service === "tv"
            ? "Which TV package do you want?"
            : "I need the exact service option before I can continue.",
      );
    }

    const resolvedAmount =
      directive.amount?.trim() ||
      (Number(item.amount) > 0 ? item.amount : "");
    if (!resolvedAmount) {
      return result("How much should I pay for this service?");
    }
    const quote = await input.checkout.createQuote({
      authorizationHeader,
      categoryCode: code,
      billerCode: biller.billerCode,
      itemCode: item.itemCode,
      customerId: directive.recipient,
      amount: resolvedAmount,
      originatingCharacterId: characterId,
    });
    return result(confirmationReply(quote), quote.document);
  }

  return Object.freeze<AgentBillingAssistant>({
    systemInstructions: BILLING_AGENT_SYSTEM_INSTRUCTIONS,

    async beforeInference(request) {
      const text = normalize(request.text);
      if (!text) return null;

      if (/^(?:yes|yeah|yep|confirm|confirmed|okay|ok|do it|proceed|continue|na am|naam|eh|e)$/u.test(text)) {
        const history = await input.checkout.list({
          authorizationHeader: request.authorizationHeader,
          limit: 10,
        });
        const pending = history.find((entry) =>
          entry.phase === "quoted" &&
          entry.quote.originatingCharacterId === request.characterId &&
          Date.parse(entry.quote.expiresAt) > Date.now(),
        );
        if (!pending) return null;
        const view = await input.wallet.confirmAndPurchase({
          authorizationHeader: request.authorizationHeader,
          quoteId: pending.quote.quoteId,
          quoteRevision: pending.quote.revision,
        });
        return result(walletReply(view), view.document);
      }

      if (
        (text.includes("balance") || text.includes("wallet")) &&
        (text.includes("my") || text.includes("mine") || text.includes("na") || text.includes("kudi"))
      ) {
        return executeDirective(
          request.authorizationHeader,
          request.characterId,
          { type: "wallet.balance" },
        );
      }

      return null;
    },

    async afterInference(request) {
      const directive = parseDirective(request.modelReply);
      if (!directive) return null;
      return executeDirective(
        request.authorizationHeader,
        request.characterId,
        directive,
      );
    },
  });
}
