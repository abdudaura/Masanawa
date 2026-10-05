import { describe, expect, it } from "vitest";
import { FlutterwaveFundingClient } from "./funding-client.js";
import type { FlutterwaveBillsTransport } from "./client.js";
describe("FlutterwaveFundingClient", () => {
  it("creates hosted checkout and independently verifies evidence", async () => {
    const transport: FlutterwaveBillsTransport = { async request(input) {
      if (input.path === "/v3/payments") return { status: 200, body: { status: "success", data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/test" } } };
      return { status: 200, body: { status: "success", data: { id: 42, tx_ref: "bill-q1-r1", flw_ref: "FLW-1", status: "successful", amount: 103, currency: "NGN" } } };
    }};
    const client = new FlutterwaveFundingClient({ secretKey: "secret", transport });
    await expect(client.createCheckout({ txRef: "bill-q1-r1", amount: "103", redirectUrl: "https://app.masanawa.com/return", customer: { email: "user@example.com" } }))
      .resolves.toMatchObject({ txRef: "bill-q1-r1" });
    await expect(client.verifyByReference("bill-q1-r1")).resolves.toMatchObject({ transactionId: "42", status: "successful", amount: "103", currency: "NGN" });
  });
  it("rejects untrusted checkout links", async () => {
    const client = new FlutterwaveFundingClient({ secretKey: "secret", transport: { async request() {
      return { status: 200, body: { status: "success", data: { link: "https://evil.example/pay" } } };
    }}});
    await expect(client.createCheckout({ txRef: "x", amount: "100", redirectUrl: "https://app.masanawa.com/return", customer: { email: "user@example.com" } }))
      .rejects.toThrow("checkout_link_untrusted");
  });
});
