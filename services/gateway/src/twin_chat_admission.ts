export type TwinInteractionKind =
  | "text-message"
  | "voice-note"
  | "live-voice";

export interface PaidVoiceAdmissionEvidence {
  readonly admissionId: string;
  readonly characterId: string;
  readonly userId: string;
  readonly chargeMode: "trial" | "paid";
  readonly admittedAt: string;
  readonly expiresAt: string;
}

export interface TwinInteractionAdmission {
  readonly interaction: TwinInteractionKind;
  readonly chargeMode: "free" | "trial" | "paid";
  readonly chargeCredits: number;
  readonly paidAdmissionId: string | null;
}

function text(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 256) {
    throw new TypeError(`${name} is invalid`);
  }
  return value.trim();
}

function time(value: string, name: string): number {
  const parsed = new Date(value).getTime();
  if (!value || Number.isNaN(parsed)) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed;
}

export function admitTwinInteraction(input: {
  readonly interaction: TwinInteractionKind;
  readonly userId: string;
  readonly characterId: string;
  readonly now: string;
  readonly paidAdmission?: PaidVoiceAdmissionEvidence | null;
}): TwinInteractionAdmission {
  const userId = text(input.userId, "userId");
  const characterId = text(input.characterId, "characterId");
  const now = time(input.now, "now");

  if (input.interaction === "text-message") {
    return Object.freeze({
      interaction: "text-message",
      chargeMode: "free",
      chargeCredits: 0,
      paidAdmissionId: null,
    });
  }

  if (
    input.interaction !== "voice-note" &&
    input.interaction !== "live-voice"
  ) {
    throw new TypeError("Unknown twin interaction");
  }

  const admission = input.paidAdmission;
  if (!admission) {
    throw new Error("Paid twin voice requires a valid admission");
  }

  if (text(admission.userId, "admission.userId") !== userId) {
    throw new Error("Paid twin voice admission belongs to another user");
  }
  if (text(admission.characterId, "admission.characterId") !== characterId) {
    throw new Error("Paid twin voice admission belongs to another twin");
  }

  const admittedAt = time(admission.admittedAt, "admission.admittedAt");
  const expiresAt = time(admission.expiresAt, "admission.expiresAt");
  if (admittedAt > now) {
    throw new Error("Paid twin voice admission is not active yet");
  }
  if (now >= expiresAt) {
    throw new Error("Paid twin voice admission expired");
  }
  if (admission.chargeMode !== "trial" && admission.chargeMode !== "paid") {
    throw new TypeError("Paid twin voice admission has invalid charge mode");
  }

  return Object.freeze({
    interaction: input.interaction,
    chargeMode: admission.chargeMode,
    chargeCredits: 0,
    paidAdmissionId: text(admission.admissionId, "admission.admissionId"),
  });
}
