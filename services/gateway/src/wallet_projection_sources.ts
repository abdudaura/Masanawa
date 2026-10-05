import type { CommerceRepository } from "@masanawa/commerce";
import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
import type {
  WalletBalanceSnapshot,
  WalletBalanceSource,
  WalletHistoryRecord,
  WalletHistorySource,
} from "./wallet_projection.js";

export function createCanonicalWalletBalanceSource(input: {
  readonly commerce: CommerceRepository;
  readonly personalClones: PersonalCloneProvisioningRepository;
}): WalletBalanceSource {
  return Object.freeze<WalletBalanceSource>({
    async readBalances(request): Promise<WalletBalanceSnapshot> {
      const spendableCredits = await input.commerce.readBalance({
        tenantId: request.tenantId as never,
        kind: "customer-credit",
        userId: request.userId as never,
        characterId: null,
      });

      const clone = await input.personalClones.readPersonalClone({
        tenantId: request.tenantId as never,
        userId: request.userId as never,
      });

      if (!clone) {
        return Object.freeze({
          spendableCredits,
          pendingEarningsCredits: 0,
          availableEarningsCredits: 0,
        });
      }

      const creator = await input.commerce.readCreatorCommercialSnapshot({
        tenantId: request.tenantId as never,
        userId: request.userId as never,
        characterId: clone.characterId,
      });

      return Object.freeze({
        spendableCredits,
        pendingEarningsCredits: creator.pendingEarningsCredits,
        availableEarningsCredits: creator.availableEarningsCredits,
      });
    },
  });
}

export interface WalletHistorySubsource {
  list(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly limit: number;
  }): Promise<readonly WalletHistoryRecord[]>;
}

export function createMergedWalletHistorySource(input: {
  readonly sources: readonly WalletHistorySubsource[];
}): WalletHistorySource {
  return Object.freeze<WalletHistorySource>({
    async listHistory(request) {
      if (input.sources.length === 0) return Object.freeze([]);
      const pages = await Promise.all(
        input.sources.map((source) => source.list(request)),
      );
      const byId = new Map<string, WalletHistoryRecord>();
      for (const page of pages) {
        for (const record of page) {
          const existing = byId.get(record.id);
          if (
            existing &&
            JSON.stringify(existing) !== JSON.stringify(record)
          ) {
            throw new Error(
              `Wallet history sources disagree on record ${record.id}`,
            );
          }
          byId.set(record.id, record);
        }
      }
      return Object.freeze(
        [...byId.values()]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, request.limit),
      );
    },
  });
}
