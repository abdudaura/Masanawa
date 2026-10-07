import { describe, expect, it, vi } from "vitest";
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
    worker: createTalkAiSeatWorker({ repository, persona, audio }),
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

  it("stop aborts in-flight inference and suppresses publication", async () => {
    let resolveReply!: (value: { text: string; correlationId: string }) => void;
    const persona: TalkAiSeatPersonaRuntime = {
      respond: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveReply = resolve;
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
    await Promise.resolve();
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
