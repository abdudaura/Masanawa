import type { CharacterId, TenantId, UserId } from "@masanawa/contracts";
import { parseCanonicalId } from "@masanawa/contracts";
export type OwnerAccessModality = "text" | "voice" | "video";

export interface OwnerAccessQuote {
  readonly requestId: string;
  readonly ownerUserId: string;
  readonly originatingCharacterId: string;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly platformFeeCredits: number;
  readonly ownerEarningCredits: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialDurationDays: number;
  readonly policyRevision: number;
  readonly trialPolicyRevision: number;
  readonly quoteExpiresAt: string;
}

export interface OwnerAccessRequest {
  readonly requestId: string;
  readonly requesterUserId: string;
  readonly ownerUserId: string;
  readonly originatingCharacterId: string;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly platformFeeCredits: number;
  readonly ownerEarningCredits: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialPolicyRevision: number;
  readonly state:
    | "requested"
    | "accepted"
    | "scheduled"
    | "active"
    | "completed"
    | "settled"
    | "declined"
    | "expired"
    | "cancelled"
    | "no-show"
    | "refunded"
    | "disputed";
  readonly requestedAt: string;
  readonly acceptBy: string;
  readonly scheduledFor: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface OwnerAccessAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface OwnerAccessAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "owner-access.request"
      | "owner-access.manage"
      | "owner-access.read";
    readonly characterId: CharacterId;
  }): Promise<OwnerAccessAuthority>;
}

export interface OwnerAccessQuotePort {
  quote(input: {
    readonly tenantId: TenantId;
    readonly requesterUserId: UserId;
    readonly characterId: CharacterId;
    readonly modality: OwnerAccessModality;
    readonly durationMinutes: number;
  }): Promise<OwnerAccessQuote>;
}

export interface OwnerAccessRequestPort {
  create(input: {
    readonly tenantId: TenantId;
    readonly requesterUserId: UserId;
    readonly quote: OwnerAccessQuote;
  }): Promise<OwnerAccessRequest>;

  act(input: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly characterId: CharacterId;
    readonly requestId: string;
    readonly action:
      | "accept"
      | "decline"
      | "schedule"
      | "start"
      | "complete"
      | "cancel";
    readonly scheduledFor?: string;
  }): Promise<OwnerAccessRequest>;

  get(input: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly characterId: CharacterId;
    readonly requestId: string;
  }): Promise<OwnerAccessRequest | null>;
}

export interface OwnerAccessService {
  quote(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly modality: OwnerAccessModality;
    readonly durationMinutes: number;
  }): Promise<OwnerAccessQuote>;

  request(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly quote: OwnerAccessQuote;
  }): Promise<OwnerAccessRequest>;

  act(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly requestId: string;
    readonly action:
      | "accept"
      | "decline"
      | "schedule"
      | "start"
      | "complete"
      | "cancel";
    readonly scheduledFor?: string;
  }): Promise<OwnerAccessRequest>;

  read(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly requestId: string;
  }): Promise<OwnerAccessRequest | null>;
}

function duration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 5 || value > 480) {
    throw new RangeError("durationMinutes is invalid");
  }
  return value;
}

function requestId(value: string): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 256) {
    throw new TypeError("requestId is invalid");
  }
  return value;
}

export function createOwnerAccessService(input: {
  readonly authorizer: OwnerAccessAuthorizer;
  readonly quotes: OwnerAccessQuotePort;
  readonly requests: OwnerAccessRequestPort;
}): OwnerAccessService {
  return Object.freeze({
    async quote(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "owner-access.request",
      });
      return input.quotes.quote({
        tenantId: authority.tenantId,
        requesterUserId: authority.userId,
        characterId,
        modality: request.modality,
        durationMinutes: duration(request.durationMinutes),
      });
    },

    async request(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "owner-access.request",
      });
      if (request.quote.originatingCharacterId !== characterId) {
        throw new Error("Owner access quote belongs to another twin");
      }
      return input.requests.create({
        tenantId: authority.tenantId,
        requesterUserId: authority.userId,
        quote: request.quote,
      });
    },

    async act(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "owner-access.manage",
      });
      return input.requests.act({
        tenantId: authority.tenantId,
        actorUserId: authority.userId,
        characterId,
        requestId: requestId(request.requestId),
        action: request.action,
        ...(request.scheduledFor ? { scheduledFor: request.scheduledFor } : {}),
      });
    },

    async read(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
        capability: "owner-access.read",
      });
      return input.requests.get({
        tenantId: authority.tenantId,
        actorUserId: authority.userId,
        characterId,
        requestId: requestId(request.requestId),
      });
    },
  });
}
