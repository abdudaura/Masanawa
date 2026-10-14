import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack dedicated NGN account boundary. Activation requires registered
 * merchant approval, explicit customer consent, authoritative user identity
 * and durable account mapping. No production route is registered by this file.
 * Never claim an account or credit money based on an assignment request alone.
 */
export interface PaystackAccount {
  readonly customerCode: string;
  readonly bank: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly active: boolean;
}
export interface PaystackVerifiedPayment {
  readonly transactionId: string;
  readonly reference: string;
  readonly currency: "NGN";
  readonly amountKobo: number;
  readonly customerCode: string;
}
export interface PaystackAssignment {
  readonly status: "pending";
  readonly customerEmail: string;
}

function object(value: unknown): Record<string,unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("paystack.invalid_response");
  return value as Record<string,unknown>;
}
function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function optionalAccount(raw: unknown, code: string): PaystackAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const data = object(raw);
  if (data.assigned !== true || data.active !== true || data.currency !== "NGN") return null;
  const bank = string(object(data.bank).name);
  const number = string(data.account_number);
  const name = string(data.account_name);
  if (!/^\d{10}$/.test(number) || !bank || !name || !code.startsWith("CUS_"))
    throw new Error("paystack.invalid_assigned_account");
  return Object.freeze({
    customerCode: code, bank, accountNumber: number,
    accountName: name, active: true,
  });
}
export function verifyPaystackWebhook(
  rawBody: Uint8Array, signature: string | undefined, secretKey: string,
): Readonly<Record<string,unknown>> {
  if (!secretKey || !signature || !/^[0-9a-f]{128}$/i.test(signature))
    throw new Error("paystack.invalid_webhook_signature");
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  const given = Buffer.from(signature, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new Error("paystack.invalid_webhook_signature");
  const payload = object(JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown);
  if (!string(payload.event)) throw new Error("paystack.invalid_webhook_event");
  return Object.freeze(payload);
}

export class PaystackDedicatedAccounts {
  constructor(
    private readonly apiKey: string,
    private readonly preferredBank: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey.startsWith("sk_") || !preferredBank.trim())
      throw new Error("paystack.configuration_required");
  }

  private async request(method: "GET"|"POST", path: string, payload?: object): Promise<Record<string,unknown>> {
    const response = await this.fetchImpl("https://api.paystack.co" + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
      },
      ...(payload ? {body: JSON.stringify(payload)} : {}),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("paystack.http_" + response.status);
    const body = object(await response.json() as unknown);
    if (body.status !== true) throw new Error("paystack.provider_denied");
    return object(body.data);
  }

  /** Requires express recorded customer consent, never runs on app sign-in. */
  async assign(input: Readonly<{
    email: string; firstName: string; lastName: string;
    phone: string; consentId: string;
    country: "NG";
  }>): Promise<PaystackAssignment> {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !input.firstName.trim() || !input.lastName.trim() ||
        !/^(?:0[789]\d{9}|\+?234[789]\d{9})$/.test(input.phone.trim()) ||
        !input.consentId.trim() || input.country !== "NG") {
      throw new Error("paystack.consent_identity_required");
    }
    // Asynchronous: assignment pending until signed provider evidence arrives.
    await this.request("POST", "/dedicated_account/assign", {
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone.trim(),
      preferred_bank: this.preferredBank,
      country: input.country,
    });
    return Object.freeze({status: "pending", customerEmail: email});
  }

  /** Bank account is never rendered until Paystack confirms active assignment. */
  async readAssignedAccount(customerCode: string): Promise<PaystackAccount|null> {
    if (!/^CUS_[A-Za-z0-9]+$/.test(customerCode))
      throw new Error("paystack.invalid_customer");
    const customer = await this.request("GET", "/customer/" + encodeURIComponent(customerCode));
    return optionalAccount(customer.dedicated_account, string(customer.customer_code));
  }

  /** A signed charge.success webhook is a signal, NOT evidence to credit.
   * Requery this provider record and atomically journal/credit its unique ID
   * using the existing canonical NGN PostgreSQL wallet before acknowledgment. */
  async verifiedPayment(reference: string): Promise<PaystackVerifiedPayment> {
    if (!/^[A-Za-z0-9._-]{5,120}$/.test(reference))
      throw new Error("paystack.invalid_reference");
    const payment = await this.request("GET", "/transaction/verify/" + encodeURIComponent(reference));
    const amount = payment.amount, transactionId = payment.id,
      customer = object(payment.customer);
    if (payment.status !== "success" || payment.currency !== "NGN" ||
        !Number.isSafeInteger(amount) || (amount as number) <= 0 ||
        (typeof transactionId !== "number" && typeof transactionId !== "string") ||
        !string(customer.customer_code).startsWith("CUS_") ||
        string(payment.reference) !== reference) {
      throw new Error("paystack.unverified_payment");
    }
    return Object.freeze({
      transactionId: String(transactionId), reference, currency: "NGN",
      amountKobo: amount as number, customerCode: string(customer.customer_code),
    });
  }
}
