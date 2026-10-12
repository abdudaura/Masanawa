import { describe, expect, it } from "vitest";
import { validDeviceId, validDeviceRevokeKey } from "./device-sessions.js";
describe("C09 opaque session identifiers", () => {
  it("accepts a canonical UUID but not bearer material or SQL payloads", () => {
    expect(validDeviceId("4eadd05d-d474-4fd0-848f-8c5791db63f6")).toBe(true);
    expect(validDeviceId("msw_access_secret")).toBe(false);
    expect(validDeviceId("4eadd05d-d474-4fd0-848f-8c5791db63f6' OR true")).toBe(false);
  });
  it("requires an opaque bounded idempotency key", () => {
    expect(validDeviceRevokeKey("rev-c09-001")).toBe(true);
    expect(validDeviceRevokeKey("short")).toBe(false);
    expect(validDeviceRevokeKey("../a".repeat(40))).toBe(false);
  });
});
