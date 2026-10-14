import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PaystackDedicatedAccounts, verifyPaystackWebhook } from "./paystack_dedicated_accounts.js";

function provider(data?: unknown): Response {
  return new Response(JSON.stringify({status:true,...(data===undefined?{}:{data})}),{status:200});
}
describe("Paystack DVA: funding must never assume provider success", () => {
  it("requires consent/identity and never sends request when incomplete", async () => {
    const fetchImpl = vi.fn(async()=>provider());
    const accounts = new PaystackDedicatedAccounts("sk_test_faked", "test-bank", fetchImpl as typeof fetch);
    const info = {email:"customer@example.com", firstName:"Tess",lastName:"Adamu",
      phone:"08031234567",country:"NG" as const,consentId:""};
    await expect(accounts.assign(info)).rejects.toThrow("paystack.consent_identity_required");
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(accounts.assign({...info,consentId:"consent-log-id"}))
      .resolves.toEqual({status:"pending",customerEmail:"customer@example.com"});
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.paystack.co/dedicated_account/assign");
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({
      email:"customer@example.com",country:"NG",preferred_bank:"test-bank"});
  });
  it("only accepts provider assigned and active NGN accounts",async()=>{
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(provider({customer_code:"CUS_example", dedicated_account:{
        assigned:false,active:false,currency:"NGN",account_number:"1234567890"}}))
      .mockResolvedValueOnce(provider({customer_code:"CUS_example", dedicated_account:{
        assigned:true,active:true,currency:"NGN",account_number:"1234567890",
        account_name:"Masanawa/Test Customer",bank:{name:"Test Bank"}}}));
    const client = new PaystackDedicatedAccounts("sk_test_faked","test-bank",fetchImpl as typeof fetch);
    expect(await client.readAssignedAccount("CUS_example")).toBeNull();
    expect(await client.readAssignedAccount("CUS_example")).toEqual({
      customerCode:"CUS_example",bank:"Test Bank",accountNumber:"1234567890",
      accountName:"Masanawa/Test Customer",active:true});
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("rejects forged or modified webhook bytes, verifies exact raw data signature",()=>{
    const key = "sk_test_faked";
    const body=Buffer.from(JSON.stringify({event:"charge.success",data:{id:47}}));
    const signature=createHmac("sha512",key).update(body).digest("hex");
    expect(verifyPaystackWebhook(body,signature,key)).toMatchObject({event:"charge.success"});
    expect(()=>verifyPaystackWebhook(body,"0".repeat(128),key)).toThrow("paystack.invalid_webhook_signature");
    expect(()=>verifyPaystackWebhook(Buffer.from(body.toString()+" "),signature,key))
      .toThrow("paystack.invalid_webhook_signature");
    expect(()=>verifyPaystackWebhook(body,undefined,key)).toThrow("paystack.invalid_webhook_signature");
  });
  it("requeries and requires actual settled NGN transaction, exact reference and customer",async()=>{
    const fetchImpl=vi.fn().mockResolvedValueOnce(provider({
      status:"success",currency:"NGN",amount:250000,id:82,
      reference:"reference_abc",customer:{customer_code:"CUS_masanawa"}}));
    const client=new PaystackDedicatedAccounts("sk_test_faked","test-bank",fetchImpl as typeof fetch);
    expect(await client.verifiedPayment("reference_abc")).toEqual({
      transactionId:"82",reference:"reference_abc",currency:"NGN",
      amountKobo:250000,customerCode:"CUS_masanawa"});
    expect(fetchImpl.mock.calls[0]![0])
      .toBe("https://api.paystack.co/transaction/verify/reference_abc");
    const failure=new PaystackDedicatedAccounts("sk_test_faked","test-bank",
      vi.fn(async()=>provider({status:"pending",currency:"NGN",amount:250000,id:82,
        reference:"reference_abc",customer:{customer_code:"CUS_masanawa"}})) as typeof fetch);
    await expect(failure.verifiedPayment("reference_abc")).rejects.toThrow("paystack.unverified_payment");
  });
});
