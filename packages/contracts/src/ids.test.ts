import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  getCanonicalIdKind,
  isCanonicalId,
  parseCanonicalId,
} from "./ids.js";

describe("canonical ids", () => {
  it("creates typed UUIDv7-backed ids", () => {
    const id = createCanonicalId("character");
    expect(id).toMatch(/^character_[0-9a-f-]+$/);
    expect(isCanonicalId("character", id)).toBe(true);
    expect(getCanonicalIdKind(id)).toBe("character");
  });

  it("rejects cross-kind identity collapse", () => {
    const id = createCanonicalId("character-session");
    expect(() => parseCanonicalId("relationship", id)).toThrow(/relationship id/);
    expect(isCanonicalId("relationship", id)).toBe(false);
  });

  it("rejects arbitrary UUID versions and malformed values", () => {
    expect(isCanonicalId("user", "user_00000000-0000-4000-8000-000000000000")).toBe(false);
    expect(isCanonicalId("user", "user_not-a-uuid")).toBe(false);
  });
});
