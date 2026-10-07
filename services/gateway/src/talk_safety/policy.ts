export type TalkSafetyTargetKind =
  | "talk"
  | "replay"
  | "comment"
  | "profile"
  | "persona";

export type TalkSafetyReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "sexual"
  | "violence"
  | "self-harm"
  | "fraud"
  | "impersonation"
  | "privacy"
  | "other";

export type TalkSafetyVisibility = "public" | "restricted" | "blocked";

export interface TalkSafetyTargetRef {
  readonly kind: TalkSafetyTargetKind;
  readonly id: string;
}

export interface TalkSafetyReport {
  readonly schemaVersion: 1;
  readonly reportId: string;
  readonly tenantId: string;
  readonly reporterUserId: string;
  readonly target: TalkSafetyTargetRef;
  readonly reason: TalkSafetyReportReason;
  readonly detail: string | null;
  readonly clientRequestId: string;
  readonly createdAt: string;
}

export interface TalkSafetyUserPreference {
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly viewerUserId: string;
  readonly subjectUserId: string;
  readonly blocked: boolean;
  readonly muted: boolean;
  readonly updatedAt: string;
}

export interface TalkSafetyEnforcement {
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly target: TalkSafetyTargetRef;
  readonly revision: number;
  readonly visibility: TalkSafetyVisibility;
  readonly reasonCode: string | null;
  readonly updatedAt: string;
}

export interface TalkSafetyDecision {
  readonly discoverable: boolean;
  readonly publiclyAccessible: boolean;
  readonly viewerCanSee: boolean;
  readonly reason:
    | "allowed"
    | "platform_restricted"
    | "platform_blocked"
    | "viewer_blocked_subject"
    | "viewer_muted_subject";
}

function text(value: string, name: string, max = 256): string {
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function iso(value: string, name: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${name} is invalid`);
  return new Date(parsed).toISOString();
}

function assertTarget(target: TalkSafetyTargetRef): TalkSafetyTargetRef {
  if (!["talk", "replay", "comment", "profile", "persona"].includes(target.kind)) {
    throw new TypeError("Safety target kind is invalid");
  }
  return Object.freeze({
    kind: target.kind,
    id: text(target.id, "target.id"),
  });
}

function reason(value: TalkSafetyReportReason): TalkSafetyReportReason {
  if (![
    "spam",
    "harassment",
    "hate",
    "sexual",
    "violence",
    "self-harm",
    "fraud",
    "impersonation",
    "privacy",
    "other",
  ].includes(value)) {
    throw new TypeError("Safety report reason is invalid");
  }
  return value;
}

export function normalizeTalkSafetyReport(input: TalkSafetyReport): TalkSafetyReport {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported safety report schema");
  return Object.freeze({
    schemaVersion: 1,
    reportId: text(input.reportId, "reportId"),
    tenantId: text(input.tenantId, "tenantId"),
    reporterUserId: text(input.reporterUserId, "reporterUserId"),
    target: assertTarget(input.target),
    reason: reason(input.reason),
    detail:
      input.detail === null
        ? null
        : text(input.detail, "detail", 2000),
    clientRequestId: text(input.clientRequestId, "clientRequestId"),
    createdAt: iso(input.createdAt, "createdAt"),
  });
}

export function talkSafetyReportFingerprint(
  input: Pick<TalkSafetyReport, "tenantId" | "reporterUserId" | "target" | "reason" | "clientRequestId">,
): string {
  const target = assertTarget(input.target);
  return [
    "talk-safety-report:v1",
    encodeURIComponent(text(input.tenantId, "tenantId")),
    encodeURIComponent(text(input.reporterUserId, "reporterUserId")),
    target.kind,
    encodeURIComponent(target.id),
    reason(input.reason),
    encodeURIComponent(text(input.clientRequestId, "clientRequestId")),
  ].join(":");
}

export function normalizeTalkSafetyUserPreference(
  input: TalkSafetyUserPreference,
): TalkSafetyUserPreference {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported safety preference schema");
  const viewerUserId = text(input.viewerUserId, "viewerUserId");
  const subjectUserId = text(input.subjectUserId, "subjectUserId");
  if (viewerUserId === subjectUserId && (input.blocked || input.muted)) {
    throw new TypeError("User cannot block or mute themselves");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: text(input.tenantId, "tenantId"),
    viewerUserId,
    subjectUserId,
    blocked: input.blocked === true,
    muted: input.muted === true,
    updatedAt: iso(input.updatedAt, "updatedAt"),
  });
}

export function normalizeTalkSafetyEnforcement(
  input: TalkSafetyEnforcement,
): TalkSafetyEnforcement {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported safety enforcement schema");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new RangeError("Safety enforcement revision is invalid");
  }
  if (!["public", "restricted", "blocked"].includes(input.visibility)) {
    throw new TypeError("Safety visibility is invalid");
  }
  const reasonCode =
    input.reasonCode === null ? null : text(input.reasonCode, "reasonCode", 160).toLowerCase();
  if (input.visibility === "public" && reasonCode !== null) {
    throw new TypeError("Public safety state cannot carry an enforcement reason");
  }
  if (input.visibility !== "public" && reasonCode === null) {
    throw new TypeError("Restricted/blocked safety state requires a reason");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: text(input.tenantId, "tenantId"),
    target: assertTarget(input.target),
    revision: input.revision,
    visibility: input.visibility,
    reasonCode,
    updatedAt: iso(input.updatedAt, "updatedAt"),
  });
}

export function decideTalkSafetyVisibility(input: Readonly<{
  enforcement: TalkSafetyEnforcement | null;
  viewerPreference: TalkSafetyUserPreference | null;
  subjectUserId: string | null;
}>): TalkSafetyDecision {
  const enforcement =
    input.enforcement === null ? null : normalizeTalkSafetyEnforcement(input.enforcement);

  if (enforcement?.visibility === "blocked") {
    return Object.freeze({
      discoverable: false,
      publiclyAccessible: false,
      viewerCanSee: false,
      reason: "platform_blocked",
    });
  }

  if (enforcement?.visibility === "restricted") {
    return Object.freeze({
      discoverable: false,
      publiclyAccessible: false,
      viewerCanSee: true,
      reason: "platform_restricted",
    });
  }

  if (input.viewerPreference !== null) {
    const preference = normalizeTalkSafetyUserPreference(input.viewerPreference);
    if (
      input.subjectUserId !== null &&
      preference.subjectUserId === input.subjectUserId &&
      preference.blocked
    ) {
      return Object.freeze({
        discoverable: true,
        publiclyAccessible: true,
        viewerCanSee: false,
        reason: "viewer_blocked_subject",
      });
    }
    if (
      input.subjectUserId !== null &&
      preference.subjectUserId === input.subjectUserId &&
      preference.muted
    ) {
      return Object.freeze({
        discoverable: true,
        publiclyAccessible: true,
        viewerCanSee: false,
        reason: "viewer_muted_subject",
      });
    }
  }

  return Object.freeze({
    discoverable: true,
    publiclyAccessible: true,
    viewerCanSee: true,
    reason: "allowed",
  });
}

export function transitionTalkSafetyEnforcement(
  current: TalkSafetyEnforcement,
  input: Readonly<{
    expectedRevision: number;
    visibility: TalkSafetyVisibility;
    reasonCode: string | null;
    updatedAt: string;
  }>,
): TalkSafetyEnforcement {
  const normalized = normalizeTalkSafetyEnforcement(current);
  if (input.expectedRevision !== normalized.revision) {
    throw new Error("Safety enforcement revision conflict");
  }
  return normalizeTalkSafetyEnforcement({
    ...normalized,
    revision: normalized.revision + 1,
    visibility: input.visibility,
    reasonCode: input.reasonCode,
    updatedAt: input.updatedAt,
  });
}
