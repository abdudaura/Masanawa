import { describe, expect, it } from "vitest";
import {
  decideTwinCommission,
  defaultCommissionPolicy,
  reverseCommission,
  type CommissionDecision,
  type TwinAttributionRecord,
} from "../../packages/commerce/src/attribution.js";

class ReplaySafeCommissionPort {
  readonly #settlements = new Map<
    string,
    { fingerprint: string; commissionCredits: number; reversedCredits: number }
  >();

  ownerEarningsCredits = 0;

  settle(input: {
    settlementId: string;
    attribution: TwinAttributionRecord;
    decision: CommissionDecision;
  }): { duplicate: boolean } {
    if (!input.decision.eligible || input.decision.commissionCredits <= 0) {
      throw new Error("ineligible commission cannot post");
    }

    const fingerprint = JSON.stringify({
      attributionId: input.attribution.attributionId,
      ownerUserId: input.attribution.ownerUserId,
      characterId: input.attribution.characterId,
      operationId: input.attribution.operationId,
      eventType: input.attribution.eventType,
      policyRevision: input.decision.policyRevision,
      baseCredits: input.decision.baseCredits,
      commissionCredits: input.decision.commissionCredits,
    });

    const existing = this.#settlements.get(input.settlementId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("commission replay fingerprint conflict");
      }
      return { duplicate: true };
    }

    this.ownerEarningsCredits += input.decision.commissionCredits;
    this.#settlements.set(input.settlementId, {
      fingerprint,
      commissionCredits: input.decision.commissionCredits,
      reversedCredits: 0,
    });
    return { duplicate: false };
  }

  reverse(input: {
    settlementId: string;
    reversalId: string;
    amountCredits: number;
  }): { duplicate: boolean } {
    const current = this.#settlements.get(input.settlementId);
    if (!current) throw new Error("commission settlement not found");

    const replayKey = `${input.settlementId}:${input.reversalId}`;
    const fingerprint = JSON.stringify({
      settlementId: input.settlementId,
      reversalId: input.reversalId,
      amountCredits: input.amountCredits,
    });
    const existing = this.#settlements.get(replayKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("commission reversal replay conflict");
      }
      return { duplicate: true };
    }

    if (
      !Number.isSafeInteger(input.amountCredits) ||
      input.amountCredits >= 0 ||
      Math.abs(input.amountCredits) >
        current.commissionCredits - current.reversedCredits
    ) {
      throw new Error("commission reversal exceeds remaining settlement");
    }

    const reversed = Math.abs(input.amountCredits);
    this.ownerEarningsCredits -= reversed;
    this.#settlements.set(input.settlementId, {
      ...current,
      reversedCredits: current.reversedCredits + reversed,
    });
    this.#settlements.set(replayKey, {
      fingerprint,
      commissionCredits: reversed,
      reversedCredits: 0,
    });
    return { duplicate: false };
  }
}

const at = "2026-10-06T12:00:00.000Z";

function attribution(
  overrides: Partial<TwinAttributionRecord> = {},
): TwinAttributionRecord {
  return {
    attributionId: "attr-commission-recovery-1",
    ownerUserId: "owner-user",
    characterId: "personal-twin",
    customerUserId: "customer-user",
    eventType: "commerce-purchase",
    operationId: "purchase-operation-1",
    policyRevision: 1,
    attributedAt: at,
    expiresAt: null,
    selfAttribution: false,
    ...overrides,
  };
}

describe("TWIN-106 commission retry recovery acceptance", () => {
  it("posts eligible commission once across a post-effect crash and exact retry", () => {
    const port = new ReplaySafeCommissionPort();
    const policy = defaultCommissionPolicy({
      eventType: "commerce-purchase",
      effectiveAt: at,
    });
    const record = attribution();
    const decision = decideTwinCommission({
      attribution: record,
      policy,
      baseCredits: 10_000,
      now: at,
    });

    expect(decision).toMatchObject({
      eligible: true,
      commissionCredits: 100,
    });

    expect(
      port.settle({
        settlementId: "commission-settlement-1",
        attribution: record,
        decision,
      }),
    ).toEqual({ duplicate: false });

    // Simulate crash after owner earning was posted but before caller marked
    // settlement completion.
    expect(
      port.settle({
        settlementId: "commission-settlement-1",
        attribution: record,
        decision: decideTwinCommission({
          attribution: record,
          policy,
          baseCredits: 10_000,
          now: at,
        }),
      }),
    ).toEqual({ duplicate: true });

    expect(port.ownerEarningsCredits).toBe(100);
  });

  it("rejects changed base amount under the same settlement identity", () => {
    const port = new ReplaySafeCommissionPort();
    const policy = defaultCommissionPolicy({
      eventType: "commerce-purchase",
      effectiveAt: at,
    });
    const record = attribution();

    port.settle({
      settlementId: "commission-settlement-conflict",
      attribution: record,
      decision: decideTwinCommission({
        attribution: record,
        policy,
        baseCredits: 10_000,
        now: at,
      }),
    });

    expect(() =>
      port.settle({
        settlementId: "commission-settlement-conflict",
        attribution: record,
        decision: decideTwinCommission({
          attribution: record,
          policy,
          baseCredits: 20_000,
          now: at,
        }),
      }),
    ).toThrow("fingerprint conflict");
    expect(port.ownerEarningsCredits).toBe(100);
  });

  it("never posts self-attribution or internal-transfer commission", () => {
    const port = new ReplaySafeCommissionPort();
    const policy = defaultCommissionPolicy({
      eventType: "commerce-purchase",
      effectiveAt: at,
    });

    const self = attribution({ selfAttribution: true });
    const selfDecision = decideTwinCommission({
      attribution: self,
      policy,
      baseCredits: 5_000,
      now: at,
    });
    expect(selfDecision.eligible).toBe(false);
    expect(() =>
      port.settle({
        settlementId: "self",
        attribution: self,
        decision: selfDecision,
      }),
    ).toThrow("ineligible");

    const internal = attribution({
      attributionId: "attr-internal",
      eventType: "internal-transfer",
    });
    const internalDecision = decideTwinCommission({
      attribution: internal,
      policy,
      baseCredits: 5_000,
      now: at,
    });
    expect(internalDecision.eligible).toBe(false);
    expect(() =>
      port.settle({
        settlementId: "internal",
        attribution: internal,
        decision: internalDecision,
      }),
    ).toThrow("ineligible");

    expect(port.ownerEarningsCredits).toBe(0);
  });

  it("reverses commission append-only once and rejects over-reversal", () => {
    const port = new ReplaySafeCommissionPort();
    const policy = defaultCommissionPolicy({
      eventType: "commerce-purchase",
      effectiveAt: at,
    });
    const record = attribution();
    const decision = decideTwinCommission({
      attribution: record,
      policy,
      baseCredits: 10_000,
      now: at,
    });

    port.settle({
      settlementId: "commission-settlement-reversal",
      attribution: record,
      decision,
    });

    const partial = reverseCommission({
      originalBaseCredits: 10_000,
      originalCommissionCredits: decision.commissionCredits,
      reversalBaseCredits: 4_000,
    });
    expect(partial).toBe(-40);

    expect(
      port.reverse({
        settlementId: "commission-settlement-reversal",
        reversalId: "commission-reversal-1",
        amountCredits: partial,
      }),
    ).toEqual({ duplicate: false });
    expect(port.ownerEarningsCredits).toBe(60);

    expect(
      port.reverse({
        settlementId: "commission-settlement-reversal",
        reversalId: "commission-reversal-1",
        amountCredits: partial,
      }),
    ).toEqual({ duplicate: true });
    expect(port.ownerEarningsCredits).toBe(60);

    expect(() =>
      port.reverse({
        settlementId: "commission-settlement-reversal",
        reversalId: "commission-reversal-too-large",
        amountCredits: -61,
      }),
    ).toThrow("exceeds remaining");
    expect(port.ownerEarningsCredits).toBe(60);
  });
});
