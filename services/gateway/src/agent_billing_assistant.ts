import { formatNgnKobo, parseNgnKobo } from "@masanawa/commerce";
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
    /** Actual human utterance, never model-generated consent text. */
    userText?: string;
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
  const exact = billers.filter((item) => normalize(item.name) === wanted);
  if (exact.length === 1) return exact[0] ?? null;
  if (exact.length > 1 || wanted.length < 2) return null;
  // Do not make payments based on whichever fuzzy provider appears first.
  // Short abbreviations are matched only when unambiguous in the live catalog.
  const partial = billers.filter((item) => normalize(item.name).includes(wanted));
  return partial.length === 1 ? partial[0] ?? null : null;
}

function bestItem(
  items: readonly BillItem[],
  directive: Extract<Directive, { type: "billing.quote" }>,
): BillItem | null {
  const plan = normalize(directive.plan ?? "");
  if (plan) {
    const tokens = plan.split(" ").filter(Boolean);
    const matches = items.filter((item) => {
      const name = normalize(item.name);
      return tokens.every((token) => name.includes(token));
    });
    // Two distinct durations/prepaid tariffs can both match "1GB" or
    // "prepaid": a human must disambiguate instead of choosing catalog order.
    return matches.length === 1 ? matches[0] ?? null : null;
  }

  if (directive.service === "airtime" || directive.service === "electricity") {
    const variable = items.filter((item) => Number(item.amount) === 0);
    if (variable.length === 1) return variable[0] ?? null;
    // Only a genuinely single offering can be selected without a plan.
    return items.length === 1 ? items[0] ?? null : null;
  }
  // Data and cable TV require the exact bundle/package, even if only one
  // option happens to be returned by a temporarily incomplete catalog.
  return null;
}

function isExplicitPaymentConsent(text: string): boolean {
  const utterance = normalize(text);
  return /^(?:yes(?: please)?|yeah|yep|confirm(?: (?:this|the|my) (?:bill|payment|purchase))?|confirmed|okay|ok|do it|go ahead|proceed|continue|na am|naam|eh|e|(?:please )?(?:pay|purchase|buy) (?:this|the|my) (?:bill|payment|purchase))$/u.test(utterance);
}

function categoryCode(service: Extract<Directive, { type: "billing.quote" }>["service"]): string {
  switch (service) {
    case "airtime": return "AIRTIME";
    case "data": return "MOBILEDATA";
    case "electricity": return "UTILITYBILLS";
    case "tv": return "CABLEBILLS";
  }
}

type PayableQuote = Readonly<{ quote: Readonly<{
  itemName: string;
  customerId: string;
  totalAmountKobo: number;
}> }>;

function quoteBoundConsentPhrase(view: PayableQuote): string {
  // The amount is formatted from canonical integer kobo. The actual provider
  // recipient and price must be repeated to prevent incidental "yes" spending.
  return `Confirm ${view.quote.itemName} bill to ${view.quote.customerId} for ${formatNgnKobo(view.quote.totalAmountKobo)} naira`;
}

function matchesQuoteBoundConsent(userText: string, view: PayableQuote): boolean {
  if (userText.length > 512) return false;
  const spoken = userText.trim().replace(/\s+/gu, " ");
  const match = /^(?:confirm (.+?) bill to (.+?) for ([0-9]+(?:\.[0-9]{1,2})?) (?:naira|ngn)|tabbatar da biya ga (.+?) ga (.+?) na ([0-9]+(?:\.[0-9]{1,2})?) naira)$/iu.exec(spoken);
  if (!match) return false;
  const itemName = (match[1] ?? match[4] ?? "").trim();
  const recipient = (match[2] ?? match[5] ?? "").trim();
  const amount = match[3] ?? match[6] ?? "";
  if (itemName.toLowerCase() !== view.quote.itemName.trim().toLowerCase()) {
    return false;
  }
  // Case folding is presentation-only; purchase uses the verbatim immutable
  // customerId already stored in the owner-authenticated server quote.
  if (recipient.toLowerCase() !== view.quote.customerId.trim().toLowerCase()) {
    return false;
  }
  try {
    return parseNgnKobo(amount) === view.quote.totalAmountKobo;
  } catch {
    return false;
  }
}

function confirmationReply(view: PayableQuote & { quote: { itemName: string } }): string {
  return `${view.quote.itemName} for ${view.quote.customerId} will cost ₦${formatNgnKobo(view.quote.totalAmountKobo)}. Confirm? For safety, say or type: "${quoteBoundConsentPhrase(view)}".`;
}

function walletReply(view: BillingWalletView): string {
  if (view.phase === "awaiting-funds" && view.funding) {
    return `Your balance is ₦${view.balance}. Transfer exactly ₦${Number(view.funding.amountKobo / 100).toFixed(2)} to ${view.funding.bankName}, account ${view.funding.accountNumber}. I will continue the purchase automatically when the transfer is verified.`;
  }
  if (view.phase === "fulfilled") {
    return `Done. The bill was completed successfully. Your wallet balance is ₦${view.balance}.`;
  }
  if (view.phase === "failed") {
    return `The bill did not complete. Check your wallet activity for the final reversal or refund status. Your available balance is ₦${view.balance}.`;
  }
  return `Your bill is being processed. Your available wallet balance is ₦${view.balance}.`;
}

export const BILLING_AGENT_SYSTEM_INSTRUCTIONS = Object.freeze([
  "Masanawa has a server-controlled NGN wallet and bill-payment tool. Never claim a payment happened unless the runtime returns evidence.",
  "For balance requests, append exactly: <masanawa_action>{\"type\":\"wallet.balance\"}</masanawa_action>.",
  "For requests to add/fund/deposit money, ask only for amount if missing. When known append: <masanawa_action>{\"type\":\"wallet.fund\",\"amount\":\"5000\"}</masanawa_action>.",
  "For bill purchases, identify service, provider/network/company and recipient. Airtime and electricity need an amount. Data and TV may use the live fixed plan price when the user names a plan, so do not force the user to know its price. Ask only for missing or ambiguous information.",
  "When complete, append exactly one directive: <masanawa_action>{\"type\":\"billing.quote\",\"service\":\"airtime|data|electricity|tv\",\"provider\":\"provider name\",\"recipient\":\"phone/meter/card\",\"amount\":\"optional decimal NGN amount\",\"plan\":\"optional plan/package/prepaid/postpaid\"}</masanawa_action>.",
  "Only request billing.confirm after the customer repeats the exact quote recipient and total as the server-provided confirmation phrase. A generic yes/ok/continue, model-generated text or unrelated agreement never authorizes spending.",
  "If the user says or types the full quote-specific confirmation phrase, append: <masanawa_action>{\"type\":\"billing.confirm\"}</masanawa_action>. Do not authorize a generic yes.",
  "Never ask the user to open a browser or Flutterwave checkout. Funding uses a temporary bank account shown inside Masanawa.",
  "A complete purchase requires one explicit confirmation. Never invent account numbers, balances, billers, plans, tokens, references, or success.",
  "Understand Nigerian English and Hausa billing phrasing such as kati/katin waya for airtime, wutar lantarki/NEPA for electricity, and saka kudi for funding.",
]);

export function createAgentBillingAssistant(input: Readonly<{
  checkout: BillingCheckoutService;
  billing: BillingFinancialService;
  wallet: BillingWalletService;
}>): AgentBillingAssistant {

  async function pendingForCharacter(
    authorizationHeader: string | undefined,
    characterId: string,
  ) {
    const history = await input.checkout.list({ authorizationHeader, limit: 50 });
    const pending = history.filter((entry) =>
      entry.phase === "quoted" &&
      entry.quote.originatingCharacterId === characterId &&
      Number.isFinite(Date.parse(entry.quote.expiresAt)) &&
      Date.parse(entry.quote.expiresAt) > Date.now(),
    );
    // Do not silently choose the "first" quote when there might be a second
    // pending one beyond the bounded recent-history window.
    return Object.freeze({
      quote: history.length < 50 && pending.length === 1 ? pending[0] ?? null : null,
      ambiguous: pending.length > 1 || history.length >= 50,
    });
  }

  async function executeDirective(
    authorizationHeader: string | undefined,
    characterId: string,
    directive: Directive,
    originalUserText = "",
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
      const selection = await pendingForCharacter(authorizationHeader, characterId);
      if (selection.ambiguous) {
        return result("I found several recent bills. Open the exact bill in Payments and confirm it there to avoid paying the wrong recipient.");
      }
      if (!selection.quote) return result("There is no pending bill to confirm.");
      if (!matchesQuoteBoundConsent(originalUserText, selection.quote)) {
        return result(`Do not confirm with a simple yes. To approve this exact recipient and amount, say or type: "${quoteBoundConsentPhrase(selection.quote)}". No money has been taken.`);
      }
      const view = await input.wallet.confirmAndPurchase({
        authorizationHeader,
        quoteId: selection.quote.quote.quoteId,
        quoteRevision: selection.quote.quote.revision,
      });
      return result(walletReply(view), view.document);
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
      const available = [...new Set(billers.map((item) => item.name.trim()))]
        .filter(Boolean).slice(0, 8);
      return result(
        available.length === 0
          ? "No provider is available for that service on the live billing account."
          : `I could not uniquely match "${directive.provider}". Which live provider do you mean: ${available.join(", ")}?`,
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
      const options = [...new Set(items.map((row) => row.name.trim()))]
        .filter(Boolean).slice(0, 8);
      return result(
        options.length === 0
          ? "No bill package is currently available for that provider."
          : `I need one exact ${directive.service} option before quoting. Available: ${options.join(", ")}. Which one do you want?`,
      );
    }

    const requestedAmount = directive.amount?.trim() ?? "";
    let fixedAmountKobo: number;
    try {
      fixedAmountKobo = Number(item.amount) > 0 ? parseNgnKobo(item.amount) : 0;
      if (fixedAmountKobo > 0 && requestedAmount &&
          parseNgnKobo(requestedAmount) !== fixedAmountKobo) {
        return result(
          `The live price of ${item.name} is ₦${item.amount}, not ₦${requestedAmount}. Please confirm the actual package amount before I create a quote.`,
        );
      }
    } catch {
      return result("The requested amount or live package price could not be verified. Please check the bill details.");
    }
    const resolvedAmount =
      fixedAmountKobo > 0 ? item.amount : requestedAmount;
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

      // Spoken and typed approvals share the exact same server quote guard.
      // Do not treat a generic answer to some other agent question as consent.
      if (isExplicitPaymentConsent(request.text) ||
          /^confirm .+ bill to /iu.test(request.text.trim()) ||
          /^tabbatar da biya ga /iu.test(request.text.trim())) {
        return executeDirective(
          request.authorizationHeader,
          request.characterId,
          { type: "billing.confirm" },
          request.text,
        );
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
      // Even a forged model billing.confirm directive cannot spend unless
      // the ORIGINAL user utterance exactly acknowledges recipient and total.
      return executeDirective(
        request.authorizationHeader,
        request.characterId,
        directive,
        request.userText ?? "",
      );
    },
  });
}

