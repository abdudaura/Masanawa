import { describe, expect, it } from "vitest";
import {
  normalizePublicBio,
  normalizePublicDisplayName,
} from "./profile_text_validation.js";

describe("F13 canonical public profile text", () => {
  it.each([
    ["NUL", "\u0000"],
    ["low control", "\u0008"],
    ["tab", "\t"],
    ["line break", "\n"],
    ["C1 control", "\u0085"],
    ["bidi override", "\u202e"],
    ["bidi embedding", "\u202b"],
    ["bidi isolate", "\u2067"],
    ["unpaired high surrogate", "\ud800"],
    ["unpaired low surrogate", "\udfff"],
  ])("rejects %s in public display names", (_label, character) => {
    expect(normalizePublicDisplayName(`A${character}mina`)).toBeNull();
  });

  it.each([
    ["NUL", "\u0000"],
    ["low control", "\u0003"],
    ["C1 control", "\u009f"],
    ["bidi override", "\u202e"],
    ["bidi pop", "\u202c"],
    ["bidi isolate", "\u2066"],
    ["standalone CR", "\r"],
    ["unpaired surrogate", "\ud800"],
  ])("rejects %s in public bios", (_label, character) => {
    expect(normalizePublicBio(`Public${character}bio`)).toBeNull();
  });

  it("preserves valid Hausa, Arabic, RTL marks and emoji without ASCII-only filtering", () => {
    expect(normalizePublicDisplayName("  Abdullahi   ناصر 😀  "))
      .toBe("Abdullahi ناصر 😀");
    expect(normalizePublicBio("  Sannu!\r\nأهلاً بك \u200f✅  "))
      .toBe("Sannu!\nأهلاً بك \u200f✅");
  });

  it("allows intentional multiline bios but not multiline display names", () => {
    expect(normalizePublicBio("First\nSecond")).toBe("First\nSecond");
    expect(normalizePublicDisplayName("First\nSecond")).toBeNull();
  });

  it("retains existing length bounds and allows clearing the bio", () => {
    expect(normalizePublicDisplayName("a")).toBeNull();
    expect(normalizePublicDisplayName("x".repeat(81))).toBeNull();
    expect(normalizePublicBio("x".repeat(301))).toBeNull();
    expect(normalizePublicBio(" \n ")).toBe("");
  });

  it("accepts exactly one well-formed surrogate pair but not a dangling one", () => {
    expect(normalizePublicDisplayName("A😀")).toBe("A😀");
    expect(normalizePublicBio("😀")).toBe("😀");
    expect(normalizePublicBio("a\ud83d")).toBeNull();
  });
});
