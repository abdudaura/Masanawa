import { WebhookReceiver } from "livekit-server-sdk";
import {
  parseCanonicalId,
  type PresenceSessionId,
  type TenantId,
} from "@masanawa/contracts";
import { CredentialSecret } from "@masanawa/security";
import {
  parseLiveKitParticipantIdentity,
  type LiveKitPresenceCredentials,
  type LiveKitPresenceParticipantRole,
} from "./token.js";

export type LiveKitPresenceTransportEventKind =
  | "participant-joined"
  | "participant-left"
  | "participant-connection-aborted"
  | "room-finished";

export interface LiveKitPresenceTransportEvent {
  readonly kind: LiveKitPresenceTransportEventKind;
  readonly providerEventId: string;
  readonly presenceSessionId: PresenceSessionId;
  readonly role: LiveKitPresenceParticipantRole | null;
  readonly connectionGeneration: number | null;
}

export interface LiveKitWebhookCredentialSource {
  resolve(input: {
    readonly tenantId: TenantId;
  }): Promise<LiveKitPresenceCredentials | null>;
}

export interface DecodedLiveKitWebhook {
  readonly event?: string;
  readonly id?: string;
  readonly room?: { readonly name?: string } | null;
  readonly participant?: { readonly identity?: string } | null;
}

export interface LiveKitWebhookDecoder {
  decode(input: {
    readonly rawBody: string;
    readonly authorization: string;
    readonly credentials: LiveKitPresenceCredentials;
  }): Promise<DecodedLiveKitWebhook>;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function rawBody(value: string): string {
  if (typeof value !== "string" || value.length < 2 || value.length > 1_048_576) {
    throw new RangeError("LiveKit webhook raw body is invalid");
  }
  return value;
}

export function createLiveKitSdkWebhookDecoder(): LiveKitWebhookDecoder {
  return Object.freeze({
    async decode(input) {
      const apiKey = bounded(input.credentials.apiKey, "LiveKit apiKey", 256);
      return input.credentials.apiSecret.use(async (apiSecret) => {
        const receiver = new WebhookReceiver(apiKey, apiSecret);
        const event = await receiver.receive(
          rawBody(input.rawBody),
          bounded(input.authorization, "LiveKit authorization", 16_384),
        );
        return event as unknown as DecodedLiveKitWebhook;
      });
    },
  });
}

function presenceSessionIdFromRoom(roomName: string | undefined): PresenceSessionId {
  if (!roomName) throw new Error("LiveKit webhook is missing room identity");
  return parseCanonicalId("presence-session", roomName);
}

export function createLiveKitPresenceWebhookVerifier(input: {
  readonly credentials: LiveKitWebhookCredentialSource;
  readonly decoder?: LiveKitWebhookDecoder;
}) {
  const decoder = input.decoder ?? createLiveKitSdkWebhookDecoder();

  return Object.freeze({
    async verify(request: {
      readonly tenantId: TenantId;
      readonly rawBody: string;
      readonly authorization: string;
    }): Promise<LiveKitPresenceTransportEvent | null> {
      const credentials = await input.credentials.resolve({
        tenantId: request.tenantId,
      });
      if (!credentials) {
        throw new Error("LiveKit credentials are unavailable for tenant");
      }
      const decoded = await decoder.decode({
        rawBody: rawBody(request.rawBody),
        authorization: bounded(
          request.authorization,
          "LiveKit authorization",
          16_384,
        ),
        credentials,
      });

      const providerEventId = bounded(
        decoded.id ?? "",
        "LiveKit provider event id",
        256,
      );

      if (decoded.event === "room_finished") {
        return Object.freeze({
          kind: "room-finished" as const,
          providerEventId,
          presenceSessionId: presenceSessionIdFromRoom(decoded.room?.name),
          role: null,
          connectionGeneration: null,
        });
      }

      const kind =
        decoded.event === "participant_joined"
          ? "participant-joined"
          : decoded.event === "participant_left"
            ? "participant-left"
            : decoded.event === "participant_connection_aborted"
              ? "participant-connection-aborted"
              : null;
      if (kind === null) return null;

      const participant = parseLiveKitParticipantIdentity(
        decoded.participant?.identity ?? "",
      );
      return Object.freeze({
        kind,
        providerEventId,
        presenceSessionId: presenceSessionIdFromRoom(decoded.room?.name),
        role: participant.role,
        connectionGeneration: participant.connectionGeneration,
      });
    },
  });
}
