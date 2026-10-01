import { describe, expect, it } from "vitest";
import { toInstant } from "@masanawa/contracts";
import {
  assertAuthenticationEvidenceCurrent,
  authenticationEvidenceCanResolveIdentity,
  createAuthenticationEvidence,
} from "./authentication.js";

describe("authentication evidence", () => {
  it("normalizes verified evidence without turning mutable aliases into identity", () => {
    const evidence = createAuthenticationEvidence({
      method: "oauth",
      issuer: " https://issuer.example ",
      subject: " stable-provider-subject ",
      strength: "strong",
      authenticatedAt: toInstant("2026-10-01T18:00:00Z"),
      expiresAt: toInstant("2026-10-01T19:00:00Z"),
      metadata: { displayName: "Mutable Name" },
    });

    expect(evidence.issuer).toBe("https://issuer.example");
    expect(evidence.subject).toBe("stable-provider-subject");
    expect(evidence.metadata?.displayName).toBe("Mutable Name");
    expect(authenticationEvidenceCanResolveIdentity(evidence)).toBe(true);
    expect(evidence).not.toHaveProperty("userId");
  });

  it("rejects unverified or expired evidence at an authentication boundary", () => {
    const unverified = createAuthenticationEvidence({
      method: "channel-transport",
      issuer: "whatsapp",
      subject: "sender-reference",
      strength: "unverified",
      authenticatedAt: toInstant("2026-10-01T18:00:00Z"),
    });
    expect(() =>
      assertAuthenticationEvidenceCurrent(
        unverified,
        toInstant("2026-10-01T18:01:00Z"),
      ),
    ).toThrow(/not verified/);

    const expired = createAuthenticationEvidence({
      method: "platform-session",
      issuer: "masanawa",
      subject: "session-subject",
      strength: "linked",
      authenticatedAt: toInstant("2026-10-01T18:00:00Z"),
      expiresAt: toInstant("2026-10-01T18:05:00Z"),
    });
    expect(() =>
      assertAuthenticationEvidenceCurrent(
        expired,
        toInstant("2026-10-01T18:05:00Z"),
      ),
    ).toThrow(/expired/);
  });

  it("requires explicit linkage strength before evidence can resolve canonical identity", () => {
    const transportVerified = createAuthenticationEvidence({
      method: "channel-transport",
      issuer: "telegram",
      subject: "provider-subject",
      strength: "transport-verified",
      authenticatedAt: toInstant("2026-10-01T18:00:00Z"),
    });

    expect(
      authenticationEvidenceCanResolveIdentity(transportVerified),
    ).toBe(false);
  });
});
