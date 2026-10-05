import { describe, expect, it } from "vitest";
import {
  defaultOwnerSessionPrivacyPolicy,
  evaluateOwnerSessionRecording,
} from "./owner-session-privacy.js";

describe("owner session recording privacy", () => {
  it("defaults to no recording", () => {
    const policy = defaultOwnerSessionPrivacyPolicy();
    expect(policy.recordingEnabled).toBe(false);
    expect(
      evaluateOwnerSessionRecording({
        policy,
        request: {
          requesterConsent: true,
          ownerConsent: true,
          requestedRetentionDays: 7,
        },
      }).reason,
    ).toBe("recording-disabled");
  });

  it("requires both participants when recording is enabled", () => {
    const policy = {
      ...defaultOwnerSessionPrivacyPolicy(),
      revision: 2,
      recordingEnabled: true,
    };
    expect(
      evaluateOwnerSessionRecording({
        policy,
        request: {
          requesterConsent: true,
          ownerConsent: false,
          requestedRetentionDays: 7,
        },
      }).reason,
    ).toBe("owner-consent-required");
  });

  it("enforces bounded retention", () => {
    const policy = {
      ...defaultOwnerSessionPrivacyPolicy(),
      revision: 3,
      recordingEnabled: true,
      maxRetentionDays: 14,
    };
    expect(
      evaluateOwnerSessionRecording({
        policy,
        request: {
          requesterConsent: true,
          ownerConsent: true,
          requestedRetentionDays: 30,
        },
      }).reason,
    ).toBe("retention-too-long");
  });
});
