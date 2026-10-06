import {
  normalizePerceptionEvent,
  type PerceptionEvent,
  type PerceptionPermissionEvidence,
  type PerceptionPrivacy,
  type PerceptionSubject,
} from "./perception-event.js";

export interface DevicePerceptionEnvelope {
  readonly perceptionEventId: string;
  readonly tenantId: string;
  readonly deviceId: string;
  readonly sourceId: string;
  readonly subject: PerceptionSubject;
  readonly permission: PerceptionPermissionEvidence;
  readonly privacy: PerceptionPrivacy;
  readonly captureId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
}

export interface MicrophoneCapture {
  readonly kind: "microphone";
  readonly contentRef: string;
  readonly mediaType: "audio/wav" | "audio/webm" | "audio/ogg" | "audio/pcm";
  readonly durationMilliseconds: number;
  readonly sampleRateHz: number;
  readonly channels: 1 | 2;
}

export interface CameraCapture {
  readonly kind: "camera";
  readonly contentRef: string;
  readonly mediaType: "image/jpeg" | "image/png" | "image/webp";
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly facing: "front" | "rear" | "external";
}

export interface ScreenCapture {
  readonly kind: "screen";
  readonly contentRef: string;
  readonly mediaType:
    | "image/png"
    | "image/jpeg"
    | "video/webm"
    | "video/mp4";
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly durationMilliseconds: number | null;
  readonly frameRate: number | null;
}

export type DeviceCapture = MicrophoneCapture | CameraCapture | ScreenCapture;

function boundedString(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function integer(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function positiveFinite(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function validateDeviceEnvelope(input: DevicePerceptionEnvelope): void {
  if (input.permission.basis !== "device-permission") {
    throw new Error(
      "device capture perception requires device-permission evidence",
    );
  }
  if (!input.deviceId.startsWith("device_")) {
    throw new TypeError("deviceId must be a canonical device id");
  }
}

function baseEvent(
  envelope: DevicePerceptionEnvelope,
): Omit<PerceptionEvent, "kind" | "payload"> {
  validateDeviceEnvelope(envelope);
  return {
    schemaVersion: 1,
    perceptionEventId: envelope.perceptionEventId,
    tenantId: envelope.tenantId,
    source: {
      kind: "device",
      sourceId: boundedString(envelope.sourceId, "sourceId", 1, 180),
      deviceId: envelope.deviceId,
      channelAccountId: null,
    },
    subject: envelope.subject,
    permission: envelope.permission,
    privacy: envelope.privacy,
    dedupeKey: `device:${boundedString(
      envelope.deviceId,
      "deviceId",
      8,
      220,
    )}:${boundedString(envelope.captureId, "captureId", 1, 180)}`,
    observedAt: envelope.observedAt,
    receivedAt: envelope.receivedAt,
  };
}

export function admitDeviceCapture(input: {
  readonly envelope: DevicePerceptionEnvelope;
  readonly capture: DeviceCapture;
}): PerceptionEvent {
  const base = baseEvent(input.envelope);
  const ref = boundedString(input.capture.contentRef, "contentRef", 1, 2048);

  if (input.capture.kind === "microphone") {
    const durationMilliseconds = integer(
      input.capture.durationMilliseconds,
      "durationMilliseconds",
      1,
      60 * 60 * 1000,
    );
    const sampleRateHz = integer(
      input.capture.sampleRateHz,
      "sampleRateHz",
      8_000,
      192_000,
    );
    if (input.capture.channels !== 1 && input.capture.channels !== 2) {
      throw new RangeError("channels is invalid");
    }

    return normalizePerceptionEvent({
      ...base,
      kind: "microphone",
      payload: {
        mediaType: input.capture.mediaType,
        contentRef: ref,
        inlineText: null,
        attributes: {
          durationMilliseconds: String(durationMilliseconds),
          sampleRateHz: String(sampleRateHz),
          channels: String(input.capture.channels),
        },
      },
    });
  }

  if (input.capture.kind === "camera") {
    const widthPixels = integer(
      input.capture.widthPixels,
      "widthPixels",
      1,
      16_384,
    );
    const heightPixels = integer(
      input.capture.heightPixels,
      "heightPixels",
      1,
      16_384,
    );

    return normalizePerceptionEvent({
      ...base,
      kind: "camera",
      payload: {
        mediaType: input.capture.mediaType,
        contentRef: ref,
        inlineText: null,
        attributes: {
          widthPixels: String(widthPixels),
          heightPixels: String(heightPixels),
          facing: input.capture.facing,
        },
      },
    });
  }

  const widthPixels = integer(
    input.capture.widthPixels,
    "widthPixels",
    1,
    16_384,
  );
  const heightPixels = integer(
    input.capture.heightPixels,
    "heightPixels",
    1,
    16_384,
  );

  const durationMilliseconds =
    input.capture.durationMilliseconds === null
      ? null
      : integer(
          input.capture.durationMilliseconds,
          "durationMilliseconds",
          1,
          8 * 60 * 60 * 1000,
        );
  const frameRate =
    input.capture.frameRate === null
      ? null
      : positiveFinite(input.capture.frameRate, "frameRate", 1, 240);

  const isVideo =
    input.capture.mediaType === "video/webm" ||
    input.capture.mediaType === "video/mp4";

  if (isVideo && (durationMilliseconds === null || frameRate === null)) {
    throw new Error(
      "screen video capture requires durationMilliseconds and frameRate",
    );
  }
  if (!isVideo && (durationMilliseconds !== null || frameRate !== null)) {
    throw new Error(
      "screen image capture must not include durationMilliseconds or frameRate",
    );
  }

  return normalizePerceptionEvent({
    ...base,
    kind: "screen",
    payload: {
      mediaType: input.capture.mediaType,
      contentRef: ref,
      inlineText: null,
      attributes: {
        widthPixels: String(widthPixels),
        heightPixels: String(heightPixels),
        ...(durationMilliseconds === null
          ? {}
          : { durationMilliseconds: String(durationMilliseconds) }),
        ...(frameRate === null ? {} : { frameRate: String(frameRate) }),
      },
    },
  });
}
