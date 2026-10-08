import { describe, expect, it } from "vitest";
import { sanitizeAvatarPng } from "./png.js";
import { validAvatarPng } from "./test_png_fixture.js";

describe("Avatar PNG image safety and metadata removal", () => {
  it("validates and strips every metadata chunk before S3 upload", () => {
    const original = validAvatarPng({ metadata: true });
    const sanitized = sanitizeAvatarPng(original);
    expect(sanitized.width).toBe(64);
    expect(sanitized.height).toBe(64);
    expect(sanitized.png.includes(Buffer.from("GPS"))).toBe(false);
    expect(sanitized.png.includes(Buffer.from("tEXt"))).toBe(false);
    expect(sanitizeAvatarPng(sanitized.png).png).toEqual(sanitized.png);
  });

  it("refuses invalid checksums and trailing foreign bytes", () => {
    const broken = Buffer.from(validAvatarPng());
    broken[50] = broken[50]! ^ 1;
    expect(() => sanitizeAvatarPng(broken)).toThrow();
    expect(() => sanitizeAvatarPng(Buffer.concat([validAvatarPng(), Buffer.from("junk")]))).toThrow();
  });

  it("refuses oversized dimensions before inflating attacker data", () => {
    expect(() => sanitizeAvatarPng(validAvatarPng({ width: 1025 }))).toThrow();
    expect(() => sanitizeAvatarPng(validAvatarPng({ height: 1025 }))).toThrow();
  });

  it("refuses invalid scanline filters and missing image body", () => {
    expect(() => sanitizeAvatarPng(validAvatarPng({ filter: 5 }))).toThrow();
    expect(() => sanitizeAvatarPng(Buffer.alloc(100))).toThrow();
  });
});
