import { createCanonicalId, parseCanonicalId } from "@masanawa/contracts";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import {
  createTransferConsent, validateInternalTransfer, verifyTransferConsent,
  type InternalTransferReceipt, type InternalTransferTerms,
} from "../../../../services/gateway/src/internal_crypto_transfer_contract.js";

interface QuoteRow {
  tenant_id: string; sender_user_id: string; recipient_user_id: string;
  recipient_label: string; request_id: string; asset: string; network: string | null;
  amount: string; approval_hash: string; failed_attempts: number;
  expires_at: Date; created_at: Date; completed_at: Date | null;
  status: "quoted" | "completed" | "expired" | "rejected";
}
export interface InternalTransferRepository {
  quote(input: InternalTransferTerms): Promise<InternalTransferReceipt>;
  confirm(input: {
    tenantId: string; senderUserId: string; requestId: string;
    confirmationToken: string;
  }): Promise<InternalTransferReceipt>;
  read(input: {
    tenantId: string; senderUserId: string; requestId: string;
  }): Promise<InternalTransferReceipt | null>;
}
function receipt(row: QuoteRow, token?: string): InternalTransferReceipt {
  return {
    requestId: row.request_id, recipientLabel: row.recipient_label,
    asset: row.asset, network: row.network, amount: row.amount,
    fee: "0", status: row.status, expiresAt: row.expires_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    ...(token ? { confirmationToken: token } : {}),
  };
}
async function readQuote(client: PoolClient, tenantId: string, userId: string,
                         requestId: string, lock = false): Promise<QuoteRow | null> {
  const data = await client.query<QuoteRow>(
    `SELECT * FROM commerce.crypto_internal_transfer_quotes
       WHERE tenant_id=$1 AND sender_user_id=$2 AND request_id=$3
       ${lock ? "FOR UPDATE" : ""}`, [tenantId,userId,requestId]);
  return data.rows[0] ?? null;
}
async function assertActivePeople(client: PoolClient, tenantId: string,
                                 sender: string, recipient: string): Promise<void> {
  const rows = await client.query<{user_id:string}>(
    `SELECT user_id FROM identity.users
      WHERE tenant_id=$1 AND user_id IN ($2,$3) AND state='active'
      FOR SHARE`, [tenantId,sender,recipient]);
  if (rows.rowCount !== 2) throw new Error("crypto.transfer.account_unavailable");
  const tenants = await client.query(
    "SELECT tenant_id FROM identity.tenants WHERE tenant_id=$1 AND state='active' FOR SHARE",
    [tenantId]);
  if (tenants.rowCount !== 1) throw new Error("crypto.transfer.tenant_unavailable");
  const deletion = await client.query(
    `SELECT 1 FROM identity.account_deletion_requests
      WHERE tenant_id=$1 AND user_id IN ($2,$3) AND phase <> 'failed' LIMIT 1`,
    [tenantId,sender,recipient]);
  if (deletion.rowCount) throw new Error("crypto.transfer.deletion_pending");
}
async function readBalance(client: PoolClient, input: {
  tenantId:string; senderUserId:string; asset:string; network:string|null;
}): Promise<string> {
  const rows=await client.query<{balance:string}>(
    `SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END),0)::text AS balance
       FROM commerce.crypto_ledger_entries WHERE tenant_id=$1 AND user_id=$2
       AND asset=$3 AND network IS NOT DISTINCT FROM $4`,
    [input.tenantId,input.senderUserId,input.asset,input.network]);
  return rows.rows[0]?.balance ?? "0";
}
async function insertTransferIntent(client: PoolClient,input: {
  tenantId:string; userId:string; requestId:string; asset:string; network:string|null;
  amount:string; direction:"in"|"out"; now:Date;
}):Promise<void> {
  const when=input.now.toISOString();
  const model={schemaVersion:1,tenantId:input.tenantId,userId:input.userId,
    requestId:input.requestId,operation:"transfer",asset:input.asset,
    network:input.network,amount:input.amount,targetAsset:null,targetNetwork:null,
    destinationAddress:null,provider:"nowpayments",providerPaymentId:null,
    providerPayoutId:null,providerInvoiceId:null,checkoutUrl:null,
    providerConversionId:null,providerTargetAmount:null,payAddress:null,
    providerPayAmount:null,providerNetworkFee:null,withdrawalFeePayer:null,
    providerDispatchStartedAt:null,status:"succeeded",transferDirection:input.direction,
    createdAt:when,updatedAt:when};
  const result=await client.query(
    `INSERT INTO commerce.crypto_intents
      (tenant_id,user_id,request_id,operation,asset,network,amount,
       provider,status,definition,created_at,updated_at)
      VALUES ($1,$2,$3,'transfer',$4,$5,$6::numeric,'nowpayments','succeeded',$7::jsonb,$8,$8)`,
    [input.tenantId,input.userId,input.requestId,input.asset,input.network,
     input.amount,JSON.stringify(model),when]);
  if(result.rowCount!==1) throw new Error("crypto.transfer.intent_write_failed");
}
async function insertLedger(client: PoolClient,input: {
  tenantId:string; userId:string; requestId:string; asset:string;
  network:string|null; amount:string; direction:"debit"|"credit"; now:Date;
}):Promise<void>{
  const reason=input.direction==="debit"?"internal-transfer-out":"internal-transfer-in";
  const entry={schemaVersion:1,tenantId:input.tenantId,ledgerEntryId:createCanonicalId("ledger-entry"),
    userId:input.userId,asset:input.asset,network:input.network,
    amount:input.amount,direction:input.direction,reason,requestId:input.requestId,
    providerReference:null,createdAt:input.now.toISOString()};
  const result=await client.query(
    `INSERT INTO commerce.crypto_ledger_entries
       (tenant_id,ledger_entry_id,user_id,asset,network,amount,
        direction,reason,request_id,provider_reference,definition,created_at)
       VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,$9,NULL,$10::jsonb,$11)`,
    [entry.tenantId,entry.ledgerEntryId,entry.userId,entry.asset,entry.network,
     entry.amount,entry.direction,entry.reason,entry.requestId,
     JSON.stringify(entry),entry.createdAt]);
  if(result.rowCount!==1)throw new Error("crypto.transfer.ledger_write_failed");
}
export function createPostgresInternalCryptoTransferRepository(pool: Pool):InternalTransferRepository{
  return {
    async quote(input){
      const terms=validateInternalTransfer(input);
      const consent=createTransferConsent();
      return withTransaction(pool,async client=>{
        await assertActivePeople(client,terms.tenantId,terms.senderUserId,terms.recipientUserId);
        const existing=await readQuote(client,terms.tenantId,terms.senderUserId,terms.requestId);
        if(existing){
          if(existing.recipient_user_id!==terms.recipientUserId ||
             existing.recipient_label!==terms.recipientLabel ||
             existing.asset!==terms.asset || existing.network!==terms.network ||
             Number(existing.amount)!==Number(terms.amount)) {
            throw new Error("crypto.transfer.request_conflict");
          }
          // The one-use approval token is never disclosed on a replay.
          return receipt(existing);
        }
        const balance=await readBalance(client,terms);
        const enough=await client.query<{ok:boolean}>(
          "SELECT $1::numeric >= $2::numeric AS ok",[balance,terms.amount]);
        if(!enough.rows[0]?.ok)throw new Error("crypto.insufficient_balance");
        const inserted=await client.query<QuoteRow>(
          `INSERT INTO commerce.crypto_internal_transfer_quotes
          (tenant_id,sender_user_id,request_id,recipient_user_id,recipient_label,
           asset,network,amount,approval_hash,expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::numeric,$9,clock_timestamp()+interval '5 minutes')
          ON CONFLICT DO NOTHING RETURNING *`,
          [terms.tenantId,terms.senderUserId,terms.requestId,terms.recipientUserId,
           terms.recipientLabel,terms.asset,terms.network,terms.amount,consent.hash]);
        if(inserted.rows[0])return receipt(inserted.rows[0],consent.token);
        const raced=await readQuote(client,terms.tenantId,terms.senderUserId,terms.requestId);
        if(!raced)throw new Error("crypto.transfer.quote_conflict");
        if(raced.recipient_user_id!==terms.recipientUserId || raced.asset!==terms.asset ||
           raced.network!==terms.network || Number(raced.amount)!==Number(terms.amount)){
          throw new Error("crypto.transfer.request_conflict");
        }
        return receipt(raced);
      });
    },
    async read(input){
      const tenantId=parseCanonicalId("tenant",input.tenantId);
      const senderUserId=parseCanonicalId("user",input.senderUserId);
      const requestId=parseCanonicalId("request",input.requestId);
      return withTransaction(pool,async client=>{
        const row=await readQuote(client,tenantId,senderUserId,requestId);
        return row?receipt(row):null;
      },{readOnly:true});
    },
    async confirm(input){
      const tenantId=parseCanonicalId("tenant",input.tenantId);
      const senderUserId=parseCanonicalId("user",input.senderUserId);
      const requestId=parseCanonicalId("request",input.requestId);
      return withTransaction(pool,async client=>{
        const quote=await readQuote(client,tenantId,senderUserId,requestId,true);
        if(!quote)throw new Error("crypto.transfer.quote_not_found");
        if(quote.status==="completed")return receipt(quote);
        if(quote.status!=="quoted")throw new Error("crypto.transfer.quote_unavailable");
        const nowResult=await client.query<{now:Date}>("SELECT clock_timestamp() AS now");
        const now=nowResult.rows[0]!.now;
        if(now>=quote.expires_at){
          await client.query(`UPDATE commerce.crypto_internal_transfer_quotes
             SET status='expired' WHERE tenant_id=$1 AND sender_user_id=$2 AND request_id=$3`,
             [tenantId,senderUserId,requestId]);
          return {...receipt(quote),status:"expired"};
        }
        if(!verifyTransferConsent(input.confirmationToken,quote.approval_hash)){
          const attempts=quote.failed_attempts+1;
          await client.query(`UPDATE commerce.crypto_internal_transfer_quotes
             SET failed_attempts=$4,status=$5 WHERE tenant_id=$1
             AND sender_user_id=$2 AND request_id=$3`,
             [tenantId,senderUserId,requestId,attempts,attempts>=5?"rejected":"quoted"]);
          throw new Error("crypto.transfer.approval_invalid");
        }
        await assertActivePeople(client,tenantId,senderUserId,quote.recipient_user_id);
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",
          [`crypto:balance:${tenantId}:${senderUserId}:${quote.asset}:${quote.network??"-"}`]);
        const balance=await readBalance(client,{tenantId,senderUserId,
          asset:quote.asset,network:quote.network});
        const sufficient=await client.query<{ok:boolean}>(
          "SELECT $1::numeric >= $2::numeric AS ok",[balance,quote.amount]);
        if(!sufficient.rows[0]?.ok)throw new Error("crypto.insufficient_balance");
        const daily=await client.query<{count:string}>(
          `SELECT COUNT(*)::text AS count FROM commerce.crypto_internal_transfer_quotes
            WHERE tenant_id=$1 AND sender_user_id=$2 AND status='completed'
              AND created_at >= clock_timestamp()-interval '24 hours'`,
          [tenantId,senderUserId]);
        if(Number(daily.rows[0]?.count??0)>=20)throw new Error("crypto.transfer.limit_reached");
        const recipientRequestId=createCanonicalId("request");
        const intent={tenantId,asset:quote.asset,network:quote.network,amount:quote.amount,now};
        await insertTransferIntent(client,{...intent,userId:senderUserId,requestId,direction:"out"});
        await insertTransferIntent(client,{...intent,userId:quote.recipient_user_id,
          requestId:recipientRequestId,direction:"in"});
        await insertLedger(client,{...intent,userId:senderUserId,requestId,direction:"debit"});
        await insertLedger(client,{...intent,userId:quote.recipient_user_id,
          requestId:recipientRequestId,direction:"credit"});
        const done=await client.query<QuoteRow>(
          `UPDATE commerce.crypto_internal_transfer_quotes
            SET status='completed',completed_at=$4,recipient_request_id=$5
            WHERE tenant_id=$1 AND sender_user_id=$2 AND request_id=$3 RETURNING *`,
          [tenantId,senderUserId,requestId,now,recipientRequestId]);
        if(!done.rows[0])throw new Error("crypto.transfer.completion_missing");
        return receipt(done.rows[0]);
      });
    },
  };
}
