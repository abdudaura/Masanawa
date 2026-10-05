import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  createPaidVoiceService,
  type PaidVoiceAdmissionPort,
  type PaidVoiceAuthorizer,
  type PaidVoicePricingPort,
} from "./paid_voice.js";

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const characterId = createCanonicalId("character");

function service(overrides?: {
  pricing?: PaidVoicePricingPort;
  admissions?: PaidVoiceAdmissionPort;
}) {
  const authorizer: PaidVoiceAuthorizer = {
    async authorize(input) {
      expect(input.characterId).toBe(characterId);
      return { tenantId, userId };
    },
  };
  const pricing: PaidVoicePricingPort = overrides?.pricing ?? {
    async quote(input) {
      return {
        quoteId: "voice-quote-123",
        characterId: input.characterId,
        policyRevision: 3,
        trialPolicyRevision: 2,
        chargeMode: "trial",
        trialDurationDays: 7,
        trialStartsAt: "2026-10-05T09:00:00.000Z",
        trialExpiresAt: "2026-10-12T09:00:00.000Z",
        estimatedSeconds: input.expectedSeconds,
        estimatedPriceCredits: 0,
        spendCapCredits: 0,
        ownerShareBasisPoints: 3000,
        quoteExpiresAt: "2026-10-05T09:05:00.000Z",
      };
    },
  };
  const admissions: PaidVoiceAdmissionPort = overrides?.admissions ?? {
    async admit(input) {
      return {
        admissionId: "voice-admission-123",
        quoteId: input.quoteId,
        characterId: input.characterId,
        chargeMode: "trial",
        admittedAt: "2026-10-05T09:00:05.000Z",
        expiresAt: "2026-10-05T09:10:05.000Z",
        spendCapCredits: 0,
      };
    },
  };
  return createPaidVoiceService({ authorizer, pricing, admissions });
}

describe("paid twin voice service", () => {
  it("returns a zero-price seven-day trial quote when policy allows it", async () => {
    const quote = await service().quote({
      authorizationHeader: "Bearer user",
      characterId,
      expectedSeconds: 300,
    });
    expect(quote.chargeMode).toBe("trial");
    expect(quote.trialDurationDays).toBe(7);
    expect(quote.estimatedPriceCredits).toBe(0);
  });

  it("requires explicit acceptance before admission", async () => {
    await expect(
      service().start({
        authorizationHeader: "Bearer user",
        characterId,
        quoteId: "voice-quote-123",
        accepted: false,
      }),
    ).rejects.toThrow("explicit acceptance");
  });

  it("fails closed when a pricing adapter crosses twin scope", async () => {
    const wrong = createCanonicalId("character");
    await expect(
      service({
        pricing: {
          async quote() {
            return {
              quoteId: "voice-quote-123",
              characterId: wrong,
              policyRevision: 1,
              trialPolicyRevision: 1,
              chargeMode: "paid",
              trialDurationDays: 7,
              trialStartsAt: null,
              trialExpiresAt: null,
              estimatedSeconds: 60,
              estimatedPriceCredits: 2,
              spendCapCredits: 10,
              ownerShareBasisPoints: 2500,
              quoteExpiresAt: "2026-10-05T09:05:00Z",
            };
          },
        },
      }).quote({
        authorizationHeader: "Bearer user",
        characterId,
        expectedSeconds: 60,
      }),
    ).rejects.toThrow("wrong twin");
  });
});
