import { describe, expect, it } from "vitest";
import {
  DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY,
  assertTwinLaunchIdentityAllowed,
  evaluateTwinLaunchIdentityGate,
  type TwinLaunchIdentityContext,
} from "./twin-launch-policy.js";

const safeContext: TwinLaunchIdentityContext = {
  ownerAgeBand: "adult",
  ownerIdentityAssurance: "verified",
  impersonationReviewState: "clear",
  profileDiscoverable: true,
};

describe("Twin launch identity policy", () => {
  it("allows a verified adult public profile under the launch defaults", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "publish-profile",
        context: safeContext,
      }),
    ).toEqual({
      allowed: true,
      action: "publish-profile",
      reasons: [],
    });
  });

  it("fails closed when owner identity assurance is not verified", () => {
    for (const ownerIdentityAssurance of ["unverified", "unknown"] as const) {
      expect(
        evaluateTwinLaunchIdentityGate({
          action: "publish-profile",
          context: { ...safeContext, ownerIdentityAssurance },
        }),
      ).toMatchObject({
        allowed: false,
        reasons: ["owner-identity-unverified"],
      });
    }
  });

  it("fails closed for unknown owner age under the launch default", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "discover-profile",
        context: { ...safeContext, ownerAgeBand: "unknown" },
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["owner-age-unknown"],
    });
  });

  it("fails closed for minor-owned public presence without an explicit policy revision", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "publish-profile",
        context: { ...safeContext, ownerAgeBand: "minor" },
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["minor-public-presence-disabled"],
    });
  });

  it("permits explicit operator policy revisions without encoding a jurisdictional age rule", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "publish-profile",
        context: { ...safeContext, ownerAgeBand: "minor" },
        policy: {
          ...DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY,
          allowMinorPublicPresence: true,
        },
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("removes a non-discoverable profile from discovery without invalidating its stable share identity", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "discover-profile",
        context: { ...safeContext, profileDiscoverable: false },
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["profile-not-discoverable"],
    });

    expect(
      evaluateTwinLaunchIdentityGate({
        action: "open-public-chat",
        context: { ...safeContext, profileDiscoverable: false },
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("fails closed while an impersonation report is under review by default", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "discover-profile",
        context: {
          ...safeContext,
          impersonationReviewState: "reported",
        },
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["impersonation-under-review"],
    });
  });

  it("allows a policy to keep a reported Twin public while review remains unresolved", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "discover-profile",
        context: {
          ...safeContext,
          impersonationReviewState: "reported",
        },
        policy: {
          ...DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY,
          allowPublicPresenceWhileImpersonationReported: true,
        },
      }),
    ).toMatchObject({ allowed: true, reasons: [] });
  });

  it("always denies a confirmed impersonation finding, including direct public chat", () => {
    for (const action of [
      "publish-profile",
      "discover-profile",
      "open-public-chat",
    ] as const) {
      expect(
        evaluateTwinLaunchIdentityGate({
          action,
          context: {
            ...safeContext,
            impersonationReviewState: "confirmed",
          },
          policy: {
            requireVerifiedOwnerForPublicPresence: false,
            allowUnknownAgePublicPresence: true,
            allowMinorPublicPresence: true,
            allowPublicPresenceWhileImpersonationReported: true,
          },
        }),
      ).toMatchObject({
        allowed: false,
        reasons: ["impersonation-confirmed"],
      });
    }
  });

  it("returns all applicable denial reasons deterministically", () => {
    expect(
      evaluateTwinLaunchIdentityGate({
        action: "discover-profile",
        context: {
          ownerAgeBand: "unknown",
          ownerIdentityAssurance: "unknown",
          impersonationReviewState: "reported",
          profileDiscoverable: false,
        },
      }),
    ).toEqual({
      allowed: false,
      action: "discover-profile",
      reasons: [
        "impersonation-under-review",
        "owner-identity-unverified",
        "owner-age-unknown",
        "profile-not-discoverable",
      ],
    });
  });

  it("provides an assertion helper for admission boundaries", () => {
    expect(() =>
      assertTwinLaunchIdentityAllowed({
        action: "open-public-chat",
        context: safeContext,
      }),
    ).not.toThrow();

    expect(() =>
      assertTwinLaunchIdentityAllowed({
        action: "open-public-chat",
        context: {
          ...safeContext,
          impersonationReviewState: "confirmed",
        },
      }),
    ).toThrow("impersonation-confirmed");
  });

  it("rejects malformed policy inputs instead of silently coercing them", () => {
    expect(() =>
      evaluateTwinLaunchIdentityGate({
        action: "publish-profile",
        context: safeContext,
        policy: {
          ...DEFAULT_TWIN_LAUNCH_IDENTITY_POLICY,
          allowMinorPublicPresence: "yes" as never,
        },
      }),
    ).toThrow("allowMinorPublicPresence must be boolean");
  });
});
