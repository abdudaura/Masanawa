import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parsePaymentStatus, type NowPaymentsPaymentStatus } from "./status.js";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface NowPaymentsIpnEvidence {
  readonly paymentId: string;
  readonly purchaseId: string | null;
  readonly orderId: string | null;
  readonly status: NowPaymentsPaymentStatus;
  readonly payloadHash: string;
}

interface CanonicalizationLimits {
  readonly maxDepth?: number;
  readonly maxObjectKeys?: number;
  readonly maxArrayLength?: number;
  readonly maxStringLength?: number;
}

function asJsonValue(
  value: unknown,
  depth: number,
  limits: Required<CanonicalizationLimits>,
): JsonValue {
  if (depth > limits.maxDepth) throw new Error("nowpayments.ipn.payload_too_deep");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > limits.maxStringLength) throw new Error("nowpayments.ipn.string_too_long");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("nowpayments.ipn.non_json_number");
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) throw new Error("nowpayments.ipn.array_too_large");
    return Object.freeze(value.map((item) => asJsonValue(item, depth + 1, limits)));
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    if (keys.length > limits.maxObjectKeys) throw new Error("nowpayments.ipn.object_too_large");
    const output: Record<string, JsonValue> = {};
    for (const key of keys) {
      if (key.length > 128) throw new Error("nowpayments.ipn.key_too_long");
      const item = source[key];
      if (item === undefined) throw new Error("nowpayments.ipn.undefined_value");
      output[key] = asJsonValue(item, depth + 1, limits);
    }
    return Object.freeze(output);
  }
  throw new Error("nowpayments.ipn.non_json_value");
}

export function canonicalizeIpnPayload(
  payload: unknown,
  limits: CanonicalizationLimits = {},
): string {
  const normalizedLimits: Required<CanonicalizationLimits> = {
    maxDepth: limits.maxDepth ?? 16,
    maxObjectKeys: limits.maxObjectKeys ?? 256,
    maxArrayLength: limits.maxArrayLength ?? 256,
    maxStringLength: limits.maxStringLength ?? 16_384,
  };
  const encoded = JSON.stringify(asJsonValue(payload, 0, normalizedLimits));
  if (encoded === undefined) throw new Error("nowpayments.ipn.payload.invalid");
  return encoded;
}

export function verifyIpnSignature(input: {
  readonly payload: unknown;
  readonly signature: string;
  readonly secret: string;
}): boolean {
  const secret = input.secret.trim();
  if (secret.length === 0) throw new Error("nowpayments.ipn.secret.required");

  const signature = input.signature.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(signature)) return false;

  const canonical = canonicalizeIpnPayload(input.payload);
  const expected = createHmac("sha512", secret).update(canonical, "utf8").digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function stringIdentity(value: unknown, code: string): string {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(code);
  const normalized = String(value).trim();
  if (normalized.length === 0 || normalized.length > 128) throw new Error(code);
  return normalized;
}

function optionalIdentity(value: unknown, code: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return stringIdentity(value, code);
}

export function parseVerifiedPaymentIpn(input: {
  readonly payload: unknown;
  readonly signature: string;
  readonly secret: string;
}): NowPaymentsIpnEvidence {
  if (!verifyIpnSignature(input)) throw new Error("nowpayments.ipn.signature.invalid");
  if (typeof input.payload !== "object" || input.payload === null || Array.isArray(input.payload)) {
    throw new Error("nowpayments.ipn.payload.invalid");
  }

  const payload = input.payload as Record<string, unknown>;
  const canonical = canonicalizeIpnPayload(payload);
  return Object.freeze({
    paymentId: stringIdentity(payload.payment_id, "nowpayments.ipn.payment_id.invalid"),
    purchaseId: optionalIdentity(payload.purchase_id, "nowpayments.ipn.purchase_id.invalid"),
    orderId: optionalIdentity(payload.order_id, "nowpayments.ipn.order_id.invalid"),
    status: parsePaymentStatus(payload.payment_status),
    payloadHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
  });
}
