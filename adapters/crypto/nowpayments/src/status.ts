export type NowPaymentsPaymentStatus =
  | "waiting"
  | "confirming"
  | "confirmed"
  | "sending"
  | "partially_paid"
  | "finished"
  | "failed"
  | "refunded"
  | "expired";

export type PaymentDisposition =
  | "open"
  | "processing"
  | "partial"
  | "succeeded"
  | "failed"
  | "refunded"
  | "expired";

const STATUSES = new Set<NowPaymentsPaymentStatus>([
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "finished",
  "failed",
  "refunded",
  "expired",
]);

export function parsePaymentStatus(value: unknown): NowPaymentsPaymentStatus {
  if (typeof value !== "string") throw new Error("nowpayments.status.invalid");
  const normalized = value.trim().toLowerCase();
  if (!STATUSES.has(normalized as NowPaymentsPaymentStatus)) {
    throw new Error("nowpayments.status.unknown");
  }
  return normalized as NowPaymentsPaymentStatus;
}

export function paymentDisposition(status: NowPaymentsPaymentStatus): PaymentDisposition {
  switch (status) {
    case "waiting":
      return "open";
    case "confirming":
    case "confirmed":
    case "sending":
      return "processing";
    case "partially_paid":
      return "partial";
    case "finished":
      return "succeeded";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "expired":
      return "expired";
  }
}

export function isTerminalPaymentStatus(status: NowPaymentsPaymentStatus): boolean {
  return (
    status === "finished" ||
    status === "failed" ||
    status === "refunded" ||
    status === "expired"
  );
}
