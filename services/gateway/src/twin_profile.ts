import type {
  CharacterId,
  Instant,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export interface TwinProfileAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface TwinProfileAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "twin.profile.read" | "twin.profile.customize";
  }): Promise<TwinProfileAuthority>;
}

export interface TwinProfileRecord {
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
  readonly updatedAt: Instant;
}

export interface TwinProfileStore {
  readForOwner(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
  }): Promise<TwinProfileRecord | null>;
  update(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
    readonly characterId: CharacterId;
    readonly expectedRevision: number;
    readonly patch: TwinProfileUpdate;
    readonly updatedAt: Instant;
  }): Promise<TwinProfileRecord>;
}

export interface TwinProfileUpdate {
  readonly displayName?: string;
  readonly bio?: string;
  readonly interests?: readonly string[];
  readonly languages?: readonly string[];
  readonly avatarUrl?: string | null;
  readonly discoverable?: boolean;
}

export interface TwinProfileView {
  readonly characterId: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly bio: string;
  readonly interests: readonly string[];
  readonly languages: readonly string[];
  readonly avatarUrl: string | null;
  readonly discoverable: boolean;
  readonly revision: number;
  readonly representationLabel: "AI twin";
}

export interface TwinProfileCustomizationPreview {
  readonly currentRevision: number;
  readonly patch: TwinProfileUpdate;
  readonly requiresConfirmation: boolean;
  readonly standingChanges: readonly ("publish-profile" | "hide-profile")[];
}

export interface TwinProfileService {
  read(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<TwinProfileView | null>;
  previewCustomization(input: {
    readonly authorizationHeader: string | undefined;
    readonly patch: TwinProfileUpdate;
  }): Promise<TwinProfileCustomizationPreview>;
  applyCustomization(input: {
    readonly authorizationHeader: string | undefined;
    readonly expectedRevision: number;
    readonly patch: TwinProfileUpdate;
    readonly confirmed: boolean;
    readonly updatedAt: Instant;
  }): Promise<TwinProfileView>;
}

function boundedText(value: string, name: string, max: number): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizePatch(patch: TwinProfileUpdate): TwinProfileUpdate {
  const normalized: {
    displayName?: string;
    bio?: string;
    interests?: readonly string[];
    languages?: readonly string[];
    avatarUrl?: string | null;
    discoverable?: boolean;
  } = {};
  if (patch.displayName !== undefined) {
    normalized.displayName = boundedText(patch.displayName, "displayName", 80);
  }
  if (patch.bio !== undefined) {
    normalized.bio = patch.bio.trim().length === 0
      ? ""
      : boundedText(patch.bio, "bio", 500);
  }
  if (patch.interests !== undefined) {
    if (!Array.isArray(patch.interests) || patch.interests.length > 20) {
      throw new TypeError("interests are invalid");
    }
    normalized.interests = Object.freeze(
      [...new Set(patch.interests.map((item) => boundedText(item, "interest", 80)))],
    );
  }
  if (patch.languages !== undefined) {
    if (!Array.isArray(patch.languages) || patch.languages.length < 1 || patch.languages.length > 12) {
      throw new TypeError("languages are invalid");
    }
    normalized.languages = Object.freeze(
      [...new Set(patch.languages.map((item) => boundedText(item, "language", 40)))],
    );
  }
  if (patch.avatarUrl !== undefined) {
    if (patch.avatarUrl === null || patch.avatarUrl.trim().length === 0) {
      normalized.avatarUrl = null;
    } else {
      const value = boundedText(patch.avatarUrl, "avatarUrl", 2048);
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") throw new TypeError("avatarUrl must use HTTPS");
      normalized.avatarUrl = parsed.toString();
    }
  }
  if (patch.discoverable !== undefined) {
    normalized.discoverable = patch.discoverable;
  }
  if (Object.keys(normalized).length === 0) throw new TypeError("profile patch is empty");
  return Object.freeze(normalized);
}

function assertOwned(record: TwinProfileRecord, authority: TwinProfileAuthority): void {
  if (record.tenantId !== authority.tenantId || record.ownerUserId !== authority.userId) {
    throw new Error("Twin profile store returned an out-of-scope profile");
  }
}

function view(record: TwinProfileRecord): TwinProfileView {
  return Object.freeze({
    characterId: record.characterId,
    publicId: record.publicId,
    displayName: record.displayName,
    bio: record.bio,
    interests: Object.freeze([...record.interests]),
    languages: Object.freeze([...record.languages]),
    avatarUrl: record.avatarUrl,
    discoverable: record.discoverable,
    revision: record.revision,
    representationLabel: "AI twin",
  });
}

function preview(record: TwinProfileRecord, rawPatch: TwinProfileUpdate): TwinProfileCustomizationPreview {
  const patch = normalizePatch(rawPatch);
  const standingChanges: ("publish-profile" | "hide-profile")[] = [];
  if (patch.discoverable !== undefined && patch.discoverable !== record.discoverable) {
    standingChanges.push(patch.discoverable ? "publish-profile" : "hide-profile");
  }
  return Object.freeze({
    currentRevision: record.revision,
    patch,
    requiresConfirmation: standingChanges.length > 0,
    standingChanges: Object.freeze(standingChanges),
  });
}

export function createTwinProfileService(input: {
  readonly authorizer: TwinProfileAuthorizer;
  readonly store: TwinProfileStore;
}): TwinProfileService {
  async function current(
    authorizationHeader: string | undefined,
    capability: "twin.profile.read" | "twin.profile.customize",
  ): Promise<{ authority: TwinProfileAuthority; record: TwinProfileRecord | null }> {
    const authority = await input.authorizer.authorize({
      authorizationHeader,
      capability,
    });
    const record = await input.store.readForOwner({
      tenantId: authority.tenantId,
      ownerUserId: authority.userId,
    });
    if (record) assertOwned(record, authority);
    return { authority, record };
  }

  return Object.freeze({
    async read(request) {
      const { record } = await current(request.authorizationHeader, "twin.profile.read");
      return record ? view(record) : null;
    },

    async previewCustomization(request) {
      const { record } = await current(
        request.authorizationHeader,
        "twin.profile.customize",
      );
      if (!record) throw new Error("Personal twin profile does not exist");
      return preview(record, request.patch);
    },

    async applyCustomization(request) {
      const { authority, record } = await current(
        request.authorizationHeader,
        "twin.profile.customize",
      );
      if (!record) throw new Error("Personal twin profile does not exist");
      if (request.expectedRevision !== record.revision) {
        throw new Error("Twin profile revision is stale");
      }
      const plan = preview(record, request.patch);
      if (plan.requiresConfirmation && request.confirmed !== true) {
        throw new Error("Twin profile standing changes require explicit confirmation");
      }
      const updated = await input.store.update({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
        characterId: record.characterId,
        expectedRevision: record.revision,
        patch: plan.patch,
        updatedAt: request.updatedAt,
      });
      assertOwned(updated, authority);
      if (updated.characterId !== record.characterId || updated.publicId !== record.publicId) {
        throw new Error("Twin profile store changed stable twin identity");
      }
      return view(updated);
    },
  });
}
