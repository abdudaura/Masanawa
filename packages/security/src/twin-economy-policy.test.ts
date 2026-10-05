import { describe, expect, it } from "vitest";
import {
  guardTwinEconomyOperation,
  type TwinEconomyLimitPolicy,
} from "./twin-economy-policy.js";
import { detectCircularTwinEconomyValue } from "./twin-economy-cycles.js";
import { decideWithdrawableTwinEarnings } from "./twin-economy-earnings.js";

const policy: TwinEconomyLimitPolicy = {
  revision: 1,
  operation: "credit-transfer",
  enabled: true,
  minAmountCredits: 1,
  maxAmountCredits: 100000,
  maxOperationsPerHour: 20,
  maxOperationsPerDay: 100,
};

describe("twin economy abuse controls", () => {
  it("rejects self-transfer", () => {
    expect(
      guardTwinEconomyOperation({
        policy,
        attempt: {
          operation: "credit-transfer",
          amountCredits: 100,
          actor: {
            actorUserId: "user-a",
            recipientUserId: "user-a",
          },
          operationsLastHour: 0,
          operationsLastDay: 0,
        },
      }).reason,
    ).toBe("self-transfer");
  });

  it("rejects self-attribution", () => {
    expect(
      guardTwinEconomyOperation({
        policy: { ...policy, operation: "purchase-attribution" },
        attempt: {
          operation: "purchase-attribution",
          amountCredits: 500,
          actor: {
            actorUserId: "user-a",
            attributedOwnerUserId: "user-a",
          },
          operationsLastHour: 0,
          operationsLastDay: 0,
        },
      }).reason,
    ).toBe("self-attribution");
  });

  it("detects a direct value return loop", () => {
    expect(
      detectCircularTwinEconomyValue({
        actorUserId: "user-a",
        recipientUserId: "user-b",
        now: "2026-10-05T10:00:00Z",
        recentEdges: [
          {
            fromUserId: "user-b",
            toUserId: "user-a",
            amountCredits: 500,
            kind: "gift",
            occurredAt: "2026-10-05T09:30:00Z",
          },
        ],
      }).reason,
    ).toBe("direct-return");
  });

  it("detects a three-user short cycle", () => {
    expect(
      detectCircularTwinEconomyValue({
        actorUserId: "user-a",
        recipientUserId: "user-b",
        now: "2026-10-05T10:00:00Z",
        recentEdges: [
          {
            fromUserId: "user-b",
            toUserId: "user-c",
            amountCredits: 100,
            kind: "transfer",
            occurredAt: "2026-10-05T09:00:00Z",
          },
          {
            fromUserId: "user-c",
            toUserId: "user-a",
            amountCredits: 100,
            kind: "transfer",
            occurredAt: "2026-10-05T09:10:00Z",
          },
        ],
      }).reason,
    ).toBe("short-cycle");
  });

  it("holds earnings exposed to unresolved chargebacks", () => {
    expect(
      decideWithdrawableTwinEarnings({
        pendingCredits: 200,
        availableCredits: 1000,
        unresolvedChargebackCredits: 300,
        unresolvedRefundCredits: 0,
        accountRestricted: false,
      }),
    ).toEqual({
      withdrawableCredits: 700,
      heldCredits: 500,
      blocked: false,
      reason: "chargeback-hold",
    });
  });
});
