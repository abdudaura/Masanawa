export type ProviderValuationEventType =
  | "external-funding"
  | "commerce-purchase";

export interface ProviderValuationPolicyRecord {
  readonly valuationKey: string;
  readonly eventType: ProviderValuationEventType;
  readonly revision: number;
  readonly enabled: boolean;
  readonly sourceUnit: string;
  readonly sourceUnitsPerStep: number;
  readonly creditUnitsPerStep: number;
  readonly minimumSourceUnits: number;
  readonly maximumBaseCredits: number | null;
  readonly effectiveAt: string;
}

export interface ProviderValuationPolicyStore {
  readActive(input: {
    readonly tenantId: string;
    readonly valuationKey: string;
    readonly eventType: ProviderValuationEventType;
  }): Promise<ProviderValuationPolicyRecord | null>;

  putRevision(input: {
    readonly tenantId: string;
    readonly valuationKey: string;
    readonly eventType: ProviderValuationEventType;
    readonly enabled: boolean;
    readonly sourceUnit: string;
    readonly sourceUnitsPerStep: number;
    readonly creditUnitsPerStep: number;
    readonly minimumSourceUnits: number;
    readonly maximumBaseCredits: number | null;
    readonly effectiveAt: string;
  }): Promise<ProviderValuationPolicyRecord>;
}

export interface ProviderValuationAdminAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "monetization.commission.read"
      | "monetization.commission.write";
  }): Promise<{ readonly tenantId: string }>;
}

function bounded(value: number, name: string, min: number): number {
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > 1_000_000_000_000
  ) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function token(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > max ||
    !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function createProviderValuationPolicyAdminService(input: {
  readonly authorizer: ProviderValuationAdminAuthorizer;
  readonly store: ProviderValuationPolicyStore;
}) {
  return Object.freeze({
    async read(request: {
      readonly authorizationHeader: string | undefined;
      readonly valuationKey: string;
      readonly eventType: ProviderValuationEventType;
    }) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.commission.read",
      });
      return input.store.readActive({
        tenantId: authority.tenantId,
        valuationKey: token(request.valuationKey, "valuationKey", 128),
        eventType: request.eventType,
      });
    },

    async update(request: {
      readonly authorizationHeader: string | undefined;
      readonly valuationKey: string;
      readonly eventType: ProviderValuationEventType;
      readonly enabled: boolean;
      readonly sourceUnit: string;
      readonly sourceUnitsPerStep: number;
      readonly creditUnitsPerStep: number;
      readonly minimumSourceUnits: number;
      readonly maximumBaseCredits: number | null;
      readonly effectiveAt: string;
    }) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.commission.write",
      });
      const effectiveAt = new Date(request.effectiveAt);
      if (Number.isNaN(effectiveAt.getTime())) {
        throw new TypeError("effectiveAt is invalid");
      }
      return input.store.putRevision({
        tenantId: authority.tenantId,
        valuationKey: token(request.valuationKey, "valuationKey", 128),
        eventType: request.eventType,
        enabled: request.enabled === true,
        sourceUnit: token(request.sourceUnit, "sourceUnit", 64),
        sourceUnitsPerStep: bounded(
          request.sourceUnitsPerStep,
          "sourceUnitsPerStep",
          1,
        ),
        creditUnitsPerStep: bounded(
          request.creditUnitsPerStep,
          "creditUnitsPerStep",
          1,
        ),
        minimumSourceUnits: bounded(
          request.minimumSourceUnits,
          "minimumSourceUnits",
          0,
        ),
        maximumBaseCredits:
          request.maximumBaseCredits === null
            ? null
            : bounded(
                request.maximumBaseCredits,
                "maximumBaseCredits",
                0,
              ),
        effectiveAt: effectiveAt.toISOString(),
      });
    },
  });
}
