import type {
  CharacterId,
  Instant,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export interface TwinPublicProfile {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly ownerUserId: UserId;
  readonly publicId: string;
  readonly displayName: string;
  readonly bio: string;
  readonly interests: readonly string[];
  readonly languages: readonly string[];
  readonly avatarUrl: string | null;
  readonly discoverable: boolean;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface PublicTwinProfileProjection {
  readonly characterId: CharacterId;
  readonly publicId: string;
  readonly displayName: string;
  readonly bio: string;
  readonly interests: readonly string[];
  readonly languages: readonly string[];
  readonly avatarUrl: string | null;
  readonly representationLabel: "AI twin";
  readonly ownerPresence: "not-present";
}

export interface TwinProfileRepository {
  create(input: TwinPublicProfile): Promise<TwinPublicProfile>;
  readForOwner(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
  }): Promise<TwinPublicProfile | null>;
  readPublicById(input: {
    readonly tenantId: TenantId;
    readonly publicId: string;
  }): Promise<TwinPublicProfile | null>;
  searchPublic(input: {
    readonly tenantId: TenantId;
    readonly query: string;
    readonly limit: number;
  }): Promise<readonly TwinPublicProfile[]>;
  update(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly ownerUserId: UserId;
    readonly expectedRevision: number;
    readonly patch: TwinProfilePatch;
    readonly updatedAt: Instant;
  }): Promise<TwinPublicProfile>;
}

export interface TwinProfilePatch {
  readonly displayName?: string;
  readonly bio?: string;
  readonly interests?: readonly string[];
  readonly languages?: readonly string[];
  readonly avatarUrl?: string | null;
  readonly discoverable?: boolean;
}

export type TwinProfileStandingChange =
  | "publish-profile"
  | "hide-profile";

export interface TwinProfileCustomizationPlan {
  readonly patch: TwinProfilePatch;
  readonly requiresConfirmation: boolean;
  readonly standingChanges: readonly TwinProfileStandingChange[];
}

function boundedText(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function boundedList(
  values: readonly string[],
  name: string,
  maxItems: number,
  maxItemLength: number,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new RangeError(`${name} has too many items`);
  }
  const normalized = values.map((value) =>
    boundedText(value, name, 1, maxItemLength),
  );
  return Object.freeze([...new Set(normalized)]);
}

export function normalizeTwinPublicId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/u.test(normalized)) {
    throw new TypeError("publicId is invalid");
  }
  return normalized;
}

export function normalizeTwinProfilePatch(
  patch: TwinProfilePatch,
): TwinProfilePatch {
  const normalized: {
    displayName?: string;
    bio?: string;
    interests?: readonly string[];
    languages?: readonly string[];
    avatarUrl?: string | null;
    discoverable?: boolean;
  } = {};

  if (patch.displayName !== undefined) {
    normalized.displayName = boundedText(patch.displayName, "displayName", 1, 80);
  }
  if (patch.bio !== undefined) {
    normalized.bio = patch.bio.trim().length === 0
      ? ""
      : boundedText(patch.bio, "bio", 1, 500);
  }
  if (patch.interests !== undefined) {
    normalized.interests = boundedList(patch.interests, "interests", 20, 80);
  }
  if (patch.languages !== undefined) {
    const languages = boundedList(patch.languages, "languages", 12, 40);
    if (languages.length < 1) throw new RangeError("languages cannot be empty");
    normalized.languages = languages;
  }
  if (patch.avatarUrl !== undefined) {
    if (patch.avatarUrl === null || patch.avatarUrl.trim().length === 0) {
      normalized.avatarUrl = null;
    } else {
      const avatarUrl = boundedText(patch.avatarUrl, "avatarUrl", 1, 2048);
      let parsed: URL;
      try {
        parsed = new URL(avatarUrl);
      } catch {
        throw new TypeError("avatarUrl must be an absolute HTTPS URL");
      }
      if (parsed.protocol !== "https:") {
        throw new TypeError("avatarUrl must be an absolute HTTPS URL");
      }
      normalized.avatarUrl = parsed.toString();
    }
  }
  if (patch.discoverable !== undefined) {
    if (typeof patch.discoverable !== "boolean") {
      throw new TypeError("discoverable must be boolean");
    }
    normalized.discoverable = patch.discoverable;
  }

  if (Object.keys(normalized).length === 0) {
    throw new TypeError("profile customization patch is empty");
  }
  return Object.freeze(normalized);
}

export function planTwinProfileCustomization(input: {
  readonly current: TwinPublicProfile;
  readonly patch: TwinProfilePatch;
}): TwinProfileCustomizationPlan {
  const patch = normalizeTwinProfilePatch(input.patch);
  const standingChanges: TwinProfileStandingChange[] = [];

  if (
    patch.discoverable !== undefined &&
    patch.discoverable !== input.current.discoverable
  ) {
    standingChanges.push(
      patch.discoverable ? "publish-profile" : "hide-profile",
    );
  }

  return Object.freeze({
    patch,
    requiresConfirmation: standingChanges.length > 0,
    standingChanges: Object.freeze(standingChanges),
  });
}

export function assertTwinProfileCustomizationConfirmed(input: {
  readonly plan: TwinProfileCustomizationPlan;
  readonly confirmed: boolean;
}): void {
  if (input.plan.requiresConfirmation && input.confirmed !== true) {
    throw new Error(
      "Twin profile standing changes require explicit owner confirmation",
    );
  }
}

export function projectPublicTwinProfile(
  profile: TwinPublicProfile,
): PublicTwinProfileProjection | null {
  if (!profile.discoverable) return null;

  return Object.freeze({
    characterId: profile.characterId,
    publicId: normalizeTwinPublicId(profile.publicId),
    displayName: boundedText(profile.displayName, "displayName", 1, 80),
    bio: profile.bio.trim(),
    interests: Object.freeze([...profile.interests]),
    languages: Object.freeze([...profile.languages]),
    avatarUrl: profile.avatarUrl?.trim() || null,
    representationLabel: "AI twin",
    ownerPresence: "not-present",
  });
}

export function assertStableTwinShareIdentity(input: {
  readonly previous: TwinPublicProfile;
  readonly next: TwinPublicProfile;
}): void {
  if (
    input.previous.tenantId !== input.next.tenantId ||
    input.previous.characterId !== input.next.characterId ||
    input.previous.ownerUserId !== input.next.ownerUserId ||
    normalizeTwinPublicId(input.previous.publicId) !==
      normalizeTwinPublicId(input.next.publicId)
  ) {
    throw new Error("Twin public share identity is immutable");
  }
}
