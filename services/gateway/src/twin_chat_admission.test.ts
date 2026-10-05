import { describe, expect, it } from "vitest";
import { admitTwinInteraction } from "./twin_chat_admission.js";

const common = {
  userId: "user-1",
  characterId: "character-1",
  now: "2026-10-05T10:00:00Z",
};

describe("twin chat admission", () => {
  it("keeps public twin text free without a financial admission", () => {
    const result = admitTwinInteraction({
      ...common,
      interaction: "text-message",
    });
    expect(result).toEqual({
      interaction: "text-message",
      chargeMode: "free",
      chargeCredits: 0,
      paidAdmissionId: null,
    });
  });

  it("does not let a client make text billable by attaching a paid admission", () => {
    const result = admitTwinInteraction({
      ...common,
      interaction: "text-message",
      paidAdmission: {
        admissionId: "voice-admission-1",
        userId: "user-1",
        characterId: "character-1",
        chargeMode: "paid",
        admittedAt: "2026-10-05T09:59:00Z",
        expiresAt: "2026-10-05T10:30:00Z",
      },
    });
    expect(result.chargeMode).toBe("free");
    expect(result.paidAdmissionId).toBeNull();
  });

  it("requires a valid admission for live voice", () => {
    expect(() =>
      admitTwinInteraction({
        ...common,
        interaction: "live-voice",
      }),
    ).toThrow("requires a valid admission");
  });

  it("accepts a valid seven-day-trial voice admission", () => {
    const result = admitTwinInteraction({
      ...common,
      interaction: "voice-note",
      paidAdmission: {
        admissionId: "voice-admission-trial",
        userId: "user-1",
        characterId: "character-1",
        chargeMode: "trial",
        admittedAt: "2026-10-05T09:59:00Z",
        expiresAt: "2026-10-05T10:30:00Z",
      },
    });
    expect(result.chargeMode).toBe("trial");
    expect(result.paidAdmissionId).toBe("voice-admission-trial");
  });

  it("rejects expired or cross-user/cross-twin admissions", () => {
    expect(() =>
      admitTwinInteraction({
        ...common,
        interaction: "live-voice",
        paidAdmission: {
          admissionId: "voice-admission-expired",
          userId: "user-1",
          characterId: "character-1",
          chargeMode: "paid",
          admittedAt: "2026-10-05T09:00:00Z",
          expiresAt: "2026-10-05T10:00:00Z",
        },
      }),
    ).toThrow("expired");

    expect(() =>
      admitTwinInteraction({
        ...common,
        interaction: "live-voice",
        paidAdmission: {
          admissionId: "voice-admission-other",
          userId: "user-2",
          characterId: "character-1",
          chargeMode: "paid",
          admittedAt: "2026-10-05T09:59:00Z",
          expiresAt: "2026-10-05T10:30:00Z",
        },
      }),
    ).toThrow("another user");

    expect(() =>
      admitTwinInteraction({
        ...common,
        interaction: "voice-note",
        paidAdmission: {
          admissionId: "voice-admission-other-twin",
          userId: "user-1",
          characterId: "character-2",
          chargeMode: "paid",
          admittedAt: "2026-10-05T09:59:00Z",
          expiresAt: "2026-10-05T10:30:00Z",
        },
      }),
    ).toThrow("another twin");
  });
});
