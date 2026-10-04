import { describe, expect, it } from "vitest";
import type { BillingFulfillmentRecord } from "./commerce-orchestrator.js";
import { projectBillingReceipt } from "./receipt-projection.js";

function record(
  state: BillingFulfillmentRecord["state"],
): BillingFulfillmentRecord {
  return {
    fulfillmentReference: "fulfillment-123",
    billerCode: "BIL119",
    itemCode: "CB141",
    itemName: "Electricity",
    customerId: "0025401100",
    customerName: "Ada Customer",
    amount: "24900.00",
    currency: "NGN",
    revision: 3,
    state,
    providerReference: state === "ready" ? null : "BP-1",
    providerStatus: state,
    lastEvidenceAt: "2026-10-04T17:00:00.000Z",
  };
}

describe("projectBillingReceipt", () => {
  it("projects successful receipts without exposing provider internals", () => {
    expect(projectBillingReceipt(record("succeeded"))).toEqual({
      kind: "billing-receipt",
      reference: "fulfillment-123",
      status: "successful",
      title: "Electricity",
      summary: "Payment confirmed by the billing provider.",
      rows: [
        { label: "Recipient", value: "0025401100" },
        { label: "Account", value: "Ada Customer" },
        { label: "Amount", value: "NGN 24900.00" },
        { label: "Reference", value: "fulfillment-123" },
        { label: "Provider reference", value: "BP-1" },
      ],
      canRetry: false,
      canRefresh: false,
    });
  });

  it("makes ambiguous purchases refreshable but not retryable", () => {
    expect(projectBillingReceipt(record("checking"))).toMatchObject({
      status: "checking",
      canRetry: false,
      canRefresh: true,
    });
  });

  it("exposes retry only before a provider dispatch is admitted", () => {
    expect(projectBillingReceipt(record("ready"))).toMatchObject({
      status: "ready",
      canRetry: true,
      canRefresh: false,
    });
  });

  it("surfaces evidence mismatches as review rather than success", () => {
    expect(projectBillingReceipt(record("manual_review"))).toMatchObject({
      status: "needs-review",
      canRetry: false,
      canRefresh: false,
    });
  });
});
