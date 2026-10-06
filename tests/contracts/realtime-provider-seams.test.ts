import { describe, expect, it } from "vitest";
import {
  assertRealtimeIdentity,
  normalizeRealtimeAudioFrame,
  normalizeRealtimeModelDelta,
  normalizeRealtimeSpeechChunk,
  normalizeRealtimeTranscriptEvent,
  type DirectLiveProviderPort,
  type RealtimeAbortSignal,
} from "../../services/presence/src/realtime-provider.js";

const presenceSessionId =
  "presence-session_0199f0a0-0000-7000-8000-000000001001";

describe("realtime provider seams", () => {
  it("normalizes bounded audio frames and copies provider-owned bytes", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const frame = normalizeRealtimeAudioFrame({
      presenceSessionId,
      generation: 1,
      sequence: 0,
      encoding: "pcm-s16le",
      sampleRateHz: 24_000,
      channels: 1,
      data: source,
      capturedAt: "2026-10-06T10:00:00Z",
    });

    source[0] = 99;
    expect(frame.data[0]).toBe(1);
    expect(frame).toMatchObject({
      generation: 1,
      sequence: 0,
      sampleRateHz: 24_000,
      channels: 1,
    });
  });

  it("normalizes transcript/model/audio output with the same Presence generation identity", () => {
    const transcript = normalizeRealtimeTranscriptEvent({
      presenceSessionId,
      generation: 2,
      sequence: 1,
      text: "hello",
      final: false,
      language: "EN",
    });
    const model = normalizeRealtimeModelDelta({
      presenceSessionId,
      generation: 2,
      sequence: 2,
      text: "Hi",
      final: false,
    });
    const audio = normalizeRealtimeSpeechChunk({
      presenceSessionId,
      generation: 2,
      sequence: 3,
      encoding: "pcm-s16le",
      sampleRateHz: 24_000,
      channels: 1,
      data: new Uint8Array([1, 2]),
      final: false,
    });

    expect(transcript.language).toBe("en");
    expect(() =>
      assertRealtimeIdentity({
        presenceSessionId,
        generation: 2,
        event: transcript,
      }),
    ).not.toThrow();
    expect(() =>
      assertRealtimeIdentity({
        presenceSessionId,
        generation: 2,
        event: model,
      }),
    ).not.toThrow();
    expect(() =>
      assertRealtimeIdentity({
        presenceSessionId,
        generation: 2,
        event: audio,
      }),
    ).not.toThrow();
  });

  it("rejects stale provider events from an earlier playback/model generation", () => {
    const event = normalizeRealtimeModelDelta({
      presenceSessionId,
      generation: 3,
      sequence: 0,
      text: "stale",
      final: false,
    });

    expect(() =>
      assertRealtimeIdentity({
        presenceSessionId,
        generation: 4,
        event,
      }),
    ).toThrow("stale or foreign generation");
  });

  it("rejects invalid audio shapes and oversized provider chunks", () => {
    expect(() =>
      normalizeRealtimeAudioFrame({
        presenceSessionId,
        generation: 1,
        sequence: 0,
        encoding: "pcm-s16le",
        sampleRateHz: 1_000,
        channels: 1,
        data: new Uint8Array([1]),
        capturedAt: "2026-10-06T10:00:00Z",
      }),
    ).toThrow("sampleRateHz");

    expect(() =>
      normalizeRealtimeSpeechChunk({
        presenceSessionId,
        generation: 1,
        sequence: 0,
        encoding: "opus",
        sampleRateHz: 48_000,
        channels: 2,
        data: new Uint8Array(2 * 1024 * 1024 + 1),
        final: false,
      }),
    ).toThrow("2097152");
  });

  it("allows an empty final text marker but not an empty non-final delta", () => {
    expect(
      normalizeRealtimeModelDelta({
        presenceSessionId,
        generation: 1,
        sequence: 5,
        text: "",
        final: true,
      }).final,
    ).toBe(true);

    expect(() =>
      normalizeRealtimeModelDelta({
        presenceSessionId,
        generation: 1,
        sequence: 5,
        text: "",
        final: false,
      }),
    ).toThrow("text must be between");
  });

  it("defines cancellation-aware direct-live lifecycle without provider business truth", async () => {
    const signal: RealtimeAbortSignal = {
      aborted: false,
      addEventListener() {},
    };
    const provider: DirectLiveProviderPort = {
      async open(input) {
        expect(input.presenceSessionId).toBe(presenceSessionId);
        expect(input.generation).toBe(7);
        expect(input.signal).toBe(signal);
        return {
          presenceSessionId,
          generation: 7,
          async send() {},
          async *receive() {
            yield {
              kind: "completed" as const,
              presenceSessionId,
              generation: 7,
            };
          },
          async close(input) {
            expect(input.reason).toBe("completed");
          },
        };
      },
    };

    const session = await provider.open({
      presenceSessionId,
      generation: 7,
      signal,
    });
    const events = [];
    for await (const event of session.receive()) events.push(event);
    expect(events).toEqual([
      { kind: "completed", presenceSessionId, generation: 7 },
    ]);
    await session.close({ reason: "completed" });
  });
});
