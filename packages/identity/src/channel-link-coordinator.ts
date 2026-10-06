import type {
  ChannelAccountId,
  Instant,
  RequestId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import {
  createChannelLinkChallenge,
  verifyChannelLinkChallenge,
  type ChannelLinkChallenge,
  type ChannelLinkChallengeIssuance,
  type ChannelLinkChallengeVerification,
} from "./channel-link-challenge.js";
import type { LaunchChannelKind } from "./channel-binding.js";

export interface ChannelLinkChallengeRepository {
  /**
   * Create by canonical RequestId. Exact replay may return the existing row.
   * A different challenge under the same RequestId must fail.
   */
  create(input: {
    readonly challenge: ChannelLinkChallenge;
  }): Promise<ChannelLinkChallenge>;

  load(input: {
    readonly requestId: RequestId;
  }): Promise<ChannelLinkChallenge | null>;

  /**
   * Persist exactly one lifecycle transition.
   * Implementations must reject a stale expectedRevision.
   */
  compareAndSet(input: {
    readonly requestId: RequestId;
    readonly expectedRevision: number;
    readonly next: ChannelLinkChallenge;
  }): Promise<ChannelLinkChallenge>;
}

function sameChallenge(
  left: ChannelLinkChallenge,
  right: ChannelLinkChallenge,
): boolean {
  return (
    left.requestId === right.requestId &&
    left.tenantId === right.tenantId &&
    left.channelAccountId === right.channelAccountId &&
    left.channel === right.channel &&
    left.userId === right.userId &&
    left.secretHash === right.secretHash &&
    left.state === right.state &&
    left.attempts === right.attempts &&
    left.maxAttempts === right.maxAttempts &&
    left.revision === right.revision &&
    left.createdAt === right.createdAt &&
    left.expiresAt === right.expiresAt &&
    left.verifiedAt === right.verifiedAt &&
    left.verifiedExternalSubjectId === right.verifiedExternalSubjectId
  );
}

export class ChannelLinkChallengeCoordinator {
  readonly #repository: ChannelLinkChallengeRepository;

  constructor(input: {
    readonly repository: ChannelLinkChallengeRepository;
  }) {
    this.#repository = input.repository;
  }

  async issue(input: {
    readonly requestId: RequestId;
    readonly tenantId: TenantId;
    readonly channelAccountId: ChannelAccountId;
    readonly channel: LaunchChannelKind;
    readonly userId: UserId;
    readonly secret: string;
    readonly createdAt: Instant;
    readonly expiresAt: Instant;
    readonly maxAttempts?: number;
  }): Promise<ChannelLinkChallengeIssuance> {
    const issuance = createChannelLinkChallenge(input);
    const persisted = await this.#repository.create({
      challenge: issuance.challenge,
    });
    if (!sameChallenge(persisted, issuance.challenge)) {
      throw new Error(
        "Channel link challenge RequestId conflicts with existing durable state",
      );
    }
    return issuance;
  }

  async verify(input: {
    readonly requestId: RequestId;
    readonly secret: string;
    readonly channel: LaunchChannelKind;
    readonly channelAccountId: ChannelAccountId;
    readonly externalSubjectId: string;
    readonly attemptedAt: Instant;
  }): Promise<ChannelLinkChallengeVerification> {
    const current = await this.#repository.load({
      requestId: input.requestId,
    });
    if (current === null) {
      throw new Error("Channel link challenge does not exist");
    }

    const decision = verifyChannelLinkChallenge({
      challenge: current,
      expectedRevision: current.revision,
      secret: input.secret,
      channel: input.channel,
      channelAccountId: input.channelAccountId,
      externalSubjectId: input.externalSubjectId,
      attemptedAt: input.attemptedAt,
    });

    if (decision.challenge.revision === current.revision) {
      if (!sameChallenge(decision.challenge, current)) {
        throw new Error(
          "Channel link challenge returned same revision with changed state",
        );
      }
      return decision;
    }

    if (decision.challenge.revision !== current.revision + 1) {
      throw new Error(
        "Channel link challenge transition must advance exactly one revision",
      );
    }

    const persisted = await this.#repository.compareAndSet({
      requestId: current.requestId,
      expectedRevision: current.revision,
      next: decision.challenge,
    });
    if (!sameChallenge(persisted, decision.challenge)) {
      throw new Error(
        "Channel link challenge repository returned unexpected state",
      );
    }

    if (decision.outcome === "verified") {
      return Object.freeze({
        ...decision,
        challenge: persisted,
      });
    }
    return Object.freeze({
      ...decision,
      challenge: persisted,
    });
  }
}
