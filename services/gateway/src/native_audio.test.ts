import { describe, expect, it, vi } from "vitest";
import { createGeminiLiveAudioRenderer } from "./native_audio.js";

function interactionAudio(bytes: Buffer, mimeType = "audio/l16") {
  return {
    steps: [
      { type: "user_input", content: [{ type: "audio", data: Buffer.from("wrong").toString("base64") }] },
      { type: "model_output", content: [{ type: "text", text: "ignored" }, {
        type: "audio", mime_type: mimeType, data: bytes.toString("base64"),
      }] },
    ],
  };
}

describe("Google Interactions native audio", () => {
  it("requests explicit headerless PCM and forwards only valid model-output audio", async () => {
    const pcm = Buffer.from([0, 0, 127, 0, 0, 0, 0, 0]);
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gemini-3.8-flash-tts");
      expect(body.response_format).toEqual({ type: "audio", mime_type: "audio/l16", sample_rate: 24000 });
      expect(body.generation_config.speech_config).toEqual([{ voice: "voice_test_42" }]);
      return new Response(JSON.stringify(interactionAudio(pcm)), { status: 200 });
    });
    const received: Buffer[] = [];
    const renderer = createGeminiLiveAudioRenderer({
      apiKey: "test-key",
      model: "gemini-3.8-flash-tts",
      voiceName: "Bodi",
      fetchImpl: fetchImpl as typeof fetch,
      resolveVoice: async () => "voice_test_42",
    });
    const result = await renderer.render(
      "Voice reply with transcript",
      undefined,
      (chunk) => { received.push(chunk); },
      { displayName: "Dr. Example", roleLabel: "Tutor" },
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(pcm);
    expect(result.mimeType).toBe("audio/wav");
    const wav = Buffer.from(result.dataBase64, "base64");
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not accept the obsolete candidates schema as a completed voice reply", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/l16", data: "AAAAAA==" } }] } }],
    }), { status: 200 }));
    const renderer = createGeminiLiveAudioRenderer({
      apiKey: "test-key", model: "gemini-3.8-flash-tts", voiceName: "Bodi",
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(renderer.render("Hello")).rejects.toThrow("no model audio");
  });

  it("rejects WAV and invalid PCM before invoking the playback callback", async () => {
    const onPcmChunk = vi.fn();
    for (const [bytes, mime] of [
      [Buffer.from("RIFF____WAVE", "ascii"), "audio/wav"],
      [Buffer.from([0, 1, 2]), "audio/l16"],
    ] as const) {
      const renderer = createGeminiLiveAudioRenderer({
        apiKey: "test-key", model: "gemini-3.8-flash-tts", voiceName: "Bodi",
        fetchImpl: vi.fn(async () => new Response(JSON.stringify(interactionAudio(bytes, mime)))) as typeof fetch,
      });
      await expect(renderer.render("Hello", undefined, onPcmChunk)).rejects.toThrow();
    }
    expect(onPcmChunk).not.toHaveBeenCalled();
  });

  it("propagates provider failures rather than manufacturing silent text success", async () => {
    const renderer = createGeminiLiveAudioRenderer({
      apiKey: "test-key", model: "gemini-3.8-flash-tts", voiceName: "Bodi",
      fetchImpl: vi.fn(async () => new Response("unavailable", { status: 503 })) as typeof fetch,
    });
    await expect(renderer.render("Hello")).rejects.toThrow("503");
  });
});
