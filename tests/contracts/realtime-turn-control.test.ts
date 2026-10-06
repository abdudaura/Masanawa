import { describe, expect, it } from "vitest";
import {
  assertCurrentRealtimeCallback,
  beginPlayback,
  completeRealtimeTurn,
  createRealtimeTurn,
  markSemanticTurnFinal,
  protectCurrentOutput,
  requestBargeIn,
} from "../../services/presence/src/turn-control.js";

const presenceSessionId =
  "presence-session_0199f0a0-0000-7000-8000-000000001101";

describe("realtime turn control", () => {
  it("requires semantic finalization before generation/playout", () => {
    const listening = createRealtimeTurn({
      presenceSessionId,
      turnId: "turn-000001",
      generation: 1,
    });
    expect(listening.phase).toBe("listening");

    const generating = markSemanticTurnFinal(listening);
    expect(generating).toMatchObject({
      phase: "generating",
      userTurnFinal: true,
    });

    const playing = beginPlayback({
      current: generating,
      interruptible: true,
    });
    expect(playing).toMatchObject({
      phase: "playing",
      playbackEpoch: 1,
    });
  });

  it("accepts barge-in only for interruptible generated/output state and rolls generation", () => {
    const current = beginPlayback({
      current: markSemanticTurnFinal(
        createRealtimeTurn({
          presenceSessionId,
          turnId: "turn-000010",
          generation: 10,
        }),
      ),
      interruptible: true,
    });

    const decision = requestBargeIn({
      current,
      nextTurnId: "turn-000011",
    });

    expect(decision).toMatchObject({
      accepted: true,
      cancelGeneration: 10,
      reason: "accepted",
      next: {
        generation: 11,
        turnId: "turn-000011",
        phase: "listening",
        playbackEpoch: 0,
      },
    });
  });

  it("protects control/result output from ordinary barge-in", () => {
    const current = protectCurrentOutput(
      beginPlayback({
        current: markSemanticTurnFinal(
          createRealtimeTurn({
            presenceSessionId,
            turnId: "turn-protected",
            generation: 3,
          }),
        ),
        interruptible: true,
      }),
    );

    const decision = requestBargeIn({
      current,
      nextTurnId: "turn-next",
    });

    expect(decision).toMatchObject({
      accepted: false,
      cancelGeneration: null,
      reason: "output-protected",
    });
    expect(decision.next).toBe(current);
  });

  it("does not treat listening as something to interrupt", () => {
    const current = createRealtimeTurn({
      presenceSessionId,
      turnId: "turn-listening",
      generation: 1,
    });
    expect(
      requestBargeIn({
        current,
        nextTurnId: "turn-next",
      }),
    ).toMatchObject({
      accepted: false,
      reason: "nothing-to-interrupt",
    });
  });

  it("rejects stale provider and playback callbacks after generation or epoch replacement", () => {
    const playing = beginPlayback({
      current: markSemanticTurnFinal(
        createRealtimeTurn({
          presenceSessionId,
          turnId: "turn-current",
          generation: 8,
        }),
      ),
      interruptible: true,
    });

    expect(() =>
      assertCurrentRealtimeCallback({
        current: playing,
        generation: 7,
      }),
    ).toThrow("stale realtime generation");

    expect(() =>
      assertCurrentRealtimeCallback({
        current: playing,
        generation: 8,
        playbackEpoch: 0,
      }),
    ).toThrow("stale playback epoch");

    expect(() =>
      assertCurrentRealtimeCallback({
        current: playing,
        generation: 8,
        playbackEpoch: 1,
      }),
    ).not.toThrow();
  });

  it("does not permit callbacks from an interrupted prior generation into the next turn", () => {
    const playing = beginPlayback({
      current: markSemanticTurnFinal(
        createRealtimeTurn({
          presenceSessionId,
          turnId: "turn-old",
          generation: 20,
        }),
      ),
      interruptible: true,
    });

    const next = requestBargeIn({
      current: playing,
      nextTurnId: "turn-new",
    }).next;

    expect(() =>
      assertCurrentRealtimeCallback({
        current: next,
        generation: 20,
      }),
    ).toThrow("stale realtime generation");
  });

  it("makes completed turns terminal for barge-in", () => {
    const completed = completeRealtimeTurn(
      beginPlayback({
        current: markSemanticTurnFinal(
          createRealtimeTurn({
            presenceSessionId,
            turnId: "turn-complete",
            generation: 1,
          }),
        ),
        interruptible: true,
      }),
    );

    expect(
      requestBargeIn({
        current: completed,
        nextTurnId: "turn-new",
      }),
    ).toMatchObject({
      accepted: false,
      reason: "terminal-turn",
    });
  });
});
