import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { TalkActivityRepository } from "../talk_activity/model.js";
import type {
  TalkHostControlsView,
  TalkHostParticipantAction,
  TalkHostRequestAction,
  TalkParticipationRepository,
  TalkParticipationView,
  TalkReaction,
  TalkRequestDecision,
} from "./model.js";

export interface TalkParticipationAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkParticipationError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkParticipationError";
  }
}

export interface TalkParticipationService {
  viewer(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkParticipationView>;

  react(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    reaction: string;
  }>): Promise<TalkParticipationView>;

  setHandRaised(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    raised: boolean;
  }>): Promise<TalkParticipationView>;

  hostControls(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkHostControlsView>;

  actOnRequest(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    requestId: string;
    action: TalkHostRequestAction;
  }>): Promise<TalkHostControlsView>;

  actOnParticipant(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    participantId: string;
    action: TalkHostParticipantAction;
  }>): Promise<TalkHostControlsView>;

  endTalk(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<Readonly<{ ended: true }>>;
}

const allowedReactions = new Set<TalkReaction>(["❤️", "👏", "😂", "💯", "🤔", "🔥"]);

function normalizeId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new TalkParticipationError(`talks.${field}_invalid`, 400);
  }
  return normalized;
}

function normalizeName(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > 160) {
    throw new TalkParticipationError("talks.participant_name_invalid", 400);
  }
  return normalized;
}

function repositoryError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  switch (error.message) {
    case "talks.host_required":
      throw new TalkParticipationError(error.message, 403);
    case "talks.host_cannot_raise_hand":
    case "talks.not_live":
    case "talks.request_unavailable":
    case "talks.request_finalized":
    case "talks.ai_commerce_required":
    case "talks.seat_capacity":
    case "talks.ai_seat_capacity":
    case "talks.host_immutable":
      throw new TalkParticipationError(error.message, 409);
    case "talks.reaction_rate_limited":
      throw new TalkParticipationError(error.message, 429);
    case "talks.request_not_found":
    case "talks.participant_not_found":
      throw new TalkParticipationError(error.message, 404);
    default:
      throw error;
  }
}

function activityKind(
  decision: TalkRequestDecision,
  action: TalkHostRequestAction,
): "raise_hand_accepted" | "raise_hand_declined" | "ai_seat_accepted" | "ai_seat_declined" {
  if (decision.request.kind === "human_speaker") {
    return action === "accept" ? "raise_hand_accepted" : "raise_hand_declined";
  }
  return action === "accept" ? "ai_seat_accepted" : "ai_seat_declined";
}

export function createTalkParticipationService(input: Readonly<{
  repository: TalkParticipationRepository;
  authorizer: TalkParticipationAuthorizer;
  activity?: TalkActivityRepository;
  now?: () => string;
  createId?: (kind: "request" | "participant") => string;
  reactionMinimumIntervalMs?: number;
  maxSeats?: number;
  maxAiSeats?: number;
}>): TalkParticipationService {
  const now = input.now ?? (() => new Date().toISOString());
  const createId =
    input.createId ??
    ((kind: "request" | "participant") =>
      kind === "request"
        ? `talk-request_${randomUUID()}`
        : `talk-participant_${randomUUID()}`);
  const reactionMinimumIntervalMs = input.reactionMinimumIntervalMs ?? 750;
  const maxSeats = input.maxSeats ?? 6;
  const maxAiSeats = input.maxAiSeats ?? 3;

  if (
    !Number.isSafeInteger(reactionMinimumIntervalMs) ||
    reactionMinimumIntervalMs < 100 ||
    reactionMinimumIntervalMs > 10_000
  ) {
    throw new TypeError("Talk reaction minimum interval must be between 100ms and 10s");
  }
  if (!Number.isSafeInteger(maxSeats) || maxSeats < 2 || maxSeats > 20) {
    throw new TypeError("Talk Seat capacity must be between 2 and 20");
  }
  if (!Number.isSafeInteger(maxAiSeats) || maxAiSeats < 0 || maxAiSeats >= maxSeats) {
    throw new TypeError("Talk AI Seat capacity is invalid");
  }

  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }


  return Object.freeze({
    async viewer(request) {
      const viewerIdentity = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      const view = await input.repository.readViewer({
        tenantId: viewerIdentity.tenantId,
        talkId,
        userId: viewerIdentity.userId,
      });
      if (!view) throw new TalkParticipationError("talks.not_found", 404);
      return view;
    },

    async react(request) {
      const viewerIdentity = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      if (!allowedReactions.has(request.reaction as TalkReaction)) {
        throw new TalkParticipationError("talks.reaction_invalid", 400);
      }
      try {
        const view = await input.repository.setReaction({
          tenantId: viewerIdentity.tenantId,
          talkId,
          userId: viewerIdentity.userId,
          reaction: request.reaction as TalkReaction,
          changedAt: now(),
          minimumIntervalMs: reactionMinimumIntervalMs,
        });
        if (!view) throw new TalkParticipationError("talks.not_found", 404);
        return view;
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },

    async setHandRaised(request) {
      const viewerIdentity = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      try {
        const view = await input.repository.setHandRaised({
          tenantId: viewerIdentity.tenantId,
          talkId,
          userId: viewerIdentity.userId,
          userName: normalizeName(viewerIdentity.profile.name),
          raised: request.raised,
          requestId: createId("request"),
          participantId: createId("participant"),
          changedAt: now(),
        });
        if (!view) throw new TalkParticipationError("talks.not_found", 404);
        return view;
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },

    async hostControls(request) {
      const host = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      try {
        const controls = await input.repository.readHostControls({
          tenantId: host.tenantId,
          talkId,
          hostUserId: host.userId,
        });
        if (!controls) throw new TalkParticipationError("talks.not_found", 404);
        return controls;
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },

    async actOnRequest(request) {
      const host = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      const requestId = normalizeId(request.requestId, "request_id");
      const changedAt = now();
      try {
        const decision = await input.repository.actOnRequest({
          tenantId: host.tenantId,
          talkId,
          hostUserId: host.userId,
          requestId,
          action: request.action,
          changedAt,
          maxSeats,
          maxAiSeats,
        });
        if (!decision) throw new TalkParticipationError("talks.not_found", 404);

        // Activity is a projection, not moderation authority. Keep it
        // best-effort until activity + moderation share one transaction.
        const activity = input.activity;
        const userId = decision.request.requesterUserId;
        if (activity && userId) {
          try {
            await activity.append({
              tenantId: host.tenantId,
              activityId: `talk-activity_${decision.request.requestId}_${request.action}`,
              userId,
              kind: activityKind(decision, request.action),
              title:
                decision.request.kind === "human_speaker"
                  ? request.action === "accept"
                    ? "Your hand was accepted"
                    : "Your hand was declined"
                  : request.action === "accept"
                    ? "AI Seat accepted"
                    : "AI Seat declined",
              detail:
                decision.request.kind === "human_speaker"
                  ? request.action === "accept"
                    ? "The Host admitted you as a Speaker."
                    : "The Host declined your request to speak."
                  : request.action === "accept"
                    ? "The Host accepted the sponsored AI Seat."
                    : "The Host declined the sponsored AI Seat.",
              createdAt: changedAt,
              talkId,
              ...(decision.request.personaId
                ? { personaId: decision.request.personaId }
                : {}),
              ...(decision.request.amountLabel
                ? { amountLabel: decision.request.amountLabel }
                : {}),
              requiresAction: false,
              unread: true,
            });
          } catch {
            // Canonical request/participant state is already durable.
          }
        }
        return decision.controls;
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },

    async actOnParticipant(request) {
      const host = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      const participantId = normalizeId(request.participantId, "participant_id");
      try {
        const controls = await input.repository.actOnParticipant({
          tenantId: host.tenantId,
          talkId,
          hostUserId: host.userId,
          participantId,
          action: request.action,
          changedAt: now(),
        });
        if (!controls) throw new TalkParticipationError("talks.not_found", 404);
        return controls;
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },

    async endTalk(request) {
      const host = await identity(request.authorizationHeader);
      const talkId = normalizeId(request.talkId, "talk_id");
      try {
        const ended = await input.repository.endTalk({
          tenantId: host.tenantId,
          talkId,
          hostUserId: host.userId,
          endedAt: now(),
        });
        if (!ended) throw new TalkParticipationError("talks.not_found", 404);
        return Object.freeze({ ended: true as const });
      } catch (error) {
        if (error instanceof TalkParticipationError) throw error;
        return repositoryError(error);
      }
    },
  });
}
