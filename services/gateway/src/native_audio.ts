export interface NativeAudioResult {
  readonly mimeType: "audio/wav";
  readonly dataBase64: string;
  readonly durationMs: number;
}

export interface NativeAudioRenderer {
  render(
    text: string,
    signal?: AbortSignal,
    onPcmChunk?: (chunk: Buffer) => void | Promise<void>,
  ): Promise<NativeAudioResult>;
}

interface LiveMessage {
  readonly setupComplete?: unknown;
  readonly serverContent?: {
    readonly turnComplete?: boolean;
    readonly modelTurn?: {
      readonly parts?: readonly {
        readonly inlineData?: {
          readonly mimeType?: string;
          readonly data?: string;
        };
      }[];
    };
  };
}

function wavFromPcm16Mono(pcm: Buffer, sampleRate = 24_000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function createGeminiLiveAudioRenderer(input: {
  readonly apiKey: string;
  readonly model?: string;
  readonly voiceName?: string;
  readonly timeoutMs?: number;
}): NativeAudioRenderer {
  const apiKey = input.apiKey.trim();
  const model = input.model?.trim() || "gemini-3.8-live";
  const voiceName = input.voiceName?.trim() || "Kore";
  const timeoutMs = input.timeoutMs ?? 25_000;
  if (!apiKey) throw new TypeError("Gemini Live API key is required");

  return Object.freeze({
    async render(
      text: string,
      signal?: AbortSignal,
      onPcmChunk?: (chunk: Buffer) => void | Promise<void>,
    ) {
      const value = text.trim();
      if (!value) throw new TypeError("Native audio text is required");
      if (value.length > 16_000) throw new RangeError("Native audio text is too long");

      const WebSocketCtor = (globalThis as { WebSocket?: any }).WebSocket;
      if (!WebSocketCtor) throw new Error("WebSocket runtime unavailable");

      const url =
        "wss://generativelanguage.googleapis.com/ws/" +
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent" +
        "?key=" + encodeURIComponent(apiKey);

      if (signal?.aborted) throw new Error("Gemini Live audio cancelled");
      return await new Promise<NativeAudioResult>((resolve, reject) => {
        const socket = new WebSocketCtor(url);
        const chunks: Buffer[] = [];
        let settled = false;
        let sentTurn = false;

        const cleanup = () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        };

        const finishError = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          try { socket.close(); } catch {}
          reject(error);
        };

        const onAbort = () =>
          finishError(new Error("Gemini Live audio cancelled"));
        signal?.addEventListener("abort", onAbort, { once: true });

        const abort = () => finishError(new Error("Gemini Live audio cancelled"));
        if (signal?.aborted) {
          abort();
          return;
        }
        signal?.addEventListener("abort", abort, { once: true });

        const timer = setTimeout(
          () => finishError(new Error("Gemini Live audio timed out")),
          timeoutMs,
        );

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({
            setup: {
              model: "models/" + model,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            },
          }));
        });

        socket.addEventListener("message", async (event: { data: unknown }) => {
          try {
            let raw: string;
            if (typeof event.data === "string") {
              raw = event.data;
            } else if (
              typeof Blob !== "undefined" &&
              event.data instanceof Blob
            ) {
              raw = await event.data.text();
            } else if (event.data instanceof ArrayBuffer) {
              raw = Buffer.from(event.data).toString("utf8");
            } else if (ArrayBuffer.isView(event.data)) {
              raw = Buffer.from(
                event.data.buffer,
                event.data.byteOffset,
                event.data.byteLength,
              ).toString("utf8");
            } else {
              return;
            }
            const message = JSON.parse(raw) as LiveMessage;
            if (message.setupComplete !== undefined && !sentTurn) {
              sentTurn = true;
              socket.send(JSON.stringify({
                clientContent: {
                  turns: [{
                    role: "user",
                    parts: [{
                      text:
                        "Speak the following response naturally in the same language. " +
                        "Preserve its wording and do not add commentary:\n\n" + value,
                    }],
                  }],
                  turnComplete: true,
                },
              }));
              return;
            }

            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              const inline = part.inlineData;
              if (
                inline?.data &&
                typeof inline.mimeType === "string" &&
                inline.mimeType.startsWith("audio/pcm")
              ) {
                const chunk = Buffer.from(inline.data, "base64");
                if (chunk.length) {
                  chunks.push(chunk);
                  await onPcmChunk?.(chunk);
                }
              }
            }

            if (message.serverContent?.turnComplete) {
              if (settled) return;
              const pcm = Buffer.concat(chunks);
              if (!pcm.length || pcm.length > 12 * 1024 * 1024) {
                finishError(new Error("Gemini Live returned invalid audio"));
                return;
              }
              settled = true;
              cleanup();
              try { socket.close(); } catch {}
              const wav = wavFromPcm16Mono(pcm);
              resolve(Object.freeze({
                mimeType: "audio/wav" as const,
                dataBase64: wav.toString("base64"),
                durationMs: Math.max(1, Math.round((pcm.length / 2 / 24_000) * 1000)),
              }));
            }
          } catch {
            finishError(new Error("Gemini Live returned an invalid response"));
          }
        });

        socket.addEventListener("error", () =>
          finishError(new Error("Gemini Live audio connection failed")),
        );
        socket.addEventListener("close", (event: { code?: number; reason?: string }) => {
          if (!settled) {
            const suffix =
              event.code || event.reason
                ? ` (${event.code ?? 0}${event.reason ? `: ${event.reason}` : ""})`
                : "";
            finishError(new Error(`Gemini Live audio connection closed${suffix}`));
          }
        });
      });
    },
  });
}
