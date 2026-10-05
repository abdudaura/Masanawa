export interface GiftAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface GiftAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "credits.gift";
  }): Promise<GiftAuthority>;
}

export interface GiftRecipientResolver {
  resolveByCharacter(input: {
    readonly tenantId: string;
    readonly senderUserId: string;
    readonly characterId: string;
  }): Promise<{
    readonly recipientUserId: string;
    readonly characterId: string;
  }>;
}

export interface GiftGuard {
  assertAllowed(input: {
    readonly tenantId: string;
    readonly senderUserId: string;
    readonly recipientUserId: string;
    readonly characterId: string;
    readonly amountCredits: number;
    readonly operation: "gift";
  }): Promise<void>;
}

export interface GiftExecutor {
  execute(input: {
    readonly tenantId: string;
    readonly requestId: string;
    readonly senderUserId: string;
    readonly recipientUserId: string;
    readonly recipientCharacterId: string;
    readonly amountCredits: number;
    readonly reason: "gift";
  }): Promise<{
    readonly giftId: string;
    readonly amountCredits: number;
    readonly status: "completed";
    readonly completedAt: string;
  }>;
}

export interface GiftService {
  gift(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly characterId: string;
    readonly amountCredits: number;
  }): Promise<{
    readonly giftId: string;
    readonly recipientUserId: string;
    readonly characterId: string;
    readonly amountCredits: number;
    readonly status: "completed";
    readonly acquisitionCommissionEligible: false;
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

export function createGiftService(input: {
  readonly authorizer: GiftAuthorizer;
  readonly recipients: GiftRecipientResolver;
  readonly guard: GiftGuard;
  readonly executor: GiftExecutor;
}): GiftService {
  return Object.freeze({
    async gift(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "credits.gift",
      });
      const requestId = text(request.requestId, "requestId");
      const characterId = text(request.characterId, "characterId");
      const amountCredits = amount(request.amountCredits);
      const resolved = await input.recipients.resolveByCharacter({
        tenantId: authority.tenantId,
        senderUserId: authority.userId,
        characterId,
      });
      if (resolved.recipientUserId === authority.userId) {
        throw new Error("Cannot gift yourself");
      }
      await input.guard.assertAllowed({
        tenantId: authority.tenantId,
        senderUserId: authority.userId,
        recipientUserId: resolved.recipientUserId,
        characterId: resolved.characterId,
        amountCredits,
        operation: "gift",
      });
      const result = await input.executor.execute({
        tenantId: authority.tenantId,
        requestId,
        senderUserId: authority.userId,
        recipientUserId: resolved.recipientUserId,
        recipientCharacterId: resolved.characterId,
        amountCredits,
        reason: "gift",
      });
      if (result.amountCredits !== amountCredits) {
        throw new Error("Gift executor returned a mismatched amount");
      }
      return Object.freeze({
        giftId: result.giftId,
        recipientUserId: resolved.recipientUserId,
        characterId: resolved.characterId,
        amountCredits: result.amountCredits,
        status: result.status,
        acquisitionCommissionEligible: false as const,
        completedAt: result.completedAt,
      });
    },
  });
}
