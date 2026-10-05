import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";
import { parseCanonicalId } from "@masanawa/contracts";

export interface PaidVoiceAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface PaidVoiceAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
    readonly capability: "twin.voice.quote" | "twin.voice.start";
  }): Promise<PaidVoiceAuthority>;
}

export interface PaidVoiceQuoteRecord {
  readonly quoteId: string;
  readonly characterId: CharacterId;
  readonly policyRevision: number;
  readonly trialPolicyRevision: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialDurationDays: number;
  readonly trialStartsAt: string | null;
  readonly trialExpiresAt: string | null;
  readonly estimatedSeconds: number;
  readonly estimatedPriceCredits: number;
  readonly spendCapCredits: number;
  readonly ownerShareBasisPoints: number;
  readonly quoteExpiresAt: string;
}

export interface PaidVoicePricingPort {
  quote(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
    readonly expectedSeconds: number;
  }): Promise<PaidVoiceQuoteRecord>;
}

export interface PaidVoiceAdmissionRecord {
  readonly admissionId: string;
  readonly quoteId: string;
  readonly characterId: CharacterId;
  readonly chargeMode: "trial" | "paid";
  readonly admittedAt: string;
  readonly expiresAt: string;
  readonly spendCapCredits: number;
}

export interface PaidVoiceAdmissionPort {
  admit(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
    readonly quoteId: string;
    readonly accepted: true;
  }): Promise<PaidVoiceAdmissionRecord>;
}

export interface PaidVoiceService {
  quote(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly expectedSeconds: number;
  }): Promise<PaidVoiceQuoteRecord>;

  start(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly quoteId: string;
    readonly accepted: boolean;
  }): Promise<PaidVoiceAdmissionRecord>;
}

function expectedSeconds(value: number): number {
  if (!Number.isSafeInteger(value) || value < 30 || value > 60 * 60) {
    throw new RangeError("expectedSeconds must be between 30 and 3600");
  }
  return value;
}

function opaqueId(value: string, name: string): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 256) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
}

export function createPaidVoiceService(input: {
  readonly authorizer: PaidVoiceAuthorizer;
  readonly pricing: PaidVoicePricingPort;
  readonly admissions: PaidVoiceAdmissionPort;
}): PaidVoiceService {
  return Object.freeze({
    async quote(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "twin.voice.quote",
      });
      const quote = await input.pricing.quote({
        tenantId: authority.tenantId,
        userId: authority.userId,
        characterId,
        expectedSeconds: expectedSeconds(request.expectedSeconds),
      });
      if (quote.characterId !== characterId) {
        throw new Error("Paid voice quote returned for the wrong twin");
      }
      return quote;
    },

    async start(request) {
      if (request.accepted !== true) {
        throw new TypeError("Paid voice start requires explicit acceptance");
      }
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "twin.voice.start",
      });
      const admission = await input.admissions.admit({
        tenantId: authority.tenantId,
        userId: authority.userId,
        characterId,
        quoteId: opaqueId(request.quoteId, "quoteId"),
        accepted: true,
      });
      if (admission.characterId !== characterId) {
        throw new Error("Paid voice admission returned for the wrong twin");
      }
      return admission;
    },
  });
}
