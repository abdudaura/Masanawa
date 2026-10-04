import { describe, expect, it } from "vitest";
import {
  isTerminalPaymentStatus,
  parsePaymentStatus,
  paymentDisposition,
} from "./status.js";

describe("NOWPayments payment statuses", () => {
  it("maps provider statuses without treating in-flight states as success", () => {
    expect(paymentDisposition(parsePaymentStatus("waiting"))).toBe("open");
    expect(paymentDisposition(parsePaymentStatus("confirming"))).toBe("processing");
    expect(paymentDisposition(parsePaymentStatus("confirmed"))).toBe("processing");
    expect(paymentDisposition(parsePaymentStatus("sending"))).toBe("processing");
    expect(paymentDisposition(parsePaymentStatus("finished"))).toBe("succeeded");
  });

  it("keeps partial payment separate from successful fulfillment", () => {
    expect(paymentDisposition(parsePaymentStatus("partially_paid"))).toBe("partial");
    expect(isTerminalPaymentStatus("partially_paid")).toBe(false);
  });

  it("recognizes explicit terminal provider states", () => {
    expect(isTerminalPaymentStatus("finished")).toBe(true);
    expect(isTerminalPaymentStatus("failed")).toBe(true);
    expect(isTerminalPaymentStatus("refunded")).toBe(true);
    expect(isTerminalPaymentStatus("expired")).toBe(true);
  });

  it("fails closed on an unknown provider status", () => {
    expect(() => parsePaymentStatus("completed")).toThrow("nowpayments.status.unknown");
  });
});
