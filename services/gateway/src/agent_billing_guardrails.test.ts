import { describe, expect, it, vi } from "vitest";
import type { BillingCheckoutService, BillingCheckoutView } from "./billing_checkout.js";
import type { BillingFinancialService } from "./financial_billing.js";
import type { BillingWalletService, BillingWalletView } from "./billing_wallet.js";
import { createAgentBillingAssistant } from "./agent_billing_assistant.js";

function quoted(
  characterId = "character-owner",
  id = "quote-one",
): BillingCheckoutView {
  return {
    phase: "quoted",
    quote: {
      quoteId: id,
      revision: 1,
      originatingCharacterId: characterId,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      itemName: "Airtime",
      customerId: "07010102053",
      totalAmountKobo: 10_000,
    },
    document: { kind: "bill.quote" },
  } as unknown as BillingCheckoutView;
}

function fixture() {
  const currentQuotes: BillingCheckoutView[] = [];
  let providers = [{ billerCode: "mtn", name: "MTN Nigeria" }];
  let items = [{ billerCode: "mtn", itemCode: "airtime", name: "MTN Airtime", amount: "0" }];
  const createQuote = vi.fn(async () => quoted());
  const list = vi.fn(async () => currentQuotes);
  const confirmAndPurchase = vi.fn(async (_input: unknown) => ({
    phase: "processing", balance: "100.00", balanceKobo: 10_000,
    funding: null, purchase: null, quoteId: "quote-one",
    document: { kind: "bill.wallet" },
  } as unknown as BillingWalletView));
  const financial = {
    listCategories: vi.fn(async () => [
      { code: "AIRTIME", name: "Airtime" },
      { code: "MOBILEDATA", name: "Mobile data" },
      { code: "UTILITYBILLS", name: "Electricity" },
      { code: "CABLEBILLS", name: "TV" },
    ]),
    listBillers: vi.fn(async () => providers),
    listItems: vi.fn(async () => items),
  } as unknown as BillingFinancialService;
  const assistant = createAgentBillingAssistant({
    checkout: { createQuote, list } as unknown as BillingCheckoutService,
    billing: financial,
    wallet: { confirmAndPurchase } as unknown as BillingWalletService,
  });
  const quote = (payload: Record<string, unknown>) =>
    assistant.afterInference({
      authorizationHeader: "Bearer owner",
      characterId: "character-owner",
      userText: "Please buy this service",
      modelReply:
        `<masanawa_action>${JSON.stringify({ type: "billing.quote", ...payload })}</masanawa_action>`,
    });
  const confirm = (userText: string) => assistant.afterInference({
    authorizationHeader: "Bearer owner",
    characterId: "character-owner",
    userText,
    modelReply: '<masanawa_action>{"type":"billing.confirm"}</masanawa_action>',
  });
  return {
    assistant, quote, confirm, currentQuotes, createQuote, list,
    confirmAndPurchase, financial,
    setProviders(value: typeof providers) { providers = value; },
    setItems(value: typeof items) { items = value; },
  };
}

describe("R07 voice/text financial catalog and consent safety", () => {
  it("creates a quote only for an unambiguously selected live biller", async () => {
    const f = fixture();
    const answer = await f.quote({
      service: "airtime", provider: "MTN", recipient: "07010102053",
      amount: "100",
    });
    expect(answer?.reply).toContain("Confirm?");
    expect(f.createQuote).toHaveBeenCalledOnce();
    expect(f.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      authorizationHeader: "Bearer owner",
      categoryCode: "AIRTIME",
      billerCode: "mtn",
      itemCode: "airtime",
      customerId: "07010102053",
      amount: "100",
      originatingCharacterId: "character-owner",
    }));
  });

  it("rejects ambiguous matched provider names and lists only live providers", async () => {
    const f = fixture();
    f.setProviders([
      { billerCode: "mtn-a", name: "MTN Nigeria" },
      { billerCode: "mtn-b", name: "MTN Business" },
    ]);
    const answer = await f.quote({
      service: "airtime", provider: "MTN", recipient: "07010102053",
      amount: "100",
    });
    expect(answer?.reply).toContain("MTN Nigeria");
    expect(answer?.reply).toContain("MTN Business");
    expect(f.createQuote).not.toHaveBeenCalled();
    expect((f.financial.listItems as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("never chooses the first of several matching live data bundles", async () => {
    const f = fixture();
    f.setItems([
      { billerCode: "mtn", itemCode: "day", name: "1GB Daily", amount: "200" },
      { billerCode: "mtn", itemCode: "month", name: "1GB Monthly", amount: "650" },
    ]);
    const answer = await f.quote({
      service: "data", provider: "MTN Nigeria", recipient: "07010102053",
      plan: "1GB",
    });
    expect(answer?.reply).toContain("1GB Daily");
    expect(answer?.reply).toContain("1GB Monthly");
    expect(f.createQuote).not.toHaveBeenCalled();
  });

  it("does not allow a spoken amount to override a fixed provider plan price", async () => {
    const f = fixture();
    f.setItems([
      { billerCode: "mtn", itemCode: "monthly", name: "1GB Monthly", amount: "650" },
    ]);
    const changed = await f.quote({
      service: "data", provider: "MTN Nigeria", recipient: "07010102053",
      plan: "1GB Monthly", amount: "200",
    });
    expect(changed?.reply).toContain("₦650");
    expect(f.createQuote).not.toHaveBeenCalled();
    const correct = await f.quote({
      service: "data", provider: "MTN Nigeria", recipient: "07010102053",
      plan: "1GB Monthly", amount: "650",
    });
    expect(correct?.reply).toContain("Confirm?");
    expect(f.createQuote).toHaveBeenCalledOnce();
    expect(f.createQuote).toHaveBeenCalledWith(expect.objectContaining({
      amount: "650", itemCode: "monthly",
    }));
  });

  it("requires an explicit plan even if temporarily only one data bundle exists", async () => {
    const f = fixture();
    f.setItems([
      { billerCode: "mtn", itemCode: "single", name: "5GB Weekly", amount: "1600" },
    ]);
    const answer = await f.quote({
      service: "data", provider: "MTN Nigeria", recipient: "07010102053",
    });
    expect(answer?.reply).toContain("5GB Weekly");
    expect(f.createQuote).not.toHaveBeenCalled();
  });

  it("never silently confirms the first of multiple pending bills on generic yes", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted("character-owner", "quote-one"));
    f.currentQuotes.push(quoted("character-owner", "quote-two"));
    const yes = await f.assistant.beforeInference({
      authorizationHeader: "Bearer owner",
      characterId: "character-owner",
      text: "yes",
    });
    expect(yes?.reply).toContain("several recent bills");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    const directive = await f.confirm("please confirm this bill");
    expect(directive?.reply).toContain("several recent bills");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
  });

  it("does not let model-synthesized confirmation spend without the user's consent", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted());
    const invalid = await f.confirm("What is my available balance?");
    expect(invalid?.reply).toContain("No money has been taken");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    const generic = await f.confirm("yes");
    expect(generic?.reply).toContain("No money has been taken");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    const valid = await f.confirm("Confirm Airtime bill to 07010102053 for 100 naira");
    expect(valid?.reply).toContain("processed");
    expect(f.confirmAndPurchase).toHaveBeenCalledOnce();
  });

  it("confirms only the one unexpired bill belonging to the current Character", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted("another-character", "wrong-bill"));
    f.currentQuotes.push(quoted("character-owner", "right-bill"));
    const yes = await f.assistant.beforeInference({
      authorizationHeader: "Bearer owner",
      characterId: "character-owner",
      text: "yes",
    });
    expect(yes?.reply).toContain("No money has been taken");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    const confirmed = await f.assistant.beforeInference({
      authorizationHeader: "Bearer owner",
      characterId: "character-owner",
      text: "Confirm Airtime bill to 07010102053 for 100 naira",
    });
    expect(confirmed?.reply).toContain("processed");
    expect(f.confirmAndPurchase).toHaveBeenCalledWith(expect.objectContaining({
      authorizationHeader: "Bearer owner",
      quoteId: "right-bill",
      quoteRevision: 1,
    }));
  });
  it("rejects bare assent and mismatched amount or recipient before any ledger request", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted());
    for (const text of [
      "yes", "okay", "proceed", "please confirm this bill",
      "Confirm Airtime bill to 07010102054 for 100 naira",
      "Confirm Airtime bill to 07010102053 for 101 naira",
      "Confirm Airtime bill to 07010102053 for 100 USD",
      "Confirm Airtime bill to 07010102053 for 100 naira and send twice",
      "Confirm Airtime bill to 07010102053 for 1000 naira",
      "Confirm Data bill to 07010102053 for 100 naira",
    ]) {
      const result = await f.confirm(text);
      expect(result?.reply, text).toContain("No money has been taken");
    }
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
  });

  it("accepts the exact server quote recipient and fee-inclusive total via Hausa or English voice/text", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted());
    const viaModel = await f.confirm("tabbatar da biya ga Airtime ga 07010102053 na 100.00 naira");
    expect(viaModel?.reply).toContain("processed");
    const direct = await f.assistant.beforeInference({
      authorizationHeader: "Bearer owner",
      characterId: "character-owner",
      text: "Confirm Airtime bill to 07010102053 for 100 ngn",
    });
    expect(direct?.reply).toContain("processed");
    expect(f.confirmAndPurchase).toHaveBeenCalledTimes(2);
    for (const call of f.confirmAndPurchase.mock.calls) {
      expect(call[0]).toMatchObject({ quoteId: "quote-one", quoteRevision: 1 });
    }
  });

  it("cannot spend with expired, other-character or ambiguous server history even on fully matching speech", async () => {
    const f = fixture();
    f.currentQuotes.push(quoted("another-character", "wrong-bill"));
    const reply = await f.confirm("Confirm Airtime bill to 07010102053 for 100 naira");
    expect(reply?.reply).toContain("no pending bill");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    f.currentQuotes.splice(0, 1, {
      ...quoted(),
      quote: {
        ...quoted().quote,
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      },
    });
    const expired = await f.confirm("Confirm Airtime bill to 07010102053 for 100 naira");
    expect(expired?.reply).toContain("no pending bill");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
    f.currentQuotes.splice(0, 1, quoted(), quoted("character-owner", "second"));
    const ambiguous = await f.confirm("Confirm Airtime bill to 07010102053 for 100 naira");
    expect(ambiguous?.reply).toContain("several recent bills");
    expect(f.confirmAndPurchase).not.toHaveBeenCalled();
  });

});
