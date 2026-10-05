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
