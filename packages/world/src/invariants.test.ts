import { toInstant } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  assertSimulationTimeDoesNotMoveBackward,
  normalizeSimulationInputKey,
  normalizeWorldPolicy,
} from "./invariants.js";

describe("world invariants", () => {
  it("rejects backward simulation time", () => {
    expect(() =>
      assertSimulationTimeDoesNotMoveBackward(
        toInstant("2026-10-01T10:00:00Z"),
        toInstant("2026-10-01T09:59:59Z"),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "world.simulation_time_regression" }),
    );
  });

  it("allows equal simulation time when a commit does not advance the clock", () => {
    expect(() =>
      assertSimulationTimeDoesNotMoveBackward(
        toInstant("2026-10-01T10:00:00Z"),
        toInstant("2026-10-01T10:00:00Z"),
      ),
    ).not.toThrow();
  });

  it("normalizes bounded catch-up policy explicitly", () => {
    expect(
      normalizeWorldPolicy({
        schemaVersion: 1,
        catchUpMode: "bounded",
        maxCatchUpSteps: 12,
        spatialEnabled: false,
        automaticCanonEnabled: true,
      }),
    ).toEqual({
      schemaVersion: 1,
      catchUpMode: "bounded",
      maxCatchUpSteps: 12,
      spatialEnabled: false,
      automaticCanonEnabled: true,
    });

    expect(() =>
      normalizeWorldPolicy({
        schemaVersion: 1,
        catchUpMode: "bounded",
        maxCatchUpSteps: 0,
        spatialEnabled: false,
        automaticCanonEnabled: false,
      }),
    ).toThrow(/requires at least one step/u);
  });

  it("requires a stable bounded simulation-input idempotency key", () => {
    expect(normalizeSimulationInputKey("  routine:morning:2026-10-01  ")).toBe(
      "routine:morning:2026-10-01",
    );
    expect(() => normalizeSimulationInputKey(" ")).toThrow(/invalid/u);
  });
});
