/** J01 / C04. Pure contract; actor identity comes exclusively from session authority. */
export const FAN_DISCLOSURE_VERSION = "masana-ai-v1" as const;
export const FAN_INTERESTS = ["technology", "learning", "creative", "business", "wellbeing"] as const;
export type FanLanguage = "en" | "ha";
export type FanInterest = (typeof FAN_INTERESTS)[number];
export interface FanSetupUpdate {
  readonly expectedRevision: number;
  readonly displayName: string;
  readonly preferredLanguage: FanLanguage;
  readonly interests: readonly FanInterest[];
  readonly ageAttested18Plus: true;
  readonly disclosureAccepted: true;
  readonly disclosureVersion: typeof FAN_DISCLOSURE_VERSION;
  readonly avatarMediaId?: string | null;
}
export interface FanSetupProfile {
  readonly userId: string;
  readonly displayName: string | null;
  readonly avatarMediaId: string | null;
  readonly preferredLanguage: FanLanguage;
  readonly interests: readonly FanInterest[];
  readonly ageAttested18Plus: boolean;
  readonly disclosureAccepted: boolean;
  readonly disclosureVersion: string | null;
  readonly completed: boolean;
  readonly revision: number;
}
export class FanSetupValidationError extends Error {
  readonly code = "invalid_fan_setup";
  constructor(readonly reason: string) { super(reason); }
}
const keys = new Set(["expectedRevision", "displayName", "preferredLanguage",
  "interests", "ageAttested18Plus", "disclosureAccepted", "disclosureVersion", "avatarMediaId"]);
const allowed = new Set<string>(FAN_INTERESTS);
export function parseFanSetupUpdate(raw: unknown): FanSetupUpdate {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new FanSetupValidationError("body_required");
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some(k => !keys.has(k)))
    throw new FanSetupValidationError("unknown_field");
  const expectedRevision = body.expectedRevision;
  if (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 1)
    throw new FanSetupValidationError("invalid_revision");
  const displayName = typeof body.displayName === "string"
    ? body.displayName.normalize("NFC").trim() : "";
  if (displayName.length < 2 || displayName.length > 60 ||
      /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(displayName))
    throw new FanSetupValidationError("invalid_display_name");
  if (body.preferredLanguage !== "en" && body.preferredLanguage !== "ha")
    throw new FanSetupValidationError("invalid_language");
  if (!Array.isArray(body.interests) || body.interests.length > 5 ||
      body.interests.some(x => typeof x !== "string" || !allowed.has(x)) ||
      new Set(body.interests).size !== body.interests.length)
    throw new FanSetupValidationError("invalid_interests");
  if (body.ageAttested18Plus !== true)
    throw new FanSetupValidationError("age_confirmation_required");
  if (body.disclosureAccepted !== true || body.disclosureVersion !== FAN_DISCLOSURE_VERSION)
    throw new FanSetupValidationError("ai_disclosure_required");
  if (body.avatarMediaId !== undefined && body.avatarMediaId !== null &&
      (typeof body.avatarMediaId !== "string" || !/^media_[A-Za-z0-9_-]{5,120}$/.test(body.avatarMediaId)))
    throw new FanSetupValidationError("invalid_avatar");
  return {
    expectedRevision: expectedRevision as number,
    displayName,
    preferredLanguage: body.preferredLanguage,
    interests: [...body.interests] as FanInterest[],
    ageAttested18Plus: true,
    disclosureAccepted: true,
    disclosureVersion: FAN_DISCLOSURE_VERSION,
    ...(Object.hasOwn(body, "avatarMediaId") ? {avatarMediaId: body.avatarMediaId as string | null}: {})
  };
}
