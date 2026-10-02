import { describe, expect, it } from "vitest";
import {
  isCapabilityKey,
  normalizeCapabilityKey,
} from "./capability.js";

describe("CapabilityKey", () => {
  it("normalizes bounded platform capability identifiers", () => {
    expect(normalizeCapabilityKey("  LLM.Generate  ")).toBe("llm.generate");
    expect(normalizeCapabilityKey("payments-charge")).toBe("payments-charge");
    expect(isCapabilityKey("llm.generate")).toBe(true);
    expect(isCapabilityKey(" LLM.Generate ")).toBe(false);
  });

  it("rejects ambiguous or unsafe capability identifiers", () => {
    for (const value of ["", ".tool", "tool..run", "tool/run", "tool run"]) {
      expect(() => normalizeCapabilityKey(value)).toThrow(/invalid/u);
    }
  });
});
