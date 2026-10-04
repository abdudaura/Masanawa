import { describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import { normalizeAgentFloatAllocation, normalizeAgentFloatAllocationCommand,
  normalizeAgentFloatAllocationHistoryQuery } from "./model.js";

function command() {
  return {
    schemaVersion: 1 as const, tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"), requestId: createCanonicalId("request"), amountCredits: 50,
  };
}

describe("Agent Float allocation command contract", () => {
  it("uses an existing canonical RequestId and freezes normalized custody", () => {
    const input = command();
    const result = normalizeAgentFloatAllocationCommand(input);
    expect(result).toEqual(input);
    expect(Object.isFrozen(result)).toBe(true);
    const receipt = normalizeAgentFloatAllocation({ ...input,
      ledgerEntryId: createCanonicalId("ledger-entry"), createdAt: nowInstant() });
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(normalizeAgentFloatAllocationCommand(receipt)).toEqual(input);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 1_000_000_001, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid or unbounded allocation amount %s", amountCredits => {
      expect(() => normalizeAgentFloatAllocationCommand({ ...command(), amountCredits })).toThrow();
    },
  );

  it("rejects wrong schema and IDs instead of treating arbitrary strings as replay identities", () => {
    const input = command();
    for (const change of [
      { schemaVersion: 2 as never }, { tenantId: createCanonicalId("user") as never },
      { userId: createCanonicalId("character") as never }, { characterId: createCanonicalId("user") as never },
      { requestId: "retry-key" as never }, { requestId: createCanonicalId("ledger-entry") as never },
    ]) expect(() => normalizeAgentFloatAllocationCommand({ ...input, ...change })).toThrow();
  });

  it("accepts the bounded ceiling without rounding or coercion", () => {
    expect(normalizeAgentFloatAllocationCommand({ ...command(), amountCredits: 1_000_000_000 }).amountCredits)
      .toBe(1_000_000_000);
    expect(() => normalizeAgentFloatAllocationCommand({ ...command(), amountCredits: "50" as never })).toThrow();
  });

  it("rejects malformed persisted ledger custody and timestamps", () => {
    const allocation = { ...command(), ledgerEntryId: createCanonicalId("ledger-entry"), createdAt: nowInstant() };
    expect(() => normalizeAgentFloatAllocation({ ...allocation, ledgerEntryId: createCanonicalId("request") as never })).toThrow();
    expect(() => normalizeAgentFloatAllocation({ ...allocation, createdAt: "not-a-time" as never })).toThrow();
  });

  it("normalizes bounded history defaults and existing canonical cursor IDs", () => {
    const input = command();
    const defaults = normalizeAgentFloatAllocationHistoryQuery({ tenantId: input.tenantId, userId: input.userId });
    expect(defaults).toEqual({ tenantId: input.tenantId, userId: input.userId,
      characterId: null, beforeRequestId: null, limit: 20 });
    expect(Object.isFrozen(defaults)).toBe(true);
    expect(normalizeAgentFloatAllocationHistoryQuery({ ...input,
      beforeRequestId: input.requestId, limit: 100 })).toMatchObject({
      characterId: input.characterId, beforeRequestId: input.requestId, limit: 100,
    });
  });

  it.each([0, -1, 1.5, 101, NaN, Infinity, "20", null])(
    "rejects invalid history limit %s without coercion", limit => {
      expect(() => normalizeAgentFloatAllocationHistoryQuery({ ...command(), limit: limit as never })).toThrow();
    },
  );

  it("rejects wrong history scope/filter/cursor ID types", () => {
    for (const change of [{ tenantId: createCanonicalId("user") },
      { userId: createCanonicalId("character") }, { characterId: createCanonicalId("request") },
      { beforeRequestId: createCanonicalId("ledger-entry") }]) {
      expect(() => normalizeAgentFloatAllocationHistoryQuery({ ...command(), ...change } as never)).toThrow();
    }
  });
});
