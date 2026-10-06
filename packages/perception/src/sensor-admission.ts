import {
  normalizePerceptionEvent,
  type PerceptionEvent,
  type PerceptionPermissionEvidence,
  type PerceptionPrivacy,
  type PerceptionSubject,
} from "./perception-event.js";

export interface SensorPerceptionEnvelope {
  readonly perceptionEventId: string;
  readonly tenantId: string;
  readonly deviceId: string;
  readonly sourceId: string;
  readonly subject: PerceptionSubject;
  readonly permission: PerceptionPermissionEvidence;
  readonly privacy: PerceptionPrivacy;
  readonly upstreamEventId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
}

export interface NotificationPerception {
  readonly kind: "notification";
  readonly applicationId: string;
  readonly title: string;
  readonly body: string;
}

export interface DeviceStatePerception {
  readonly kind: "device-state";
  readonly batteryPercent: number;
  readonly charging: boolean;
  readonly network: "offline" | "wifi" | "cellular" | "ethernet" | "unknown";
}

export interface LocationPerception {
  readonly kind: "location";
  readonly precision: "coarse" | "precise";
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
}

export type SensorPerception =
  | NotificationPerception
  | DeviceStatePerception
  | LocationPerception;

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

function requirePurpose(
  permission: PerceptionPermissionEvidence,
  purpose: string,
): void {
  const purposes = permission.purposes.map((value) => value.trim().toLowerCase());
  if (!purposes.includes(purpose)) {
    throw new Error(`sensor perception requires permission purpose: ${purpose}`);
  }
}

function baseEvent(
  envelope: SensorPerceptionEnvelope,
): Omit<PerceptionEvent, "kind" | "payload"> {
  if (!envelope.deviceId.startsWith("device_")) {
    throw new TypeError("deviceId must be a canonical device id");
  }
  if (envelope.permission.basis !== "device-permission") {
    throw new Error("sensor perception requires device-permission evidence");
  }

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
    )}:${boundedString(envelope.upstreamEventId, "upstreamEventId", 1, 180)}`,
    observedAt: envelope.observedAt,
    receivedAt: envelope.receivedAt,
  };
}

function finite(
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

function roundedCoordinate(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function admitSensorPerception(input: {
  readonly envelope: SensorPerceptionEnvelope;
  readonly sensor: SensorPerception;
}): PerceptionEvent {
  const base = baseEvent(input.envelope);

  if (input.sensor.kind === "notification") {
    requirePurpose(input.envelope.permission, "notification-context");
    const applicationId = boundedString(
      input.sensor.applicationId,
      "applicationId",
      1,
      180,
    );
    const title = boundedString(input.sensor.title, "title", 0, 256);
    const body = boundedString(input.sensor.body, "body", 0, 4_096);
    if (title.length === 0 && body.length === 0) {
      throw new Error("notification requires title or body");
    }

    return normalizePerceptionEvent({
      ...base,
      kind: "notification",
      payload: {
        mediaType: "application/vnd.masanawa.notification+json",
        contentRef: null,
        inlineText: JSON.stringify({ applicationId, title, body }),
        attributes: { applicationId },
      },
    });
  }

  if (input.sensor.kind === "device-state") {
    requirePurpose(input.envelope.permission, "device-state");
    if (
      !Number.isSafeInteger(input.sensor.batteryPercent) ||
      input.sensor.batteryPercent < 0 ||
      input.sensor.batteryPercent > 100
    ) {
      throw new RangeError("batteryPercent is invalid");
    }
    if (typeof input.sensor.charging !== "boolean") {
      throw new TypeError("charging must be boolean");
    }

    return normalizePerceptionEvent({
      ...base,
      kind: "device-state",
      payload: {
        mediaType: "application/vnd.masanawa.device-state+json",
        contentRef: null,
        inlineText: JSON.stringify({
          batteryPercent: input.sensor.batteryPercent,
          charging: input.sensor.charging,
          network: input.sensor.network,
        }),
        attributes: {
          batteryPercent: String(input.sensor.batteryPercent),
          charging: String(input.sensor.charging),
          network: input.sensor.network,
        },
      },
    });
  }

  requirePurpose(input.envelope.permission, "location");
  const latitude = finite(input.sensor.latitude, "latitude", -90, 90);
  const longitude = finite(input.sensor.longitude, "longitude", -180, 180);
  const accuracyMeters = finite(
    input.sensor.accuracyMeters,
    "accuracyMeters",
    0,
    100_000,
  );

  if (
    input.sensor.precision !== "coarse" &&
    input.sensor.precision !== "precise"
  ) {
    throw new TypeError("precision is invalid");
  }

  if (
    input.sensor.precision === "precise" &&
    input.envelope.privacy.scope !== "user-private" &&
    input.envelope.privacy.scope !== "relationship"
  ) {
    throw new Error(
      "precise location requires user-private or relationship privacy scope",
    );
  }

  const normalizedLatitude =
    input.sensor.precision === "coarse"
      ? roundedCoordinate(latitude, 2)
      : roundedCoordinate(latitude, 6);
  const normalizedLongitude =
    input.sensor.precision === "coarse"
      ? roundedCoordinate(longitude, 2)
      : roundedCoordinate(longitude, 6);

  return normalizePerceptionEvent({
    ...base,
    kind: "location",
    payload: {
      mediaType: "application/geo+json",
      contentRef: null,
      inlineText: JSON.stringify({
        type: "Point",
        coordinates: [normalizedLongitude, normalizedLatitude],
      }),
      attributes: {
        precision: input.sensor.precision,
        latitude: String(normalizedLatitude),
        longitude: String(normalizedLongitude),
        accuracyMeters: String(Math.round(accuracyMeters)),
      },
    },
  });
}
