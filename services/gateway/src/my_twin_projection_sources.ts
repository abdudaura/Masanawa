import type { MyTwinProfileSource } from "./my_twin_projection.js";
import type {
  MyTwinFeatureSource,
  MyTwinPerformanceSource,
  MyTwinPerformanceSummary,
} from "./my_twin_projection.js";

export interface MyTwinActivitySummaryReader {
  readSummary(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
  }): Promise<{
    readonly visitors: number;
    readonly conversations: number;
    readonly earningsCredits: number;
    readonly pendingOwnerRequests: number;
  }>;
}

export function createMyTwinPerformanceSource(input: {
  readonly activity: MyTwinActivitySummaryReader;
}): MyTwinPerformanceSource {
  return Object.freeze({
    async read(request): Promise<MyTwinPerformanceSummary> {
      const value = await input.activity.readSummary(request);
      return Object.freeze({
        visitors: value.visitors,
        conversations: value.conversations,
        earningsCredits: value.earningsCredits,
        pendingOwnerRequests: value.pendingOwnerRequests,
      });
    },
  });
}

export interface TwinVoiceAvailabilityReader {
  isEnabled(input: {
    readonly tenantId: string;
    readonly characterId: string;
  }): Promise<boolean>;
}

export interface OwnerAccessAvailabilityReader {
  readOffering(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
  }): Promise<{ readonly enabled: boolean } | null>;
}

export function createMyTwinFeatureSource(input: {
  readonly voice: TwinVoiceAvailabilityReader;
  readonly ownerAccess: OwnerAccessAvailabilityReader;
}): MyTwinFeatureSource {
  return Object.freeze({
    async read(request) {
      const [voiceEnabled, offering] = await Promise.all([
        input.voice.isEnabled({
          tenantId: request.tenantId,
          characterId: request.characterId,
        }),
        input.ownerAccess.readOffering(request),
      ]);

      return Object.freeze({
        voiceEnabled: voiceEnabled === true,
        ownerAccessEnabled: offering?.enabled === true,
      });
    },
  });
}


export interface TwinVoicePolicyReader {
  readActive(input: {
    readonly tenantId: string;
    readonly characterId: string;
  }): Promise<{ readonly active: boolean } | null>;
}

export function createPolicyBackedVoiceAvailability(input: {
  readonly policies: TwinVoicePolicyReader;
}): TwinVoiceAvailabilityReader {
  return Object.freeze({
    async isEnabled(request) {
      const policy = await input.policies.readActive(request);
      return policy?.active === true;
    },
  });
}

export interface OwnerAccessOfferingReader {
  readActive(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
  }): Promise<{ readonly enabled: boolean } | null>;
}

export function createOfferingBackedOwnerAccessAvailability(input: {
  readonly offerings: OwnerAccessOfferingReader;
}): OwnerAccessAvailabilityReader {
  return Object.freeze({
    async readOffering(request) {
      const offering = await input.offerings.readActive(request);
      return offering
        ? Object.freeze({ enabled: offering.enabled === true })
        : null;
    },
  });
}


export interface CanonicalTwinProfileRecord {
  readonly tenantId: string;
  readonly characterId: string;
  readonly ownerUserId: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly bio: string;
  readonly languages: readonly string[];
  readonly discoverable: boolean;
  readonly revision: number;
}

export interface CanonicalTwinProfileStore {
  readForOwner(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
  }): Promise<CanonicalTwinProfileRecord | null>;

  update(input: {
    readonly tenantId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly expectedRevision: number;
    readonly patch: { readonly discoverable: boolean };
    readonly updatedAt: string;
  }): Promise<CanonicalTwinProfileRecord>;
}

function projectProfile(record: CanonicalTwinProfileRecord) {
  return Object.freeze({
    characterId: record.characterId,
    publicId: record.publicId,
    displayName: record.displayName,
    bio: record.bio,
    languages: Object.freeze([...record.languages]),
    discoverable: record.discoverable,
    revision: record.revision,
  });
}

export function createCanonicalMyTwinProfileSource(input: {
  readonly store: CanonicalTwinProfileStore;
  readonly now?: () => string;
}): MyTwinProfileSource {
  const now = input.now ?? (() => new Date().toISOString());

  return Object.freeze({
    async read(request) {
      const record = await input.store.readForOwner(request);
      if (!record) return null;
      if (
        record.tenantId !== request.tenantId ||
        record.ownerUserId !== request.ownerUserId
      ) {
        throw new Error("Twin profile store returned an out-of-scope profile");
      }
      return projectProfile(record);
    },

    async setDiscoverable(request) {
      const current = await input.store.readForOwner({
        tenantId: request.tenantId,
        ownerUserId: request.ownerUserId,
      });
      if (!current) {
        throw new Error("Personal twin profile does not exist");
      }
      if (
        current.tenantId !== request.tenantId ||
        current.ownerUserId !== request.ownerUserId
      ) {
        throw new Error("Twin profile store returned an out-of-scope profile");
      }

      const updated = await input.store.update({
        tenantId: request.tenantId,
        ownerUserId: request.ownerUserId,
        characterId: current.characterId,
        expectedRevision: current.revision,
        patch: { discoverable: request.discoverable },
        updatedAt: now(),
      });

      if (
        updated.characterId !== current.characterId ||
        updated.publicId !== current.publicId ||
        updated.ownerUserId !== current.ownerUserId
      ) {
        throw new Error("Twin profile store changed stable twin identity");
      }

      return projectProfile(updated);
    },
  });
}
