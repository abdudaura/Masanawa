import {
  normalizePerceptionEvent,
  type PerceptionEvent,
  type PerceptionPermissionEvidence,
  type PerceptionPrivacy,
  type PerceptionSubject,
} from "./perception-event.js";

export interface DeviceSensorEnvelope {
  readonly perceptionEventId: string;
  readonly tenantId: string;
  readonly deviceId: string;
  readonly sourceId: string;
  readonly subject: PerceptionSubject;
  readonly permission: PerceptionPermissionEvidence;
  readonly privacy: PerceptionPrivacy;
  readonly observationId: string;
  readonly observedAt: string;
  readonly receivedAt: string;
}

export interface NotificationObservation {
  readonly kind: "notification";
  readonly applicationId: string;
  readonly notificationKey: string;
  readonly title: string | null;
  readonly body: string | null;
  readonly category: string | null;
  readonly ongoing: boolean;
}

export interface DeviceStateObservation {
  readonly kind: "device-state";
  readonly batteryPercent: number | null;
  readonly charging: boolean | null;
  readonly network:
    | "offline"
    | "wifi"
    | "cellular"
    | "ethernet"
    | "other"
    | null;
  readonly metered: boolean | null;
  readonly powerSaveMode: boolean | null;
  readonly screenInteractive: boolean | null;
}

export interface LocationObservation {
  readonly kind: "location";
  readonly permissionPrecision: "coarse" | "precise";
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyMeters: number;
  readonly altitudeMeters: number | null;
  readonly speedMetersPerSecond: number | null;
}

export type DeviceSensorObservation =
  | NotificationObservation
  | DeviceStateObservation
  | LocationObservation;

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

function optionalBoundedString(
  value: string | null,
  name: string,
  max: number,
): string | null {
  if (value === null) return null;
  return boundedString(value, name, 1, max);
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

function integerOrNull(
  value: number | null,
  name: string,
  min: number,
  max: number,
): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function validateEnvelope(envelope: DeviceSensorEnvelope): void {
  if (!envelope.deviceId.startsWith("device_")) {
    throw new TypeError("deviceId must be a canonical device id");
  }
  if (envelope.permission.basis !== "device-permission") {
    throw new Error(
      "Device sensor perception requires device-permission evidence",
    );
  }
}

function baseEvent(
  envelope: DeviceSensorEnvelope,
): Omit<PerceptionEvent, "kind" | "payload"> {
  validateEnvelope(envelope);
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
    )}:${boundedString(
      envelope.observationId,
      "observationId",
      1,
      180,
    )}`,
    observedAt: envelope.observedAt,
    receivedAt: envelope.receivedAt,
  };
}

function compactJson(value: Readonly<Record<string, unknown>>): string {
  const text = JSON.stringify(value);
  if (text.length > 16_384) {
    throw new RangeError("Device sensor payload is too large");
  }
  return text;
}

function notificationEvent(input: {
  readonly envelope: DeviceSensorEnvelope;
  readonly observation: NotificationObservation;
}): PerceptionEvent {
  const notification = input.observation;
  const applicationId = boundedString(
    notification.applicationId,
    "applicationId",
    1,
    220,
  );
  const notificationKey = boundedString(
    notification.notificationKey,
    "notificationKey",
    1,
    220,
  );
  const title = optionalBoundedString(notification.title, "title", 500);
  const body = optionalBoundedString(notification.body, "body", 4_000);
  const category = optionalBoundedString(
    notification.category,
    "category",
    120,
  );
  if (typeof notification.ongoing !== "boolean") {
    throw new TypeError("ongoing is invalid");
  }

  if (title === null && body === null) {
    throw new Error("Notification perception requires title or body");
  }

  return normalizePerceptionEvent({
    ...baseEvent(input.envelope),
    kind: "notification",
    payload: {
      mediaType: "application/json",
      contentRef: null,
      inlineText: compactJson({
        applicationId,
        notificationKey,
        title,
        body,
        category,
        ongoing: notification.ongoing,
      }),
      attributes: {
        applicationId,
        notificationKey,
        ongoing: String(notification.ongoing),
        ...(category === null ? {} : { category }),
      },
    },
  });
}

function deviceStateEvent(input: {
  readonly envelope: DeviceSensorEnvelope;
  readonly observation: DeviceStateObservation;
}): PerceptionEvent {
  const state = input.observation;
  const batteryPercent = integerOrNull(
    state.batteryPercent,
    "batteryPercent",
    0,
    100,
  );
  if (
    state.network !== null &&
    state.network !== "offline" &&
    state.network !== "wifi" &&
    state.network !== "cellular" &&
    state.network !== "ethernet" &&
    state.network !== "other"
  ) {
    throw new TypeError("network is invalid");
  }

  const values = {
    batteryPercent,
    charging: state.charging,
    network: state.network,
    metered: state.metered,
    powerSaveMode: state.powerSaveMode,
    screenInteractive: state.screenInteractive,
  };

  if (Object.values(values).every((value) => value === null)) {
    throw new Error("Device-state perception requires at least one observed fact");
  }

  for (const [name, value] of Object.entries(values)) {
    if (
      name !== "batteryPercent" &&
      name !== "network" &&
      value !== null &&
      typeof value !== "boolean"
    ) {
      throw new TypeError(`${name} is invalid`);
    }
  }

  return normalizePerceptionEvent({
    ...baseEvent(input.envelope),
    kind: "device-state",
    payload: {
      mediaType: "application/json",
      contentRef: null,
      inlineText: compactJson(values),
      attributes: {
        ...(batteryPercent === null
          ? {}
          : { batteryPercent: String(batteryPercent) }),
        ...(state.network === null ? {} : { network: state.network }),
      },
    },
  });
}

function locationEvent(input: {
  readonly envelope: DeviceSensorEnvelope;
  readonly observation: LocationObservation;
}): PerceptionEvent {
  if (input.envelope.privacy.scope !== "user-private") {
    throw new Error("Location perception must remain user-private");
  }
  if (input.envelope.privacy.retention === "durable") {
    throw new Error("Location perception must not use durable retention");
  }
  if (input.envelope.privacy.memoryPromotion !== "forbidden") {
    throw new Error("Location perception cannot be promoted to memory");
  }

  const location = input.observation;
  if (
    location.permissionPrecision !== "coarse" &&
    location.permissionPrecision !== "precise"
  ) {
    throw new TypeError("permissionPrecision is invalid");
  }
  const latitude = finite(location.latitude, "latitude", -90, 90);
  const longitude = finite(location.longitude, "longitude", -180, 180);
  const accuracyMeters = finite(
    location.accuracyMeters,
    "accuracyMeters",
    0,
    100_000,
  );
  const altitudeMeters =
    location.altitudeMeters === null
      ? null
      : finite(location.altitudeMeters, "altitudeMeters", -1_000, 100_000);
  const speedMetersPerSecond =
    location.speedMetersPerSecond === null
      ? null
      : finite(
          location.speedMetersPerSecond,
          "speedMetersPerSecond",
          0,
          400,
        );

  if (
    location.permissionPrecision === "coarse" &&
    accuracyMeters < 100
  ) {
    throw new Error(
      "Coarse location must not contain unexpectedly precise coordinates",
    );
  }

  const normalized =
    location.permissionPrecision === "coarse"
      ? {
          latitude: Number(latitude.toFixed(2)),
          longitude: Number(longitude.toFixed(2)),
          accuracyMeters: Math.max(accuracyMeters, 100),
          altitudeMeters: null,
          speedMetersPerSecond: null,
        }
      : {
          latitude,
          longitude,
          accuracyMeters,
          altitudeMeters,
          speedMetersPerSecond,
        };

  return normalizePerceptionEvent({
    ...baseEvent(input.envelope),
    kind: "location",
    payload: {
      mediaType: "application/json",
      contentRef: null,
      inlineText: compactJson({
        permissionPrecision: location.permissionPrecision,
        ...normalized,
      }),
      attributes: {
        precision: location.permissionPrecision,
        accuracyMeters: String(normalized.accuracyMeters),
      },
    },
  });
}

export function admitDeviceSensorPerception(input: {
  readonly envelope: DeviceSensorEnvelope;
  readonly observation: DeviceSensorObservation;
}): PerceptionEvent {
  if (input.observation.kind === "notification") {
    return notificationEvent({
      envelope: input.envelope,
      observation: input.observation,
    });
  }
  if (input.observation.kind === "device-state") {
    return deviceStateEvent({
      envelope: input.envelope,
      observation: input.observation,
    });
  }
  return locationEvent({
    envelope: input.envelope,
    observation: input.observation,
  });
}
