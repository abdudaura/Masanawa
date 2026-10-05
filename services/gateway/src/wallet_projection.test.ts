import { describe, expect, it } from "vitest";
import {
  createWalletProjectionService,
  type WalletAuthorizer,
  type WalletBalanceSource,
  type WalletHistorySource,
} from "./wallet_projection.js";

describe("wallet projection", () => {
  it("returns only the three consumer balances plus unified history", async () => {
    const authorizer: WalletAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("wallet.read");
        return { tenantId: "tenant-1", userId: "user-1" };
      },
    };
    const balances: WalletBalanceSource = {
      async readBalances() {
        return {
          spendableCredits: 5000,
          pendingEarningsCredits: 300,
          availableEarningsCredits: 900,
        };
      },
    };
    const history: WalletHistorySource = {
      async listHistory() {
        return [
          {
            id: "entry-old",
            kind: "purchase",
            title: "Data bundle",
            amountCredits: 100,
            incoming: false,
            createdAt: "2026-10-05T08:00:00Z",
          },
          {
            id: "entry-new",
            kind: "gift",
            title: "Gift received",
            amountCredits: 50,
            incoming: true,
            createdAt: "2026-10-05T09:00:00Z",
          },
        ];
      },
    };

    const view = await createWalletProjectionService({
      authorizer,
      balances,
      history,
    }).read({ authorizationHeader: "Bearer user" });

    expect(view.spendableCredits).toBe(5000);
    expect(view.pendingEarningsCredits).toBe(300);
    expect(view.availableEarningsCredits).toBe(900);
    expect(view.entries.map((entry) => entry.id)).toEqual([
      "entry-new",
      "entry-old",
    ]);
    expect(JSON.stringify(view)).not.toContain("agentFloat");
    expect(JSON.stringify(view)).not.toContain("reserve");
    expect(JSON.stringify(view)).not.toContain("provider");
  });

  it("rejects a source that returns invalid financial values", async () => {
    const service = createWalletProjectionService({
      authorizer: {
        async authorize() {
          return { tenantId: "tenant-1", userId: "user-1" };
        },
      },
      balances: {
        async readBalances() {
          return {
            spendableCredits: -1,
            pendingEarningsCredits: 0,
            availableEarningsCredits: 0,
          };
        },
      },
      history: {
        async listHistory() {
          return [];
        },
      },
    });

    await expect(
      service.read({ authorizationHeader: "Bearer user" }),
    ).rejects.toThrow("spendableCredits");
  });
});
