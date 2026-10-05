export interface OwnerSessionPrivacyPolicy {
  readonly revision: number;
  readonly recordingEnabled: boolean;
  readonly requireRequesterConsent: boolean;
  readonly requireOwnerConsent: boolean;
  readonly maxRetentionDays: number;
}

export interface OwnerSessionRecordingRequest {
  readonly requesterConsent: boolean;
  readonly ownerConsent: boolean;
  readonly requestedRetentionDays: number;
}

export interface OwnerSessionRecordingDecision {
  readonly allowed: boolean;
  readonly retentionDays: number;
  readonly reason:
    | "allowed"
    | "recording-disabled"
    | "requester-consent-required"
    | "owner-consent-required"
    | "retention-too-long";
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function defaultOwnerSessionPrivacyPolicy(): OwnerSessionPrivacyPolicy {
  return Object.freeze({
    revision: 1,
    recordingEnabled: false,
    requireRequesterConsent: true,
    requireOwnerConsent: true,
    maxRetentionDays: 30,
  });
}

export function evaluateOwnerSessionRecording(input: {
  readonly policy: OwnerSessionPrivacyPolicy;
  readonly request: OwnerSessionRecordingRequest;
}): OwnerSessionRecordingDecision {
  const policy = input.policy;
  integer(policy.revision, "revision", 1, 2_147_483_647);
  const maxRetentionDays = integer(
    policy.maxRetentionDays,
    "maxRetentionDays",
    1,
    3650,
  );
  const requestedRetentionDays = integer(
    input.request.requestedRetentionDays,
    "requestedRetentionDays",
    1,
    3650,
  );

  if (!policy.recordingEnabled) {
    return {
      allowed: false,
      retentionDays: 0,
      reason: "recording-disabled",
    };
  }
  if (policy.requireRequesterConsent && !input.request.requesterConsent) {
    return {
      allowed: false,
      retentionDays: 0,
      reason: "requester-consent-required",
    };
  }
  if (policy.requireOwnerConsent && !input.request.ownerConsent) {
    return {
      allowed: false,
      retentionDays: 0,
      reason: "owner-consent-required",
    };
  }
  if (requestedRetentionDays > maxRetentionDays) {
    return {
      allowed: false,
      retentionDays: 0,
      reason: "retention-too-long",
    };
  }

  return {
    allowed: true,
    retentionDays: requestedRetentionDays,
    reason: "allowed",
  };
}
