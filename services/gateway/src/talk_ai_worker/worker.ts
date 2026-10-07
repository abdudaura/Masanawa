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
): TalkAiSeatWorkerResult | null {
  if (!seat) {
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
}>): TalkAiSeatWorker {
  let stopped = false;
  const controllers = new Set<AbortController>();

  return Object.freeze({
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

      const seatDenied = deniedBySeat(seat);
      if (seatDenied) return seatDenied;
      const liveDenied = deniedByLive(live);
      if (liveDenied) return liveDenied;

      const controller = new AbortController();
      controllers.add(controller);
      try {
        const reply = await input.persona.respond({
          tenantId: request.tenantId,
          talkId: request.talkId,
          seatId: request.seatId,
          personaId: seat!.personaId,
          kind: seat!.kind,
          transcript,
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

        if (deniedBySeat(freshSeat) || deniedByLive(freshLive)) {
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
        controllers.delete(controller);
      }
    },

    stop() {
      stopped = true;
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
  });
}
