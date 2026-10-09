import {
  projectTalkAiStageContext,
  type TalkAiStageEventRepository,
} from "../talk_ai_worker/event_context.js";
import type {
  TalkAiSeatWorker,
  TalkAiSeatWorkerRepository,
  TalkAiSeatWorkerResult,
} from "../talk_ai_worker/worker.js";

/**
 * U15 is a Host-facing copilot, not a second LiveKit/commerce authority.
 * Only the R02 worker may infer and publish approved, admitted-seat speech.
 */
export interface LiveStageHostIdentity {
  readonly tenantId: string;
  readonly userId: string;
}
export interface LiveStageHostAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<LiveStageHostIdentity>;
  isCurrentHost(input: Readonly<{ tenantId: string; talkId: string; userId: string }>): Promise<boolean>;
}
export type CopilotTurnOutcome = "published" | "denied" | "unknown";
export interface CopilotTurnStore {
  acquire(input: Readonly<{
    tenantId: string; talkId: string; seatId: string; userId: string;
    requestId: string; transcript: string; now: string; maxPerHour: number;
  }>): Promise<
    | Readonly<{ kind: "acquired" }>
    | Readonly<{ kind: "replay"; outcome: CopilotTurnOutcome }>
    | Readonly<{ kind: "in_progress" | "budget_exhausted" | "conflict" }>
  >;
  finish(input: Readonly<{
    tenantId: string; talkId: string; seatId: string; userId: string;
    requestId: string; transcript: string; outcome: CopilotTurnOutcome;
  }>): Promise<void>;
}
export interface HostSuggestion {
  readonly kind: "question" | "poll" | "topic";
  readonly prompt: string;
  /** Suggestions are only Host-facing hints, not verified factual claims. */
  readonly trust: "public-untrusted-data";
}
export type HostTurnResult =
  | Readonly<{ status: "published"; reason: "published" }>
  | Readonly<{ status: "denied"; reason: string }>
  | Readonly<{ status: "uncertain"; reason: string }>
  | Readonly<{ status: "in_progress" | "budget_exhausted" | "conflict"; reason: string }>;

export class LiveStageCopilotError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "LiveStageCopilotError";
  }
}
function bounded(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new LiveStageCopilotError("talks." + name + "_invalid", 400);
  const clean = value.trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f-\u009f]/u.test(clean)) {
    throw new LiveStageCopilotError("talks." + name + "_invalid", 400);
  }
  return clean;
}
function cleanPublic(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}
function liveEnough(live: Awaited<ReturnType<TalkAiSeatWorkerRepository["readLiveState"]>>): boolean {
  return live?.state === "live" && live.hostConnected === true && live.aiGenerationAllowed === true;
}
function eligible(seat: Awaited<ReturnType<TalkAiSeatWorkerRepository["readSeat"]>>): boolean {
  return !!seat && seat.admitted && !seat.removed && !seat.muted &&
    seat.commercialAuthorizationActive;
}
function outcomeOf(result: TalkAiSeatWorkerResult): CopilotTurnOutcome {
  return result.disposition === "published" ? "published" : "denied";
}

export function createLiveStageCopilot(input: Readonly<{
  authorizer: LiveStageHostAuthorizer;
  seats: TalkAiSeatWorkerRepository;
  stage: TalkAiStageEventRepository;
  worker: TalkAiSeatWorker;
  turns: CopilotTurnStore;
  /** A strict server-side cap: no inference from reactions or stage events. */
  maxHostApprovedTurnsPerHour: number;
  now?: () => Date;
}>) {
  const max = input.maxHostApprovedTurnsPerHour;
  if (!Number.isSafeInteger(max) || max < 1 || max > 60) {
    throw new TypeError("Invalid server-side copilot turn cap");
  }
  const now = input.now ?? (() => new Date());

  async function host(header: string | undefined, talkId: string): Promise<LiveStageHostIdentity> {
    const identity = await input.authorizer.authorize({ authorizationHeader: header });
    if (!identity.tenantId || !identity.userId ||
        !await input.authorizer.isCurrentHost({
          tenantId: identity.tenantId, userId: identity.userId, talkId,
        })) {
      throw new LiveStageCopilotError("talks.host_forbidden", 403);
    }
    const live = await input.seats.readLiveState({ tenantId: identity.tenantId, talkId });
    if (!liveEnough(live)) throw new LiveStageCopilotError("talks.stage_not_live", 409);
    return identity;
  }

  return Object.freeze({
    /** No model output, raw user messages or fabricated questions enter this list. */
    async suggestions(request: Readonly<{
      authorizationHeader: string | undefined; talkId: string;
    }>): Promise<readonly HostSuggestion[]> {
      const talkId = bounded(request.talkId, "talk_id", 160);
      const identity = await host(request.authorizationHeader, talkId);
      const before = now().toISOString();
      const authorized = await input.stage.readAuthorizedStage({
        tenantId: identity.tenantId, talkId, before,
      });
      const context = projectTalkAiStageContext({
        tenantId: identity.tenantId, talkId, before, stage: authorized,
      });
      if (!context || !context.participants.some(p => p.kind === "human" && p.isHost)) {
        throw new LiveStageCopilotError("talks.stage_unavailable", 409);
      }
      const items: HostSuggestion[] = [];
      // Only the canonical R09 audience-visible projection is used.
      // No arbitrary chat, private DM, purchase amount, balances or comments.
      for (const event of [...context.events].reverse()) {
        if (items.length >= 3) break;
        if (event.kind === "question" && event.summary.startsWith("Public question (")) {
          const q = cleanPublic(event.summary.slice(event.summary.indexOf("): ") + 3), 180);
          if (q) items.push(Object.freeze({
            kind: "question" as const, prompt: q, trust: "public-untrusted-data" as const,
          }));
        } else if (event.kind === "poll" && event.summary.startsWith("Public poll ")) {
          const q = cleanPublic((event.summary.split(" | Votes: ")[0] ?? "").replace(/^Public poll (opened|closed): /u, ""), 130);
          if (q) items.push(Object.freeze({
            kind: "poll" as const, prompt: "Invite discussion about: " + q,
            trust: "public-untrusted-data" as const,
          }));
        }
      }
      if (items.length === 0 && context.topic) {
        items.push(Object.freeze({
          kind: "topic" as const,
          prompt: "Invite a human guest to share their perspective on: " +
            cleanPublic(context.topic, 120),
          trust: "public-untrusted-data" as const,
        }));
      }
      return Object.freeze(items);
    },

    /** Explicit Host-initiated approval only, never automatic AI-to-AI replies. */
    async approveTurn(request: Readonly<{
      authorizationHeader: string | undefined;
      talkId: string; seatId: string; requestId: string;
      hostApprovedTranscript: string;
    }>): Promise<HostTurnResult> {
      const talkId = bounded(request.talkId, "talk_id", 160);
      const seatId = bounded(request.seatId, "seat_id", 160);
      const requestId = bounded(request.requestId, "request_id", 128);
      const transcript = bounded(request.hostApprovedTranscript, "transcript", 500);
      const identity = await host(request.authorizationHeader, talkId);
      const seat = await input.seats.readSeat({ tenantId: identity.tenantId, talkId, seatId });
      if (!eligible(seat)) return Object.freeze({
        status: "denied" as const, reason: "seat_not_authorized",
      });
      const stamped = now().toISOString();
      const claim = await input.turns.acquire({
        tenantId: identity.tenantId, talkId, seatId, userId: identity.userId,
        requestId, transcript, now: stamped, maxPerHour: max,
      });
      if (claim.kind === "replay") {
        if (claim.outcome === "published") return Object.freeze({
          status: "published" as const, reason: "published" as const,
        });
        return Object.freeze({
          status: claim.outcome === "unknown" ? "uncertain" as const : "denied" as const,
          reason: "previous_" + claim.outcome,
        });
      }
      if (claim.kind !== "acquired") return Object.freeze({
        status: claim.kind, reason: "claim_" + claim.kind,
      });
      let outcome: CopilotTurnOutcome = "unknown";
      try {
        // Only the canonical worker calls the persona and publishes audio.
        // It re-reads admission, Host presence and commerce after inference.
        const result = await input.worker.handleTurn({
          tenantId: identity.tenantId, talkId, seatId,
          turn: {
            transcript, speakerUserId: identity.userId, occurredAt: stamped,
          },
        });
        outcome = outcomeOf(result);
        // A publication acknowledgement is *not* proof the listener heard audio.
        return Object.freeze(result.disposition === "published"
          ? { status: "published" as const, reason: "published" as const }
          : { status: "denied" as const, reason: result.reason });
      } catch {
        // Unknown publish outcome must never be retried under a fresh key.
        return Object.freeze({ status: "uncertain" as const, reason: "worker_outcome_unknown" });
      } finally {
        // Persistent update failure propagates; the original claim remains
        // reserved/running and a retried request cannot execute a second turn.
        await input.turns.finish({
          tenantId: identity.tenantId, talkId, seatId, userId: identity.userId,
          requestId, transcript, outcome,
        });
      }
    },
  });
}
