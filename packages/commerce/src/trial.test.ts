import { describe, expect, it } from "vitest";
import {
  defaultPaidFeatureTrialPolicy,
  evaluatePaidFeatureTrial,
  normalizePaidFeatureTrialPolicy,
} from "./trial.js";

describe("paid feature trial policy", () => {
  it("starts with a configurable seven-day default", () => {
    const policy = defaultPaidFeatureTrialPolicy(
      "twin-voice",
      "2026-10-05T08:00:00Z",
    );
    expect(policy.durationDays).toBe(7);
    expect(policy.enabled).toBe(true);
    expect(policy.maxUnits).toBeNull();
  });

  it("admits qualifying first use without charging", () => {
    const policy = defaultPaidFeatureTrialPolicy(
      "twin-voice",
      "2026-10-05T08:00:00Z",
    );
    const decision = evaluatePaidFeatureTrial({
      policy,
      usage: { startedAt: null, consumedUnits: 0 },
      requestedUnits: 1,
      now: "2026-10-05T09:00:00Z",
    });
    expect(decision.eligible).toBe(true);
    expect(decision.startsAt).toBe("2026-10-05T09:00:00.000Z");
    expect(decision.expiresAt).toBe("2026-10-12T09:00:00.000Z");
  });

  it("lets admin disable or cap the trial", () => {
    const policy = normalizePaidFeatureTrialPolicy({
      schemaVersion: 1,
      feature: "twin-voice",
      revision: 9,
      enabled: true,
      durationDays: 3,
      maxUnits: 10,
      createdAt: "2026-10-05T08:00:00Z",
    });
    const decision = evaluatePaidFeatureTrial({
      policy,
      usage: { startedAt: "2026-10-05T08:00:00Z", consumedUnits: 8 },
      requestedUnits: 3,
      now: "2026-10-06T08:00:00Z",
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe("request-exceeds-remaining");
    expect(decision.remainingUnits).toBe(2);
  });

  it("expires by the admitted policy revision window", () => {
    const policy = normalizePaidFeatureTrialPolicy({
      schemaVersion: 1,
      feature: "owner-access",
      revision: 2,
      enabled: true,
      durationDays: 7,
      maxUnits: null,
      createdAt: "2026-10-01T00:00:00Z",
    });
    const decision = evaluatePaidFeatureTrial({
      policy,
      usage: { startedAt: "2026-10-01T00:00:00Z", consumedUnits: 0 },
      requestedUnits: 1,
      now: "2026-10-08T00:00:00Z",
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toBe("expired");
  });
  it("caps the default owner-access trial at one completed session", () => {
    const policy = defaultPaidFeatureTrialPolicy(
      "owner-access",
      "2026-10-05T08:00:00Z",
    );
    expect(policy.durationDays).toBe(7);
    expect(policy.maxUnits).toBe(1);
  });

});
