export interface NativeAudioRenderResult {
  readonly dataBase64: string;
  readonly mimeType: string;
  readonly durationMs: number;
}

export interface NativeAudioRenderer {
  render(
    text: string,
    signal?: AbortSignal,
    onPcmChunk?: (chunk: Buffer) => void | Promise<void>,
    persona?: {displayName:string;roleLabel:string},
  ): Promise<NativeAudioRenderResult>;
}

interface GeminiInteractionResponse {
  readonly steps?: readonly {
    readonly type?: unknown;
    readonly content?: readonly {
      readonly type?: unknown;
      readonly mime_type?: unknown;
      readonly data?: unknown;
    }[];
  }[];
}

/** The REST Interactions API stores generated audio in model_output steps.
 * SDK-only output_audio conveniences and generateContent candidates are absent.
 */
function audioPart(payload: GeminiInteractionResponse): {
  readonly mimeType: string;
  readonly dataBase64: string;
} {
  const audio = payload.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === "audio")
    .at(-1);
  if (!audio || typeof audio.data !== "string" || !audio.data.length) {
    throw new Error("Gemini Interactions returned no model audio");
  }
  const mimeType = typeof audio.mime_type === "string"
    ? audio.mime_type.toLowerCase().split(";")[0]?.trim()
    : "audio/l16";
  // We explicitly request L16; never deliver container audio to PCM callbacks.
  if (mimeType !== "audio/l16") {
    throw new Error("Gemini Interactions returned an unexpected audio format");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(audio.data)) {
    throw new Error("Gemini Interactions returned invalid base64 audio");
  }
  return Object.freeze({ mimeType, dataBase64: audio.data });
}

function durationMs(buffer: Buffer, mimeType: string): number {
  const rateMatch = /(?:^|;)\s*rate=(\d+)/iu.exec(mimeType);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24_000;
  // Gemini native PCM is mono signed 16-bit PCM unless the MIME type says
  // otherwise. Duration is advisory metadata for mobile playback UI.
  if (/audio\/(?:pcm|l16)/iu.test(mimeType) && sampleRate > 0) {
    return Math.max(1, Math.round((buffer.byteLength / 2 / sampleRate) * 1000));
  }
  return 0;
}

export function createGeminiLiveAudioRenderer(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly voiceName: string;
  readonly fetchImpl?: typeof fetch;
  readonly resolveVoice?: (displayName:string)=>Promise<string>;
}): NativeAudioRenderer {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  const voiceName = input.voiceName.trim();
  if (!apiKey) throw new TypeError("Gemini API key is required");
  if (!model) throw new TypeError("Gemini native audio model is required");
  if (!voiceName) throw new TypeError("Gemini native audio voice is required");
  const fetchImpl = input.fetchImpl ?? fetch;

  const renderer: NativeAudioRenderer = {
    async render(text, signal, onPcmChunk, persona) {
      const prompt = text.trim();
      if (!prompt || prompt.length > 32_000) {
        throw new RangeError("Native audio text is invalid");
      }

      const selectedVoice = persona && input.resolveVoice
        ? await input.resolveVoice(persona.displayName)
        : voiceName;
      if (!selectedVoice.trim()) throw new Error("Google voice selection is empty");
      const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method:'POST', signal: signal ?? AbortSignal.timeout(45000),
        headers:{'content-type':'application/json','x-goog-api-key':apiKey},
        body:JSON.stringify({model:model.includes('live')?'gemini-3.8-flash-tts':model,
          input:[{type:'user_input',content:[{type:'text',text:prompt,annotations:[{type:'speech_metadata',style:`Warm, clear, natural conversational delivery${persona ? ` suited to a ${persona.roleLabel} educator` : ''}. Read only the supplied transcript.`}]}]}],
          response_format:{type:'audio',mime_type:'audio/l16',sample_rate:24000},generation_config:{speech_config:[{voice:selectedVoice}]}}),
      });
      if (!response.ok) {
        throw new Error(`Gemini native audio request failed with ${response.status}`);
      }

      const audio = audioPart((await response.json()) as GeminiInteractionResponse);
      const buffer = Buffer.from(audio.dataBase64, "base64");
      if (buffer.byteLength === 0 || buffer.byteLength > 32 * 1024 * 1024 || buffer.byteLength % 2 !== 0) {
        throw new Error("Gemini native audio payload is invalid");
      }
      if (onPcmChunk) await onPcmChunk(buffer);
      return Object.freeze({
        dataBase64: audio.dataBase64,
        mimeType: audio.mimeType,
        durationMs: durationMs(buffer, audio.mimeType),
      });
    },
  };

  return Object.freeze(renderer);
}
