import { describe, expect, it } from "vitest";
import { admitMsnSettlement, type MsnConversionQuote, type MsnProviderSettlement } from "./admission.js";
import { createMsnLedgerStore, type MsnPgPool } from "./store.js";

const quote: MsnConversionQuote = {
  quoteId:"q1", tenantId:"t1", userId:"u1",
  fundingRail:"NGN_FLUTTERWAVE", fundingReference:"f1", ngnFundingKobo:25000n,
  backingAsset:"USDTTRC20", backingNetwork:"tron",
  minimumSettledBackingUsdMicro:1000000n, pricePerMsnUsdMicro:250000n,
  providerQuoteReference:"pq1", issuedAtMs:1000, expiresAtMs:5000,
};
const settlement: MsnProviderSettlement = {
  tenantId:"t1", userId:"u1", quoteId:"q1", fundingReference:"f1",
  providerSettlementId:"custody1", providerQuoteReference:"pq1",
  backingAsset:"USDTTRC20", backingNetwork:"tron",
  settledBackingUsdMicro:1000000n, verifiedNgnFundingKobo:25000n, settledAtMs:4000,
};
const admission = admitMsnSettlement({
  quote, settlement, nowMs:6000, qualifiedProvider:true,
  custodyBackingVerified:true, conversionLicensedAndAvailable:true,
  accountPolicyApproved:true,
});
const evidence = "a".repeat(64);

function fixture(mode: "new" | "duplicate" | "insufficient" | "no-receipt" |
  "no-quote" | "wrong-quote" | "unverified" | "provider-mismatch" |
  "wrong-intent" = "new") {
  const statements: string[] = [];
  const query = async (sql: string, _params?: unknown[]) => {
    statements.push(sql);
    if (sql.includes("FROM commerce.msn_funding_quotes q"))
      return { rows: mode === "no-quote" ? [] : [{
        user_id: "u1", funding_rail: "NGN_FLUTTERWAVE",
        funding_reference: "f1", ngn_funding_kobo: "25000",
        backing_asset: "USDTTRC20", backing_network: "tron",
        minimum_backing: "1000000",
        price: mode === "wrong-quote" ? "1" : "250000",
        provider_quote_reference: "pq1",
        issued_at: new Date(1000), expires_at: new Date(5000),
        verified_provider_id: mode === "unverified" ? null : "123",
      }], rowCount: 1 };
    if (sql.includes("INSERT INTO commerce.msn_issuances"))
      return { rows: [], rowCount: mode === "duplicate" ? 0 : 1 };
    if (sql.includes("FROM commerce.ngn_funding_intents"))
      return { rows: mode === "no-receipt" ? [] :
        [{ amount_kobo:"25000",provider_transaction_id:
          mode === "provider-mismatch" ? "999" : "123",state:"credited",
          quote_id:mode === "wrong-intent" ? "someone-else" : "q1" }], rowCount:1 };
    if (sql.includes("FROM commerce.ngn_wallet_entries"))
      return { rows: [{ balance: mode === "insufficient" ? "24999" : "25000" }], rowCount:1 };
    if (sql.includes("FROM commerce.msn_issuances"))
      return { rows: [{
        tenant_id:"t1",user_id:"u1",quote_id:"q1",funding_reference:"f1",
        provider_settlement_id:"custody1",backing_asset:"USDTTRC20",backing_network:"tron",
        backing_usd_micro:"1000000",msn_credit_micro:"4000000",
        price_per_msn_usd_micro:"250000",ngn_funding_kobo:"25000",
        verified_evidence_sha256:evidence,
      }], rowCount:1 };
    return { rows: [{ balance:"4000000" }], rowCount:1 };
  };
  const pool: MsnPgPool = {
    query,
    connect: async () => ({ query, release() { statements.push("RELEASE"); } }),
  };
  return { statements, store:createMsnLedgerStore(pool) };
}

describe("MSN ledger atomicity and replay", () => {
  it("consumes the settled NGN ledger before issuing balanced MSN", async () => {
    const f = fixture();
    expect(await f.store.issue({quote,admission,verifiedEvidenceSha256:evidence}))
      .toEqual({quoteId:"q1",msnCreditMicro:"4000000",replay:false});
    const log=f.statements.join("\n");
    for (const phrase of ["pg_advisory_xact_lock","FROM commerce.ngn_funding_intents",
      "FROM commerce.ngn_wallet_entries","INSERT INTO commerce.ngn_wallet_entries",
      "INSERT INTO commerce.msn_ledger_entries","COMMIT"])
      expect(log).toContain(phrase);
    expect(log).not.toContain("ROLLBACK");
  });
  it.each([
    ["no-quote","msn.quote.persisted_terms_mismatch"],
    ["wrong-quote","msn.quote.persisted_terms_mismatch"],
    ["unverified","msn.ngn.fiat_verification_missing"],
    ["provider-mismatch","msn.ngn.funding_not_settled"],
    ["wrong-intent","msn.ngn.funding_not_settled"],
  ] as const)("rejects %s instead of minting against unbound evidence", async (mode, code) => {
    const f=fixture(mode);
    await expect(f.store.issue({quote,admission,verifiedEvidenceSha256:evidence}))
      .rejects.toThrow(code);
    const sql=f.statements.join("\n");
    expect(sql).toContain("ROLLBACK");
    expect(sql).not.toContain("INSERT INTO commerce.msn_ledger_entries");
    expect(sql).not.toContain("INSERT INTO commerce.ngn_wallet_entries");
  });
  it("locks the canonical credited intent before reserving the NGN wallet", async () => {
    const f=fixture();
    await f.store.issue({quote,admission,verifiedEvidenceSha256:evidence});
    const intent=f.statements.findIndex(x=>x.includes("FROM commerce.ngn_funding_intents"));
    const wallet=f.statements.findIndex(x=>x.includes("pg_advisory_xact_lock"));
    expect(intent).toBeGreaterThan(-1);
    expect(wallet).toBeGreaterThan(intent);
    expect(f.statements.join("\n")).toContain("FROM commerce.msn_funding_quotes q");
  });
  it("replays without a second NGN debit/MSN credit", async () => {
    const f=fixture("duplicate");
    expect(await f.store.issue({quote,admission,verifiedEvidenceSha256:evidence}))
      .toMatchObject({replay:true});
    expect(f.statements.join("\n")).not.toContain("INSERT INTO commerce.ngn_wallet_entries");
    expect(f.statements.join("\n")).not.toContain("INSERT INTO commerce.msn_ledger_entries");
  });
  it.each(["insufficient","no-receipt"] as const)("rolls back %s before mint", async (mode)=>{
    const f=fixture(mode);
    await expect(f.store.issue({quote,admission,verifiedEvidenceSha256:evidence})).rejects.toThrow();
    expect(f.statements).toContain("ROLLBACK");
    expect(f.statements.join("\n")).not.toContain("INSERT INTO commerce.msn_ledger_entries");
  });
  it("does not double-count customer crypto deposits", async ()=>{
    const f=fixture();
    await expect(f.store.issue({
      quote:{...quote,fundingRail:"NOWPAYMENTS_CRYPTO",ngnFundingKobo:null},
      admission,verifiedEvidenceSha256:evidence,
    })).rejects.toThrow("msn.crypto.reservation_not_composed");
    expect(f.statements).toEqual([]);
  });
  it("rejects fake settlement proof hashes before database writes", async ()=>{
    const f=fixture();
    await expect(f.store.issue({quote,admission,verifiedEvidenceSha256:"fake"}))
      .rejects.toThrow("msn.evidence.hash_required");
    expect(f.statements).toEqual([]);
  });
  it("returns exact authoritative MSN micros, not a numeric float", async ()=>{
    const f=fixture();
    expect(await f.store.readBalance("t1","u1"))
      .toEqual({asset:"MSN",spendableMicro:"4000000"});
  });
});
