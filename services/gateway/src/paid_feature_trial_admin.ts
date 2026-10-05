export type AdminPaidFeatureKey =
  | "twin-voice"
  | "owner-access"
  | "premium-twin";

export interface AdminPaidFeatureTrialPolicy {
  readonly feature: AdminPaidFeatureKey;
  readonly revision: number;
  readonly enabled: boolean;
  readonly durationDays: number;
  readonly maxUnits: number | null;
  readonly effectiveAt: string;
}

export interface PaidFeatureTrialPolicyStore {
  readActive(input: {
    readonly tenantId: string;
    readonly feature: AdminPaidFeatureKey;
  }): Promise<AdminPaidFeatureTrialPolicy | null>;

  putRevision(input: {
    readonly tenantId: string;
    readonly feature: AdminPaidFeatureKey;
    readonly enabled: boolean;
    readonly durationDays: number;
    readonly maxUnits: number | null;
    readonly effectiveAt: string;
  }): Promise<AdminPaidFeatureTrialPolicy>;
}

export interface PaidFeatureTrialAdminAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "monetization.trials.read" | "monetization.trials.write";
  }): Promise<{ readonly tenantId: string }>;
}

export interface PaidFeatureTrialAdminService {
  read(input: {
    readonly authorizationHeader: string | undefined;
    readonly feature: AdminPaidFeatureKey;
  }): Promise<AdminPaidFeatureTrialPolicy>;

  update(input: {
    readonly authorizationHeader: string | undefined;
    readonly feature: AdminPaidFeatureKey;
    readonly enabled: boolean;
    readonly durationDays: number;
    readonly maxUnits: number | null;
    readonly effectiveAt: string;
  }): Promise<AdminPaidFeatureTrialPolicy>;
}

function feature(value: string): AdminPaidFeatureKey {
  if (!["twin-voice", "owner-access", "premium-twin"].includes(value)) {
    throw new TypeError("Unknown paid feature");
  }
  return value as AdminPaidFeatureKey;
}

function duration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 365) {
    throw new RangeError("durationDays must be between 1 and 365");
  }
  return value;
}

function units(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
    throw new RangeError("maxUnits is invalid");
  }
  return value;
}

function timestamp(value: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new TypeError("effectiveAt is invalid");
  }
  return parsed.toISOString();
}

export function createPaidFeatureTrialAdminService(input: {
  readonly authorizer: PaidFeatureTrialAdminAuthorizer;
  readonly store: PaidFeatureTrialPolicyStore;
  readonly now?: () => Date;
}): PaidFeatureTrialAdminService {
  const now = input.now ?? (() => new Date());
  return Object.freeze({
    async read(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.trials.read",
      });
      const key = feature(request.feature);
      const current = await input.store.readActive({
        tenantId: authority.tenantId,
        feature: key,
      });
      if (current) return current;

      return Object.freeze({
        feature: key,
        revision: 0,
        enabled: true,
        durationDays: 7,
        maxUnits: null,
        effectiveAt: now().toISOString(),
      });
    },

    async update(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "monetization.trials.write",
      });
      return input.store.putRevision({
        tenantId: authority.tenantId,
        feature: feature(request.feature),
        enabled: request.enabled === true,
        durationDays: duration(request.durationDays),
        maxUnits: units(request.maxUnits),
        effectiveAt: timestamp(request.effectiveAt),
      });
    },
  });
}
