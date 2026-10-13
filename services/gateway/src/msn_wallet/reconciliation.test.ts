import { describe, expect, it, vi } from "vitest";
import { createMsnReconciler } from "./reconciliation.js";
import type { MsnPgPool } from "./store.js";

function row(extra: Record<string, unknown> = {}) {
  return {
    quote_id: "q1", user_id: "u1", funding_rail: "NGN_FLUTTERWAVE",
    funding_reference: "f1", expected_ngn_kobo: "10000",
    quote_price: "500000", quote_asset: "USDTTRC20", quote_network: "tron",
    verified_provider_id: null, custody_claim_id: null,
    issuance_funding_reference: null, issuance_asset: null,
    issuance_network: null, issuance_ngn_kobo: null, issuance_price: null,
    issuance_backing: null, issuance_credit: null,
    funding_state: "credited", funding_provider_id: "123",
    funding_amount_kobo: "10000",
    ledger_sides: "0", ledger_total: "0",
    ledger_customer: "0", ledger_platform: "0",
    ngn_debit_entries: "0", ngn_valid_debits: "0", ngn_debited_kobo: "0",
    ...extra,
  };
}
function fixture(rows: Record<string, unknown>[]) {
  const queries: string[] = [];
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    queries.push(sql);
    return { rows: sql.includes("SELECT q.quote_id") ? rows : [], rowCount: 1 };
  });
  let releases = 0;
  const pool: MsnPgPool = {
    query,
    connect: async () => ({ query, release() { releases++; } }),
  };
  return { runner: createMsnReconciler(pool), query, queries, released: () => releases };
}
const issued = {
  verified_provider_id: "123", custody_claim_id: "custody1",
  issuance_funding_reference: "f1", issuance_asset: "USDTTRC20",
  issuance_network: "tron", issuance_ngn_kobo: "10000",
  issuance_price: "500000", issuance_backing: "1000000",
  issuance_credit: "2000000", ledger_sides: "2", ledger_total: "0",
  ledger_customer: "2000000", ledger_platform: "-2000000",
  ngn_debit_entries: "1", ngn_valid_debits: "1", ngn_debited_kobo: "10000",
};
describe("staged MSN worker reconciliation boundaries", () => {
  it("treats fiat settlement as backing pending, never qualified custody", async () => {
    const f = fixture([row({ verified_provider_id: "123" })]);
    expect(await f.runner.scan("t1")).toEqual({
      scanned: 1, truncated: false,
      results: [{ quoteId: "q1", state: "backing_pending",
        reasons: [], custodyQualified: false }],
    });
    expect(f.query.mock.calls.find(x => x[0].includes("SELECT q.quote_id"))?.[1])
      .toEqual(["t1", 51]);
    expect(f.queries[0]).toContain("REPEATABLE READ READ ONLY");
    expect(f.queries).toContain("COMMIT");
    expect(f.released()).toBe(1);
  });
  it("reports a balanced issuance as accounting-only, NOT custody qualification", async () => {
    const f = fixture([row(issued)]);
    expect((await f.runner.scan("t1")).results[0]).toEqual({
      quoteId: "q1", state: "issued_accounting_consistent",
      reasons: [], custodyQualified: false,
    });
  });
  it("detects missing fiat, replayed provider, changed quote and unbalanced entries", async () => {
    const f = fixture([row({
      ...issued, verified_provider_id: null, funding_state: "failed",
      issuance_price: "1000000", ledger_total: "100",
    })]);
    expect((await f.runner.scan("t1")).results[0]).toMatchObject({
      state: "anomaly", reasons: [
        "issuance_without_verified_fiat", "issuance_quote_mismatch",
        "double_entry_mismatch", "funding_not_currently_credited",
      ],
    });
  });
  it("detects conflicting canonical fiat provider and exact price rounding", async () => {
    const f = fixture([row({
      ...issued, funding_provider_id: "forged", issuance_credit: "2000001",
    })]);
    const result = (await f.runner.scan("t1")).results[0];
    expect(result?.reasons).toEqual([
      "issuance_economics_mismatch", "double_entry_mismatch", "fiat_provider_mismatch",
    ]);
  });
  it("detects missing, malformed and duplicated canonical NGN debits", async () => {
    const cases = [
      { ngn_debit_entries: "0", ngn_valid_debits: "0", ngn_debited_kobo: "0" },
      { ngn_debit_entries: "2", ngn_valid_debits: "1", ngn_debited_kobo: "10000" },
      { ngn_debit_entries: "1", ngn_valid_debits: "1", ngn_debited_kobo: "9999" },
      { ngn_debit_entries: "1", ngn_valid_debits: "0", ngn_debited_kobo: "0" },
    ];
    for (const change of cases) {
      const r=await fixture([row({...issued,...change})]).runner.scan("t1");
      expect(r.results[0]).toMatchObject({
        state: "anomaly", custodyQualified: false,
        reasons: ["ngn_conversion_debit_mismatch"],
      });
    }
  });
  it("detects an NGN debit for an unissued quote", async () => {
    const scan=await fixture([row({
      ngn_debit_entries:"1",ngn_valid_debits:"1",ngn_debited_kobo:"10000",
    })]).runner.scan("t1");
    expect(scan.results[0]).toMatchObject({
      state: "anomaly", reasons: ["orphan_ngn_conversion_debit"],
    });
  });
  it("rejects invalid aggregate debit data without silently classifying healthy",async()=>{
    const f=fixture([row({...issued,ngn_valid_debits:"Infinity"})]);
    await expect(f.runner.scan("t1")).rejects.toThrow("invalid_ngn_valid_debits");
    expect(f.queries).toContain("ROLLBACK");
  });
  it("rejects account-scoping bypass and unbounded workloads before opening DB", async () => {
    const f = fixture([]);
    await expect(f.runner.scan("t1 OR TRUE")).rejects.toThrow("invalid_tenant");
    await expect(f.runner.scan("t1", 101)).rejects.toThrow("invalid_limit");
    expect(f.query).not.toHaveBeenCalled();
  });
  it("rolls back an invalid database snapshot and never reports guessed success", async () => {
    const f = fixture([row({ ledger_sides: "NaN" })]);
    await expect(f.runner.scan("t1")).rejects.toThrow("invalid_ledger_sides");
    expect(f.queries).toContain("ROLLBACK");
    expect(f.released()).toBe(1);
  });
  it("enforces a bounded continuation indication without streaming PII", async () => {
    const f = fixture([row(), row({ quote_id: "q2" })]);
    const v = await f.runner.scan("t1", 1);
    expect(v.scanned).toBe(1);
    expect(v.truncated).toBe(true);
    expect(JSON.stringify(v)).not.toContain("user_id");
  });
});
