import type { BillingFulfillmentRecord } from "./commerce-orchestrator.js";

export type BillingReceiptProjection = Readonly<{
  kind: "billing-receipt";
  reference: string;
  status:
    | "ready"
    | "processing"
    | "checking"
    | "successful"
    | "failed"
    | "reversed"
    | "needs-review";
  title: string;
  summary: string;
  rows: readonly Readonly<{ label: string; value: string }>[];
  canRetry: boolean;
  canRefresh: boolean;
}>;

export function projectBillingReceipt(
  record: BillingFulfillmentRecord,
): BillingReceiptProjection {
  const status =
    record.state === "dispatching"
      ? "processing"
      : record.state === "succeeded"
        ? "successful"
        : record.state === "manual_review"
          ? "needs-review"
          : record.state;

  const summary =
    status === "successful"
      ? "Payment confirmed by the billing provider."
      : status === "failed"
        ? "Payment failed. No automatic redispatch will occur."
        : status === "reversed"
          ? "The provider reports that this payment was reversed."
          : status === "needs-review"
            ? "Provider evidence did not exactly match the confirmed bill. Manual review is required."
            : status === "checking"
              ? "We are checking the existing payment reference before any retry."
              : status === "processing"
                ? "Payment was submitted and is being reconciled."
                : "Bill details are validated and ready for confirmation.";

  return Object.freeze({
    kind: "billing-receipt",
    reference: record.fulfillmentReference,
    status,
    title: record.itemName,
    summary,
    rows: Object.freeze([
      Object.freeze({ label: "Recipient", value: record.customerId }),
      ...(record.customerName
        ? [Object.freeze({ label: "Account", value: record.customerName })]
        : []),
      Object.freeze({ label: "Amount", value: `NGN ${record.amount}` }),
      Object.freeze({ label: "Reference", value: record.fulfillmentReference }),
      ...(record.state === "succeeded" && record.deliveryCode
        ? [Object.freeze({ label: "Delivery code", value: record.deliveryCode })] : []),
      ...(record.providerReference
        ? [
            Object.freeze({
              label: "Provider reference",
              value: record.providerReference,
            }),
          ]
        : []),
    ]),
    canRetry: record.state === "ready",
    canRefresh:
      record.state === "dispatching" || record.state === "checking" || record.state === "succeeded",
  });
}

