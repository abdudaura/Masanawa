import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  hashOtpCode, hashPlatformSessionToken, mintPlatformSessionToken, normalizePlatformAuthIdentifier,
} from "./platform-session.js";

describe("platform customer session primitives", () => {
  it("normalizes identities", () => {
    expect(normalizePlatformAuthIdentifier({ email: " User@Example.COM " })).toEqual({
      channel: "email", identifier: "user@example.com",
    });
    expect(normalizePlatformAuthIdentifier({ phone: "+234 801 234 5678" })).toEqual({
      channel: "sms", identifier: "+2348012345678",
    });
  });
  it("hashes OTP and session credentials", () => {
    const tenantId = createCanonicalId("tenant");
    expect(hashOtpCode({
      pepper: "x".repeat(32), tenantId, channel: "email", identifier: "user@example.com", code: "123456",
    })).toHaveLength(64);
    expect(hashPlatformSessionToken(mintPlatformSessionToken("access"))).toHaveLength(64);
  });
});
