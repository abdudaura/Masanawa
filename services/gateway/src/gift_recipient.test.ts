import { describe, expect, it } from "vitest";
import type { CharacterOwnershipReader } from "@masanawa/identity";
import { createGiftRecipientResolver } from "./gift_recipient.js";

describe("gift recipient resolver", () => {
  it("resolves the owner of a personal twin from canonical Identity ownership", async () => {
    const ownership: CharacterOwnershipReader = {
      async readForCharacter(input) {
        return {
          tenantId: input.tenantId,
          characterId: input.characterId,
          kind: "personal-clone",
          ownerUserId: "user-owner" as never,
          createdAt: "2026-10-05T09:00:00Z" as never,
        };
      },
    };

    const result = await createGiftRecipientResolver({ ownership }).resolveByCharacter({
      tenantId: "tenant-1",
      senderUserId: "user-sender",
      characterId: "character-1",
    });

    expect(result.recipientUserId).toBe("user-owner");
    expect(result.characterId).toBe("character-1");
  });

  it("rejects platform/business Characters for personal gifts", async () => {
    const ownership: CharacterOwnershipReader = {
      async readForCharacter(input) {
        return {
          tenantId: input.tenantId,
          characterId: input.characterId,
          kind: "business",
          ownerUserId: "user-owner" as never,
          createdAt: "2026-10-05T09:00:00Z" as never,
        };
      },
    };

    await expect(
      createGiftRecipientResolver({ ownership }).resolveByCharacter({
        tenantId: "tenant-1",
        senderUserId: "user-sender",
        characterId: "character-1",
      }),
    ).rejects.toThrow("personal twins");
  });

  it("rejects gifts to your own twin", async () => {
    const ownership: CharacterOwnershipReader = {
      async readForCharacter(input) {
        return {
          tenantId: input.tenantId,
          characterId: input.characterId,
          kind: "personal-clone",
          ownerUserId: "user-same" as never,
          createdAt: "2026-10-05T09:00:00Z" as never,
        };
      },
    };

    await expect(
      createGiftRecipientResolver({ ownership }).resolveByCharacter({
        tenantId: "tenant-1",
        senderUserId: "user-same",
        characterId: "character-1",
      }),
    ).rejects.toThrow("yourself");
  });
});
