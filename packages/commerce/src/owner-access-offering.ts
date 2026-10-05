import type {
  OwnerAccessModality,
  OwnerAccessPolicy,
} from "./owner-access.js";

export interface OwnerAccessOffering {
  readonly schemaVersion: 1;
  readonly ownerUserId: string;
  readonly characterId: string;
  readonly revision: number;
  readonly enabled: boolean;
  readonly modalities: readonly OwnerAccessModality[];
  readonly durationOptionsMinutes: readonly number[];
  readonly priceCreditsPerMinute: number;
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

export function normalizeOwnerAccessOffering(input: {
  readonly offering: OwnerAccessOffering;
  readonly policy: OwnerAccessPolicy;
}): OwnerAccessOffering {
  const { offering, policy } = input;
  if (offering.schemaVersion !== 1) {
    throw new TypeError("Unsupported owner access offering schema");
  }
  if (!offering.ownerUserId || !offering.characterId) {
    throw new TypeError("Owner access offering identity is required");
  }
  const revision = integer(offering.revision, "revision", 1, 2_147_483_647);
  if (
    !Array.isArray(offering.modalities) ||
    offering.modalities.length < 1 ||
    offering.modalities.length > 3
  ) {
    throw new RangeError("Owner access modalities are invalid");
  }
  const modalities = [...new Set(offering.modalities)];
  if (
    modalities.length !== offering.modalities.length ||
    modalities.some((value) => !["text", "voice", "video"].includes(value))
  ) {
    throw new TypeError("Owner access modalities must be unique and supported");
  }
  if (
    !Array.isArray(offering.durationOptionsMinutes) ||
    offering.durationOptionsMinutes.length < 1 ||
    offering.durationOptionsMinutes.length > 8
  ) {
    throw new RangeError("Owner access duration options are invalid");
  }
  const durations = offering.durationOptionsMinutes.map((value) =>
    integer(
      value,
      "durationOptionMinutes",
      policy.minDurationMinutes,
      policy.maxDurationMinutes,
    ),
  );
  if (new Set(durations).size !== durations.length) {
    throw new TypeError("Owner access duration options must be unique");
  }
  const priceCreditsPerMinute = integer(
    offering.priceCreditsPerMinute,
    "priceCreditsPerMinute",
    0,
    1_000_000_000,
  );

  for (const duration of durations) {
    const total = duration * priceCreditsPerMinute;
    if (total < policy.minPriceCredits || total > policy.maxPriceCredits) {
      throw new RangeError("Owner access offering price falls outside platform bounds");
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    ownerUserId: offering.ownerUserId,
    characterId: offering.characterId,
    revision,
    enabled: offering.enabled === true,
    modalities: Object.freeze(modalities),
    durationOptionsMinutes: Object.freeze([...durations].sort((a, b) => a - b)),
    priceCreditsPerMinute,
  });
}

export function priceOwnerAccessOffering(input: {
  readonly offering: OwnerAccessOffering;
  readonly modality: OwnerAccessModality;
  readonly durationMinutes: number;
}): number {
  if (!input.offering.enabled) throw new Error("Owner is not accepting paid chats");
  if (!input.offering.modalities.includes(input.modality)) {
    throw new Error("Owner does not offer this chat type");
  }
  if (!input.offering.durationOptionsMinutes.includes(input.durationMinutes)) {
    throw new Error("Owner does not offer this duration");
  }
  return input.durationMinutes * input.offering.priceCreditsPerMinute;
}
