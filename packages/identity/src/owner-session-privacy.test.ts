import { describe, expect, it } from "vitest";
import {
  DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
  evaluateOwnerSessionCapture,
  normalizeOwnerSessionPrivacyPolicy,
  projectOwnerSessionEvidence,
} from "./owner-session-privacy.js";

describe("owner-session privacy policy", () => {
  it("allows bounded text transcript retention by default", () => {
    expect(
      evaluateOwnerSessionCapture({
        context: {
          modality: "text",
          captureKind: "text-transcript",
          requesterConsented: false,
          ownerConsented: false,
          recordingIndicatorVisible: false,
        },
      }),
    ).toEqual({
      allowed: true,
      captureKind: "text-transcript",
      retentionDays: 30,
      reasons: [],
    });
  });

  it("disables audio and video recording by default", () => {
    for (const input of [
      { modality: "voice", captureKind: "audio-recording" },
      { modality: "video", captureKind: "video-recording" },
    ] as const) {
      expect(
        evaluateOwnerSessionCapture({
          context: {
            ...input,
            requesterConsented: true,
            ownerConsented: true,
            recordingIndicatorVisible: true,
          },
        }),
      ).toMatchObject({
        allowed: false,
        retentionDays: 0,
        reasons: ["capture-disabled"],
      });
    }
  });

  it("requires requester consent, owner consent and a visible indicator when recording is enabled", () => {
    const policy = {
      ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
      revision: 2,
      allowAudioRecording: true,
      recordingRetentionDays: 7,
    };

    expect(
      evaluateOwnerSessionCapture({
        policy,
        context: {
          modality: "voice",
          captureKind: "audio-recording",
          requesterConsented: false,
          ownerConsented: false,
          recordingIndicatorVisible: false,
        },
      }),
    ).toEqual({
      allowed: false,
      captureKind: "audio-recording",
      retentionDays: 0,
      reasons: [
        "requester-consent-required",
        "owner-consent-required",
        "recording-indicator-required",
      ],
    });
  });

  it("allows explicitly consented recording under an enabled policy", () => {
    expect(
      evaluateOwnerSessionCapture({
        policy: {
          ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
          revision: 2,
          allowAudioRecording: true,
          recordingRetentionDays: 7,
        },
        context: {
          modality: "voice",
          captureKind: "audio-recording",
          requesterConsented: true,
          ownerConsented: true,
          recordingIndicatorVisible: true,
        },
      }),
    ).toEqual({
      allowed: true,
      captureKind: "audio-recording",
      retentionDays: 7,
      reasons: [],
    });
  });

  it("rejects capture kinds that do not match the session modality", () => {
    expect(
      evaluateOwnerSessionCapture({
        context: {
          modality: "text",
          captureKind: "audio-recording",
          requesterConsented: true,
          ownerConsented: true,
          recordingIndicatorVisible: true,
        },
      }),
    ).toMatchObject({
      allowed: false,
      reasons: ["capture-kind-modality-mismatch", "capture-disabled"],
    });
  });

  it("never treats attendance/completion evidence as permission to persist content", () => {
    const denied = evaluateOwnerSessionCapture({
      context: {
        modality: "voice",
        captureKind: "audio-recording",
        requesterConsented: true,
        ownerConsented: true,
        recordingIndicatorVisible: true,
      },
    });

    expect(projectOwnerSessionEvidence({ captureDecision: denied })).toEqual({
      mayPersistAttendance: true,
      mayPersistCompletion: true,
      mayPersistParticipantIds: true,
      mayPersistContent: false,
      mayPersistRecording: false,
    });
  });

  it("permits metadata-only evidence when no capture is requested", () => {
    const decision = evaluateOwnerSessionCapture({
      context: {
        modality: "voice",
        captureKind: "none",
        requesterConsented: false,
        ownerConsented: false,
        recordingIndicatorVisible: false,
      },
    });

    expect(projectOwnerSessionEvidence({ captureDecision: decision })).toEqual({
      mayPersistAttendance: true,
      mayPersistCompletion: true,
      mayPersistParticipantIds: true,
      mayPersistContent: false,
      mayPersistRecording: false,
    });
  });

  it("rejects unsafe recording policy revisions that permit silent or unilateral recording", () => {
    expect(() =>
      normalizeOwnerSessionPrivacyPolicy({
        ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
        revision: 2,
        allowAudioRecording: true,
        recordingRetentionDays: 7,
        requireOwnerRecordingConsent: false,
      }),
    ).toThrow("requires both participant consents");

    expect(() =>
      normalizeOwnerSessionPrivacyPolicy({
        ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
        revision: 2,
        allowVideoRecording: true,
        recordingRetentionDays: 7,
        requireRecordingIndicator: false,
      }),
    ).toThrow("visible recording indicator");
  });

  it("requires zero retention when a capture family is disabled", () => {
    expect(() =>
      normalizeOwnerSessionPrivacyPolicy({
        ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
        revision: 2,
        allowTextTranscriptRetention: false,
      }),
    ).toThrow("textTranscriptRetentionDays must be zero");

    expect(() =>
      normalizeOwnerSessionPrivacyPolicy({
        ...DEFAULT_OWNER_SESSION_PRIVACY_POLICY,
        revision: 2,
        recordingRetentionDays: 1,
      }),
    ).toThrow("recordingRetentionDays must be zero");
  });
});
