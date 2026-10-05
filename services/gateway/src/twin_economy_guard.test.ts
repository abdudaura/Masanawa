import { describe, expect, it } from "vitest";
import {
  createTwinEconomyGuardService,
  type TwinEconomyGuardHistoryPort,
  type TwinEconomyGuardPolicyPort,
} from "./twin_economy_guard.js";

describe("twin economy Gateway guard", () => {
  it("combines active policy and recent history before admission", async () => {
    const policies: TwinEconomyGuardPolicyPort = {
      async readPolicy(input) {
        return {
          revision: 1,
          operation: input.operation,
          enabled: true,
          minAmountCredits: 1,
          maxAmountCredits: 1000,
          maxOperationsPerHour: 3,
          maxOperationsPerDay: 10,
        };
      },
    };
    const history: TwinEconomyGuardHistoryPort = {
      async counts() {
        return { operationsLastHour: 3, operationsLastDay: 3 };
      },
    };

    const service = createTwinEconomyGuardService({ policies, history });
    const decision = await service.preflight({
      tenantId: "tenant-1",
      actorUserId: "user-a",
      operation: "gift",
      amountCredits: 100,
      recipientUserId: "user-b",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("hourly-limit");
  });

  it("rejects self-attribution before downstream Commerce work", async () => {
    const policies: TwinEconomyGuardPolicyPort = {
      async readPolicy(input) {
        return {
          revision: 1,
          operation: input.operation,
          enabled: true,
          minAmountCredits: 0,
          maxAmountCredits: 100000,
          maxOperationsPerHour: 50,
          maxOperationsPerDay: 500,
        };
      },
    };
    const history: TwinEconomyGuardHistoryPort = {
      async counts() {
        return { operationsLastHour: 0, operationsLastDay: 0 };
      },
    };
    const service = createTwinEconomyGuardService({ policies, history });
    const decision = await service.preflight({
      tenantId: "tenant-1",
      actorUserId: "user-a",
      operation: "purchase-attribution",
      amountCredits: 5000,
      attributedOwnerUserId: "user-a",
    });

    expect(decision.reason).toBe("self-attribution");
  });
});
