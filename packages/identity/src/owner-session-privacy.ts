export type OwnerSessionModality = "text" | "voice" | "video";

export type OwnerSessionCaptureKind =
  | "none"
  | "text-transcript"
  | "audio-recording"
  | "video-recording";

export type OwnerSessionCaptureDenialReason =
  | "capture-disabled"
  | "requester-consent-required"
  | "owner-consent-required"
  | "recording-indicator-required"
  | "capture-kind-modality-mismatch";

export interface OwnerSessionPrivacyPolicy {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly allowTextTranscriptRetention: boolean;
  readonly allowAudioRecording: boolean;
  readonly allowVideoRecording: boolean;
  readonly requireRequesterRecordingConsent: boolean;
  readonly requireOwnerRecordingConsent: boolean;
  readonly requireRecordingIndicator: boolean;
  readonly textTranscriptRetentionDays: number;
  readonly recordingRetentionDays: number;
}

export interface OwnerSessionCaptureContext {
  readonly modality: OwnerSessionModality;
  readonly captureKind: OwnerSessionCaptureKind;
  readonly requesterConsented: boolean;
  readonly ownerConsented: boolean;
  readonly recordingIndicatorVisible: boolean;
}

export interface OwnerSessionCaptureDecision {
  readonly allowed: boolean;
  readonly captureKind: OwnerSessionCaptureKind;
  readonly retentionDays: number;
  readonly reasons: readonly OwnerSessionCaptureDenialReason[];
}

export interface OwnerSessionEvidenceProjection {
  readonly mayPersistAttendance: true;
  readonly mayPersistCompletion: true;
  readonly mayPersistParticipantIds: true;
  readonly mayPersistContent: boolean;
  readonly mayPersistRecording: boolean;
}

export const DEFAULT_OWNER_SESSION_PRIVACY_POLICY: OwnerSessionPrivacyPolicy =
  Object.freeze({
    schemaVersion: 1,
    revision: 1,
    allowTextTranscriptRetention: true,
    allowAudioRecording: false,
    allowVideoRecording: false,
    requireRequesterRecordingConsent: true,
    requireOwnerRecordingConsent: true,
    requireRecordingIndicator: true,
    textTranscriptRetentionDays: 30,
    recordingRetentionDays: 0,
  });

function integer(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeOwnerSessionPrivacyPolicy(
  input: OwnerSessionPrivacyPolicy,
): OwnerSessionPrivacyPolicy {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported owner-session privacy policy");
  }

  const revision = integer(input.revision, "revision", 1, 2_147_483_647);
  const textTranscriptRetentionDays = integer(
    input.textTranscriptRetentionDays,
    "textTranscriptRetentionDays",
    0,
    3_650,
  );
  const recordingRetentionDays = integer(
    input.recordingRetentionDays,
    "recordingRetentionDays",
    0,
    3_650,
  );

  const booleans = {
    allowTextTranscriptRetention: input.allowTextTranscriptRetention,
    allowAudioRecording: input.allowAudioRecording,
    allowVideoRecording: input.allowVideoRecording,
    requireRequesterRecordingConsent: input.requireRequesterRecordingConsent,
    requireOwnerRecordingConsent: input.requireOwnerRecordingConsent,
    requireRecordingIndicator: input.requireRecordingIndicator,
  };
  for (const [name, value] of Object.entries(booleans)) {
    if (typeof value !== "boolean") {
      throw new TypeError(`${name} must be boolean`);
    }
  }

  if (
    (input.allowAudioRecording || input.allowVideoRecording) &&
    (!input.requireRequesterRecordingConsent ||
      !input.requireOwnerRecordingConsent ||
      !input.requireRecordingIndicator)
  ) {
    throw new Error(
      "Owner-session recording requires both participant consents and a visible recording indicator",
    );
  }

  if (
    !input.allowTextTranscriptRetention &&
    textTranscriptRetentionDays !== 0
  ) {
    throw new Error(
      "textTranscriptRetentionDays must be zero when transcript retention is disabled",
    );
  }

  if (
    !input.allowAudioRecording &&
    !input.allowVideoRecording &&
    recordingRetentionDays !== 0
  ) {
    throw new Error(
      "recordingRetentionDays must be zero when recording is disabled",
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    revision,
    allowTextTranscriptRetention: input.allowTextTranscriptRetention,
    allowAudioRecording: input.allowAudioRecording,
    allowVideoRecording: input.allowVideoRecording,
    requireRequesterRecordingConsent:
      input.requireRequesterRecordingConsent,
    requireOwnerRecordingConsent: input.requireOwnerRecordingConsent,
    requireRecordingIndicator: input.requireRecordingIndicator,
    textTranscriptRetentionDays,
    recordingRetentionDays,
  });
}

function validateContext(context: OwnerSessionCaptureContext): void {
  if (
    context.modality !== "text" &&
    context.modality !== "voice" &&
    context.modality !== "video"
  ) {
    throw new TypeError("modality is invalid");
  }
  if (
    context.captureKind !== "none" &&
    context.captureKind !== "text-transcript" &&
    context.captureKind !== "audio-recording" &&
    context.captureKind !== "video-recording"
  ) {
    throw new TypeError("captureKind is invalid");
  }
  for (const [name, value] of Object.entries({
    requesterConsented: context.requesterConsented,
    ownerConsented: context.ownerConsented,
    recordingIndicatorVisible: context.recordingIndicatorVisible,
  })) {
    if (typeof value !== "boolean") {
      throw new TypeError(`${name} must be boolean`);
    }
  }
}

function captureMatchesModality(
  modality: OwnerSessionModality,
  captureKind: OwnerSessionCaptureKind,
): boolean {
  if (captureKind === "none") return true;
  if (captureKind === "text-transcript") return modality === "text";
  if (captureKind === "audio-recording") {
    return modality === "voice" || modality === "video";
  }
  return modality === "video";
}

export function evaluateOwnerSessionCapture(input: {
  readonly policy?: OwnerSessionPrivacyPolicy;
  readonly context: OwnerSessionCaptureContext;
}): OwnerSessionCaptureDecision {
  const policy = normalizeOwnerSessionPrivacyPolicy(
    input.policy ?? DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
  );
  validateContext(input.context);

  const reasons: OwnerSessionCaptureDenialReason[] = [];
  let retentionDays = 0;

  if (!captureMatchesModality(input.context.modality, input.context.captureKind)) {
    reasons.push("capture-kind-modality-mismatch");
  }

  switch (input.context.captureKind) {
    case "none":
      break;
    case "text-transcript":
      if (!policy.allowTextTranscriptRetention) {
        reasons.push("capture-disabled");
      } else {
        retentionDays = policy.textTranscriptRetentionDays;
      }
      break;
    case "audio-recording":
      if (!policy.allowAudioRecording) {
        reasons.push("capture-disabled");
      } else {
        retentionDays = policy.recordingRetentionDays;
      }
      break;
    case "video-recording":
      if (!policy.allowVideoRecording) {
        reasons.push("capture-disabled");
      } else {
        retentionDays = policy.recordingRetentionDays;
      }
      break;
  }

  const isRecording =
    input.context.captureKind === "audio-recording" ||
    input.context.captureKind === "video-recording";

  if (isRecording && !reasons.includes("capture-disabled")) {
    if (
      policy.requireRequesterRecordingConsent &&
      !input.context.requesterConsented
    ) {
      reasons.push("requester-consent-required");
    }
    if (policy.requireOwnerRecordingConsent && !input.context.ownerConsented) {
      reasons.push("owner-consent-required");
    }
    if (
      policy.requireRecordingIndicator &&
      !input.context.recordingIndicatorVisible
    ) {
      reasons.push("recording-indicator-required");
    }
  }

  return Object.freeze({
    allowed: reasons.length === 0,
    captureKind: input.context.captureKind,
    retentionDays: reasons.length === 0 ? retentionDays : 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function projectOwnerSessionEvidence(input: {
  readonly captureDecision: OwnerSessionCaptureDecision;
}): OwnerSessionEvidenceProjection {
  const captureAllowed = input.captureDecision.allowed;
  return Object.freeze({
    mayPersistAttendance: true,
    mayPersistCompletion: true,
    mayPersistParticipantIds: true,
    mayPersistContent:
      captureAllowed &&
      input.captureDecision.captureKind === "text-transcript",
    mayPersistRecording:
      captureAllowed &&
      (input.captureDecision.captureKind === "audio-recording" ||
        input.captureDecision.captureKind === "video-recording"),
  });
}
