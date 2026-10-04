import { describe, expect, it } from "vitest";
import {
  FlutterwaveBillProviderError,
  FlutterwaveBillsClient,
  type FlutterwaveBillsTransport,
} from "./client.js";

function transport(handler: FlutterwaveBillsTransport["request"]): FlutterwaveBillsTransport {
  return { request: handler };
}

describe("FlutterwaveBillsClient", () => {
  it("discovers Nigerian categories without hard-coded products", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async (request) => {
        expect(request.path).toBe("/v3/top-bill-categories");
        expect(request.query).toEqual({ country: "NG" });
        expect(request.headers.authorization).toBe("Bearer secret");
        return {
          status: 200,
          body: { status: "success", data: [{ code: "MOBILEDATA", name: "Mobile Data Service", description: "Data", country_code: "NG" }] },
        };
      }),
    });
    await expect(client.listCategories()).resolves.toEqual([
      { code: "MOBILEDATA", name: "Mobile Data Service", description: "Data", country: "NG" },
    ]);
  });

  it("preserves provider biller/item identifiers and exact decimal amount", async () => {
    const requests: string[] = [];
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async (request) => {
        requests.push(request.path);
        if (request.path.endsWith("/billers")) {
          return { status: 200, body: { status: "success", data: [{ biller_code: "BIL-MTN", name: "MTN" }] } };
        }
        return { status: 200, body: { status: "success", data: [{ item_code: "DATA-1", name: "1 GB", amount: "750.50", currency: "NGN", label_name: "Phone Number" }] } };
      }),
    });
    await expect(client.listBillers("MOBILEDATA")).resolves.toEqual([{ billerCode: "BIL-MTN", name: "MTN" }]);
    await expect(client.listItems("BIL-MTN")).resolves.toEqual([
      { billerCode: "BIL-MTN", itemCode: "DATA-1", name: "1 GB", amount: "750.50", currency: "NGN", labelName: "Phone Number" },
    ]);
    expect(requests).toEqual(["/v3/bills/MOBILEDATA/billers", "/v3/billers/BIL-MTN/items"]);
  });

  it("validates customer identifiers before non-airtime fulfillment", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async (request) => {
        expect(request.path).toBe("/v3/bill-items/CB141/validate");
        expect(request.query).toEqual({ customer: "0025401100" });
        return { status: 200, body: { status: "success", data: { response_code: "00", response_message: "Successful", name: "Test Account", biller_code: "BIL119", customer: "0025401100", product_code: "CB141", minimum: 0, maximum: 0 } } };
      }),
    });
    const result = await client.validateCustomer("CB141", "0025401100");
    expect(result.valid).toBe(true);
    expect(result.billerCode).toBe("BIL119");
  });

  it("dispatches only the caller's server-owned reference and amount", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async (request) => {
        expect(request.method).toBe("POST");
        expect(request.path).toBe("/v3/billers/BIL119/items/CB141/payment");
        expect(request.body).toEqual({ country: "NG", customer_id: "0025401100", amount: "24900.00", reference: "fulfillment-123" });
        return { status: 200, body: { status: "success", data: { status: "pending", customer_reference: "fulfillment-123", flw_ref: "BP-1", amount: "24900.00", currency: "NGN", customer_id: "0025401100" } } };
      }),
    });
    await expect(client.createPayment({ billerCode: "BIL119", itemCode: "CB141", customerId: "0025401100", amount: "24900.00", reference: "fulfillment-123" })).resolves.toMatchObject({
      reference: "fulfillment-123", providerReference: "BP-1", status: "pending",
    });
  });

  it("marks POST transport failure as unknown and forbids blind retry", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async () => { throw new Error("timeout"); }),
    });
    await expect(client.createPayment({ billerCode: "BIL119", itemCode: "CB141", customerId: "0025401100", amount: "100", reference: "fulfillment-unknown" })).rejects.toMatchObject({
      code: "dispatch_outcome_unknown", retryable: false, outcomeUnknown: true,
    });
  });

  it("treats a 5xx dispatch response as unknown and requires requery", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async () => ({ status: 503, body: { status: "error" } })),
    });
    await expect(client.createPayment({ billerCode: "B", itemCode: "I", customerId: "C", amount: "100", reference: "ref-503" })).rejects.toMatchObject({
      code: "dispatch_outcome_unknown", outcomeUnknown: true,
    });
  });

  it("requeries bill status with verbose provider evidence", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async (request) => {
        expect(request.path).toBe("/v3/bills/ref-1");
        expect(request.query).toEqual({ verbose: "1" });
        return { status: 200, body: { status: "success", data: { status: "successful", customer_reference: "ref-1", flw_ref: "BP-2", amount: "200.00", currency: "NGN", customer_id: "+2348000000000", product: "AIRTIME" } } };
      }),
    });
    await expect(client.getStatus("ref-1")).resolves.toMatchObject({ reference: "ref-1", status: "successful", providerReference: "BP-2" });
  });

  it("returns null for a reference Flutterwave cannot find", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async () => ({ status: 404, body: { status: "error" } })),
    });
    await expect(client.getStatus("missing")).resolves.toBeNull();
  });

  it("fails closed on non-Nigerian catalog evidence", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async () => ({ status: 200, body: { status: "success", data: [{ code: "AIRTIME", name: "Airtime", country_code: "GH" }] } })),
    });
    await expect(client.listCategories()).rejects.toMatchObject({ code: "unsupported_country" });
  });

  it("never exposes provider response bodies in typed errors", async () => {
    const client = new FlutterwaveBillsClient({
      secretKey: "secret",
      transport: transport(async () => ({ status: 400, body: { status: "error", message: "secret provider detail" } })),
    });
    try {
      await client.listCategories();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(FlutterwaveBillProviderError);
      expect(String(error)).not.toContain("secret provider detail");
    }
  });
  it("recognizes only the live provider's exact missing-reference response", async () => {
    const client = new FlutterwaveBillsClient({ secretKey: "secret", transport: transport(async () => ({status: 400, body: {status: "error", message: "Transaction not found"}})) });
    await expect(client.getStatus("missing")).resolves.toBeNull();
    const rejected = new FlutterwaveBillsClient({ secretKey: "secret", transport: transport(async () => ({status: 400, body: {status: "error", message: "Invalid authorization"}})) });
    await expect(rejected.getStatus("missing")).rejects.toMatchObject({code: "status_unavailable"});
  });

  it("keeps malformed accepted payment evidence ambiguous", async () => {
    const client = new FlutterwaveBillsClient({ secretKey: "secret", transport: transport(async () => ({status: 200, body: {status: "success", data: {amount: "broken"}}})) });
    await expect(client.createPayment({billerCode: "B", itemCode: "I", customerId: "C", amount: "100", reference: "ref"})).rejects.toMatchObject({outcomeUnknown: true});
  });

  it("rejects decimal zero before making a provider request", async () => {
    const client = new FlutterwaveBillsClient({ secretKey: "secret", transport: transport(async () => { throw new Error("should not dispatch"); }) });
    await expect(client.createPayment({billerCode: "B", itemCode: "I", customerId: "C", amount: "0.00", reference: "ref"})).rejects.toMatchObject({code: "invalid_amount"});
  });

  it("does not treat a duplicate-reference rejection as permission to buy again", async () => {
    const client = new FlutterwaveBillsClient({secretKey: "secret", transport: transport(async () => ({status: 400, body: {status: "error", message: "Duplicate Reference"}}))});
    await expect(client.createPayment({billerCode: "B", itemCode: "I", customerId: "C", amount: "100", reference: "existing"})).rejects.toMatchObject({outcomeUnknown: true});
  });

});

