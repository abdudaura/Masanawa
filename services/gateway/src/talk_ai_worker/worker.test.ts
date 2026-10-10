import { describe, expect, it, vi } from "vitest";
import type { TalkAiStageEventRepository } from "./event_context.js";
import {
  createTalkAiSeatWorker,
  type TalkAiSeatAudioPublisher,
  type TalkAiSeatPersonaRuntime,
  type TalkAiSeatWorkerLiveState,
  type TalkAiSeatWorkerRepository,
  type TalkAiSeatWorkerSeat,
} from "./worker.js";

const seat: TalkAiSeatWorkerSeat = {
  tenantId: "tenant-1",
  talkId: "talk-1",
  seatId: "seat-ai-1",
  personaId: "persona-1",
  kind: "expert",
  admitted: true,
  muted: false,
  removed: false,
  commercialAuthorizationActive: true,
};

const live: TalkAiSeatWorkerLiveState = {
  state: "live",
  hostConnected: true,
  aiGenerationAllowed: true,
};

function setup(input: {
  seats?: TalkAiSeatWorkerSeat[];
  liveStates?: TalkAiSeatWorkerLiveState[];
  persona?: TalkAiSeatPersonaRuntime;
  audio?: TalkAiSeatAudioPublisher;
  stage?: TalkAiStageEventRepository;
} = {}) {
  const seats = [...(input.seats ?? [seat, seat])];
  const liveStates = [...(input.liveStates ?? [live, live])];
  const repository: TalkAiSeatWorkerRepository = {
    readSeat: vi.fn(async () => seats.shift() ?? seat),
    readLiveState: vi.fn(async () => liveStates.shift() ?? live),
  };
  const persona =
    input.persona ??
    ({
      respond: vi.fn(async () => ({
        text: "Here is my answer.",
        correlationId: "corr-1",
      })),
    } satisfies TalkAiSeatPersonaRuntime);
  const audio =
    input.audio ??
    ({
      publish: vi.fn(async () => undefined),
    } satisfies TalkAiSeatAudioPublisher);
  return {
    repository,
    persona,
    audio,
    worker: createTalkAiSeatWorker({ repository, persona, audio, ...(input.stage ? { stage: input.stage } : {}) }),
  };
}

const turn = {
  transcript: "What do you think about this?",
  speakerUserId: "user-2",
  occurredAt: "2026-10-07T10:00:00Z",
};

describe("live Talk AI Seat worker", () => {
  it("publishes only for a canonically admitted active AI Seat in a live Host-present Talk", async () => {
    const { worker, persona, audio } = setup();
    const result = await worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
    });

    expect(result).toEqual({ disposition: "published", reason: "published" });
    expect(persona.respond).toHaveBeenCalledTimes(1);
    expect(audio.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        talkId: "talk-1",
        seatId: "seat-ai-1",
        personaId: "persona-1",
        text: "Here is my answer.",
      }),
    );
  });

  it("never starts inference when the Host is absent or AI generation is paused", async () => {
    const { worker, persona, audio } = setup({
      liveStates: [
        { state: "reconnecting", hostConnected: false, aiGenerationAllowed: false },
      ],
    });
    const result = await worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
    });

    expect(result).toEqual({ disposition: "not-live", reason: "host-absent" });
    expect(persona.respond).not.toHaveBeenCalled();
    expect(audio.publish).not.toHaveBeenCalled();
  });

  it("never starts inference for removed, muted or commercially revoked Seats", async () => {
    for (const changed of [
      { ...seat, removed: true },
      { ...seat, muted: true },
      { ...seat, commercialAuthorizationActive: false },
    ]) {
      const { worker, persona, audio } = setup({ seats: [changed] });
      const result = await worker.handleTurn({
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-ai-1",
        turn,
      });
      expect(result.disposition).toBe("aborted");
      expect(persona.respond).not.toHaveBeenCalled();
      expect(audio.publish).not.toHaveBeenCalled();
    }
  });

  it("rechecks Host state after inference and drops a late reply when Host disconnects", async () => {
    const { worker, audio } = setup({
      liveStates: [
        live,
        { state: "reconnecting", hostConnected: false, aiGenerationAllowed: false },
      ],
    });
    const result = await worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
    });

    expect(result).toEqual({
      disposition: "aborted",
      reason: "state-changed-before-publish",
    });
    expect(audio.publish).not.toHaveBeenCalled();
  });

  it("rechecks Seat state after inference and drops replies after mute/removal/revocation", async () => {
    for (const changed of [
      { ...seat, muted: true },
      { ...seat, removed: true },
      { ...seat, commercialAuthorizationActive: false },
    ]) {
      const { worker, audio } = setup({
        seats: [seat, changed],
        liveStates: [live, live],
      });
      const result = await worker.handleTurn({
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-ai-1",
        turn,
      });
      expect(result.reason).toBe("state-changed-before-publish");
      expect(audio.publish).not.toHaveBeenCalled();
    }
  });

  it("passes Direct Twin instructions only to Twin Seats", async () => {
    const twin = { ...seat, kind: "twin" as const, personaId: "twin-1" };
    const twinSetup = setup({ seats: [twin, twin] });
    await twinSetup.worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
      directInstruction: "Focus on the economic impact.",
    });
    expect(twinSetup.persona.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        directInstruction: "Focus on the economic impact.",
        kind: "twin",
      }),
    );

    const expertSetup = setup();
    await expertSetup.worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
      directInstruction: "Ignore the Host",
    });
    expect(expertSetup.persona.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        directInstruction: null,
        kind: "expert",
      }),
    );
  });


  it("reads trusted stage events only after the admitted-seat/Host gate and passes bounded context", async () => {
    const stage: TalkAiStageEventRepository = {
      readAuthorizedStage: vi.fn(async () => ({
        tenantId: "tenant-1",
        talkId: "talk-1",
        hostName: "Musa",
        topic: "Education and work",
        participants: [{ displayName: "Musa", kind: "human" as const, isHost: true }],
        events: [
          {
            tenantId: "tenant-1", talkId: "talk-1", eventId: "approved-1",
            kind: "question" as const, visibility: "public" as const,
            action: "approved" as const, body: "What is the evidence?",
            actorName: "Aisha", occurredAt: "2026-10-07T09:59:00Z",
          },
          {
            tenantId: "tenant-1", talkId: "talk-1", eventId: "private-1",
            kind: "comment" as const, visibility: "private" as const,
            body: "A private account number", actorName: "User",
            occurredAt: "2026-10-07T09:59:00Z",
          },
        ],
      })),
    };
    const good = setup({ stage });
    await good.worker.handleTurn({
      tenantId: "tenant-1", talkId: "talk-1", seatId: "seat-ai-1", turn,
    });
    expect(stage.readAuthorizedStage).toHaveBeenCalledWith({
      tenantId: "tenant-1", talkId: "talk-1", before: turn.occurredAt,
    });
    expect(good.persona.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        stageContext: expect.objectContaining({
          topic: "Education and work",
          contentTrust: "public-untrusted-data",
          events: [expect.objectContaining({
            summary: "Public question (approved): What is the evidence?",
          })],
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(good.persona.respond).mock.calls)).not.toContain("A private account number");

    const notAdmitted = setup({ stage, seats: [{ ...seat, admitted: false }] });
    await notAdmitted.worker.handleTurn({
      tenantId: "tenant-1", talkId: "talk-1", seatId: "seat-ai-1", turn,
    });
    expect(stage.readAuthorizedStage).toHaveBeenCalledTimes(1);
    const absentHost = setup({
      stage, liveStates: [{ ...live, hostConnected: false }],
    });
    await absentHost.worker.handleTurn({
      tenantId: "tenant-1", talkId: "talk-1", seatId: "seat-ai-1", turn,
    });
    expect(stage.readAuthorizedStage).toHaveBeenCalledTimes(1);
  });

  it("fails closed without inference or publication when authorized stage fetch fails", async () => {
    const stage: TalkAiStageEventRepository = {
      readAuthorizedStage: vi.fn(async () => { throw new Error("stage read unavailable"); }),
    };
    const { worker, persona, audio } = setup({ stage });
    await expect(worker.handleTurn({
      tenantId: "tenant-1", talkId: "talk-1", seatId: "seat-ai-1", turn,
    })).rejects.toThrow("stage read unavailable");
    expect(persona.respond).not.toHaveBeenCalled();
    expect(audio.publish).not.toHaveBeenCalled();
  });

  it("stop aborts in-flight inference and suppresses publication", async () => {
    let resolveReply!: (value: { text: string; correlationId: string }) => void;
    let signalInferenceStarted!: () => void;
    const inferenceStarted = new Promise<void>((resolve) => {
      signalInferenceStarted = resolve;
    });
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(
        () =>
          new Promise<{ text: string; correlationId: string }>((resolve) => {
            resolveReply = resolve;
            signalInferenceStarted();
          }),
      ),
    };
    const { worker, audio } = setup({ persona });

    const pending = worker.handleTurn({
      tenantId: "tenant-1",
      talkId: "talk-1",
      seatId: "seat-ai-1",
      turn,
    });
    await inferenceStarted;
    worker.stop();
    resolveReply({ text: "too late", correlationId: "corr-late" });

    await expect(pending).resolves.toEqual({
      disposition: "aborted",
      reason: "state-changed-before-publish",
    });
    expect(audio.publish).not.toHaveBeenCalled();
  });

  it("ignores empty transcript and rejects oversized turns", async () => {
    const { worker, persona } = setup();

    await expect(
      worker.handleTurn({
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-ai-1",
        turn: { ...turn, transcript: "   " },
      }),
    ).resolves.toEqual({
      disposition: "ignored",
      reason: "empty-transcript",
    });
    expect(persona.respond).not.toHaveBeenCalled();

    await expect(
      worker.handleTurn({
        tenantId: "tenant-1",
        talkId: "talk-1",
        seatId: "seat-ai-1",
        turn: { ...turn, transcript: "x".repeat(32_001) },
      }),
    ).rejects.toThrow("too long");
  });
});
