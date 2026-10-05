export interface MyTwinAuthority {
  readonly tenantId: string;
  readonly userId: string;
}

export interface MyTwinAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "my-twin.read" | "my-twin.update";
  }): Promise<MyTwinAuthority>;
}

export interface MyTwinProfileRecord {
  readonly characterId: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly bio: string;
  readonly languages: readonly string[];
  readonly discoverable: boolean;
  readonly revision: number;
}

export interface MyTwinProfileSource {
  read(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
  }): Promise<MyTwinProfileRecord | null>;

  setDiscoverable(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly discoverable: boolean;
  }): Promise<MyTwinProfileRecord>;
}

export interface MyTwinPerformanceSummary {
  readonly visitors: number;
  readonly conversations: number;
  readonly earningsCredits: number;
  readonly pendingOwnerRequests: number;
}

export interface MyTwinPerformanceSource {
  read(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
  }): Promise<MyTwinPerformanceSummary>;
}

export interface MyTwinFeatureStatus {
  readonly voiceEnabled: boolean;
  readonly ownerAccessEnabled: boolean;
}

export interface MyTwinFeatureSource {
  read(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
  }): Promise<MyTwinFeatureStatus>;
}

export interface MyTwinView {
  readonly hasTwin: boolean;
  readonly characterId: string | null;
  readonly displayName: string;
  readonly bio: string;
  readonly publicUrl: string | null;
  readonly discoverable: boolean;
  readonly voiceEnabled: boolean;
  readonly ownerAccessEnabled: boolean;
  readonly languages: readonly string[];
  readonly summary: MyTwinPerformanceSummary;
}

export interface MyTwinProjectionService {
  read(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<MyTwinView>;

  setDiscoverable(input: {
    readonly authorizationHeader: string | undefined;
    readonly discoverable: boolean;
  }): Promise<MyTwinView>;
}

const emptySummary = Object.freeze<MyTwinPerformanceSummary>({
  visitors: 0,
  conversations: 0,
  earningsCredits: 0,
  pendingOwnerRequests: 0,
});

function cleanBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new TypeError("publicTwinBaseUrl must use HTTPS");
  }
  return parsed.toString().replace(/\/$/u, "");
}

function count(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function normalizeSummary(
  value: MyTwinPerformanceSummary,
): MyTwinPerformanceSummary {
  return Object.freeze({
    visitors: count(value.visitors, "visitors"),
    conversations: count(value.conversations, "conversations"),
    earningsCredits: count(value.earningsCredits, "earningsCredits"),
    pendingOwnerRequests: count(
      value.pendingOwnerRequests,
      "pendingOwnerRequests",
    ),
  });
}

export function createMyTwinProjectionService(input: {
  readonly authorizer: MyTwinAuthorizer;
  readonly profiles: MyTwinProfileSource;
  readonly performance: MyTwinPerformanceSource;
  readonly features: MyTwinFeatureSource;
  readonly publicTwinBaseUrl: string;
}): MyTwinProjectionService {
  const baseUrl = cleanBaseUrl(input.publicTwinBaseUrl);

  async function compose(
    authority: MyTwinAuthority,
    profile: MyTwinProfileRecord | null,
  ): Promise<MyTwinView> {
    if (!profile) {
      return Object.freeze<MyTwinProjectionService>({
        hasTwin: false,
        characterId: null,
        displayName: "",
        bio: "",
        publicUrl: null,
        discoverable: false,
        voiceEnabled: false,
        ownerAccessEnabled: false,
        languages: Object.freeze([]),
        summary: emptySummary,
      });
    }

    const [summary, features] = await Promise.all([
      input.performance.read({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
        characterId: profile.characterId,
      }),
      input.features.read({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
        characterId: profile.characterId,
      }),
    ]);

    return Object.freeze({
      hasTwin: true,
      characterId: profile.characterId,
      displayName: profile.displayName,
      bio: profile.bio,
      publicUrl: `${baseUrl}/${encodeURIComponent(profile.publicId)}`,
      discoverable: profile.discoverable,
      voiceEnabled: features.voiceEnabled === true,
      ownerAccessEnabled: features.ownerAccessEnabled === true,
      languages: Object.freeze([...profile.languages]),
      summary: normalizeSummary(summary),
    });
  }

  return Object.freeze({
    async read(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "my-twin.read",
      });
      const profile = await input.profiles.read({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
      });
      return compose(authority, profile);
    },

    async setDiscoverable(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "my-twin.update",
      });
      const updated = await input.profiles.setDiscoverable({
        tenantId: authority.tenantId,
        ownerUserId: authority.userId,
        discoverable: request.discoverable === true,
      });
      return compose(authority, updated);
    },
  });
}
