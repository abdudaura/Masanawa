import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { InternalTransferReceipt } from "@masanawa/commerce";
import type { InternalTransferRepository } from "@masanawa/postgres";
import type { FinancialAuthorizer, FinancialService } from "./financial_service.js";
import { createInternalCryptoTransferService } from "./internal_crypto_transfer.js";
import { registerInternalCryptoTransferRoutes } from "./internal_crypto_transfer_routes.js";
import type { CreditRecipientResolver } from "./credit_transfer.js";

const tenantId=createCanonicalId("tenant");
const senderUserId=createCanonicalId("user");
const recipientUserId=createCanonicalId("user");
const requestId=createCanonicalId("request");
const base:InternalTransferReceipt={
  requestId,recipientLabel:"receiver@example.com",asset:"USDTTRC20",
  network:"tron",amount:"3",fee:"0",status:"quoted",
  expiresAt:new Date(Date.now()+120000).toISOString(),completedAt:null,
  confirmationToken:"a".repeat(64),
};
function setup(enabled=true) {
  const authorizer:FinancialAuthorizer={
    authorize:vi.fn(async({authorizationHeader})=>{
      if(authorizationHeader!=="Bearer sender")throw new Error("invalid_session");
      return {tenantId,userId:senderUserId};
    }),
  };
  const recipients:CreditRecipientResolver={
    resolve:vi.fn(async()=>({recipientUserId})),
  };
  const repository:InternalTransferRepository={
    quote:vi.fn(async()=>base),
    read:vi.fn(async()=>base),
    confirm:vi.fn(async()=>({...base,status:"completed",completedAt:new Date().toISOString(),
      confirmationToken:undefined})),
  };
  const financial={
    capabilities:vi.fn(async()=>({deposits:true})),
    listDepositRoutes:vi.fn(async()=>[{
      providerCode:"USDTTRC20",asset:"USDTTRC20",network:"tron",
    }]),
  } as unknown as FinancialService;
  const service=createInternalCryptoTransferService({
    authorizer,recipients,repository,financial,enabled,
  });
  return {service,authorizer,recipients,repository,financial};
}
describe("C06 authorized crypto quote and confirmation HTTP contracts",()=>{
  it("does not accept user IDs or amount from a forged query identity",async()=>{
    const f=setup();
    const result=await f.service.quote({
      authorizationHeader:"Bearer sender",requestId,
      recipient:"receiver@example.com",providerCode:"USDTTRC20",amount:"3",
    });
    expect(result.status).toBe("quoted");
    expect(f.repository.quote).toHaveBeenCalledWith(
      expect.objectContaining({tenantId,senderUserId,recipientUserId,requestId,
        asset:"USDTTRC20",network:"tron",amount:"3"}));
  });
  it("denies mis-scoped callers before touching balance or leaking receipt",async()=>{
    const f=setup();
    await expect(f.service.read({authorizationHeader:"Bearer other",requestId}))
      .rejects.toThrow("invalid_session");
    expect(f.repository.read).not.toHaveBeenCalled();
  });
  it("keeps transfer disabled without explicit production eligibility",async()=>{
    const f=setup(false);
    await expect(f.service.quote({
      authorizationHeader:"Bearer sender",requestId,
      recipient:"receiver@example.com",providerCode:"USDTTRC20",amount:"3",
    })).rejects.toThrow("crypto.transfer.not_qualified");
    expect(f.repository.quote).not.toHaveBeenCalled();
  });
  it("does not dispatch an external chain transaction: only Postgres commit",async()=>{
    const f=setup();
    const answer=await f.service.confirm({
      authorizationHeader:"Bearer sender",requestId,confirmationToken:"a".repeat(64),
    });
    expect(answer.status).toBe("completed");
    expect(f.repository.confirm).toHaveBeenCalledWith({
      tenantId,senderUserId,requestId,confirmationToken:"a".repeat(64),
    });
  });
  it("provides request-bound status route with no sender identity in body",async()=>{
    const f=setup();
    const app=Fastify();
    registerInternalCryptoTransferRoutes(app,f.service);
    const request=await app.inject({
      method:"GET",url:`/v1/financial/crypto/internal-transfers/${requestId}`,
      headers:{authorization:"Bearer sender"},
    });
    expect(request.statusCode).toBe(200);
    expect(request.json().requestId).toBe(requestId);
    await app.close();
  });
  it("rejects free-form identity override from request JSON",async()=>{
    const f=setup();
    const app=Fastify();
    registerInternalCryptoTransferRoutes(app,f.service);
    const request=await app.inject({
      method:"POST",url:"/v1/financial/crypto/internal-transfers/quotes",
      headers:{authorization:"Bearer sender"},
      payload:{requestId,recipient:"receiver@example.com",providerCode:"USDTTRC20",
        amount:"3",senderUserId:recipientUserId},
    });
    expect(request.statusCode).toBe(400);
    expect(f.repository.quote).not.toHaveBeenCalled();
    await app.close();
  });
});
