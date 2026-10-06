import { describe, expect, it } from "vitest";
import type { CharacterOwnershipReader } from "@masanawa/identity";
import { createGiftRecipientResolver } from "../../services/gateway/src/gift_recipient.js";
import {
  createGiftService,
  type GiftExecutor,
  type GiftGuard,
} from "../../services/gateway/src/gifts.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001";
const senderUserId = "user_00000000-0000-4000-8000-000000000002";
const ownerUserId = "user_00000000-0000-4000-8000-000000000003" as never;
const characterId = "character_00000000-0000-4000-8000-000000000004" as never;

function ownership(kind: "personal-clone" | "business" = "personal-clone"): CharacterOwnershipReader {
  return {
    async readForCharacter(input) {
      return {
        tenantId: input.tenantId,
        characterId: input.characterId,
        kind,
        ownerUserId,
        createdAt: "2026-10-05T09:00:00.000Z" as never,
      };
    },
  };
}

class ReplaySafeGiftExecutor implements GiftExecutor {
  readonly balances: Record<string, number> = {
    [senderUserId]: 1_000,
    [ownerUserId]: 0,
  };

  readonly #receipts = new Map<
    string,
    {
      fingerprint: string;
      result: {
        giftId: string;
        amountCredits: number;
        status: "completed";
        completedAt: string;
      };
    }
  >();

  async execute(input: Parameters<GiftExecutor["execute"]>[0]) {
    const fingerprint = JSON.stringify({
      senderUserId: input.senderUserId,
      recipientUserId: input.recipientUserId,
      recipientCharacterId: input.recipientCharacterId,
      amountCredits: input.amountCredits,
      reason: input.reason,
    });

    const existing = this.#receipts.get(input.requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("Gift replay fingerprint conflict");
      }
      return existing.result;
    }

    const sender = this.balances[input.senderUserId] ?? 0;
    if (sender < input.amountCredits) {
      throw new Error("insufficient balance");
    }

    this.balances[input.senderUserId] = sender - input.amountCredits;
    this.balances[input.recipientUserId] =
      (this.balances[input.recipientUserId] ?? 0) + input.amountCredits;

    const result = Object.freeze({
      giftId: `gift:${input.requestId}`,
      amountCredits: input.amountCredits,
      status: "completed" as const,
      completedAt: "2026-10-06T12:00:01.000Z",
    });
    this.#receipts.set(input.requestId, { fingerprint, result });
    return result;
  }
}

function service(executor: GiftExecutor, ownerKind: "personal-clone" | "business" = "personal-clone") {
  const guard: GiftGuard = {
    async assertAllowed() {},
  };

  return createGiftService({
    authorizer: {
      async authorize() {
        return { tenantId, userId: senderUserId };
      },
    },
    recipients: createGiftRecipientResolver({
      ownership: ownership(ownerKind),
    }),
    guard,
    executor,
  });
}

describe("TWIN-106 gift retry recovery acceptance", () => {
  it("applies gift value once across crash after executor effect and exact retry", async () => {
    const executor = new ReplaySafeGiftExecutor();
    const gifts = service(executor);

    const first = await gifts.gift({
      authorizationHeader: "Bearer fixture",
      requestId: "gift-request-0001",
      characterId,
      amountCredits: 125,
    });

    expect(executor.balances).toEqual({
      [senderUserId]: 875,
      [ownerUserId]: 125,
    });

    // Simulate caller crash after executor committed but before local receipt
    // acknowledgement. Recovery repeats the exact canonical gift request.
    const retry = await gifts.gift({
      authorizationHeader: "Bearer fixture",
      requestId: "gift-request-0001",
      characterId,
      amountCredits: 125,
    });

    expect(retry).toEqual(first);
    expect(retry).toMatchObject({
      recipientUserId: ownerUserId,
      characterId,
      amountCredits: 125,
      status: "completed",
      acquisitionCommissionEligible: false,
    });
    expect(executor.balances).toEqual({
      [senderUserId]: 875,
      [ownerUserId]: 125,
    });
  });

  it("rejects changed amount under the same gift request identity", async () => {
    const executor = new ReplaySafeGiftExecutor();
    const gifts = service(executor);

    await gifts.gift({
      authorizationHeader: "Bearer fixture",
      requestId: "gift-request-conflict",
      characterId,
      amountCredits: 100,
    });

    await expect(
      gifts.gift({
        authorizationHeader: "Bearer fixture",
        requestId: "gift-request-conflict",
        characterId,
        amountCredits: 101,
      }),
    ).rejects.toThrow("fingerprint conflict");

    expect(executor.balances).toEqual({
      [senderUserId]: 900,
      [ownerUserId]: 100,
    });
  });

  it("preserves recipient Character and gift/no-commission semantics on replay", async () => {
    const executor = new ReplaySafeGiftExecutor();
    const gifts = service(executor);

    const first = await gifts.gift({
      authorizationHeader: "Bearer fixture",
      requestId: "gift-request-semantics",
      characterId,
      amountCredits: 50,
    });
    const retry = await gifts.gift({
      authorizationHeader: "Bearer fixture",
      requestId: "gift-request-semantics",
      characterId,
      amountCredits: 50,
    });

    expect(retry).toEqual(first);
    expect(retry.characterId).toBe(characterId);
    expect(retry.recipientUserId).toBe(ownerUserId);
    expect(retry.acquisitionCommissionEligible).toBe(false);
  });

  it("rejects non-personal destinations before executor effects", async () => {
    const executor = new ReplaySafeGiftExecutor();
    const gifts = service(executor, "business");

    await expect(
      gifts.gift({
        authorizationHeader: "Bearer fixture",
        requestId: "gift-request-business",
        characterId,
        amountCredits: 50,
      }),
    ).rejects.toThrow("personal twins");

    expect(executor.balances).toEqual({
      [senderUserId]: 1_000,
      [ownerUserId]: 0,
    });
  });

  it("rejects self-gift before executor effects", async () => {
    const executor = new ReplaySafeGiftExecutor();
    const selfOwnership: CharacterOwnershipReader = {
      async readForCharacter(input) {
        return {
          tenantId: input.tenantId,
          characterId: input.characterId,
          kind: "personal-clone",
          ownerUserId: senderUserId as never,
          createdAt: "2026-10-05T09:00:00.000Z" as never,
        };
      },
    };

    const gifts = createGiftService({
      authorizer: {
        async authorize() {
          return { tenantId, userId: senderUserId };
        },
      },
      recipients: createGiftRecipientResolver({ ownership: selfOwnership }),
      guard: {
        async assertAllowed() {
          throw new Error("must not reach guard");
        },
      },
      executor,
    });

    await expect(
      gifts.gift({
        authorizationHeader: "Bearer fixture",
        requestId: "gift-request-self",
        characterId,
        amountCredits: 25,
      }),
    ).rejects.toThrow("yourself");

    expect(executor.balances).toEqual({
      [senderUserId]: 1_000,
      [ownerUserId]: 0,
    });
  });
});
