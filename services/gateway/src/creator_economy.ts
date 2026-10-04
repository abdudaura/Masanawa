import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import type { CommerceRepository } from "@masanawa/commerce";
import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
import type { CreatorAuthorizer } from "./creator_clone.js";

export interface CreatorEconomySnapshot {
  readonly hasClone: boolean;
  readonly characterId: string | null;
  readonly customerCredits: number;
  readonly agentFloatCredits: number;
  readonly pendingEarningsCredits: number;
  readonly availableEarningsCredits: number;
}

export interface CreatorEconomyService {
  read(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<CreatorEconomySnapshot>;

  allocateFloat(input: {
    readonly authorizationHeader: string | undefined;
    readonly amountCredits: number;
  }): Promise<CreatorEconomySnapshot>;
}

export function createCreatorEconomyService(input: {
  readonly authorizer: CreatorAuthorizer;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly commerce: CommerceRepository;
}): CreatorEconomyService {
  async function snapshot(
    authorizationHeader: string | undefined,
    capability: "creator.economy.read" | "creator.float.write",
  ): Promise<{
    readonly authority: Awaited<ReturnType<CreatorAuthorizer["authorize"]>>;
    readonly clone:
      | Awaited<
          ReturnType<PersonalCloneProvisioningRepository["readPersonalClone"]>
        >
      | null;
    readonly value: CreatorEconomySnapshot;
  }> {
    const authority = await input.authorizer.authorize({
      authorizationHeader,
      capability,
    });
    const clone = await input.personalClones.readPersonalClone({
      tenantId: authority.tenantId,
      userId: authority.userId,
    });

    const customerCredits = await input.commerce.readBalance({
      tenantId: authority.tenantId,
      kind: "customer-credit",
      userId: authority.userId,
      characterId: null,
    });

    if (!clone) {
      return Object.freeze({
        authority,
        clone: null,
        value: Object.freeze({
          hasClone: false,
          characterId: null,
          customerCredits,
          agentFloatCredits: 0,
          pendingEarningsCredits: 0,
          availableEarningsCredits: 0,
        }),
      });
    }

    const creator = await input.commerce.readCreatorCommercialSnapshot({
      tenantId: authority.tenantId,
      userId: authority.userId,
      characterId: clone.characterId,
    });

    return Object.freeze({
      authority,
      clone,
      value: Object.freeze({
        hasClone: true,
        characterId: clone.characterId,
        customerCredits,
        ...creator,
      }),
    });
  }

  return Object.freeze({
    async read(request) {
      return (await snapshot(
        request.authorizationHeader,
        "creator.economy.read",
      )).value;
    },

    async allocateFloat(request) {
      if (
        !Number.isSafeInteger(request.amountCredits) ||
        request.amountCredits < 1 ||
        request.amountCredits > 1_000_000_000
      ) {
        throw new RangeError("amountCredits is invalid");
      }

      const current = await snapshot(
        request.authorizationHeader,
        "creator.float.write",
      );
      if (!current.clone) {
        throw new Error("Create a personal clone before adding Agent Float");
      }

      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: createCanonicalId("ledger-entry"),
        tenantId: current.authority.tenantId,
        debit: {
          tenantId: current.authority.tenantId,
          kind: "customer-credit",
          userId: current.authority.userId,
          characterId: null,
        },
        credit: {
          tenantId: current.authority.tenantId,
          kind: "agent-float",
          userId: current.authority.userId,
          characterId: current.clone.characterId,
        },
        amountCredits: request.amountCredits,
        reason: "agent-float-topup",
        quoteId: null,
        fulfillmentId: null,
        createdAt: nowInstant(),
      });

      return (await snapshot(
        request.authorizationHeader,
        "creator.economy.read",
      )).value;
    },
  });
}
