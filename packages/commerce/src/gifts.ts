import {
  admitCreditTransfer,
  type CreditTransferAdmission,
  type CreditTransferCommand,
} from "./transfers.js";

export interface GiftCommand {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly recipientCharacterId: string;
  readonly amountCredits: number;
  readonly createdAt: string;
}

export interface GiftAdmission {
  readonly requestId: string;
  readonly transfer: CreditTransferAdmission;
  readonly recipientCharacterId: string;
  readonly economicReason: "gift";
  readonly acquisitionCommissionEligible: false;
}

function characterId(value: string): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 256) {
    throw new TypeError("recipientCharacterId is invalid");
  }
  return value.trim();
}

export function admitGift(command: GiftCommand): GiftAdmission {
  if (command.schemaVersion !== 1) throw new TypeError("Unsupported Gift schema");
  const transferCommand: CreditTransferCommand = {
    schemaVersion: 1,
    requestId: command.requestId,
    senderUserId: command.senderUserId,
    recipientUserId: command.recipientUserId,
    amountCredits: command.amountCredits,
    provenanceClass: "gift",
    createdAt: command.createdAt,
  };
  const transfer = admitCreditTransfer(transferCommand);
  return Object.freeze({
    requestId: transfer.requestId,
    transfer,
    recipientCharacterId: characterId(command.recipientCharacterId),
    economicReason: "gift",
    acquisitionCommissionEligible: false,
  });
}
