import { describe, expect, it } from "vitest";
import {
  decideTalkSafetyVisibility,
  normalizeTalkSafetyEnforcement,
  normalizeTalkSafetyReport,
  normalizeTalkSafetyUserPreference,
  talkSafetyReportFingerprint,
  transitionTalkSafetyEnforcement,
} from "./policy.js";

describe("Talk safety policy", () => {
  it("normalizes bounded authenticated reports without auto-enforcement", () => {
    const report = normalizeTalkSafetyReport({
      schemaVersion: 1,
      reportId: "report-1",
      tenantId: "tenant-1",
      reporterUserId: "user-1",
      target: { kind: "talk", id: "talk-1" },
      reason: "harassment",
      detail: "Repeated abusive remarks",
      clientRequestId: "client-1",
      createdAt: "2026-10-07T10:00:00Z",
    });

    expect(report.target).toEqual({ kind: "talk", id: "talk-1" });
    expect(report.reason).toBe("harassment");
    expect(report.createdAt).toBe("2026-10-07T10:00:00.000Z");
  });

  it("produces deterministic report fingerprints for idempotency", () => {
    const input = {
      tenantId: "tenant-1",
      reporterUserId: "user-1",
      target: { kind: "comment" as const, id: "comment-5" },
      reason: "spam" as const,
      clientRequestId: "req-9",
    };
    expect(talkSafetyReportFingerprint(input)).toBe(talkSafetyReportFingerprint(input));
  });

  it("keeps user block/mute local to the viewer rather than platform enforcement", () => {
    const preference = normalizeTalkSafetyUserPreference({
      schemaVersion: 1,
      tenantId: "tenant-1",
      viewerUserId: "viewer",
      subjectUserId: "host",
      blocked: true,
      muted: false,
      updatedAt: "2026-10-07T10:00:00Z",
    });

    const decision = decideTalkSafetyVisibility({
      enforcement: null,
      viewerPreference: preference,
      subjectUserId: "host",
    });

    expect(decision).toEqual({
      discoverable: true,
      publiclyAccessible: true,
      viewerCanSee: false,
      reason: "viewer_blocked_subject",
    });
  });

  it("hard-filters platform-blocked targets from discovery and public access", () => {
    const enforcement = normalizeTalkSafetyEnforcement({
      schemaVersion: 1,
      tenantId: "tenant-1",
      target: { kind: "replay", id: "replay-1" },
      revision: 1,
      visibility: "blocked",
      reasonCode: "policy.abuse",
      updatedAt: "2026-10-07T10:00:00Z",
    });

    expect(decideTalkSafetyVisibility({
      enforcement,
      viewerPreference: null,
      subjectUserId: null,
    })).toEqual({
      discoverable: false,
      publiclyAccessible: false,
      viewerCanSee: false,
      reason: "platform_blocked",
    });
  });

  it("supports restricted evidence review without public discovery", () => {
    const enforcement = normalizeTalkSafetyEnforcement({
      schemaVersion: 1,
      tenantId: "tenant-1",
      target: { kind: "persona", id: "persona-1" },
      revision: 1,
      visibility: "restricted",
      reasonCode: "review.pending",
      updatedAt: "2026-10-07T10:00:00Z",
    });

    const decision = decideTalkSafetyVisibility({
      enforcement,
      viewerPreference: null,
      subjectUserId: null,
    });
    expect(decision.discoverable).toBe(false);
    expect(decision.publiclyAccessible).toBe(false);
    expect(decision.viewerCanSee).toBe(true);
  });

  it("revision-guards enforcement changes and requires reasons when restricted", () => {
    const current = normalizeTalkSafetyEnforcement({
      schemaVersion: 1,
      tenantId: "tenant-1",
      target: { kind: "talk", id: "talk-1" },
      revision: 3,
      visibility: "public",
      reasonCode: null,
      updatedAt: "2026-10-07T10:00:00Z",
    });

    expect(() => transitionTalkSafetyEnforcement(current, {
      expectedRevision: 2,
      visibility: "blocked",
      reasonCode: "policy.abuse",
      updatedAt: "2026-10-07T10:01:00Z",
    })).toThrow("revision conflict");

    expect(() => transitionTalkSafetyEnforcement(current, {
      expectedRevision: 3,
      visibility: "restricted",
      reasonCode: null,
      updatedAt: "2026-10-07T10:01:00Z",
    })).toThrow("requires a reason");
  });

  it("rejects self-blocking and malformed report/enforcement inputs", () => {
    expect(() => normalizeTalkSafetyUserPreference({
      schemaVersion: 1,
      tenantId: "tenant-1",
      viewerUserId: "same",
      subjectUserId: "same",
      blocked: true,
      muted: false,
      updatedAt: "2026-10-07T10:00:00Z",
    })).toThrow("themselves");

    expect(() => normalizeTalkSafetyReport({
      schemaVersion: 1,
      reportId: "report-1",
      tenantId: "tenant-1",
      reporterUserId: "user-1",
      target: { kind: "talk", id: "talk-1" },
      reason: "spam",
      detail: "x".repeat(2001),
      clientRequestId: "client-1",
      createdAt: "2026-10-07T10:00:00Z",
    })).toThrow("detail");

    expect(() => normalizeTalkSafetyEnforcement({
      schemaVersion: 1,
      tenantId: "tenant-1",
      target: { kind: "profile", id: "profile-1" },
      revision: 1,
      visibility: "public",
      reasonCode: "should-not-be-here",
      updatedAt: "2026-10-07T10:00:00Z",
    })).toThrow("cannot carry");
  });
});
