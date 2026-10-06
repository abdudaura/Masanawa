import { describe, expect, it } from "vitest";
import type { CharacterOwnershipReader } from "@masanawa/identity";
import {
  createGiftRecipientResolver,
} from "../../services/gateway/src/gift_recipient.js";
import {
  createGiftService,
  type GiftExecutor,
  type GiftGuard,
} from "../../services/gateway/src/gifts.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001";
const senderUserId = "user_00000000-0000-4000-8000-000000000002";
const ownerUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const characterId = "character_00000000-0000-4000-8000-000000000004" as never;

function ownership(owner: string): CharacterOwnershipReader {
  return {
    async readForCharacter(input) {
      return {
        tenantId: input.tenantId,
        characterId: input.characterId,
        kind: "personal-clone",
        ownerUserId: owner as never,
        createdAt: "2026-10-05T09:00:00.000Z" as never,
      };
    },
  };
}

describe("TWIN-103 gift -> correct owner receipt acceptance", () => {
  it("resolves the canonical personal-Twin owner and returns that owner in the receipt", async () => {
    const recipients = createGiftRecipientResolver({
      ownership: ownership(ownerUserId),
    });

    let executed:
      | {
          senderUserId: string;
          recipientUserId: string;
          recipientCharacterId: string;
          amountCredits: number;
          reason: string;
        }
      | undefined;

    const guard: GiftGuard = {
      async assertAllowed(input) {
        expect(input).toMatchObject({
          tenantId,
          senderUserId,
          recipientUserId: ownerUserId,
          characterId,
          amountCredits: 125,
          operation: "gift",
        });
      },
    };

    const executor: GiftExecutor = {
      async execute(input) {
        executed = {
          senderUserId: input.senderUserId,
          recipientUserId: input.recipientUserId,
          recipientCharacterId: input.recipientCharacterId,
          amountCredits: input.amountCredits,
          reason: input.reason,
        };
        return {
          giftId: "gift-acceptance-001",
          amountCredits: input.amountCredits,
          status: "completed",
          completedAt: "2026-10-06T10:20:00.000Z",
        };
      },
    };

    const service = createGiftService({
      authorizer: {
        async authorize(input) {
          expect(input.capability).toBe("credits.gift");
          return { tenantId, userId: senderUserId };
        },
      },
      recipients,
      guard,
      executor,
    });

    const receipt = await service.gift({
      authorizationHeader: "Bearer visitor-session",
      requestId: "request-gift-acceptance-001",
      characterId,
      amountCredits: 125,
    });

    expect(executed).toEqual({
      senderUserId,
      recipientUserId: ownerUserId,
      recipientCharacterId: characterId,
      amountCredits: 125,
      reason: "gift",
    });
    expect(receipt).toMatchObject({
      giftId: "gift-acceptance-001",
      recipientUserId: ownerUserId,
      characterId,
      amountCredits: 125,
      status: "completed",
      acquisitionCommissionEligible: false,
    });
  });

  it("rejects gifting the sender's own personal Twin before any guard or executor side effect", async () => {
    let guardCalled = false;
    let executorCalled = false;

    const service = createGiftService({
      authorizer: {
        async authorize() {
          return { tenantId, userId: senderUserId };
        },
      },
      recipients: createGiftRecipientResolver({
        ownership: ownership(senderUserId),
      }),
      guard: {
        async assertAllowed() {
          guardCalled = true;
        },
      },
      executor: {
        async execute() {
          executorCalled = true;
          throw new Error("must not execute");
        },
      },
    });

    await expect(
      service.gift({
        authorizationHeader: "Bearer owner-session",
        requestId: "request-gift-self-001",
        characterId,
        amountCredits: 10,
      }),
    ).rejects.toThrow("yourself");

    expect(guardCalled).toBe(false);
    expect(executorCalled).toBe(false);
  });

  it("rejects a non-personal Character as a gift destination before execution", async () => {
    let executorCalled = false;
    const nonPersonalOwnership: CharacterOwnershipReader = {
      async readForCharacter(input) {
        return {
          tenantId: input.tenantId,
          characterId: input.characterId,
          kind: "business",
          ownerUserId,
          createdAt: "2026-10-05T09:00:00.000Z" as never,
        };
      },
    };

    const service = createGiftService({
      authorizer: {
        async authorize() {
          return { tenantId, userId: senderUserId };
        },
      },
      recipients: createGiftRecipientResolver({
        ownership: nonPersonalOwnership,
      }),
      guard: {
        async assertAllowed() {
          throw new Error("must not reach guard");
        },
      },
      executor: {
        async execute() {
          executorCalled = true;
          throw new Error("must not execute");
        },
      },
    });

    await expect(
      service.gift({
        authorizationHeader: "Bearer visitor-session",
        requestId: "request-gift-business-001",
        characterId,
        amountCredits: 10,
      }),
    ).rejects.toThrow("personal twins");

    expect(executorCalled).toBe(false);
  });
});
