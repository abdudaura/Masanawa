import { describe, expect, it } from "vitest";
import {
  createPaidFeatureTrialAdminService,
  type PaidFeatureTrialAdminAuthorizer,
  type PaidFeatureTrialPolicyStore,
} from "./paid_feature_trial_admin.js";

describe("paid feature trial admin service", () => {
  it("returns a seven-day default before any admin revision exists", async () => {
    const authorizer: PaidFeatureTrialAdminAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1" };
      },
    };
    const store: PaidFeatureTrialPolicyStore = {
      async readActive() {
        return null;
      },
      async putRevision() {
        throw new Error("not used");
      },
    };
    const service = createPaidFeatureTrialAdminService({
      authorizer,
      store,
      now: () => new Date("2026-10-05T09:00:00Z"),
    });
    const policy = await service.read({
      authorizationHeader: "Bearer admin",
      feature: "twin-voice",
    });
    expect(policy.durationDays).toBe(7);
    expect(policy.enabled).toBe(true);
  });

  it("lets admin create a new duration/cap revision", async () => {
    const authorizer: PaidFeatureTrialAdminAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("monetization.trials.write");
        return { tenantId: "tenant-1" };
      },
    };
    const store: PaidFeatureTrialPolicyStore = {
      async readActive() {
        return null;
      },
      async putRevision(input) {
        return {
          feature: input.feature,
          revision: 4,
          enabled: input.enabled,
          durationDays: input.durationDays,
          maxUnits: input.maxUnits,
          effectiveAt: input.effectiveAt,
        };
      },
    };
    const service = createPaidFeatureTrialAdminService({ authorizer, store });
    const policy = await service.update({
      authorizationHeader: "Bearer admin",
      feature: "owner-access",
      enabled: true,
      durationDays: 14,
      maxUnits: 2,
      effectiveAt: "2026-10-06T00:00:00Z",
    });
    expect(policy.durationDays).toBe(14);
    expect(policy.maxUnits).toBe(2);
  });

  it("exposes the one-session owner-access default through admin reads", async () => {
    const authorizer: PaidFeatureTrialAdminAuthorizer = {
      async authorize() {
        return { tenantId: "tenant-1" };
      },
    };
    const store: PaidFeatureTrialPolicyStore = {
      async readActive() {
        return null;
      },
      async putRevision() {
        throw new Error("not used");
      },
    };
    const service = createPaidFeatureTrialAdminService({
      authorizer,
      store,
      now: () => new Date("2026-10-05T09:00:00Z"),
    });

    const policy = await service.read({
      authorizationHeader: "Bearer admin",
      feature: "owner-access",
    });

    expect(policy.durationDays).toBe(7);
    expect(policy.maxUnits).toBe(1);
  });

});
