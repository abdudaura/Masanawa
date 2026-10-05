export type TwinAttributionEventType =
  | "external-funding"
  | "commerce-purchase"
  | "internal-transfer"
  | "gift"
  | "refund"
  | "reversal"
  | "test"
  | "admin";

export interface TwinAttributionInput {
  readonly attributionId: string;
  readonly ownerUserId: string;
  readonly characterId: string;
  readonly customerUserId: string | null;
  readonly eventType: TwinAttributionEventType;
  readonly operationId: string;
  readonly attributedAt: string;
  readonly expiresAt: string | null;
  readonly selfAttribution: boolean;
}

export interface TwinCommissionQuote {
  readonly eligible: boolean;
  readonly reason: string;
  readonly policyRevision: number;
  readonly baseCredits: number;
  readonly commissionCredits: number;
}

export interface TwinAttributionAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface TwinAttributionAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "monetization.attribution.read";
  }): Promise<TwinAttributionAuthority>;
}

export interface TwinAttributionQuotePort {
  quote(input: {
    readonly tenantId: string;
    readonly actorUserId: string;
    readonly attribution: TwinAttributionInput;
    readonly baseCredits: number;
  }): Promise<TwinCommissionQuote>;
}

export interface TwinAttributionService {
  quote(input: {
    readonly authorizationHeader: string | undefined;
    readonly attribution: TwinAttributionInput;
    readonly baseCredits: number;
  }): Promise<TwinCommissionQuote>;
}

function credits(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError("baseCredits is invalid");
  }
  return value;
}

export function createTwinAttributionService(input: {
  readonly authorizer: TwinAttributionAuthorizer;
  readonly quotes: TwinAttributionQuotePort;
}): TwinAttributionService {
  return Object.freeze<TwinAttributionService>({
    async quote(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.attribution.read",
      });
      return input.quotes.quote({
        tenantId: authority.tenantId,
        actorUserId: authority.userId,
        attribution: request.attribution,
        baseCredits: credits(request.baseCredits),
      });
    },
  });
}

export interface CommissionPolicyRecord {
  readonly eventType: "external-funding" | "commerce-purchase";
  readonly revision: number;
  readonly enabled: boolean;
  readonly rateBasisPoints: number;
  readonly minimumCommissionCredits: number;
  readonly maximumCommissionCredits: number | null;
  readonly effectiveAt: string;
}

export interface CommissionPolicyStore {
  readActive(input: {
    readonly tenantId: string;
    readonly eventType: "external-funding" | "commerce-purchase";
  }): Promise<CommissionPolicyRecord | null>;

  putRevision(input: {
    readonly tenantId: string;
    readonly eventType: "external-funding" | "commerce-purchase";
    readonly enabled: boolean;
    readonly rateBasisPoints: number;
    readonly minimumCommissionCredits: number;
    readonly maximumCommissionCredits: number | null;
    readonly effectiveAt: string;
  }): Promise<CommissionPolicyRecord>;
}

export interface CommissionPolicyAdminAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "monetization.commission.read"
      | "monetization.commission.write";
  }): Promise<{ readonly tenantId: string }>;
}

export function createCommissionPolicyAdminService(input: {
  readonly authorizer: CommissionPolicyAdminAuthorizer;
  readonly store: CommissionPolicyStore;
  readonly now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  return Object.freeze({
    async read(request: {
      readonly authorizationHeader: string | undefined;
      readonly eventType: "external-funding" | "commerce-purchase";
    }) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.commission.read",
      });
      const current = await input.store.readActive({
        tenantId: authority.tenantId,
        eventType: request.eventType,
      });
      if (current) return current;
      return Object.freeze({
        eventType: request.eventType,
        revision: 0,
        enabled: true,
        rateBasisPoints: 100,
        minimumCommissionCredits: 0,
        maximumCommissionCredits: null,
        effectiveAt: now().toISOString(),
      });
    },

    async update(request: {
      readonly authorizationHeader: string | undefined;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly enabled: boolean;
      readonly rateBasisPoints: number;
      readonly minimumCommissionCredits: number;
      readonly maximumCommissionCredits: number | null;
      readonly effectiveAt: string;
    }) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.commission.write",
      });
      if (
        !Number.isSafeInteger(request.rateBasisPoints) ||
        request.rateBasisPoints < 0 ||
        request.rateBasisPoints > 10_000
      ) {
        throw new RangeError("rateBasisPoints is invalid");
      }
      if (
        !Number.isSafeInteger(request.minimumCommissionCredits) ||
        request.minimumCommissionCredits < 0
      ) {
        throw new RangeError("minimumCommissionCredits is invalid");
      }
      if (
        request.maximumCommissionCredits !== null &&
        (!Number.isSafeInteger(request.maximumCommissionCredits) ||
          request.maximumCommissionCredits < request.minimumCommissionCredits)
      ) {
        throw new RangeError("maximumCommissionCredits is invalid");
      }
      if (Number.isNaN(new Date(request.effectiveAt).getTime())) {
        throw new TypeError("effectiveAt is invalid");
      }
      return input.store.putRevision({
        tenantId: authority.tenantId,
        eventType: request.eventType,
        enabled: request.enabled === true,
        rateBasisPoints: request.rateBasisPoints,
        minimumCommissionCredits: request.minimumCommissionCredits,
        maximumCommissionCredits: request.maximumCommissionCredits,
        effectiveAt: new Date(request.effectiveAt).toISOString(),
      });
    },
  });
}
