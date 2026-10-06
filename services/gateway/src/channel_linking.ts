import { randomBytes } from "node:crypto";
import {
  activateChannelBinding,
  ChannelLinkChallengeCoordinator,
  createChannelIdentityResolver,
  type ChannelBindingRepository,
  type ChannelLinkChallengeRepository,
  type LaunchChannelKind,
  type UserChannelBinding,
} from "@masanawa/identity";
import {
  parseCanonicalId,
  toInstant,
  type ChannelAccountId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export interface ChannelLinkUserAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface ChannelLinkUserAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: "channel.identity.link";
  }): Promise<ChannelLinkUserAuthority>;
}

export interface ChannelLinkTransportAuthority {
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly externalSubjectId: string;
}

export interface ChannelLinkTransportAuthorizer {
  authorize(input: {
    readonly transportEvidence: string;
    readonly channelAccountId: ChannelAccountId;
    readonly channel: LaunchChannelKind;
    readonly externalSubjectId: string;
  }): Promise<ChannelLinkTransportAuthority>;
}

export type ChannelLinkIssueResult =
  | Readonly<{
      status: "issued";
      requestId: RequestId;
      secret: string;
      expiresAt: Instant;
    }>
  | Readonly<{
      status: "already-issued";
      requestId: RequestId;
      expiresAt: Instant;
    }>;

export type ChannelLinkVerifyResult =
  | Readonly<{
      status: "linked";
      replay: boolean;
      binding: UserChannelBinding;
    }>
  | Readonly<{
      status: "rejected";
      reason: "invalid-secret" | "expired" | "locked";
      remainingAttempts: number;
    }>;

export interface ChannelLinkingService {
  issue(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly channelAccountId: string;
    readonly channel: LaunchChannelKind;
  }): Promise<ChannelLinkIssueResult>;

  verify(input: {
    readonly transportEvidence: string;
    readonly requestId: string;
    readonly channelAccountId: string;
    readonly channel: LaunchChannelKind;
    readonly externalSubjectId: string;
    readonly secret: string;
  }): Promise<ChannelLinkVerifyResult>;

  resolve(input: {
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
    readonly channel: LaunchChannelKind;
    readonly externalSubjectId: string;
  }): ReturnType<ReturnType<typeof createChannelIdentityResolver>["resolve"]>;
}

function validChannel(value: LaunchChannelKind): LaunchChannelKind {
  if (value !== "whatsapp" && value !== "telegram") {
    throw new TypeError("channel is invalid");
  }
  return value;
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

function boundedTransportEvidence(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("transportEvidence must be a string");
  }
  const normalized = value.trim();
  if (
    normalized.length < 8 ||
    normalized.length > 4096 ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError("transportEvidence is invalid");
  }
  return normalized;
}

function defaultSecret(): string {
  return randomBytes(32).toString("base64url");
}

function assertExistingChallengeScope(input: {
  readonly authority: ChannelLinkUserAuthority;
  readonly requestId: RequestId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly challenge: NonNullable<
    Awaited<ReturnType<ChannelLinkChallengeRepository["load"]>>
  >;
}): void {
  if (
    input.challenge.requestId !== input.requestId ||
    input.challenge.tenantId !== input.authority.tenantId ||
    input.challenge.userId !== input.authority.userId ||
    input.challenge.channelAccountId !== input.channelAccountId ||
    input.challenge.channel !== input.channel
  ) {
    throw new Error("Channel link RequestId belongs to a different scope");
  }
}

function sameBindingScope(input: {
  readonly binding: UserChannelBinding;
  readonly tenantId: TenantId;
  readonly channelAccountId: ChannelAccountId;
  readonly channel: LaunchChannelKind;
  readonly userId: UserId;
  readonly externalSubjectId: string;
}): boolean {
  return (
    input.binding.tenantId === input.tenantId &&
    input.binding.channelAccountId === input.channelAccountId &&
    input.binding.channel === input.channel &&
    input.binding.userId === input.userId &&
    input.binding.externalSubjectId === input.externalSubjectId
  );
}

export function createChannelLinkingService(input: {
  readonly userAuthorizer: ChannelLinkUserAuthorizer;
  readonly transportAuthorizer: ChannelLinkTransportAuthorizer;
  readonly bindings: ChannelBindingRepository;
  readonly challenges: ChannelLinkChallengeRepository;
  readonly now?: () => Instant;
  readonly secretFactory?: () => string;
  readonly challengeLifetimeMs?: number;
  readonly maxAttempts?: number;
}): ChannelLinkingService {
  const now = input.now ?? (() => toInstant(new Date()));
  const secretFactory = input.secretFactory ?? defaultSecret;
  const challengeLifetimeMs = input.challengeLifetimeMs ?? 10 * 60_000;
  const maxAttempts = input.maxAttempts ?? 5;

  if (
    !Number.isSafeInteger(challengeLifetimeMs) ||
    challengeLifetimeMs < 60_000 ||
    challengeLifetimeMs > 15 * 60_000
  ) {
    throw new RangeError("challengeLifetimeMs must be 1-15 minutes");
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new RangeError("maxAttempts must be between 1 and 10");
  }

  const coordinator = new ChannelLinkChallengeCoordinator({
    repository: input.challenges,
  });
  const resolver = createChannelIdentityResolver({
    repository: input.bindings,
  });

  return Object.freeze<ChannelLinkingService>({
    async issue(request) {
      const authority = await input.userAuthorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "channel.identity.link",
      });
      const requestId = parseCanonicalId("request", request.requestId);
      const channelAccountId = parseCanonicalId(
        "channel-account",
        request.channelAccountId,
      );
      const channel = validChannel(request.channel);

      const account = await input.bindings.readAccount({
        tenantId: authority.tenantId,
        channelAccountId,
      });
      if (
        account === null ||
        account.tenantId !== authority.tenantId ||
        account.channelAccountId !== channelAccountId ||
        account.channel !== channel ||
        account.state !== "active"
      ) {
        throw new Error("Channel account is unavailable for linking");
      }

      const alreadyLinked = await input.bindings.readActiveBindingForUser({
        tenantId: authority.tenantId,
        channelAccountId,
        userId: authority.userId,
      });
      if (alreadyLinked !== null) {
        throw new Error("Channel account is already linked to this User");
      }

      const existing = await input.challenges.load({ requestId });
      if (existing !== null) {
        assertExistingChallengeScope({
          authority,
          requestId,
          channelAccountId,
          channel,
          challenge: existing,
        });
        return Object.freeze({
          status: "already-issued" as const,
          requestId,
          expiresAt: existing.expiresAt,
        });
      }

      const createdAt = toInstant(now());
      const expiresAt = toInstant(
        new Date(Date.parse(createdAt) + challengeLifetimeMs),
      );
      const secret = secretFactory();
      const issuance = await coordinator.issue({
        requestId,
        tenantId: authority.tenantId,
        channelAccountId,
        channel,
        userId: authority.userId,
        secret,
        createdAt,
        expiresAt,
        maxAttempts,
      });

      return Object.freeze({
        status: "issued" as const,
        requestId,
        secret: issuance.secret,
        expiresAt: issuance.challenge.expiresAt,
      });
    },

    async verify(request) {
      const requestId = parseCanonicalId("request", request.requestId);
      const channelAccountId = parseCanonicalId(
        "channel-account",
        request.channelAccountId,
      );
      const channel = validChannel(request.channel);
      const externalSubjectId = boundedSubject(request.externalSubjectId);
      const transportEvidence = boundedTransportEvidence(
        request.transportEvidence,
      );

      const authority = await input.transportAuthorizer.authorize({
        transportEvidence,
        channelAccountId,
        channel,
        externalSubjectId,
      });
      if (
        authority.channelAccountId !== channelAccountId ||
        authority.channel !== channel ||
        authority.externalSubjectId !== externalSubjectId
      ) {
        throw new Error("Transport authority does not match channel link request");
      }

      const current = await input.challenges.load({ requestId });
      if (current === null) {
        throw new Error("Channel link challenge does not exist");
      }
      if (
        current.tenantId !== authority.tenantId ||
        current.channelAccountId !== channelAccountId ||
        current.channel !== channel
      ) {
        throw new Error("Channel link challenge is outside transport authority");
      }

      const decision = await coordinator.verify({
        requestId,
        secret: request.secret,
        channel,
        channelAccountId,
        externalSubjectId,
        attemptedAt: toInstant(now()),
      });
      if (decision.outcome === "rejected") {
        return Object.freeze({
          status: "rejected" as const,
          reason: decision.reason,
          remainingAttempts: decision.remainingAttempts,
        });
      }

      const challenge = decision.challenge;
      const account = await input.bindings.readAccount({
        tenantId: challenge.tenantId,
        channelAccountId,
      });
      if (
        account === null ||
        account.tenantId !== challenge.tenantId ||
        account.channelAccountId !== challenge.channelAccountId ||
        account.channel !== challenge.channel ||
        account.state !== "active"
      ) {
        throw new Error("Channel account became unavailable during linking");
      }

      const existing = await input.bindings.readBindingBySubject({
        tenantId: challenge.tenantId,
        channelAccountId,
        externalSubjectId,
      });

      if (existing !== null) {
        if (
          !sameBindingScope({
            binding: existing,
            tenantId: challenge.tenantId,
            channelAccountId,
            channel,
            userId: challenge.userId,
            externalSubjectId,
          })
        ) {
          throw new Error("Channel subject is already bound to another identity");
        }
        if (existing.state === "revoked") {
          throw new Error("Revoked channel binding cannot be relinked");
        }
        if (existing.state === "active") {
          if (
            existing.proof === null ||
            existing.proof.method !== decision.proof.method ||
            existing.proof.evidenceRef !== decision.proof.evidenceRef ||
            existing.proof.verifiedAt !== decision.proof.verifiedAt
          ) {
            throw new Error("Active channel binding proof does not match challenge");
          }
          return Object.freeze({
            status: "linked" as const,
            replay: true,
            binding: existing,
          });
        }
      }

      const pending =
        existing ??
        (await input.bindings.createPendingBinding({
          account,
          userId: challenge.userId,
          externalSubjectId,
          createdAt: decision.proof.verifiedAt,
        }));

      const activated = activateChannelBinding({
        account,
        binding: pending,
        expectedRevision: pending.revision,
        proof: decision.proof,
        activatedAt: decision.proof.verifiedAt,
      });
      const persisted = await input.bindings.putBinding(activated);

      if (
        !sameBindingScope({
          binding: persisted,
          tenantId: challenge.tenantId,
          channelAccountId,
          channel,
          userId: challenge.userId,
          externalSubjectId,
        }) ||
        persisted.state !== "active" ||
        persisted.proof === null ||
        persisted.proof.evidenceRef !== decision.proof.evidenceRef
      ) {
        throw new Error("Channel binding repository returned unexpected linked state");
      }

      return Object.freeze({
        status: "linked" as const,
        replay: decision.replay,
        binding: persisted,
      });
    },

    resolve(request) {
      return resolver.resolve(request);
    },
  });
}
