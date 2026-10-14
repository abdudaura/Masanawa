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

interface GeminiAudioResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly {
        readonly inlineData?: {
          readonly mimeType?: unknown;
          readonly data?: unknown;
        };
        readonly inline_data?: {
          readonly mime_type?: unknown;
          readonly data?: unknown;
        };
      }[];
    };
  }[];
}

function audioPart(payload: GeminiAudioResponse): {
  readonly mimeType: string;
  readonly dataBase64: string;
} {
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData;
      if (
        inline &&
        typeof inline.mimeType === "string" &&
        typeof inline.data === "string" &&
        inline.data.length > 0
      ) {
        return Object.freeze({
          mimeType: inline.mimeType,
          dataBase64: inline.data,
        });
      }
      const legacy = part.inline_data;
      if (
        legacy &&
        typeof legacy.mime_type === "string" &&
        typeof legacy.data === "string" &&
        legacy.data.length > 0
      ) {
        return Object.freeze({
          mimeType: legacy.mime_type,
          dataBase64: legacy.data,
        });
      }
    }
  }
  throw new Error("Gemini native audio returned no audio");
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

      const selectedVoice=persona && input.resolveVoice ? await input.resolveVoice(persona.displayName) : voiceName;
      const response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method:'POST', signal: signal ?? AbortSignal.timeout(45000),
        headers:{'content-type':'application/json','x-goog-api-key':apiKey},
        body:JSON.stringify({model:model.includes('live')?'gemini-3.8-flash-tts':model,
          input:[{type:'user_input',content:[{type:'text',text:prompt,annotations:[{type:'speech_metadata',style:`Warm, clear, natural conversational delivery${persona ? ` suited to a ${persona.roleLabel} educator` : ''}. Read only the supplied transcript.`}]}]}],
          response_format:{type:'audio'},generation_config:{speech_config:[{voice:selectedVoice}]}}),
      });
      if (!response.ok) {
        throw new Error(`Gemini native audio request failed with ${response.status}`);
      }

      const audio = audioPart((await response.json()) as GeminiAudioResponse);
      const buffer = Buffer.from(audio.dataBase64, "base64");
      if (buffer.byteLength === 0 || buffer.byteLength > 32 * 1024 * 1024) {
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
