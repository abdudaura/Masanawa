import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  TalkGiftActivitySink,
  TalkGiftExecutor,
  TalkGiftReceipt,
  TalkGiftRepository,
} from "./model.js";

export interface TalkGiftAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkGiftError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkGiftError";
  }
}

export interface TalkGiftService {
  gift(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    requestId: string;
    amountCredits: number;
  }>): Promise<TalkGiftReceipt>;
}

function text(value: string, name: "talk_id" | "request_id", max = 256): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TalkGiftError(`talks.gift.${name}_invalid`, 400);
  }
  return normalized;
}

function amount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000_000) {
    throw new TalkGiftError("talks.gift.amount_invalid", 400);
  }
  return value;
}

export function createTalkGiftService(input: Readonly<{
  repository: TalkGiftRepository;
  authorizer: TalkGiftAuthorizer;
  executor: TalkGiftExecutor;
  activity?: TalkGiftActivitySink;
}>): TalkGiftService {
  return Object.freeze({
    async gift(request) {
      const viewer = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const talkId = text(request.talkId, "talk_id", 160);
      const requestId = text(request.requestId, "request_id");
      const amountCredits = amount(request.amountCredits);

      const target = await input.repository.resolveTarget({
        tenantId: viewer.tenantId,
        talkId,
      });
      if (!target) throw new TalkGiftError("talks.not_found", 404);
      if (target.hostUserId === viewer.userId) {
        throw new TalkGiftError("talks.gift.self_forbidden", 409);
      }

      let moved;
      try {
        moved = await input.executor.execute({
          tenantId: viewer.tenantId,
          requestId,
          senderUserId: viewer.userId,
          recipientUserId: target.hostUserId,
          amountCredits,
        });
      } catch (error) {
        if (error instanceof Error && /balance|insufficient/iu.test(error.message)) {
          throw new TalkGiftError("talks.gift.insufficient_credits", 409);
        }
        throw error;
      }

      if (moved.amountCredits !== amountCredits) {
        throw new Error("Talk gift executor returned a mismatched amount");
      }

      if (!moved.replayed && input.activity) {
        await input.activity.append({
          tenantId: viewer.tenantId,
          requestId,
          recipientUserId: target.hostUserId,
          senderUserId: viewer.userId,
          talkId,
          talkTitle: target.talkTitle,
          giftId: moved.giftId,
          amountCredits,
          completedAt: moved.completedAt,
        });
      }

      return Object.freeze({
        giftId: moved.giftId,
        talkId,
        recipientUserId: target.hostUserId,
        recipientName: target.hostName,
        amountCredits,
        status: "completed" as const,
        completedAt: moved.completedAt,
      });
    },
  });
}
