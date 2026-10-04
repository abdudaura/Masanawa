import type { FlutterwaveBillsTransport } from "./client.js";
type Json = Record<string, unknown>;
export interface FlutterwaveCheckout { readonly txRef: string; readonly checkoutUrl: string; }
export interface FlutterwaveVerifiedPayment {
  readonly transactionId: string; readonly txRef: string; readonly providerReference: string | null;
  readonly status: string; readonly amount: string; readonly currency: string;
}
export interface FlutterwaveRefundReceipt {
  readonly transactionId: string; readonly refundReference: string; readonly status: string; readonly amount: string | null;
}
function record(value: unknown, label: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`flutterwave.funding.invalid_${label}`);
  return value as Json;
}
function textValue(value: unknown, label: string, max = 1024): string {
  const candidate = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > max) throw new Error(`flutterwave.funding.invalid_${label}`);
  return candidate;
}
function decimal(value: unknown, label: string): string {
  const candidate = textValue(value, label, 80);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(candidate)) throw new Error(`flutterwave.funding.invalid_${label}`);
  return candidate;
}
function providerHeaders(secretKey: string) {
  return Object.freeze({ authorization: `Bearer ${secretKey}`, accept: "application/json", "content-type": "application/json" });
}
export class FlutterwaveFundingClient {
  readonly #secretKey: string;
  readonly #transport: FlutterwaveBillsTransport;
  constructor(input: Readonly<{ secretKey: string; transport: FlutterwaveBillsTransport }>) {
    this.#secretKey = input.secretKey.trim();
    if (!this.#secretKey) throw new Error("flutterwave.funding.secret_key_required");
    this.#transport = input.transport;
  }
  async createCheckout(input: Readonly<{
    txRef: string; amount: string; redirectUrl: string;
    customer: Readonly<{ email: string; name?: string; phone?: string }>; signal?: AbortSignal;
  }>): Promise<FlutterwaveCheckout> {
    const redirect = new URL(input.redirectUrl);
    if (redirect.protocol !== "https:") throw new Error("flutterwave.funding.redirect_https_required");
    const response = await this.#transport.request({
      method: "POST", path: "/v3/payments", headers: providerHeaders(this.#secretKey),
      body: { tx_ref: textValue(input.txRef, "tx_ref", 128), amount: decimal(input.amount, "amount"), currency: "NGN",
        redirect_url: redirect.toString(), customer: {
          email: textValue(input.customer.email, "customer_email", 320),
          ...(input.customer.name?.trim() ? { name: textValue(input.customer.name, "customer_name", 300) } : {}),
          ...(input.customer.phone?.trim() ? { phonenumber: textValue(input.customer.phone, "customer_phone", 40) } : {}),
        }, customizations: { title: "Masanawa bill payment" } },
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (response.status !== 200) throw new Error("flutterwave.funding.checkout_rejected");
    const envelope = record(response.body, "checkout_envelope");
    if (envelope.status !== "success") throw new Error("flutterwave.funding.checkout_rejected");
    const checkoutUrl = textValue(record(envelope.data, "checkout_data").link, "checkout_link", 2048);
    const parsed = new URL(checkoutUrl);
    if (parsed.protocol !== "https:" || !(parsed.hostname === "flutterwave.com" || parsed.hostname.endsWith(".flutterwave.com"))) {
      throw new Error("flutterwave.funding.checkout_link_untrusted");
    }
    return Object.freeze({ txRef: input.txRef, checkoutUrl: parsed.toString() });
  }
  async verifyByReference(txRef: string, signal?: AbortSignal): Promise<FlutterwaveVerifiedPayment> {
    const normalized = textValue(txRef, "tx_ref", 128);
    const response = await this.#transport.request({
      method: "GET", path: "/v3/transactions/verify_by_reference", query: { tx_ref: normalized },
      headers: providerHeaders(this.#secretKey), ...(signal ? { signal } : {}),
    });
    if (response.status !== 200) throw new Error("flutterwave.funding.verification_unavailable");
    const envelope = record(response.body, "verify_envelope");
    if (envelope.status !== "success") throw new Error("flutterwave.funding.verification_failed");
    const data = record(envelope.data, "verify_data");
    const returnedRef = textValue(data.tx_ref, "verified_tx_ref", 128);
    if (returnedRef !== normalized) throw new Error("flutterwave.funding.reference_mismatch");
    return Object.freeze({
      transactionId: textValue(data.id, "transaction_id", 80), txRef: returnedRef,
      providerReference: data.flw_ref == null ? null : textValue(data.flw_ref, "provider_reference", 200),
      status: textValue(data.status, "status", 64).toLowerCase(),
      amount: decimal(data.amount, "verified_amount"), currency: textValue(data.currency, "currency", 8).toUpperCase(),
    });
  }
  async refund(input: Readonly<{ transactionId: string; amount: string; callbackUrl?: string; signal?: AbortSignal }>): Promise<FlutterwaveRefundReceipt> {
    const transactionId = textValue(input.transactionId, "transaction_id", 80);
    if (!/^\d+$/u.test(transactionId)) throw new Error("flutterwave.funding.transaction_id_invalid");
    const response = await this.#transport.request({
      method: "POST", path: `/v3/transactions/${encodeURIComponent(transactionId)}/refund`,
      headers: providerHeaders(this.#secretKey), body: {
        amount: decimal(input.amount, "refund_amount"), comments: "Masanawa bill fulfillment did not complete",
        ...(input.callbackUrl ? { callbackurl: new URL(input.callbackUrl).toString() } : {}),
      }, ...(input.signal ? { signal: input.signal } : {}),
    });
    if (response.status !== 200) throw new Error("flutterwave.funding.refund_unavailable");
    const envelope = record(response.body, "refund_envelope");
    if (envelope.status !== "success") throw new Error("flutterwave.funding.refund_rejected");
    const data = record(envelope.data, "refund_data");
    return Object.freeze({
      transactionId, refundReference: textValue(data.flw_ref ?? data.id, "refund_reference", 200),
      status: textValue(data.status, "refund_status", 64).toLowerCase(),
      amount: data.amount_refunded == null ? null : decimal(data.amount_refunded, "refund_amount"),
    });
  }
}
