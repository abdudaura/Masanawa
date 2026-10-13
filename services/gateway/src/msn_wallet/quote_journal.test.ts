import {describe,expect,it,vi} from "vitest";
import type { MsnConversionQuote } from "./admission.js";
import {createMsnFundingJournal} from "./quote_journal.js";
import type {MsnPgPool} from "./store.js";

const quote:MsnConversionQuote={
  quoteId:"quote1",tenantId:"tenant1",userId:"user1",
  fundingReference:"fund1",fundingRail:"NGN_FLUTTERWAVE",
  ngnFundingKobo:15025n,backingAsset:"USDTTRC20",backingNetwork:"tron",
  minimumSettledBackingUsdMicro:1000000n,pricePerMsnUsdMicro:500000n,
  providerQuoteReference:"providerquote1",issuedAtMs:1000,expiresAtMs:50000,
};
const hash="a".repeat(64);
function dbRow(overrides:Record<string,unknown>={}):Record<string,unknown>{
  return {
    tenant_id:quote.tenantId,user_id:quote.userId,quote_id:quote.quoteId,
    funding_reference:quote.fundingReference,funding_rail:quote.fundingRail,
    ngn_funding_kobo:"15025",backing_asset:quote.backingAsset,
    backing_network:quote.backingNetwork,
    minimum_settled_backing_usd_micro:"1000000",
    price_per_msn_usd_micro:"500000",provider_quote_reference:quote.providerQuoteReference,
    pricing_evidence_sha256:hash,
    issued_at:new Date(quote.issuedAtMs),expires_at:new Date(quote.expiresAtMs),
    provider_transaction_id:null,issued_msn_micro:null,...overrides,
  };
}
function fixture(row:Record<string,unknown>|null=dbRow()){
  const statements:string[]=[];let released=0;
  const query=vi.fn(async(sql:string)=>{
    statements.push(sql);
    if(sql.includes("SELECT q.tenant_id"))return{rows:row?[row]:[],rowCount:row?1:0};
    return{rows:[],rowCount:1};
  });
  const pool:MsnPgPool={
    query,
    connect:async()=>({query,release(){released++;}}),
  };
  return {store:createMsnFundingJournal(pool),query,statements,released:()=>released};
}
describe("MSN quote journal source boundaries",()=>{
  it("stores immutable exact quote and checks same-economics replay",async()=>{
    const f=fixture();
    await f.store.saveQuote(quote,hash);
    expect(f.statements.join("\n")).toContain("INSERT INTO commerce.msn_funding_quotes");
    expect(f.statements).toContain("COMMIT");
    expect(f.released()).toBe(1);
  });
  it("rejects changed price, changed identity and evidence hash on replay",async()=>{
    const f=fixture();
    await expect(f.store.saveQuote({...quote,pricePerMsnUsdMicro:600000n},hash))
      .rejects.toThrow("msn.quote.replay_conflict");
    expect(f.statements).toContain("ROLLBACK");
    const other=fixture();
    await expect(other.store.saveQuote(quote,"b".repeat(64)))
      .rejects.toThrow("msn.quote.replay_conflict");
  });
  it("fails before DB calls for invalid price, missing proof and inconsistent rail",async()=>{
    const f=fixture();
    await expect(f.store.saveQuote({...quote,pricePerMsnUsdMicro:0n},hash)).rejects.toThrow();
    await expect(f.store.saveQuote(quote,"not-source-proof")).rejects.toThrow();
    await expect(f.store.saveQuote({...quote,fundingRail:"NOWPAYMENTS_CRYPTO"},hash)).rejects.toThrow();
    expect(f.statements).toEqual([]);
  });
  it("reads pending only if there is a real quote, without invented issuance",async()=>{
    const f=fixture();
    const r=await f.store.listStatus("tenant1","user1");
    expect(r).toEqual([{
      quoteId:"quote1",fundingRail:"NGN_FLUTTERWAVE",
      fundingReference:"fund1",ngnFundingKobo:"15025",
      backingAsset:"USDTTRC20",backingNetwork:"tron",
      state:"awaiting_verified_funding",issuedMsnMicro:null,
      issuedAt:"1970-01-01T00:00:01.000Z",
      expiresAt:"1970-01-01T00:00:50.000Z",
    }]);
    expect(f.query.mock.calls[0]![1]).toEqual(["tenant1","user1"]);
  });
  it("distinguishes provider-verified fiat without asserting custody",async()=>{
    const f=fixture(dbRow({provider_transaction_id:"921"}));
    const [v]=await f.store.listStatus("tenant1","user1");
    expect(v?.state).toBe("fiat_verified_backing_pending");
    expect(v?.issuedMsnMicro).toBeNull();
  });
  it("shows minted units only when joined to actual issuance journal",async()=>{
    const f=fixture(dbRow({issued_msn_micro:"4000000"}));
    const [v]=await f.store.listStatus("tenant1","user1");
    expect(v?.state).toBe("backed_issued");
    expect(v?.issuedMsnMicro).toBe("4000000");
  });
  it("isolates absent quotes and rejects foreign identity before SQL",async()=>{
    const f=fixture(null);
    expect(await f.store.listStatus("tenant1","user1")).toEqual([]);
    await expect(f.store.listStatus("tenant 1","user1")).rejects.toThrow("identity_invalid");
  });
  it("denies late fiat promotion before provider or SQL writes",async()=>{
    const f=fixture();
    const reader={read:vi.fn()};
    const provider={verifyByReference:vi.fn()};
    await expect(f.store.verifyFiat({
      tenantId:"tenant1",userId:"user1",quoteId:"quote1",
      reader,provider,observedAtMs:50001,
    })).rejects.toThrow("msn.quote.expired");
    expect(reader.read).not.toHaveBeenCalled();
    expect(provider.verifyByReference).not.toHaveBeenCalled();
  });
  it("refuses nonexistent quote without contacting payment provider",async()=>{
    const f=fixture(null);
    const reader={read:vi.fn()};
    const provider={verifyByReference:vi.fn()};
    await expect(f.store.verifyFiat({
      tenantId:"tenant1",userId:"user1",quoteId:"quote1",
      reader,provider,observedAtMs:2000,
    })).rejects.toThrow("msn.quote.not_found");
    expect(provider.verifyByReference).not.toHaveBeenCalled();
  });
});
