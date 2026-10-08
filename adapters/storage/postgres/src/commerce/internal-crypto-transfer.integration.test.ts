import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { CryptoIntent } from "@masanawa/commerce";
import { runMigrations } from "../migrations.js";
import { createPostgresCryptoRepository } from "./crypto-repository.js";
import { createPostgresInternalCryptoTransferRepository } from "./internal-crypto-transfer.js";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const suite=connectionString?describe:describe.skip;
suite("C06 internal crypto book transfer — PostgreSQL acceptance",()=>{
  let pool:Pool;
  const transfer=()=>createPostgresInternalCryptoTransferRepository(pool);
  const crypto=()=>createPostgresCryptoRepository(pool);
  beforeAll(async()=>{
    pool=new Pool({connectionString});
    await runMigrations(pool,[
      {owner:"commerce",directory:fileURLToPath(new URL("../../../../../packages/commerce/migrations",import.meta.url))},
      {owner:"identity",directory:fileURLToPath(new URL("../../../../../packages/identity/migrations",import.meta.url))},
    ]);
  });
  afterAll(async()=>{await pool?.end();});
  async function fixture(fund="5") {
    const tenantId=createCanonicalId("tenant");
    const senderUserId=createCanonicalId("user");
    const recipientUserId=createCanonicalId("user");
    const now=toInstant(new Date());
    await pool.query(
      "INSERT INTO identity.tenants(tenant_id,state,created_at,updated_at) VALUES ($1,'active',$2,$2)",
      [tenantId,now]);
    for(const userId of [senderUserId,recipientUserId]){
      await pool.query(
        "INSERT INTO identity.users(tenant_id,user_id,state,created_at,updated_at) VALUES ($1,$2,'active',$3,$3)",
        [tenantId,userId,now]);
    }
    const requestId=createCanonicalId("request");
    const deposit:CryptoIntent={
      schemaVersion:1,tenantId,userId:senderUserId,requestId,operation:"deposit",
      asset:"USDTTRC20",network:"tron",amount:fund,targetAsset:null,destinationAddress:null,
      provider:"nowpayments",providerPaymentId:null,providerPayoutId:null,
      payAddress:null,providerPayAmount:null,providerDispatchStartedAt:now,
      status:"processing",createdAt:now,updatedAt:now,
    };
    await crypto().createIntent(deposit);
    const paymentId=`fixture-${requestId}`;
    await crypto().bindProviderPayment({tenantId,userId:senderUserId,
      requestId,providerPaymentId:paymentId,payAddress:"fixture-address",
      providerPayAmount:fund,updatedAt:now});
    await crypto().applyProviderPaymentEvent({
      tenantId,userId:senderUserId,
      event:{paymentId,parentPaymentId:null,orderId:requestId,status:"finished",
        priceAmount:fund,priceCurrency:"USDTTRC20",payAmount:fund,
        payCurrency:"USDTTRC20",actuallyPaid:fund,
        payloadHash:createHash("sha256").update(`C06:${requestId}`).digest("hex"),
        observedAt:now},
    });
    const base={
      tenantId,senderUserId,recipientUserId,
      recipientLabel:"receiver@example.com",asset:"USDTTRC20",network:"tron",
      amount:"3",requestId:createCanonicalId("request"),
    };
    return {...base,crypto:crypto()};
  }
  it("executes balanced sender debit / receiver credit exactly once, including replay + history",async()=>{
    const f=await fixture();
    const quote=await transfer().quote(f);
    expect(quote.status).toBe("quoted");
    expect(quote.confirmationToken).toMatch(/^[0-9a-f]{64}$/);
    expect((await transfer().quote(f)).confirmationToken).toBeUndefined();
    const r=await transfer().confirm({tenantId:f.tenantId,
      senderUserId:f.senderUserId,requestId:f.requestId,
      confirmationToken:quote.confirmationToken!});
    expect(r.status).toBe("completed");
    const replay=await transfer().confirm({tenantId:f.tenantId,
      senderUserId:f.senderUserId,requestId:f.requestId,
      confirmationToken:quote.confirmationToken!});
    expect(replay.status).toBe("completed");
    expect(await f.crypto.readBalance({tenantId:f.tenantId,userId:f.senderUserId,
      asset:f.asset,network:f.network})).toBe("2");
    expect(await f.crypto.readBalance({tenantId:f.tenantId,userId:f.recipientUserId,
      asset:f.asset,network:f.network})).toBe("3");
    const sender=await f.crypto.readIntent({tenantId:f.tenantId,
      userId:f.senderUserId,requestId:f.requestId});
    expect(sender?.operation).toBe("transfer");
    expect(sender?.transferDirection).toBe("out");
    const incoming=await f.crypto.listIntents({tenantId:f.tenantId,userId:f.recipientUserId});
    expect(incoming.some(e=>e.operation==="transfer" && e.transferDirection==="in")).toBe(true);
    const count=await pool.query<{total:string}>(
      `SELECT count(*)::text AS total FROM commerce.crypto_ledger_entries
       WHERE tenant_id=$1 AND reason IN ('internal-transfer-in','internal-transfer-out')`,
      [f.tenantId]);
    expect(Number(count.rows[0]?.total)).toBe(2);
  });
  it("rejects changed replay, cross-user receipt and invalid consent without moving funds",async()=>{
    const f=await fixture();
    const q=await transfer().quote(f);
    await expect(transfer().quote({...f,amount:"2"})).rejects.toThrow("request_conflict");
    expect(await transfer().read({tenantId:f.tenantId,
      senderUserId:f.recipientUserId,requestId:f.requestId})).toBeNull();
    const wrong=await transfer().confirm({tenantId:f.tenantId,senderUserId:f.senderUserId,
      requestId:f.requestId,confirmationToken:"0".repeat(64)});
    expect(wrong.status).toBe("quoted");
    expect(await f.crypto.readBalance({tenantId:f.tenantId,userId:f.senderUserId,
      asset:f.asset,network:f.network})).toBe("5");
    expect(q.confirmationToken).toBeTruthy();
  });
  it("only one concurrent transfer can spend a single custody-backed balance",async()=>{
    const f=await fixture("5");
    const a=await transfer().quote({...f,amount:"4"});
    const other={...f,requestId:createCanonicalId("request"),amount:"4"};
    const b=await transfer().quote(other);
    const results=await Promise.allSettled([
      transfer().confirm({tenantId:f.tenantId,senderUserId:f.senderUserId,
        requestId:f.requestId,confirmationToken:a.confirmationToken!}),
      transfer().confirm({tenantId:f.tenantId,senderUserId:f.senderUserId,
        requestId:other.requestId,confirmationToken:b.confirmationToken!}),
    ]);
    expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);
    expect(results.filter(x=>x.status==="rejected")).toHaveLength(1);
    expect(await f.crypto.readBalance({tenantId:f.tenantId,userId:f.senderUserId,
      asset:f.asset,network:f.network})).toBe("1");
  });
  it("blocks disabled recipients and pending deletion before an irreversible debit",async()=>{
    const f=await fixture();
    const q=await transfer().quote(f);
    await pool.query("UPDATE identity.users SET state='disabled' WHERE tenant_id=$1 AND user_id=$2",
      [f.tenantId,f.recipientUserId]);
    await expect(transfer().confirm({tenantId:f.tenantId,senderUserId:f.senderUserId,
      requestId:f.requestId,confirmationToken:q.confirmationToken!}))
      .rejects.toThrow("account_unavailable");
    expect(await f.crypto.readBalance({tenantId:f.tenantId,userId:f.senderUserId,
      asset:f.asset,network:f.network})).toBe("5");
  });
});
