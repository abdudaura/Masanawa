import { describe, expect, it, vi } from "vitest";
import type { MsnConversionQuote } from "./admission.js";
import type { MsnFiatIntakeRecord } from "./fiat_intake_pg.js";
import { verifyMsnFiatIntake } from "./fiat_intake.js";

const quote: MsnConversionQuote = {
  quoteId: "msn-quote-a", tenantId: "tenant-a", userId: "fan-a",
  fundingRail: "NGN_FLUTTERWAVE", fundingReference: "fund-a",
  ngnFundingKobo: 15_025n, backingAsset: "USDTTRC20",
  backingNetwork: "tron", minimumSettledBackingUsdMicro: 1_000_000n,
  pricePerMsnUsdMicro: 500_000n, providerQuoteReference: "custody-quote-a",
  issuedAtMs: 1_000, expiresAtMs: 60_000,
};
const record: MsnFiatIntakeRecord = {
  tenantId: "tenant-a", userId: "fan-a",
  fundingReference: "fund-a", quoteId: "msn-quote-a",
  txRef: "flw-tx-a", amountKobo: 15_025n, state: "credited",
  providerTransactionId: "921", providerReference: "FLW-921",
};
const payment = {
  txRef: "flw-tx-a", transactionId: "921", providerReference: "FLW-921",
  status: "successful", amount: "150.25", currency: "NGN",
};
function fixture(changes: {
  readonly quote?: Partial<MsnConversionQuote>;
  readonly record?: Partial<MsnFiatIntakeRecord> | null;
  readonly payment?: Partial<typeof payment>;
} = {}) {
  const stored = changes.record === null ? null : { ...record, ...changes.record };
  const read = vi.fn(async () => stored);
  const verifyByReference = vi.fn(async () => ({ ...payment, ...changes.payment }));
  const args = { quote: { ...quote, ...changes.quote }, reader: { read },
    provider: { verifyByReference }, observedAtMs: 60_000 };
  return { args, read, verifyByReference };
}

describe("MSN fiat provider verification (never custody/issuance)", () => {
  it("independently verifies exact Flutterwave reference, kobo and credited PostgreSQL ledger", async () => {
    const f = fixture();
    const v = await verifyMsnFiatIntake(f.args);
    expect(v).toMatchObject({
      state: "fiat_verified_backing_pending", quoteId: "msn-quote-a",
      fundingKobo: "15025", providerTransactionId: "921",
      tenantId: "tenant-a", userId: "fan-a",
    });
    expect(v.providerVerificationSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(v).not.toHaveProperty("msnCreditMicro");
    expect(v).not.toHaveProperty("custodyBackingVerified");
    expect(f.verifyByReference).toHaveBeenCalledWith("flw-tx-a", undefined);
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.read).toHaveBeenNthCalledWith(1, {
      tenantId: "tenant-a", userId: "fan-a", fundingReference: "fund-a",
    });
    expect(Object.isFrozen(v)).toBe(true);
  });

  it.each([
    ["pending payment", { state: "awaiting" as const }],
    ["expired payment", { state: "expired" as const }],
    ["foreign user", { userId: "fan-b" }],
    ["foreign tenant", { tenantId: "tenant-b" }],
    ["another quote", { quoteId: "msn-quote-b" }],
    ["different funding", { fundingReference: "fund-b" }],
    ["amount mismatch", { amountKobo: 15_024n }],
    ["no provider transaction", { providerTransactionId: null }],
    ["no quote link", { quoteId: null }],
  ])("refuses %s before contacting provider", async (_, change) => {
    const f = fixture({ record: change });
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow("not_qualified");
    expect(f.verifyByReference).not.toHaveBeenCalled();
  });

  it.each([
    ["redirect-as-payment", { status: "pending" }],
    ["wrong provider reference", { txRef: "attacker" }],
    ["wrong currency", { currency: "USD" }],
    ["underpayment", { amount: "150.24" }],
    ["overpayment", { amount: "150.26" }],
    ["fractional kobo", { amount: "150.251" }],
    ["wrong transaction", { transactionId: "922" }],
    ["changed provider ref", { providerReference: "FLW-X" }],
  ])("rejects %s from provider readback", async (_, change) => {
    const f = fixture({ payment: change });
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow(/msn.fiat_intake/);
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it("never trusts an internal credited row when provider verification is unavailable", async () => {
    const f = fixture();
    f.verifyByReference.mockRejectedValueOnce(new Error("Flutterwave connection failed"));
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow("Flutterwave");
    expect(f.read).toHaveBeenCalledTimes(1);
  });

  it("rejects a changed credit row after the provider returns", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce(record).mockResolvedValueOnce({ ...record, state: "failed" });
    await expect(verifyMsnFiatIntake(f.args))
      .rejects.toThrow("msn.fiat_intake.changed_during_verification");
  });

  it("rejects disappearance and provider-id change during readback", async () => {
    const gone = fixture();
    gone.read.mockResolvedValueOnce(record).mockResolvedValueOnce(null);
    await expect(verifyMsnFiatIntake(gone.args))
      .rejects.toThrow("changed_during_verification");
    const changed = fixture();
    changed.read.mockResolvedValueOnce(record).mockResolvedValueOnce({
      ...record, providerTransactionId: "923",
    });
    await expect(verifyMsnFiatIntake(changed.args))
      .rejects.toThrow("changed_during_verification");
  });

  it("does not fabricate a crypto/fiat price or admit another funding rail", async () => {
    const f = fixture({ quote: { fundingRail: "NOWPAYMENTS_CRYPTO", ngnFundingKobo: null } });
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow("quote_invalid");
    expect(f.read).not.toHaveBeenCalled();
  });
  it("does not re-interpret a malformed executable quote", async () => {
    const f = fixture({ quote: { pricePerMsnUsdMicro: 0n } });
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow("quote_invalid");
    expect(f.read).not.toHaveBeenCalled();
  });
  it("returns not-found without leaking other tenants' stored funding", async () => {
    const f = fixture({ record: null });
    await expect(verifyMsnFiatIntake(f.args)).rejects.toThrow("not_found");
    expect(f.verifyByReference).not.toHaveBeenCalled();
  });
});
