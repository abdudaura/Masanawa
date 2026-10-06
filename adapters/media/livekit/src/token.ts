import { AccessToken } from "livekit-server-sdk";
import {
  parseCanonicalId,
  type PresenceSessionId,
  type TenantId,
} from "@masanawa/contracts";
import { CredentialSecret } from "@masanawa/security";

export type LiveKitPresenceParticipantRole = "user" | "character";

export interface LiveKitPresenceCredentials {
  readonly serverUrl: string;
  readonly apiKey: string;
  readonly apiSecret: CredentialSecret;
}

export interface LiveKitPresenceCredentialSource {
  resolve(input: {
    readonly tenantId: TenantId;
  }): Promise<LiveKitPresenceCredentials | null>;
}

export interface LiveKitJoinTokenGrant {
  readonly roomJoin: true;
  readonly room: string;
  readonly canPublish: true;
  readonly canSubscribe: true;
  readonly canPublishData: false;
  readonly canUpdateOwnMetadata: false;
}

export interface LiveKitTokenSignerInput {
  readonly apiKey: string;
  readonly apiSecret: CredentialSecret;
  readonly participantIdentity: string;
  readonly ttlSeconds: number;
  readonly grant: LiveKitJoinTokenGrant;
}

export interface LiveKitTokenSigner {
  mint(input: LiveKitTokenSignerInput): Promise<string>;
}

export interface LiveKitPresenceJoinToken {
  readonly serverUrl: string;
  readonly roomName: string;
  readonly participantIdentity: string;
  readonly token: string;
  readonly ttlSeconds: number;
  readonly connectionGeneration: number;
  readonly role: LiveKitPresenceParticipantRole;
}

function bounded(value: string, name: string, maxLength: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positiveGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000_000) {
    throw new RangeError("connectionGeneration is invalid");
  }
  return value;
}

function ttl(value: number): number {
  if (!Number.isSafeInteger(value) || value < 30 || value > 600) {
    throw new RangeError("LiveKit token ttlSeconds must be between 30 and 600");
  }
  return value;
}

function serverUrl(value: string): string {
  const normalized = bounded(value, "LiveKit serverUrl", 2048);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError("LiveKit serverUrl is invalid");
  }
  if (parsed.protocol !== "wss:") {
    throw new TypeError("LiveKit serverUrl must use wss");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new TypeError("LiveKit serverUrl must not contain credentials/query/fragment");
  }
  return parsed.toString().replace(/\/$/u, "");
}

export function liveKitRoomName(
  presenceSessionId: PresenceSessionId,
): string {
  return parseCanonicalId("presence-session", presenceSessionId);
}

export function liveKitParticipantIdentity(input: {
  readonly role: LiveKitPresenceParticipantRole;
  readonly connectionGeneration: number;
}): string {
  if (input.role !== "user" && input.role !== "character") {
    throw new TypeError("LiveKit participant role is invalid");
  }
  return `${input.role}:g${positiveGeneration(input.connectionGeneration)}`;
}

export function parseLiveKitParticipantIdentity(value: string): {
  readonly role: LiveKitPresenceParticipantRole;
  readonly connectionGeneration: number;
} {
  const normalized = bounded(value, "LiveKit participant identity", 64);
  const match = /^(user|character):g([1-9][0-9]{0,9})$/u.exec(normalized);
  if (!match) throw new TypeError("LiveKit participant identity is invalid");
  return Object.freeze({
    role: match[1] as LiveKitPresenceParticipantRole,
    connectionGeneration: positiveGeneration(Number(match[2])),
  });
}

export function createLiveKitSdkTokenSigner(): LiveKitTokenSigner {
  return Object.freeze({
    async mint(input) {
      const apiKey = bounded(input.apiKey, "LiveKit apiKey", 256);
      return input.apiSecret.use(async (apiSecret) => {
        const accessToken = new AccessToken(apiKey, apiSecret, {
          identity: bounded(
            input.participantIdentity,
            "LiveKit participantIdentity",
            64,
          ),
          ttl: ttl(input.ttlSeconds),
        });
        accessToken.addGrant({
          roomJoin: true,
          room: bounded(input.grant.room, "LiveKit room", 220),
          canPublish: true,
          canSubscribe: true,
          canPublishData: false,
          canUpdateOwnMetadata: false,
        });
        return accessToken.toJwt();
      });
    },
  });
}

export function createLiveKitPresenceTokenService(input: {
  readonly credentials: LiveKitPresenceCredentialSource;
  readonly signer?: LiveKitTokenSigner;
}) {
  const signer = input.signer ?? createLiveKitSdkTokenSigner();

  return Object.freeze({
    async mintJoinToken(request: {
      readonly tenantId: TenantId;
      readonly presenceSessionId: PresenceSessionId;
      readonly role: LiveKitPresenceParticipantRole;
      readonly connectionGeneration: number;
      readonly ttlSeconds?: number;
    }): Promise<LiveKitPresenceJoinToken> {
      const credentials = await input.credentials.resolve({
        tenantId: request.tenantId,
      });
      if (!credentials) {
        throw new Error("LiveKit credentials are unavailable for tenant");
      }

      const roomName = liveKitRoomName(request.presenceSessionId);
      const participantIdentity = liveKitParticipantIdentity({
        role: request.role,
        connectionGeneration: request.connectionGeneration,
      });
      const ttlSeconds = ttl(request.ttlSeconds ?? 300);
      const grant = Object.freeze<LiveKitJoinTokenGrant>({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canUpdateOwnMetadata: false,
      });
      const tokenValue = await signer.mint({
        apiKey: bounded(credentials.apiKey, "LiveKit apiKey", 256),
        apiSecret: credentials.apiSecret,
        participantIdentity,
        ttlSeconds,
        grant,
      });
      const token = bounded(tokenValue, "LiveKit join token", 32_768);

      return Object.freeze({
        serverUrl: serverUrl(credentials.serverUrl),
        roomName,
        participantIdentity,
        token,
        ttlSeconds,
        connectionGeneration: positiveGeneration(request.connectionGeneration),
        role: request.role,
      });
    },
  });
}
