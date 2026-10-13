import { randomUUID,randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import type { MsnConversionQuote } from "../../../../../services/gateway/src/msn_wallet/admission.js";
import { createMsnFiatIntakeReader } from "../../../../../services/gateway/src/msn_wallet/fiat_intake_pg.js";
import { createMsnFundingJournal } from "../../../../../services/gateway/src/msn_wallet/quote_journal.js";
import { runMigrations } from "../migrations.js";

const url=process.env.MASANAWA_TEST_DATABASE_URL;
const db=url?describe:describe.skip;
db("AF01 staged MSN immutable quote and verified-fiat journal in actual PG18",()=>{
  let pool:Pool;
  beforeAll(async()=>{
    pool=new Pool({connectionString:url});
    await runMigrations(pool,[{
      owner:"commerce",
      directory:fileURLToPath(new URL("../../../../../packages/commerce/migrations",import.meta.url)),
    }]);
    const ddl=await readFile(fileURLToPath(new URL(
      "../../../../../packages/commerce/migration_proposals/0112_msn_wallet.sql",
      import.meta.url,
    )),"utf8");
    await pool.query(ddl);
  });
  afterAll(async()=>{await pool?.end();});

  async function seed(){
    const tenantId=randomUUID(),userId=randomUUID(),quoteId=randomUUID();
    const fundingReference=randomUUID(),txRef=randomUUID();
    const providerTransactionId=String(randomInt(1_000_000_000,2_000_000_000));
    const nowMs=Date.now(),expiresAtMs=nowMs+60_000;
    const quote:MsnConversionQuote={
      quoteId,tenantId,userId,fundingRail:"NGN_FLUTTERWAVE",
      fundingReference,ngnFundingKobo:15025n,backingAsset:"USDTTRC20",
      backingNetwork:"tron",minimumSettledBackingUsdMicro:1000000n,
      pricePerMsnUsdMicro:500000n,providerQuoteReference:randomUUID(),
      issuedAtMs:nowMs-60_000,expiresAtMs,
    };
    const journal=createMsnFundingJournal(pool);
    await journal.saveQuote(quote,"a".repeat(64)); // fixture-only synthetic pricing proof
    const pg=await pool.connect();
    try{
      await pg.query("BEGIN");
      await pg.query(
        `INSERT INTO commerce.ngn_funding_intents
         (tenant_id,user_id,funding_reference,tx_ref,amount_kobo,quote_id,
          state,account_number,bank_name,provider_transaction_id,provider_reference,
          expires_at,created_at,updated_at)
         VALUES($1,$2,$3,$4,15025,$5,'credited','0000000000','TEST BANK',
                $6,'FLW-Q',now()+interval '1 hour',now(),now())`,
        [tenantId,userId,fundingReference,txRef,quoteId,providerTransactionId],
      );
      await pg.query(
        `INSERT INTO commerce.ngn_wallet_entries
         (tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,
          provider_transaction_id,created_at)
         VALUES ($1,$2,$3,'credit',15025,'funding',$4,$5,now())`,
        [tenantId,userId,"fund:"+txRef,fundingReference,providerTransactionId],
      );
      await pg.query("COMMIT");
    }catch(e){await pg.query("ROLLBACK").catch(()=>undefined);throw e;
    }finally{pg.release();}
    const provider={async verifyByReference(ref:string){
      expect(ref).toBe(txRef);
      return {txRef,transactionId:providerTransactionId,
        providerReference:"FLW-Q",status:"successful",amount:"150.25",
        currency:"NGN"};
    }};
    return {journal,quote,provider,nowMs,providerTransactionId};
  }

  it("persists exact quote and replays identical terms, rejects malicious quote mutations",async()=>{
    const {journal,quote}=await seed();
    await journal.saveQuote(quote,"a".repeat(64));
    await expect(journal.saveQuote({
      ...quote,pricePerMsnUsdMicro:1n,
    },"a".repeat(64))).rejects.toThrow("msn.quote.replay_conflict");
    const item=await pool.query(
      "SELECT price_per_msn_usd_micro::text AS price FROM commerce.msn_funding_quotes WHERE tenant_id=$1 AND quote_id=$2",
      [quote.tenantId,quote.quoteId],
    );
    expect(item.rows[0]?.price).toBe("500000");
    await expect(pool.query(
      "UPDATE commerce.msn_funding_quotes SET price_per_msn_usd_micro=1 WHERE tenant_id=$1 AND quote_id=$2",
      [quote.tenantId,quote.quoteId],
    )).rejects.toThrow("MSN ledger/issuance is append-only");
  });

  it("reconciles canonical Flutterwave receipt into immutable pending event, never mints MSN",async()=>{
    const {journal,quote,provider,nowMs}=await seed();
    const first=await journal.listStatus(quote.tenantId,quote.userId);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      state:"awaiting_verified_funding",issuedMsnMicro:null,ngnFundingKobo:"15025",
    });
    const args={tenantId:quote.tenantId,userId:quote.userId,
      quoteId:quote.quoteId,reader:createMsnFiatIntakeReader(pool),
      provider,observedAtMs:nowMs};
    const verified=await journal.verifyFiat(args);
    expect(verified.state).toBe("fiat_verified_backing_pending");
    expect(verified.issuedMsnMicro).toBeNull();
    const same=await journal.verifyFiat(args);
    expect(same.state).toBe("fiat_verified_backing_pending");
    expect(await journal.listStatus(randomUUID(),quote.userId)).toEqual([]);
    expect(await journal.listStatus(quote.tenantId,randomUUID())).toEqual([]);
    const issuances=await pool.query(
      "SELECT count(*)::int AS n FROM commerce.msn_issuances WHERE tenant_id=$1",
      [quote.tenantId],
    );
    expect(issuances.rows[0]?.n).toBe(0);
    const rows=await pool.query(
      "SELECT count(*)::int AS n FROM commerce.msn_fiat_verifications WHERE tenant_id=$1",
      [quote.tenantId],
    );
    expect(rows.rows[0]?.n).toBe(1);
    await expect(pool.query(
      "DELETE FROM commerce.msn_fiat_verifications WHERE tenant_id=$1",
      [quote.tenantId],
    )).rejects.toThrow("MSN ledger/issuance is append-only");
  });

  it("provider underpayment cannot produce a fiat event or consume NGN",async()=>{
    const {journal,quote,provider,nowMs}=await seed();
    await expect(journal.verifyFiat({
      tenantId:quote.tenantId,userId:quote.userId,quoteId:quote.quoteId,
      reader:createMsnFiatIntakeReader(pool),observedAtMs:nowMs,
      provider:{async verifyByReference(ref){
        const paid=await provider.verifyByReference(ref);
        return {...paid,amount:"150.24"};
      }},
    })).rejects.toThrow("msn.fiat_intake.provider_mismatch");
    const count=await pool.query(
      "SELECT count(*)::int AS n FROM commerce.msn_fiat_verifications WHERE tenant_id=$1",
      [quote.tenantId],
    );
    expect(count.rows[0]?.n).toBe(0);
    const ngn=await pool.query(
      "SELECT count(*)::int AS n FROM commerce.ngn_wallet_entries WHERE tenant_id=$1",
      [quote.tenantId],
    );
    expect(ngn.rows[0]?.n).toBe(1);
  });

  it("funding verification cannot be attributed to a foreign signed-in user",async()=>{
    const {journal,quote,provider,nowMs}=await seed();
    await expect(journal.verifyFiat({
      tenantId:quote.tenantId,userId:randomUUID(),quoteId:quote.quoteId,
      reader:createMsnFiatIntakeReader(pool),provider,observedAtMs:nowMs,
    })).rejects.toThrow("msn.quote.not_found");
  });
});
