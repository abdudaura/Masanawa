import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeCryptoAmount, normalizeCryptoAsset, normalizeCryptoNetwork } from "./crypto.js";
import { parseCanonicalId } from "@masanawa/contracts";

export type InternalTransferStatus = "quoted" | "completed" | "expired" | "rejected";
export interface InternalTransferTerms {
  readonly tenantId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly recipientLabel: string;
  readonly requestId: string;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
}
export interface InternalTransferReceipt {
  readonly requestId: string;
  readonly recipientLabel: string;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly fee: "0";
  readonly status: InternalTransferStatus;
  readonly expiresAt: string;
  readonly completedAt: string | null;
  readonly confirmationToken?: string;
}
export function validateInternalTransfer(input: InternalTransferTerms): InternalTransferTerms {
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const senderUserId = parseCanonicalId("user", input.senderUserId);
  const recipientUserId = parseCanonicalId("user", input.recipientUserId);
  if (senderUserId === recipientUserId) throw new Error("crypto.transfer.self_forbidden");
  const requestId = parseCanonicalId("request", input.requestId);
  const recipientLabel = input.recipientLabel.trim();
  if (recipientLabel.length < 3 || recipientLabel.length > 320) {
    throw new Error("crypto.transfer.recipient_invalid");
  }
  const amount = normalizeCryptoAmount(input.amount);
  if (amount.length > 80) throw new Error("crypto.transfer.amount_invalid");
  return { tenantId, senderUserId, recipientUserId, recipientLabel, requestId,
    asset: normalizeCryptoAsset(input.asset), network: normalizeCryptoNetwork(input.network), amount };
}
export function createTransferConsent(): Readonly<{ token: string; hash: string }> {
  const token = randomBytes(32).toString("hex");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}
export function verifyTransferConsent(token: string, hash: string): boolean {
  if (!/^[0-9a-f]{64}$/u.test(token) || !/^[0-9a-f]{64}$/u.test(hash)) return false;
  return timingSafeEqual(
    createHash("sha256").update(token).digest(),
    Buffer.from(hash, "hex"),
  );
}
