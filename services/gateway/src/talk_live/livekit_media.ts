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
  fetchImpl?: typeof fetch;
}>): TalkMediaTokenIssuer {
  const serverUrl = input.serverUrl.trim();
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  if (!/^wss:\/\//u.test(serverUrl)) throw new TypeError("LIVEKIT_URL must use wss://");
  if (!apiKey) throw new TypeError("LIVEKIT_API_KEY is required");
  if (apiSecret.length < 16) throw new TypeError("LIVEKIT_API_SECRET is too short");

  const now = input.now ?? (() => new Date());
  const fetchImpl = input.fetchImpl ?? fetch;
  const adminUrl = new URL(serverUrl);
  adminUrl.protocol = "https:";
  // Do not inherit a path from LIVEKIT_URL: Twirp is rooted at the origin.
  const adminOrigin = adminUrl.origin;
  const ttlSeconds = input.ttlSeconds ?? 30;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) {
    throw new TypeError("LiveKit token TTL must be between 30 and 900 seconds");
  }

  // LiveKit connection permission cannot be revoked by changing a database
  // lease alone. On Host handover, evict the former connected identity before
  // the successor receives credentials. LiveKit Cloud additionally revokes
  // tokens with revoke_token_ts; self-hosted tokens expire after the short TTL.
  async function roomAdminCall(
    method: "ListParticipants" | "RemoveParticipant",
    room: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<Response> {
    const issued = Math.floor(now().getTime() / 1000);
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({
      iss: apiKey,
      iat: issued,
      nbf: issued - 5,
      exp: issued + 60,
      video: { roomAdmin: true, room },
    }));
    const signing = `${header}.${payload}`;
    const token = `${signing}.${signHs256(apiSecret, signing)}`;
    try {
      return await fetchImpl(`${adminOrigin}/twirp/livekit.RoomService/${method}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Network and abort errors are retriable dependencies, not application
      // bugs or JWT signing failures; never surface provider response details.
      const operation = method === "ListParticipants" ? "list" : "remove";
      throw new Error(`talks.live.media_admin_${operation}_failed`);
    }
  }

  async function evictPreviousHostSessions(request: Readonly<{
    talkId: string;
    userId: string;
    sessionId: string;
  }>): Promise<void> {
    const list = await roomAdminCall("ListParticipants", request.talkId, {
      room: request.talkId,
    });
    if (!list.ok) {
      // A brand-new Talk may not yet have a LiveKit room. Other failures must
      // not silently yield a credential while old Host tracks remain audible.
      if (list.status === 404) {
        const missing = await list.json().catch(() => null) as
          | { code?: unknown; msg?: unknown }
          | null;
        if (missing?.code === "not_found" &&
            typeof missing.msg === "string" &&
            /room/i.test(missing.msg)) return;
      }
      throw new Error("talks.live.media_admin_list_failed");
    }
    const decoded: unknown = await list.json().catch(() => {
      throw new Error("talks.live.media_admin_invalid_participants");
    });
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("talks.live.media_admin_invalid_participants");
    }
    // Protobuf JSON may omit empty repeated fields rather than emit [].
    const participants = "participants" in decoded
      ? decoded.participants
      : [];
    if (!Array.isArray(participants)) {
      throw new Error("talks.live.media_admin_invalid_participants");
    }
    const prefix = `${request.userId}:talk-live_`;
    const currentIdentity = `${request.userId}:${request.sessionId}`;
    const previous = new Set<string>();
    for (const item of participants) {
      if (!item || typeof item !== "object" ||
          typeof item.identity !== "string") {
        throw new Error("talks.live.media_admin_invalid_participants");
      }
      const identity = item.identity as string;
      if (identity.startsWith(prefix) && identity !== currentIdentity) {
        previous.add(identity);
      }
    }
    for (const identity of previous) {
      const removed = await roomAdminCall("RemoveParticipant", request.talkId, {
        room: request.talkId,
        identity,
        // LiveKit Cloud uses milliseconds; omit no-ops only for an absent
        // participant, which can race with its own network teardown.
        revoke_token_ts: now().getTime(),
      });
      if (!removed.ok) {
        if (removed.status === 404) {
          const missing = await removed.json().catch(() => null) as
            | { code?: unknown; msg?: unknown }
            | null;
          if (missing?.code === "not_found" &&
              typeof missing.msg === "string" &&
              /participant/i.test(missing.msg)) continue;
        }
        throw new Error("talks.live.media_admin_remove_failed");
      }
    }
  }

  return Object.freeze<TalkMediaTokenIssuer>({
    async mint(request) {
      if (request.role === "host") {
        await evictPreviousHostSessions(request);
      }
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

