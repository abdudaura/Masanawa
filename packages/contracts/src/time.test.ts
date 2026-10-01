import { describe, expect, it } from "vitest";
import { compareInstants, toInstant } from "./time.js";

describe("Instant", () => {
  it("normalizes to UTC ISO-8601", () => {
    expect(toInstant("2026-10-01T17:00:00+01:00")).toBe("2026-10-01T16:00:00.000Z");
  });

  it("rejects invalid dates", () => {
    expect(() => toInstant("not-a-date")).toThrow(/Invalid instant/);
  });

  it("orders normalized instants lexicographically", () => {
    const a = toInstant("2026-10-01T00:00:00Z");
    const b = toInstant("2026-10-02T00:00:00Z");
    expect(compareInstants(a, b)).toBe(-1);
  });
});
