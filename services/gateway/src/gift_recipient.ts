import type { CharacterOwnershipReader } from "@masanawa/identity";
import type { GiftRecipientResolver } from "./gifts.js";

export function createGiftRecipientResolver(input: {
  readonly ownership: CharacterOwnershipReader;
}): GiftRecipientResolver {
  return Object.freeze({
    async resolveByCharacter(request) {
      const record = await input.ownership.readForCharacter({
        tenantId: request.tenantId as never,
        characterId: request.characterId as never,
      });

      if (!record || record.ownerUserId === null) {
        throw new Error("Twin does not have an eligible owner");
      }
      if (record.kind !== "personal-clone") {
        throw new Error("Gifts are only available for personal twins");
      }
      if (record.ownerUserId === request.senderUserId) {
        throw new Error("Cannot gift yourself");
      }

      return Object.freeze({
        recipientUserId: record.ownerUserId,
        characterId: record.characterId,
      });
    },
  });
}
