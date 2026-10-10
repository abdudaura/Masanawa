export type CreditProvenanceClass =
  | "external-funding"
  | "earned"
  | "gift"
  | "refund"
  | "internal-transfer"
  | "admin-adjustment";

export interface CreditTransferCommand {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amountCredits: number;
  readonly provenanceClass: CreditProvenanceClass;
  readonly createdAt: string;
}

export interface CreditTransferAdmission {
  readonly requestId: string;
  readonly fingerprint: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amountCredits: number;
  readonly sourceProvenanceClass: CreditProvenanceClass;
  readonly destinationProvenanceClass: "internal-transfer";
  readonly commissionEligible: false;
  readonly createdAt: string;
}

export interface CreditTransferReceipt extends CreditTransferAdmission {
  readonly transferId: string;
  readonly status: "completed" | "reversed";
  readonly completedAt: string;
  readonly reversalOfTransferId: string | null;
}

function text(value: string, name: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return value.trim();
}

function credits(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000_000) {
    throw new RangeError("amountCredits is invalid");
  }
  return value;
}

function timestamp(value: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError("createdAt is invalid");
  }
  return parsed.toISOString();
}

function provenance(value: CreditProvenanceClass): CreditProvenanceClass {
  if (
    value !== "external-funding" &&
    value !== "earned" &&
    value !== "gift" &&
    value !== "refund" &&
    value !== "internal-transfer" &&
    value !== "admin-adjustment"
  ) {
    throw new TypeError("provenanceClass is invalid");
  }
  return value;
}

export function creditTransferFingerprint(input: {
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amountCredits: number;
  readonly provenanceClass: CreditProvenanceClass;
}): string {
  const sender = encodeURIComponent(text(input.senderUserId, "senderUserId"));
  const recipient = encodeURIComponent(text(input.recipientUserId, "recipientUserId"));
  const amount = credits(input.amountCredits);
  const source = provenance(input.provenanceClass);
  return `credit-transfer:v1:${sender}:${recipient}:${amount}:${source}`;
}

export function admitCreditTransfer(
  command: CreditTransferCommand,
): CreditTransferAdmission {
  if (command.schemaVersion !== 1) {
    throw new TypeError("Unsupported Credit transfer schema");
  }
  const requestId = text(command.requestId, "requestId");
  const senderUserId = text(command.senderUserId, "senderUserId");
  const recipientUserId = text(command.recipientUserId, "recipientUserId");
  if (senderUserId === recipientUserId) {
    throw new Error("Cannot transfer Credits to yourself");
  }
  const amountCredits = credits(command.amountCredits);
  const sourceProvenanceClass = provenance(command.provenanceClass);
  const createdAt = timestamp(command.createdAt);
  return Object.freeze({
    requestId,
    fingerprint: creditTransferFingerprint({
      senderUserId,
      recipientUserId,
      amountCredits,
      provenanceClass: sourceProvenanceClass,
    }),
    senderUserId,
    recipientUserId,
    amountCredits,
    sourceProvenanceClass,
    destinationProvenanceClass: "internal-transfer",
    commissionEligible: false,
    createdAt,
  });
}

export function reverseCreditTransfer(input: {
  readonly original: CreditTransferReceipt;
  readonly reversalRequestId: string;
  readonly reversedAt: string;
}): CreditTransferReceipt {
  if (input.original.status !== "completed") {
    throw new Error("Only a completed transfer can be reversed");
  }
  // This is a receipt-shape guard, not a substitute for an authoritative
  // ledger read or the atomic once-only reversal enforced by persistence.
  const originalTransferId = text(input.original.transferId, "transferId");
  const originalAdmission = admitCreditTransfer({
    schemaVersion: 1,
    requestId: input.original.requestId,
    senderUserId: input.original.senderUserId,
    recipientUserId: input.original.recipientUserId,
    amountCredits: input.original.amountCredits,
    provenanceClass: input.original.sourceProvenanceClass,
    createdAt: input.original.createdAt,
  });
  if (
    input.original.fingerprint !== originalAdmission.fingerprint ||
    input.original.destinationProvenanceClass !== "internal-transfer" ||
    input.original.commissionEligible !== false ||
    input.original.reversalOfTransferId !== null
  ) {
    throw new TypeError("Original transfer receipt is invalid");
  }
  const originalCompletedAt = timestamp(input.original.completedAt);
  if (Date.parse(originalCompletedAt) < Date.parse(originalAdmission.createdAt)) {
    throw new RangeError("Original transfer completion predates admission");
  }
  const reversalRequestId = text(input.reversalRequestId, "reversalRequestId");
  if (reversalRequestId === originalAdmission.requestId) {
    throw new TypeError("Reversal must use a new request ID");
  }
  const reversedAt = timestamp(input.reversedAt);
  if (Date.parse(reversedAt) < Date.parse(originalCompletedAt)) {
    throw new RangeError("Reversal predates original completion");
  }
  return Object.freeze({
    ...input.original,
    requestId: reversalRequestId,
    fingerprint: `credit-transfer-reversal:v1:${encodeURIComponent(originalTransferId)}`,
    senderUserId: input.original.recipientUserId,
    recipientUserId: input.original.senderUserId,
    sourceProvenanceClass: "internal-transfer",
    destinationProvenanceClass: "internal-transfer",
    commissionEligible: false,
    transferId: `${originalTransferId}:reversal`,
    status: "reversed",
    createdAt: reversedAt,
    completedAt: reversedAt,
    reversalOfTransferId: originalTransferId,
  });
}
