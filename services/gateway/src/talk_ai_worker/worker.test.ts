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
    let inferenceStarted!: () => void;
    const started = new Promise<void>((resolve) => { inferenceStarted = resolve; });
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(
        () =>
          new Promise<{ text: string; correlationId: string }>((resolve) => {
            resolveReply = resolve;
            inferenceStarted();
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
    await started;
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


describe("AI Seat turn fencing and persona continuity", () => {
  const request = {
    tenantId: "tenant-1",
    talkId: "talk-1",
    seatId: "seat-ai-1",
    turn,
  };

  it("preempts an older model reply when a newer human turn reaches the same Seat", async () => {
    let releaseFirst!: (reply: { text: string; correlationId: string }) => void;
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => { firstStarted = resolve; });
    const firstReply = new Promise<{ text: string; correlationId: string }>((resolve) => {
      releaseFirst = resolve;
    });
    const signals: AbortSignal[] = [];
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(async ({ signal }) => {
        signals.push(signal);
        if (signals.length === 1) {
          firstStarted();
          return firstReply;
        }
        return { text: "new response", correlationId: "new-correlation" };
      }),
    };
    const { worker, audio } = setup({ persona });
    const old = worker.handleTurn(request);
    await started;
    const newer = worker.handleTurn({
      ...request,
      turn: { ...turn, transcript: "Actually, answer this instead." },
    });
    releaseFirst({ text: "obsolete response", correlationId: "old-correlation" });

    expect(await old).toEqual({
      disposition: "aborted",
      reason: "state-changed-before-publish",
    });
    expect(await newer).toEqual({ disposition: "published", reason: "published" });
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(audio.publish).toHaveBeenCalledTimes(1);
    expect(audio.publish).toHaveBeenCalledWith(
      expect.objectContaining({ text: "new response", correlationId: "new-correlation" }),
    );
  });

  it("suppresses a superseded turn still waiting on initial repository reads", async () => {
    let releaseRead!: (value: TalkAiSeatWorkerSeat) => void;
    let firstReadStarted!: () => void;
    const started = new Promise<void>((resolve) => { firstReadStarted = resolve; });
    const pendingRead = new Promise<TalkAiSeatWorkerSeat>((resolve) => {
      releaseRead = resolve;
    });
    let reads = 0;
    const repository: TalkAiSeatWorkerRepository = {
      readSeat: vi.fn(async () => {
        if (++reads === 1) {
          firstReadStarted();
          return pendingRead;
        }
        return seat;
      }),
      readLiveState: vi.fn(async () => live),
    };
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(async () => ({ text: "current", correlationId: "corr-current" })),
    };
    const audio: TalkAiSeatAudioPublisher = { publish: vi.fn(async () => undefined) };
    const worker = createTalkAiSeatWorker({ repository, persona, audio });
    const old = worker.handleTurn(request);
    await started;
    const newer = worker.handleTurn({
      ...request, turn: { ...turn, transcript: "new human question" },
    });
    releaseRead(seat);

    expect(await old).toEqual({
      disposition: "aborted",
      reason: "state-changed-before-publish",
    });
    expect(await newer).toEqual({ disposition: "published", reason: "published" });
    expect(persona.respond).toHaveBeenCalledTimes(1);
    expect(audio.publish).toHaveBeenCalledTimes(1);
  });

  it("preempts an older turn during stage-context loading before model inference", async () => {
    let releaseStage!: (value: null) => void;
    let firstStageStarted!: () => void;
    const started = new Promise<void>((resolve) => { firstStageStarted = resolve; });
    const pendingStage = new Promise<null>((resolve) => { releaseStage = resolve; });
    let reads = 0;
    const stage: TalkAiStageEventRepository = {
      readAuthorizedStage: vi.fn(async () => {
        if (++reads === 1) {
          firstStageStarted();
          return pendingStage;
        }
        return null;
      }),
    };
    const { worker, persona, audio } = setup({ stage });
    const old = worker.handleTurn(request);
    await started;
    const newer = worker.handleTurn({
      ...request, turn: { ...turn, transcript: "fresh question" },
    });
    releaseStage(null);
    expect((await old).reason).toBe("state-changed-before-publish");
    expect((await newer).disposition).toBe("published");
    expect(persona.respond).toHaveBeenCalledTimes(1);
    expect(audio.publish).toHaveBeenCalledTimes(1);
  });

  it("rejects a different tenant, Talk or Seat returned by storage before inference", async () => {
    for (const bad of [
      { ...seat, tenantId: "another-tenant" },
      { ...seat, talkId: "another-talk" },
      { ...seat, seatId: "another-seat" },
    ]) {
      const { worker, persona, audio } = setup({ seats: [bad] });
      expect(await worker.handleTurn(request)).toEqual({
        disposition: "not-admitted", reason: "seat-missing",
      });
      expect(persona.respond).not.toHaveBeenCalled();
      expect(audio.publish).not.toHaveBeenCalled();
    }
  });

  it("drops a reply when the admitted persona or Seat kind changes during inference", async () => {
    for (const replacement of [
      { ...seat, personaId: "replacement-persona" },
      { ...seat, kind: "twin" as const },
    ]) {
      const { worker, audio } = setup({ seats: [seat, replacement] });
      expect(await worker.handleTurn(request)).toEqual({
        disposition: "aborted", reason: "state-changed-before-publish",
      });
      expect(audio.publish).not.toHaveBeenCalled();
    }
  });

  it("allows parallel replies on independently authorized Seats", async () => {
    let releaseFirst!: (reply: { text: string; correlationId: string }) => void;
    let startedFirst!: () => void;
    const firstStarted = new Promise<void>((resolve) => { startedFirst = resolve; });
    const pendingFirst = new Promise<{ text: string; correlationId: string }>((resolve) => {
      releaseFirst = resolve;
    });
    const repository: TalkAiSeatWorkerRepository = {
      readSeat: vi.fn(async ({ seatId }) => ({
        ...seat,
        seatId,
        personaId: seatId === "seat-ai-1" ? "persona-1" : "persona-2",
      })),
      readLiveState: vi.fn(async () => live),
    };
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(async ({ seatId }) => {
        if (seatId === "seat-ai-1") {
          startedFirst();
          return pendingFirst;
        }
        return { text: "second seat", correlationId: "second" };
      }),
    };
    const audio: TalkAiSeatAudioPublisher = { publish: vi.fn(async () => undefined) };
    const worker = createTalkAiSeatWorker({ repository, persona, audio });
    const first = worker.handleTurn(request);
    await firstStarted;
    const second = worker.handleTurn({ ...request, seatId: "seat-ai-2" });
    expect(await second).toEqual({ disposition: "published", reason: "published" });
    releaseFirst({ text: "first seat", correlationId: "first" });
    expect(await first).toEqual({ disposition: "published", reason: "published" });
    expect(audio.publish).toHaveBeenCalledTimes(2);
  });
});

