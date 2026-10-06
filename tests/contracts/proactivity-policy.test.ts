import { describe, expect, it } from "vitest";
import {
  evaluateProactivityPolicy,
  normalizeProactivityPolicy,
  type ProactivityPolicy,
} from "../../packages/proactivity/src/policy.js";

const policy: ProactivityPolicy = {
  schemaVersion: 1,
  revision: 1,
  relationshipEnabled: true,
  allowedPrivacyScopes: ["relationship"],
  maxActionsPerHour: 3,
  maxActionsPerDay: 10,
  quietHours: {
    enabled: true,
    startLocalTime: "22:00",
    endLocalTime: "07:00",
    timeZone: "Africa/Lagos",
  },
};

describe("proactivity policy", () => {
  it("allows a relationship-scoped attempt outside quiet hours and limits", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("fails closed when relationship proactivity is disabled", () => {
    expect(
      evaluateProactivityPolicy({
        policy: { ...policy, relationshipEnabled: false },
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "relationship-disabled" });
  });

  it("denies privacy scopes that were not explicitly allowed", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "user-private",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "privacy-scope-denied" });
  });

  it("enforces quiet hours across midnight in the configured time zone", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T22:30:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "quiet-hours" });

    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T06:30:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "quiet-hours" });
  });

  it("treats equal quiet-hour start/end as quiet all day rather than silently disabling", () => {
    expect(
      evaluateProactivityPolicy({
        policy: {
          ...policy,
          quietHours: {
            ...policy.quietHours,
            startLocalTime: "00:00",
            endLocalTime: "00:00",
          },
        },
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "quiet-hours" });
  });

  it("enforces hourly and daily action ceilings", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 3,
          actionsLastDay: 3,
        },
      }),
    ).toEqual({ allowed: false, reason: "hourly-limit" });

    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-06T12:00:00Z",
          actionsLastHour: 0,
          actionsLastDay: 10,
        },
      }),
    ).toEqual({ allowed: false, reason: "daily-limit" });
  });

  it("rejects invalid time zones and incoherent daily limits", () => {
    expect(() =>
      normalizeProactivityPolicy({
        ...policy,
        quietHours: {
          ...policy.quietHours,
          timeZone: "Mars/Olympus",
        },
      }),
    ).toThrow("timeZone is invalid");

    expect(() =>
      normalizeProactivityPolicy({
        ...policy,
        maxActionsPerHour: 5,
        maxActionsPerDay: 4,
      }),
    ).toThrow("maxActionsPerDay is invalid");
  });
});
