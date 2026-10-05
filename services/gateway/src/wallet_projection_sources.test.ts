import { describe, expect, it } from "vitest";
import type { CommerceRepository } from "@masanawa/commerce";
import type { PersonalCloneProvisioningRepository } from "@masanawa/identity";
import {
  createCanonicalWalletBalanceSource,
  createMergedWalletHistorySource,
} from "./wallet_projection_sources.js";

describe("canonical Wallet projection sources", () => {
  it("maps customer Credits and creator earnings while hiding Agent Float", async () => {
    const commerce = {
      async readBalance() {
        return 5000;
      },
      async readCreatorCommercialSnapshot() {
        return {
          agentFloatCredits: 9999,
          pendingEarningsCredits: 250,
          availableEarningsCredits: 800,
        };
      },
    } as unknown as CommerceRepository;
    const personalClones = {
      async readPersonalClone() {
        return {
          characterId:
            "character_00000000-0000-4000-8000-000000000003",
          characterVersionId:
            "character-version_00000000-0000-4000-8000-000000000004",
          relationshipId:
            "relationship_00000000-0000-4000-8000-000000000005",
        };
      },
    } as unknown as PersonalCloneProvisioningRepository;

    const source = createCanonicalWalletBalanceSource({
      commerce,
      personalClones,
    });
    const view = await source.readBalances({
      tenantId: "tenant-1",
      userId: "user-1",
    });

    expect(view).toEqual({
      spendableCredits: 5000,
      pendingEarningsCredits: 250,
      availableEarningsCredits: 800,
    });
    expect(JSON.stringify(view)).not.toContain("9999");
  });

  it("returns zero creator earnings when no personal twin exists", async () => {
    const commerce = {
      async readBalance() {
        return 200;
      },
      async readCreatorCommercialSnapshot() {
        throw new Error("must not read creator snapshot");
      },
    } as unknown as CommerceRepository;
    const personalClones = {
      async readPersonalClone() {
        return null;
      },
    } as unknown as PersonalCloneProvisioningRepository;

    const view = await createCanonicalWalletBalanceSource({
      commerce,
      personalClones,
    }).readBalances({
      tenantId: "tenant-1",
      userId: "user-1",
    });

    expect(view.availableEarningsCredits).toBe(0);
    expect(view.spendableCredits).toBe(200);
  });

  it("merges and deduplicates history from independent sources", async () => {
    const merged = createMergedWalletHistorySource({
      sources: [
        {
          async list() {
            return [
              {
                id: "gift-1",
                kind: "gift" as const,
                title: "Gift received",
                amountCredits: 50,
                incoming: true,
                createdAt: "2026-10-05T09:00:00Z",
              },
            ];
          },
        },
        {
          async list() {
            return [
              {
                id: "purchase-1",
                kind: "purchase" as const,
                title: "Data bundle",
                amountCredits: 100,
                incoming: false,
                createdAt: "2026-10-05T10:00:00Z",
              },
            ];
          },
        },
      ],
    });

    const history = await merged.listHistory({
      tenantId: "tenant-1",
      userId: "user-1",
      limit: 50,
    });
    expect(history.map((entry) => entry.id)).toEqual([
      "purchase-1",
      "gift-1",
    ]);
  });
});
