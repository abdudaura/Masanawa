import { describe, expect, it } from "vitest";
import {
  createCreditTransferService,
  type CreditRecipientResolver,
  type CreditTransferAuthorizer,
  type CreditTransferExecutor,
  type CreditTransferGuard,
} from "./credit_transfer.js";
import {
  createGiftService,
  type GiftAuthorizer,
  type GiftExecutor,
  type GiftGuard,
  type GiftRecipientResolver,
} from "./gifts.js";

describe("Credit transfer service", () => {
  it("uses authenticated sender identity and returns non-commissionable receipt", async () => {
    const authorizer: CreditTransferAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1", userId: "user-a" };
      },
    };
    const recipients: CreditRecipientResolver = {
      async resolve(input) {
        expect(input.senderUserId).toBe("user-a");
        return { recipientUserId: "user-b" };
      },
    };
    const guard: CreditTransferGuard = {
      async assertAllowed(input) {
        expect(input.operation).toBe("transfer");
        expect(input.amountCredits).toBe(250);
      },
    };
    const executor: CreditTransferExecutor = {
      async execute(input) {
        expect(input.senderUserId).toBe("user-a");
        expect(input.recipientUserId).toBe("user-b");
        expect(input.reason).toBe("internal-transfer");
        return {
          transferId: "transfer-1",
          amountCredits: input.amountCredits,
          status: "completed",
          completedAt: "2026-10-05T09:30:00Z",
        };
      },
    };
    const service = createCreditTransferService({
      authorizer,
      recipients,
      guard,
      executor,
    });

    const receipt = await service.transfer({
      authorizationHeader: "Bearer user",
      requestId: "request-transfer-001",
      recipient: "@friend",
      amountCredits: 250,
    });

    expect(receipt.recipientUserId).toBe("user-b");
    expect(receipt.commissionEligible).toBe(false);
  });

  it("rejects self-transfer after recipient resolution", async () => {
    const service = createCreditTransferService({
      authorizer: {
        async authorize() {
          return { tenantId: "tenant-1", userId: "user-a" };
        },
      },
      recipients: {
        async resolve() {
          return { recipientUserId: "user-a" };
        },
      },
      guard: {
        async assertAllowed() {
          throw new Error("must not reach guard");
        },
      },
      executor: {
        async execute() {
          throw new Error("must not execute");
        },
      },
    });

    await expect(
      service.transfer({
        authorizationHeader: "Bearer user",
        requestId: "request-transfer-002",
        recipient: "me",
        amountCredits: 1,
      }),
    ).rejects.toThrow("yourself");
  });
});

describe("Gift service", () => {
  it("resolves the twin owner on the server and never creates acquisition commission", async () => {
    const authorizer: GiftAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1", userId: "user-a" };
      },
    };
    const recipients: GiftRecipientResolver = {
      async resolveByCharacter(input) {
        expect(input.characterId).toBe("character-b");
        return {
          recipientUserId: "user-b",
          characterId: "character-b",
        };
      },
    };
    const guard: GiftGuard = {
      async assertAllowed(input) {
        expect(input.operation).toBe("gift");
      },
    };
    const executor: GiftExecutor = {
      async execute(input) {
        return {
          giftId: "gift-1",
          amountCredits: input.amountCredits,
          status: "completed",
          completedAt: "2026-10-05T09:31:00Z",
        };
      },
    };
    const service = createGiftService({
      authorizer,
      recipients,
      guard,
      executor,
    });

    const receipt = await service.gift({
      authorizationHeader: "Bearer user",
      requestId: "request-gift-001",
      characterId: "character-b",
      amountCredits: 100,
    });

    expect(receipt.recipientUserId).toBe("user-b");
    expect(receipt.acquisitionCommissionEligible).toBe(false);
  });
});
