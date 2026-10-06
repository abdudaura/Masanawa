export type RealtimeAudioEncoding =
  | "pcm-s16le"
  | "pcm-f32le"
  | "opus";

export interface RealtimeAudioFrame {
  readonly presenceSessionId: string;
  readonly generation: number;
  readonly sequence: number;
  readonly encoding: RealtimeAudioEncoding;
  readonly sampleRateHz: number;
  readonly channels: 1 | 2;
  readonly data: Uint8Array;
  readonly capturedAt: string;
}

export interface RealtimeTranscriptEvent {
  readonly presenceSessionId: string;
  readonly generation: number;
  readonly sequence: number;
  readonly text: string;
  readonly final: boolean;
  readonly language: string | null;
}

export interface RealtimeModelDelta {
  readonly presenceSessionId: string;
  readonly generation: number;
  readonly sequence: number;
  readonly text: string;
  readonly final: boolean;
}

export interface RealtimeSpeechChunk {
  readonly presenceSessionId: string;
  readonly generation: number;
  readonly sequence: number;
  readonly encoding: RealtimeAudioEncoding;
  readonly sampleRateHz: number;
  readonly channels: 1 | 2;
  readonly data: Uint8Array;
  readonly final: boolean;
}

export type DirectLiveInbound =
  | { readonly kind: "audio"; readonly frame: RealtimeAudioFrame }
  | {
      readonly kind: "text";
      readonly presenceSessionId: string;
      readonly generation: number;
      readonly sequence: number;
      readonly text: string;
    };

export type DirectLiveOutbound =
  | { readonly kind: "transcript"; readonly event: RealtimeTranscriptEvent }
  | { readonly kind: "model"; readonly event: RealtimeModelDelta }
  | { readonly kind: "audio"; readonly event: RealtimeSpeechChunk }
  | {
      readonly kind: "completed";
      readonly presenceSessionId: string;
      readonly generation: number;
    }
  | {
      readonly kind: "failed";
      readonly presenceSessionId: string;
      readonly generation: number;
      readonly reason: string;
    };

export interface RealtimeAbortSignal {
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
}

export interface StreamingSpeechToTextPort {
  transcribe(input: {
    readonly presenceSessionId: string;
    readonly generation: number;
    readonly frames: AsyncIterable<RealtimeAudioFrame>;
    readonly signal: RealtimeAbortSignal;
  }): AsyncIterable<RealtimeTranscriptEvent>;
}

export interface StreamingRealtimeModelPort {
  respond(input: {
    readonly presenceSessionId: string;
    readonly generation: number;
    readonly text: string;
    readonly signal: RealtimeAbortSignal;
  }): AsyncIterable<RealtimeModelDelta>;
}

export interface StreamingTextToSpeechPort {
  synthesize(input: {
    readonly presenceSessionId: string;
    readonly generation: number;
    readonly text: AsyncIterable<RealtimeModelDelta>;
    readonly signal: RealtimeAbortSignal;
  }): AsyncIterable<RealtimeSpeechChunk>;
}

export interface DirectLiveSession {
  readonly presenceSessionId: string;
  readonly generation: number;
  send(input: DirectLiveInbound): Promise<void>;
  receive(): AsyncIterable<DirectLiveOutbound>;
  close(input: { readonly reason: "completed" | "cancelled" | "failed" }): Promise<void>;
}

export interface DirectLiveProviderPort {
  open(input: {
    readonly presenceSessionId: string;
    readonly generation: number;
    readonly signal: RealtimeAbortSignal;
  }): Promise<DirectLiveSession>;
}

function boundedString(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function presenceId(value: string): string {
  const normalized = boundedString(value, "presenceSessionId", 24, 220);
  if (!normalized.startsWith("presence-session_")) {
    throw new TypeError("presenceSessionId must be canonical");
  }
  return normalized;
}

function positiveInteger(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function nonnegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function audioEncoding(value: RealtimeAudioEncoding): RealtimeAudioEncoding {
  if (value !== "pcm-s16le" && value !== "pcm-f32le" && value !== "opus") {
    throw new TypeError("encoding is invalid");
  }
  return value;
}

function audioShape(input: {
  readonly sampleRateHz: number;
  readonly channels: number;
}): { readonly sampleRateHz: number; readonly channels: 1 | 2 } {
  const sampleRateHz = positiveInteger(input.sampleRateHz, "sampleRateHz", 192_000);
  if (sampleRateHz < 8_000) throw new RangeError("sampleRateHz is invalid");
  if (input.channels !== 1 && input.channels !== 2) {
    throw new RangeError("channels is invalid");
  }
  return { sampleRateHz, channels: input.channels };
}

function bytes(value: Uint8Array, name: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 || value.byteLength > 2 * 1024 * 1024) {
    throw new RangeError(`${name} must contain 1 to 2097152 bytes`);
  }
  return new Uint8Array(value);
}

function instant(value: string, name: string): string {
  const normalized = boundedString(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

export function normalizeRealtimeAudioFrame(
  input: RealtimeAudioFrame,
): RealtimeAudioFrame {
  const shape = audioShape(input);
  return Object.freeze({
    presenceSessionId: presenceId(input.presenceSessionId),
    generation: positiveInteger(input.generation, "generation", 2_147_483_647),
    sequence: nonnegativeInteger(input.sequence, "sequence"),
    encoding: audioEncoding(input.encoding),
    sampleRateHz: shape.sampleRateHz,
    channels: shape.channels,
    data: bytes(input.data, "data"),
    capturedAt: instant(input.capturedAt, "capturedAt"),
  });
}

export function normalizeRealtimeTranscriptEvent(
  input: RealtimeTranscriptEvent,
): RealtimeTranscriptEvent {
  if (typeof input.final !== "boolean") throw new TypeError("final must be boolean");
  return Object.freeze({
    presenceSessionId: presenceId(input.presenceSessionId),
    generation: positiveInteger(input.generation, "generation", 2_147_483_647),
    sequence: nonnegativeInteger(input.sequence, "sequence"),
    text: boundedString(input.text, "text", input.final ? 0 : 1, 32_000),
    final: input.final,
    language:
      input.language === null
        ? null
        : boundedString(input.language, "language", 2, 40).toLowerCase(),
  });
}

export function normalizeRealtimeModelDelta(
  input: RealtimeModelDelta,
): RealtimeModelDelta {
  if (typeof input.final !== "boolean") throw new TypeError("final must be boolean");
  return Object.freeze({
    presenceSessionId: presenceId(input.presenceSessionId),
    generation: positiveInteger(input.generation, "generation", 2_147_483_647),
    sequence: nonnegativeInteger(input.sequence, "sequence"),
    text: boundedString(input.text, "text", input.final ? 0 : 1, 64_000),
    final: input.final,
  });
}

export function normalizeRealtimeSpeechChunk(
  input: RealtimeSpeechChunk,
): RealtimeSpeechChunk {
  if (typeof input.final !== "boolean") throw new TypeError("final must be boolean");
  const shape = audioShape(input);
  return Object.freeze({
    presenceSessionId: presenceId(input.presenceSessionId),
    generation: positiveInteger(input.generation, "generation", 2_147_483_647),
    sequence: nonnegativeInteger(input.sequence, "sequence"),
    encoding: audioEncoding(input.encoding),
    sampleRateHz: shape.sampleRateHz,
    channels: shape.channels,
    data: bytes(input.data, "data"),
    final: input.final,
  });
}

export function assertRealtimeIdentity(input: {
  readonly presenceSessionId: string;
  readonly generation: number;
  readonly event:
    | RealtimeAudioFrame
    | RealtimeTranscriptEvent
    | RealtimeModelDelta
    | RealtimeSpeechChunk;
}): void {
  const expectedPresence = presenceId(input.presenceSessionId);
  const expectedGeneration = positiveInteger(
    input.generation,
    "generation",
    2_147_483_647,
  );
  if (
    input.event.presenceSessionId !== expectedPresence ||
    input.event.generation !== expectedGeneration
  ) {
    throw new Error("Realtime provider event belongs to a stale or foreign generation");
  }
}
