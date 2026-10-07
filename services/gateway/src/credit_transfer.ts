export interface CreditTransferAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface CreditTransferAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "credits.transfer";
  }): Promise<CreditTransferAuthority>;
}

export interface CreditRecipientResolver {
  resolve(input: {
    readonly tenantId: string;
    readonly senderUserId: string;
    readonly recipient: string;
  }): Promise<{ readonly recipientUserId: string }>;
}

export interface CreditTransferGuard {
  assertAllowed(input: {
    readonly tenantId: string;
    readonly senderUserId: string;
    readonly recipientUserId: string;
    readonly amountCredits: number;
    readonly operation: "transfer";
  }): Promise<void>;
}

export interface CreditTransferExecutor {
  execute(input: {
    readonly tenantId: string;
    readonly requestId: string;
    readonly senderUserId: string;
    readonly recipientUserId: string;
    readonly amountCredits: number;
    readonly reason: "internal-transfer";
  }): Promise<{
    readonly transferId: string;
    readonly amountCredits: number;
    readonly status: "completed";
    readonly completedAt: string;
  }>;
}

export interface CreditTransferService {
  transfer(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly recipient: string;
    readonly amountCredits: number;
  }): Promise<{
    readonly transferId: string;
    readonly recipientUserId: string;
    readonly amountCredits: number;
    readonly status: "completed";
    readonly commissionEligible: false;
    readonly completedAt: string;
  }>;
}

function text(value: string, name: string, max = 256): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return value.trim();
}

function amount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000_000) {
    throw new RangeError("amountCredits is invalid");
  }
  return value;
}

export function createCreditTransferService(input: {
  readonly authorizer: CreditTransferAuthorizer;
  readonly recipients: CreditRecipientResolver;
  readonly guard: CreditTransferGuard;
  readonly executor: CreditTransferExecutor;
}): CreditTransferService {
  return Object.freeze<CreditTransferService>({
    async transfer(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "credits.transfer",
      });
      const requestId = text(request.requestId, "requestId");
      const recipient = text(request.recipient, "recipient");
      const amountCredits = amount(request.amountCredits);
      const resolved = await input.recipients.resolve({
        tenantId: authority.tenantId,
        senderUserId: authority.userId,
        recipient,
      });
      if (resolved.recipientUserId === authority.userId) {
        throw new Error("Cannot transfer Credits to yourself");
      }
      await input.guard.assertAllowed({
        tenantId: authority.tenantId,
        senderUserId: authority.userId,
        recipientUserId: resolved.recipientUserId,
        amountCredits,
        operation: "transfer",
      });
      const result = await input.executor.execute({
        tenantId: authority.tenantId,
        requestId,
        senderUserId: authority.userId,
        recipientUserId: resolved.recipientUserId,
        amountCredits,
        reason: "internal-transfer",
      });
      if (result.amountCredits !== amountCredits) {
        throw new Error("Transfer executor returned a mismatched amount");
      }
      return Object.freeze({
        transferId: result.transferId,
        recipientUserId: resolved.recipientUserId,
        amountCredits: result.amountCredits,
        status: result.status,
        commissionEligible: false as const,
        completedAt: result.completedAt,
      });
    },
  });
}
