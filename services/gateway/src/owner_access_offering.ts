export type OwnerAccessOfferingModality = "text" | "voice" | "video";

export interface OwnerAccessOfferingView {
  readonly enabled: boolean;
  readonly modalities: readonly OwnerAccessOfferingModality[];
  readonly durationOptionsMinutes: readonly number[];
  readonly priceCreditsPerMinute: number;
  readonly revision: number;
}

export interface OwnerAccessOfferingAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface OwnerAccessOfferingAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "owner-access.offering.read"
      | "owner-access.offering.write";
  }): Promise<OwnerAccessOfferingAuthority>;
}

export interface OwnerAccessOfferingStore {
  read(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
  }): Promise<OwnerAccessOfferingView | null>;

  putRevision(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly enabled: boolean;
    readonly modalities: readonly OwnerAccessOfferingModality[];
    readonly durationOptionsMinutes: readonly number[];
    readonly priceCreditsPerMinute: number;
  }): Promise<OwnerAccessOfferingView>;
}

export interface OwnerAccessPlatformBounds {
  readonly allowedDurationsMinutes: readonly number[];
  readonly minPriceCreditsPerMinute: number;
  readonly maxPriceCreditsPerMinute: number;
}

export function createOwnerAccessOfferingService(input: {
  readonly authorizer: OwnerAccessOfferingAuthorizer;
  readonly store: OwnerAccessOfferingStore;
  readonly bounds: OwnerAccessPlatformBounds;
}) {
  function validate(request: {
    readonly enabled: boolean;
    readonly modalities: readonly OwnerAccessOfferingModality[];
    readonly durationOptionsMinutes: readonly number[];
    readonly priceCreditsPerMinute: number;
  }) {
    if (
      !Number.isSafeInteger(request.priceCreditsPerMinute) ||
      request.priceCreditsPerMinute < input.bounds.minPriceCreditsPerMinute ||
      request.priceCreditsPerMinute > input.bounds.maxPriceCreditsPerMinute
    ) {
      throw new RangeError("priceCreditsPerMinute is outside platform bounds");
    }

    const modalities = [...new Set(request.modalities)];
    if (
      modalities.length !== request.modalities.length ||
      modalities.length < 1 ||
      modalities.some(
        (value) =>
          value !== "text" && value !== "voice" && value !== "video",
      )
    ) {
      throw new TypeError("modalities are invalid");
    }

    const durations = [...new Set(request.durationOptionsMinutes)];
    if (
      durations.length !== request.durationOptionsMinutes.length ||
      durations.length < 1 ||
      durations.some(
        (value) =>
          !Number.isSafeInteger(value) ||
          !input.bounds.allowedDurationsMinutes.includes(value),
      )
    ) {
      throw new TypeError("durationOptionsMinutes are invalid");
    }

    return Object.freeze({
      enabled: request.enabled === true,
      modalities: Object.freeze(modalities),
      durationOptionsMinutes: Object.freeze([...durations].sort((a, b) => a - b)),
      priceCreditsPerMinute: request.priceCreditsPerMinute,
    });
  }

  return Object.freeze({
    async read(request: {
      readonly authorizationHeader: string | undefined;
    }): Promise<OwnerAccessOfferingView> {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "owner-access.offering.read",
      });
      const current = await input.store.read({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
      });
      if (current) return current;

      const defaultDuration =
        input.bounds.allowedDurationsMinutes.includes(15)
          ? 15
          : input.bounds.allowedDurationsMinutes[0];
      if (defaultDuration === undefined) {
        throw new Error("Owner access platform duration bounds are empty");
      }

      return Object.freeze({
        enabled: false,
        modalities: Object.freeze(["voice"] as const),
        durationOptionsMinutes: Object.freeze([defaultDuration]),
        priceCreditsPerMinute: input.bounds.minPriceCreditsPerMinute,
        revision: 0,
      });
    },

    async update(request: {
      readonly authorizationHeader: string | undefined;
      readonly enabled: boolean;
      readonly modalities: readonly OwnerAccessOfferingModality[];
      readonly durationOptionsMinutes: readonly number[];
      readonly priceCreditsPerMinute: number;
    }): Promise<OwnerAccessOfferingView> {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "owner-access.offering.write",
      });
      const normalized = validate(request);
      return input.store.putRevision({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
        ...normalized,
      });
    },
  });
}
