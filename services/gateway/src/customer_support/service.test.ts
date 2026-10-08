
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CustomerAuthError } from "../customer_auth.js";
import { createBillingHistorySupportReader, createCustomerSupportService } from "./service.js";
import type { SupportTicket, SupportTicketStore, SupportOperationReader } from "./model.js";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";

const ref = "bill_quote_SENSITIVE_1234";
const key = "123e4567-e89b-42d3-a456-426614174000";
const now = "2026-10-08T15:00:00.000Z";
function fixture() {
  const saved = new Map<string, { digest: string; ticket: SupportTicket }>();
  const store: SupportTicketStore = {
    async create(p) {
      const index = [p.tenantId, p.userId, p.requestKey].join(":");
      const prior = saved.get(index);
      if (prior) return prior.digest === p.requestDigest ? prior.ticket : null;
      const ticket: SupportTicket = {
        id: p.id, kind: p.kind, referenceMask: p.referenceMask,
        operationPhase: p.operationPhase, summary: p.summary,
        status: "queued", resolution: null, createdAt: p.createdAt, updatedAt: p.createdAt,
      };
      saved.set(index, { digest: p.requestDigest, ticket });
      return ticket;
    },
    async list({ tenantId, userId }) {
      return [...saved.entries()].filter(([index]) => index.startsWith([tenantId,userId].join(":") + ":")).map(([,v]) => v.ticket);
    },
    async read({ tenantId, userId, id }) {
      return (await this.list({tenantId,userId,limit:30})).find(x => x.id === id) ?? null;
    },
  };
  const sessions: PlatformCustomerSessionAuthorizer = {
    async authorize({authorizationHeader}) {
      if (authorizationHeader !== "Bearer A" && authorizationHeader !== "Bearer B") throw new CustomerAuthError("UNAUTHORIZED",401);
      const userId = authorizationHeader.slice(-1);
      return {tenantId:"tenant1",userId} as never;
    },
  };
  const read = vi.fn(async (input: Parameters<SupportOperationReader["read"]>[0]) => {
    if (input.userId !== "A" || input.kind !== "billing_quote" || input.reference !== ref) return null;
    return {kind:"billing_quote" as const,reference:ref,phase:"pending" as const,observedAt:now};
  });
  const service = createCustomerSupportService({
    authorizer:sessions, operations:{read}, tickets:store,now:()=>now,
  });
  const request = {authorizationHeader:"Bearer A",kind:"billing_quote" as const,reference:ref,
    requestKey:key,summary:"The payment is still waiting for confirmation.",shareWithSupport:true};
  return {service,read,request,saved};
}

describe("U29 support safety", () => {
  it("requires a real authenticated session and never reports an arbitrary operation", async () => {
    const {service,read}=fixture();
    await expect(service.status({authorizationHeader:"Bearer B",kind:"billing_quote",reference:ref})).rejects.toMatchObject({statusCode:404,code:"OPERATION_UNAVAILABLE"});
    await expect(service.status({authorizationHeader:undefined,kind:"billing_quote",reference:ref})).rejects.toMatchObject({statusCode:401});
    expect(read).toHaveBeenCalledTimes(1);
    const safe = await service.status({authorizationHeader:"Bearer A",kind:"billing_quote",reference:ref});
    expect(safe).toMatchObject({phase:"pending",referenceMask:"••••1234"});
    expect(JSON.stringify(safe)).not.toContain("SENSITIVE");
    expect(safe.message).toMatch(/Do not repeat/);
  });

  it("rejects unconsented disclosure and does not create a ticket", async () => {
    const {service,request,saved}=fixture();
    await expect(service.create({...request,shareWithSupport:false})).rejects.toMatchObject({code:"SUPPORT_CONSENT_REQUIRED"});
    expect(saved.size).toBe(0);
  });

  it("returns one durable ticket for repeated identical idempotency key and rejects altered content", async () => {
    const {service,request}=fixture();
    const first=await service.create(request);
    const again=await service.create(request);
    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({status:"queued",kind:"billing_quote",operationPhase:"pending",referenceMask:"••••1234"});
    expect(JSON.stringify(first)).not.toContain(ref);
    await expect(service.create({...request,summary:"A different request body with the same key."})).rejects.toMatchObject({code:"SUPPORT_IDEMPOTENCY_CONFLICT"});
    const list=await service.list({authorizationHeader:"Bearer A",limit:30});
    expect(list).toHaveLength(1);
  });

  it("isolates ticket list/read between accounts, without leaking existence", async () => {
    const {service,request}=fixture();
    const ticket=await service.create(request);
    expect(await service.list({authorizationHeader:"Bearer B",limit:30})).toEqual([]);
    await expect(service.read({authorizationHeader:"Bearer B",id:ticket.id})).rejects.toMatchObject({statusCode:404});
    expect(await service.read({authorizationHeader:"Bearer A",id:ticket.id})).toMatchObject({id:ticket.id});
  });

  it("general support requests need no payment identifiers, but forbid attached references", async () => {
    const {service,request}=fixture();
    const ticket=await service.create({...request,kind:"general",reference:undefined});
    expect(ticket).toMatchObject({kind:"general",operationPhase:null,referenceMask:null});
    await expect(service.create({...request,kind:"general"})).rejects.toMatchObject({code:"INVALID_REFERENCE"});
  });

  it("refuses malformed identifiers, short summaries and unsupported crypto reader", async () => {
    const {service,request}=fixture();
    await expect(service.create({...request,requestKey:"123"})).rejects.toMatchObject({code:"INVALID_IDEMPOTENCY_KEY"});
    await expect(service.create({...request,summary:"send it"})).rejects.toMatchObject({code:"INVALID_SUMMARY"});
    await expect(service.create({...request,kind:"crypto_intent"})).rejects.toMatchObject({code:"OPERATION_UNAVAILABLE"});
    await expect(service.status({authorizationHeader:"Bearer A",kind:"billing_quote",reference:"/../../p"})).rejects.toMatchObject({code:"INVALID_REFERENCE"});
  });

  it("uses authenticated Billing history rather than read/verify/checkout/reconcile", async () => {
    const list=vi.fn(async () => [{quote:{quoteId:ref},phase:"processing"}]);
    const read=vi.fn(),verifyAndPurchase=vi.fn(),startCheckout=vi.fn();
    const result=await createBillingHistorySupportReader({list,read,verifyAndPurchase,startCheckout} as never,()=>now).read({
      tenantId:"tenant1",userId:"A",authorizationHeader:"Bearer A",kind:"billing_quote",reference:ref,
    });
    expect(result).toMatchObject({phase:"pending",reference:ref});
    expect(list).toHaveBeenCalledWith({authorizationHeader:"Bearer A",limit:100});
    expect(read).not.toHaveBeenCalled();
    expect(verifyAndPurchase).not.toHaveBeenCalled();
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("has a deterministic sha256 digest for the idempotent ticket, not the token", async () => {
    const {service,request,saved}=fixture();
    await service.create(request);
    const digest = createHash("sha256").update(JSON.stringify({
      kind:"billing_quote",reference:ref,summary:request.summary,
    })).digest("hex");
    expect([...saved.values()][0]?.digest).toBe(digest);
  });
});
