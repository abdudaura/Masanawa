import { createHmac } from "node:crypto";
import type { HumanCallRoomRevoker } from "./livekit_media.js";

/**
 * LiveKit RoomService DeleteRoom uses authenticated Twirp (not a browser SDK).
 * No extra dependency and no client-side privileged grants. This terminates
 * already-joined media, which an expired participant JWT cannot do.
 *
 * Docs: https://docs.livekit.io/reference/other/roomservice-api/
 */
export function createLiveKitHumanCallRoomRevoker(input: {
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}): HumanCallRoomRevoker {
  let origin: URL;
  try {
    origin = new URL(input.serverUrl);
  } catch {
    throw new TypeError("LiveKit URL is invalid");
  }
  if (origin.protocol !== "wss:" ||
      origin.username || origin.password || origin.search || origin.hash ||
      origin.pathname !== "/") {
    throw new TypeError("LiveKit private call revoker requires a clean wss:// origin");
  }
  const apiKey = input.apiKey.trim();
  const secret = input.apiSecret;
  if (!apiKey || secret.length < 16) {
    throw new TypeError("LiveKit room revoker credentials unavailable");
  }
  const timeoutMs = input.timeoutMs ?? 5000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 15000) {
    throw new TypeError("Invalid LiveKit room-revocation timeout");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const endpoint = `https://${origin.host}/twirp/livekit.RoomService/DeleteRoom`;
  function jwt(room: string): string {
    const seconds = Math.floor(now().getTime() / 1000);
    const header = Buffer.from(JSON.stringify({
      alg: "HS256", typ: "JWT",
    })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: apiKey, sub: "c09-room-revoker", iat: seconds,
      nbf: seconds - 5, exp: seconds + 30,
      video: { roomCreate: true, room },
    })).toString("base64url");
    const signed = `${header}.${payload}`;
    const signature = createHmac("sha256", secret)
      .update(signed, "utf8").digest("base64url");
    return `${signed}.${signature}`;
  }
  return Object.freeze({
    async closeRoom(room: string): Promise<void> {
      if (!/^human-call_[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(room)) {
        throw new TypeError("Invalid private human-call room identifier");
      }
      // Only room identity enters the body. No phone, user, email, DM text,
      // participant token or platform bearer is transmitted or logged.
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt(room)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return;
      // An already-deleted room is an idempotent success. Distinguish a
      // Twirp room-not-found response from a misconfigured endpoint's 404.
      if (response.status === 404) {
        try {
          const data: unknown = await response.json();
          if (data && typeof data === "object" && "code" in data &&
              data.code === "not_found") return;
        } catch {
          // Unknown 404 is not safe to classify as a completed disconnect.
        }
      }
      // Never include the provider response body, Authorization or URL
      // (which may reveal deployment details) in propagated application errors.
      throw new Error("Private call room termination unconfirmed");
    },
  });
}
