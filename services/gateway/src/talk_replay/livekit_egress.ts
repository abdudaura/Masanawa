import { createHmac } from "node:crypto";

export type ReplayEgressStatus =
  | "starting"
  | "active"
  | "ending"
  | "complete"
  | "failed"
  | "aborted"
  | "limit_reached";

export interface ReplayEgressInfo {
  readonly egressId: string;
  readonly status: ReplayEgressStatus;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly error: string | null;
}

export interface TalkReplayEgress {
  start(input: Readonly<{
    talkId: string;
    objectKey: string;
  }>): Promise<ReplayEgressInfo>;
  stop(input: Readonly<{ egressId: string }>): Promise<ReplayEgressInfo>;
  inspect(input: Readonly<{ egressId: string }>): Promise<ReplayEgressInfo | null>;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function token(input: Readonly<{
  apiKey: string;
  apiSecret: string;
  now: Date;
}>): string {
  const issued = Math.floor(input.now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: input.apiKey,
      iat: issued,
      nbf: issued - 5,
      exp: issued + 60,
      video: { roomRecord: true },
    }),
  );
  const signing = `${header}.${payload}`;
  const signature = createHmac("sha256", input.apiSecret)
    .update(signing, "utf8")
    .digest("base64url");
  return `${signing}.${signature}`;
}

function epochNanos(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // LiveKit Egress timestamps are nanoseconds since Unix epoch.
  return new Date(Math.floor(numeric / 1_000_000)).toISOString();
}

function status(value: unknown): ReplayEgressStatus {
  if (typeof value === "number") {
    return (
      [
        "starting",
        "active",
        "ending",
        "complete",
        "failed",
        "aborted",
        "limit_reached",
      ] as const
    )[value] ?? "failed";
  }
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "EGRESS_STARTING":
    case "STARTING":
      return "starting";
    case "EGRESS_ACTIVE":
    case "ACTIVE":
      return "active";
    case "EGRESS_ENDING":
    case "ENDING":
      return "ending";
    case "EGRESS_COMPLETE":
    case "COMPLETE":
      return "complete";
    case "EGRESS_FAILED":
    case "FAILED":
      return "failed";
    case "EGRESS_ABORTED":
    case "ABORTED":
      return "aborted";
    case "EGRESS_LIMIT_REACHED":
    case "LIMIT_REACHED":
      return "limit_reached";
    default:
      return "failed";
  }
}

function mapInfo(value: unknown): ReplayEgressInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("talks.replay_egress_invalid_response");
  }
  const row = value as Record<string, unknown>;
  const egressId =
    typeof row.egress_id === "string"
      ? row.egress_id
      : typeof row.egressId === "string"
        ? row.egressId
        : "";
  if (!egressId) throw new Error("talks.replay_egress_invalid_response");
  const error =
    typeof row.error === "string" && row.error.trim()
      ? row.error.trim().slice(0, 500)
      : null;
  return Object.freeze({
    egressId,
    status: status(row.status),
    startedAt: epochNanos(row.started_at ?? row.startedAt),
    endedAt: epochNanos(row.ended_at ?? row.endedAt),
    error,
  });
}

export function createLiveKitTalkReplayEgress(input: Readonly<{
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  bucket: string;
  region: string;
  accessKey: string;
  secret: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): TalkReplayEgress {
  const url = input.serverUrl
    .trim()
    .replace(/^wss:/u, "https:")
    .replace(/^ws:/u, "http:")
    .replace(/\/$/u, "");
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  const bucket = input.bucket.trim();
  const region = input.region.trim();
  const accessKey = input.accessKey.trim();
  const secret = input.secret.trim();
  if (!/^https?:\/\//u.test(url)) {
    throw new TypeError("LiveKit replay server URL is invalid");
  }
  if (!apiKey || apiSecret.length < 16) {
    throw new TypeError("LiveKit replay credentials are invalid");
  }
  if (!bucket || !region || !accessKey || !secret) {
    throw new TypeError("Replay object storage configuration is incomplete");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  async function call(method: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetchImpl(`${url}/twirp/livekit.Egress/${method}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token({
          apiKey,
          apiSecret,
          now: now(),
        })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`talks.replay_egress_${method.toLowerCase()}_failed`);
    }
    return response.json();
  }

  return Object.freeze({
    async start(request) {
      const storage: Record<string, unknown> = {
        access_key: accessKey,
        secret,
        region,
        bucket,
        ...(input.endpoint?.trim()
          ? { endpoint: input.endpoint.trim() }
          : {}),
        ...(input.forcePathStyle === undefined
          ? {}
          : { force_path_style: input.forcePathStyle }),
      };
      const result = await call("StartEgress", {
        room_name: request.talkId,
        template: { audio_only: true },
        outputs: [
          {
            file: {
              file_type: "MP4",
              filepath: request.objectKey,
            },
          },
        ],
        storage: { s3: storage },
      });
      return mapInfo(result);
    },

    async stop(request) {
      return mapInfo(
        await call("StopEgress", { egress_id: request.egressId }),
      );
    },

    async inspect(request) {
      const result = await call("ListEgress", {
        egress_id: request.egressId,
      });
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("talks.replay_egress_invalid_response");
      }
      const row = result as Record<string, unknown>;
      const items = Array.isArray(row.items) ? row.items : [];
      if (items.length === 0) return null;
      return mapInfo(items[0]);
    },
  });
}
