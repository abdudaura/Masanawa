import { describe, expect, it } from "vitest";
import {
  assertIdempotencyMatch,
  assertOperationTransition,
  canTransitionOperation,
  isTerminalOperationState,
  type OperationState,
} from "@masanawa/events";

describe("bounded idempotency and operation pressure", () => {
  it("keeps 25k exact idempotency replays deterministic", () => {
    const record = {
      requestFingerprint: "sha256:stable-request-fingerprint",
    };

    for (let index = 0; index < 25_000; index += 1) {
      expect(() =>
        assertIdempotencyMatch(
          record,
          "sha256:stable-request-fingerprint",
        ),
      ).not.toThrow();
    }
  });

  it("keeps changed-fingerprint replay fail-closed under 5k conflicts", () => {
    const record = {
      requestFingerprint: "sha256:original-request-fingerprint",
    };
    let rejected = 0;

    for (let index = 0; index < 5_000; index += 1) {
      try {
        assertIdempotencyMatch(
          record,
          `sha256:changed-request-${index}`,
        );
      } catch (error) {
        rejected += 1;
        expect(String(error)).toContain(
          "already bound to a different canonical request",
        );
      }
    }

    expect(rejected).toBe(5_000);
  });

  it("preserves valid Operation transition chains across 10k repetitions", () => {
    const chain: readonly OperationState[] = [
      "prepared",
      "authorized",
      "dispatching",
      "dispatched",
      "accepted",
      "succeeded",
    ];

    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      for (let index = 0; index < chain.length - 1; index += 1) {
        const from = chain[index]!;
        const to = chain[index + 1]!;
        expect(canTransitionOperation(from, to)).toBe(true);
        expect(() => assertOperationTransition(from, to)).not.toThrow();
      }
    }
  });

  it("never admits invalid terminal or backward Operation transitions under pressure", () => {
    const invalid: readonly (readonly [OperationState, OperationState])[] = [
      ["succeeded", "dispatching"],
      ["failed", "authorized"],
      ["rejected", "prepared"],
      ["accepted", "dispatching"],
      ["dispatched", "prepared"],
      ["authorized", "prepared"],
    ];

    let rejected = 0;
    for (let iteration = 0; iteration < 5_000; iteration += 1) {
      for (const [from, to] of invalid) {
        expect(canTransitionOperation(from, to)).toBe(false);
        try {
          assertOperationTransition(from, to);
        } catch {
          rejected += 1;
        }
      }
    }

    expect(rejected).toBe(5_000 * invalid.length);
    expect(isTerminalOperationState("succeeded")).toBe(true);
    expect(isTerminalOperationState("failed")).toBe(true);
    expect(isTerminalOperationState("rejected")).toBe(true);
  });
});
