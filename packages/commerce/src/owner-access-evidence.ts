export type OwnerAccessEvidenceSource =
  | "in-app-session"
  | "verified-provider-session"
  | "operator-review";

export interface OwnerAccessAttendanceEvidence {
  readonly source: OwnerAccessEvidenceSource;
  readonly sessionReference: string;
  readonly requesterPresent: boolean;
  readonly ownerPresent: boolean;
  readonly verifiedSeconds: number;
  readonly capturedAt: string;
}

export function verifyOwnerAccessCompletion(input: {
  readonly evidence: OwnerAccessAttendanceEvidence;
  readonly minimumVerifiedSeconds: number;
}): boolean {
  if (
    !Number.isSafeInteger(input.minimumVerifiedSeconds) ||
    input.minimumVerifiedSeconds < 1 ||
    input.minimumVerifiedSeconds > 24 * 60 * 60
  ) {
    throw new RangeError("minimumVerifiedSeconds is invalid");
  }
  if (
    !Number.isSafeInteger(input.evidence.verifiedSeconds) ||
    input.evidence.verifiedSeconds < 0 ||
    input.evidence.verifiedSeconds > 24 * 60 * 60
  ) {
    throw new RangeError("verifiedSeconds is invalid");
  }
  if (
    typeof input.evidence.sessionReference !== "string" ||
    input.evidence.sessionReference.length < 8 ||
    input.evidence.sessionReference.length > 256
  ) {
    throw new TypeError("sessionReference is invalid");
  }
  if (Number.isNaN(new Date(input.evidence.capturedAt).getTime())) {
    throw new TypeError("capturedAt is invalid");
  }
  return (
    input.evidence.requesterPresent === true &&
    input.evidence.ownerPresent === true &&
    input.evidence.verifiedSeconds >= input.minimumVerifiedSeconds
  );
}
