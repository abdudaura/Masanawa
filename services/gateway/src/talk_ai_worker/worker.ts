import {
  projectTalkAiStageContext,
  type TalkAiStageContext,
  type TalkAiStageEventRepository,
} from "./event_context.js";

export type TalkAiSeatKind = "expert" | "twin";

export interface TalkAiSeatWorkerSeat {
  readonly tenantId: string;
  readonly talkId: string;
  readonly seatId: string;
  readonly personaId: string;
  readonly kind: TalkAiSeatKind;
  readonly admitted: boolean;
  readonly muted: boolean;
  readonly removed: boolean;
  readonly commercialAuthorizationActive: boolean;
}

export interface TalkAiSeatWorkerLiveState {
  readonly state: "live" | "reconnecting" | "ended";
  readonly hostConnected: boolean;
  readonly aiGenerationAllowed: boolean;
}

export interface TalkAiSeatTurnInput {
  readonly transcript: string;
  readonly speakerUserId: string | null;
  readonly occurredAt: string;
}

export interface TalkAiSeatPersonaReply {
  readonly text: string;
  readonly correlationId: string;
}

export interface TalkAiSeatWorkerRepository {
  readSeat(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
  }>): Promise<TalkAiSeatWorkerSeat | null>;
  readLiveState(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<TalkAiSeatWorkerLiveState | null>;
}

export interface TalkAiSeatPersonaRuntime {
  respond(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
    personaId: string;
    kind: TalkAiSeatKind;
    transcript: string;
    directInstruction: string | null;
    stageContext: TalkAiStageContext | null;
    signal: AbortSignal;
  }>): Promise<TalkAiSeatPersonaReply>;
}

export interface TalkAiSeatAudioPublisher {
  publish(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
    personaId: string;
    text: string;
    correlationId: string;
    signal: AbortSignal;
  }>): Promise<void>;
}

export interface TalkAiSeatWorkerResult {
  readonly disposition:
    | "published"
    | "ignored"
    | "aborted"
    | "not-admitted"
    | "not-live";
  readonly reason:
    | "published"
    | "empty-transcript"
    | "seat-missing"
    | "seat-not-admitted"
    | "seat-muted"
    | "seat-removed"
    | "commerce-revoked"
    | "host-absent"
    | "ai-paused"
    | "talk-ended"
    | "state-changed-before-publish";
}

export interface TalkAiSeatWorker {
  handleTurn(input: Readonly<{
    tenantId: string;
    talkId: string;
    seatId: string;
    turn: TalkAiSeatTurnInput;
    directInstruction?: string | null;
  }>): Promise<TalkAiSeatWorkerResult>;
  stop(): void;
}

function text(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} is invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new TypeError(`${name} is invalid`);
  return normalized;
}

function validTime(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError("turn.occurredAt is invalid");
  return new Date(parsed).toISOString();
}

function deniedBySeat(
  seat: TalkAiSeatWorkerSeat | null,
  request: Pick<TalkAiSeatWorkerSeat, "tenantId" | "talkId" | "seatId">,
): TalkAiSeatWorkerResult | null {
  // Never trust a repository adapter to return a Seat belonging to the
  // requested tenant, Talk or Seat ID. Context and audio are tenant-sensitive.
  if (
    !seat ||
    seat.tenantId !== request.tenantId ||
    seat.talkId !== request.talkId ||
    seat.seatId !== request.seatId
  ) {
    return Object.freeze({ disposition: "not-admitted", reason: "seat-missing" });
  }
  if (!seat.admitted) {
    return Object.freeze({ disposition: "not-admitted", reason: "seat-not-admitted" });
  }
  if (seat.removed) {
    return Object.freeze({ disposition: "aborted", reason: "seat-removed" });
  }
  if (seat.muted) {
    return Object.freeze({ disposition: "aborted", reason: "seat-muted" });
  }
  if (!seat.commercialAuthorizationActive) {
    return Object.freeze({ disposition: "aborted", reason: "commerce-revoked" });
  }
  return null;
}

function deniedByLive(
  live: TalkAiSeatWorkerLiveState | null,
): TalkAiSeatWorkerResult | null {
  if (!live || live.state === "ended") {
    return Object.freeze({ disposition: "not-live", reason: "talk-ended" });
  }
  if (!live.hostConnected || live.state === "reconnecting") {
    return Object.freeze({ disposition: "not-live", reason: "host-absent" });
  }
  if (!live.aiGenerationAllowed) {
    return Object.freeze({ disposition: "not-live", reason: "ai-paused" });
  }
  return null;
}

export function createTalkAiSeatWorker(input: Readonly<{
  repository: TalkAiSeatWorkerRepository;
  persona: TalkAiSeatPersonaRuntime;
  audio: TalkAiSeatAudioPublisher;
  stage?: TalkAiStageEventRepository;
}>): TalkAiSeatWorker {
  let stopped = false;
  // A newer human turn for the same canonical Seat preempts in-flight
  // inference/publication. JSON tuple keys cannot collide across tenants/Talks.
  const activeTurns = new Map<string, AbortController>();

  return Object.freeze<TalkAiSeatWorker>({
    async handleTurn(request) {
      if (stopped) {
        return Object.freeze({
          disposition: "aborted" as const,
          reason: "state-changed-before-publish" as const,
        });
      }

      text(request.tenantId, "tenantId", 256);
      text(request.talkId, "talkId", 256);
      text(request.seatId, "seatId", 256);
      validTime(request.turn.occurredAt);

      const transcript = request.turn.transcript.trim();
      if (!transcript) {
        return Object.freeze({
          disposition: "ignored" as const,
          reason: "empty-transcript" as const,
        });
      }
      if (transcript.length > 32_000) {
        throw new RangeError("turn.transcript is too long");
      }

      const key = JSON.stringify([request.tenantId, request.talkId, request.seatId]);
      const controller = new AbortController();
      // Register before the first asynchronous read: otherwise an older
      // request can escape cancellation while its admission check is pending.
      const superseded = activeTurns.get(key);
      activeTurns.set(key, controller);
      // Abort listeners may be synchronous/reentrant. Install the new owner
      // first so a listener-triggered newer turn cannot be overwritten.
      superseded?.abort();
      try {
        const [seat, live] = await Promise.all([
          input.repository.readSeat({
            tenantId: request.tenantId,
            talkId: request.talkId,
            seatId: request.seatId,
          }),
          input.repository.readLiveState({
            tenantId: request.tenantId,
            talkId: request.talkId,
          }),
        ]);

        if (controller.signal.aborted || stopped) {
          return Object.freeze({
            disposition: "aborted" as const,
            reason: "state-changed-before-publish" as const,
          });
        }
        const seatDenied = deniedBySeat(seat, request);
        if (seatDenied) return seatDenied;
        const liveDenied = deniedByLive(live);
        if (liveDenied) return liveDenied;
        // Read only authoritative, audience-visible context after admission
        // and Host checks. An unavailable stage source fails closed; it cannot
        // turn client events into model instructions or bypass the live gate.
        const stageContext = input.stage
          ? projectTalkAiStageContext({
              tenantId: request.tenantId,
              talkId: request.talkId,
              before: request.turn.occurredAt,
              stage: await input.stage.readAuthorizedStage({
                tenantId: request.tenantId,
                talkId: request.talkId,
                before: request.turn.occurredAt,
              }),
            })
          : null;
        // A new human turn can arrive during the stage read. Never start a
        // redundant model request for a superseded turn.
        if (controller.signal.aborted || stopped) {
          return Object.freeze({
            disposition: "aborted" as const,
            reason: "state-changed-before-publish" as const,
          });
        }
        const reply = await input.persona.respond({
          tenantId: request.tenantId,
          talkId: request.talkId,
          seatId: request.seatId,
          personaId: seat!.personaId,
          kind: seat!.kind,
          transcript,
          stageContext,
          directInstruction:
            seat!.kind === "twin"
              ? (request.directInstruction?.trim() || null)
              : null,
          signal: controller.signal,
        });

        if (controller.signal.aborted || stopped) {
          return Object.freeze({
            disposition: "aborted" as const,
            reason: "state-changed-before-publish" as const,
          });
        }

        // Re-read authoritative state after inference. A Host disconnect, mute,
        // removal or commerce revocation during inference must suppress the reply.
        const [freshSeat, freshLive] = await Promise.all([
          input.repository.readSeat({
            tenantId: request.tenantId,
            talkId: request.talkId,
            seatId: request.seatId,
          }),
          input.repository.readLiveState({
            tenantId: request.tenantId,
            talkId: request.talkId,
          }),
        ]);

        // A Seat may be reassigned to another Expert/Twin while inference
        // runs. A reply generated by its previous persona must never be
        // published under the newly admitted persona's authority.
        if (
          deniedBySeat(freshSeat, request) ||
          deniedByLive(freshLive) ||
          freshSeat!.personaId !== seat!.personaId ||
          freshSeat!.kind !== seat!.kind
        ) {
          controller.abort();
          return Object.freeze({
            disposition: "aborted" as const,
            reason: "state-changed-before-publish" as const,
          });
        }

        const responseText = text(reply.text, "persona reply", 32_000);
        const correlationId = text(reply.correlationId, "correlationId", 256);

        await input.audio.publish({
          tenantId: request.tenantId,
          talkId: request.talkId,
          seatId: request.seatId,
          personaId: freshSeat!.personaId,
          text: responseText,
          correlationId,
          signal: controller.signal,
        });

        return Object.freeze({
          disposition: "published" as const,
          reason: "published" as const,
        });
      } catch (error) {
        if (controller.signal.aborted || stopped) {
          return Object.freeze({
            disposition: "aborted" as const,
            reason: "state-changed-before-publish" as const,
          });
        }
        throw error;
      } finally {
        if (activeTurns.get(key) === controller) activeTurns.delete(key);
      }
    },

    stop() {
      stopped = true;
      for (const controller of activeTurns.values()) controller.abort();
      activeTurns.clear();
    },
  });
}

