import { createHmac } from "node:crypto";

export interface TalkMediaCredentials {
  readonly server_url: string;
  readonly participant_token: string;
  readonly room_name: string;
  readonly participant_identity: string;
  readonly expires_at: string;
}

export interface TalkMediaTokenIssuer {
  mint(input: Readonly<{
    talkId: string;
    sessionId: string;
    userId: string;
    role: "host" | "speaker" | "listener";
    canPublishAudio: boolean;
  }>): Promise<TalkMediaCredentials>;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signHs256(secret: string, signingInput: string): string {
  return createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("base64url");
}

export function createLiveKitTalkMediaTokenIssuer(input: Readonly<{
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  now?: () => Date;
  ttlSeconds?: number;
}>): TalkMediaTokenIssuer {
  const serverUrl = input.serverUrl.trim();
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  if (!/^wss:\/\//u.test(serverUrl)) throw new TypeError("LIVEKIT_URL must use wss://");
  if (!apiKey) throw new TypeError("LIVEKIT_API_KEY is required");
  if (apiSecret.length < 16) throw new TypeError("LIVEKIT_API_SECRET is too short");

  const now = input.now ?? (() => new Date());
  const ttlSeconds = input.ttlSeconds ?? 30;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) {
    throw new TypeError("LiveKit token TTL must be between 30 and 900 seconds");
  }

  return Object.freeze<TalkLiveMedia>({
    async mint(request) {
      const issued = Math.floor(now().getTime() / 1000);
      const expires = issued + ttlSeconds;
      const roomName = request.talkId;
      const identity = `${request.userId}:${request.sessionId}`;
      const header = { alg: "HS256", typ: "JWT" };
      const payload = {
        iss: apiKey,
        sub: identity,
        iat: issued,
        nbf: issued - 5,
        exp: expires,
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: request.role !== "listener" && request.canPublishAudio,
          canSubscribe: true,
          canPublishData: false,
          ...(request.role !== "listener" && request.canPublishAudio
            ? { canPublishSources: ["microphone"] }
            : {}),
        },
        metadata: JSON.stringify({
          talkId: request.talkId,
          sessionId: request.sessionId,
          role: request.role,
        }),
      };
      const encodedHeader = base64url(JSON.stringify(header));
      const encodedPayload = base64url(JSON.stringify(payload));
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const token = `${signingInput}.${signHs256(apiSecret, signingInput)}`;
      return Object.freeze({
        server_url: serverUrl,
        participant_token: token,
        room_name: roomName,
        participant_identity: identity,
        expires_at: new Date(expires * 1000).toISOString(),
      });
    },
  });
}
