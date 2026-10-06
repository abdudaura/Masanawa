import {
  toInstant,
  type ChannelAccountId,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type {
  ChannelIdentityResolution,
  LaunchChannelKind,
} from "@masanawa/identity";
import type { DeterministicChannelRoute } from "./channel-routing.js";

export interface ChannelIdentityResolverPort {
  resolve(input: {
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
    readonly channel: LaunchChannelKind;
    readonly externalSubjectId: string;
  }): Promise<ChannelIdentityResolution>;
}

export interface DeterministicChannelRouterPort {
  resolve(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly observedAt: Instant;
  }): Promise<DeterministicChannelRoute>;
}

export interface ProofResolvedChannelRoute {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly externalSubjectId: string;
  readonly bindingRevision: number;
  readonly proofMethod: "channel-possession-challenge" | "authenticated-cross-channel-confirmation";
  readonly proofEvidenceRef: string;
  readonly proofVerifiedAt: Instant;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
  readonly source: DeterministicChannelRoute["source"];
}

function boundedSubject(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("externalSubjectId must be a string");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 512 ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError("externalSubjectId is invalid");
  }
  return normalized;
}

export function createProofResolvedChannelRouter(input: {
  readonly identities: ChannelIdentityResolverPort;
  readonly router: DeterministicChannelRouterPort;
}) {
  return Object.freeze({
    async resolve(request: {
      readonly tenantId: TenantId;
      readonly channelAccountId: ChannelAccountId;
      readonly channel: LaunchChannelKind;
      readonly externalSubjectId: string;
      readonly observedAt: Instant;
    }): Promise<ProofResolvedChannelRoute> {
      const externalSubjectId = boundedSubject(request.externalSubjectId);
      const observedAt = toInstant(request.observedAt);

      const identityResult = await input.identities.resolve({
        tenantId: request.tenantId,
        channelAccountId: request.channelAccountId,
        channel: request.channel,
        externalSubjectId,
      });
      if (identityResult.status !== "resolved") {
        throw new Error(
          `Channel subject is not proof-linked: ${identityResult.reason}`,
        );
      }

      const identity = identityResult.identity;
      if (
        identity.tenantId !== request.tenantId ||
        identity.channelAccountId !== request.channelAccountId ||
        identity.channel !== request.channel ||
        identity.externalSubjectId !== externalSubjectId ||
        identity.proof === null
      ) {
        throw new Error("Resolved channel identity does not match routing request");
      }

      const route = await input.router.resolve({
        tenantId: identity.tenantId,
        userId: identity.userId,
        observedAt,
      });
      if (
        route.tenantId !== identity.tenantId ||
        route.userId !== identity.userId
      ) {
        throw new Error("Deterministic channel route changed resolved identity scope");
      }

      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
        channelAccountId: identity.channelAccountId,
        channel: identity.channel,
        externalSubjectId: identity.externalSubjectId,
        bindingRevision: identity.bindingRevision,
        proofMethod: identity.proof.method,
        proofEvidenceRef: identity.proof.evidenceRef,
        proofVerifiedAt: identity.proof.verifiedAt,
        characterId: route.characterId,
        relationshipId: route.relationshipId,
        source: route.source,
      });
    },
  });
}
