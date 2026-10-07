import { createHmac } from "node:crypto";

export interface TalkAiRuntimeDispatch {
  readonly tenantId: string;
  readonly talkId: string;
  readonly seatId: string;
  readonly personaId: string;
  readonly kind: "expert" | "twin";
}

export interface TalkAiRuntimeDispatcher {
  dispatch(input: TalkAiRuntimeDispatch): Promise<void>;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function roomAdminToken(input: {
  apiKey: string;
  apiSecret: string;
  room: string;
  now: Date;
}): string {
  const issued = Math.floor(input.now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: input.apiKey,
    iat: issued,
    nbf: issued - 5,
    exp: issued + 60,
    video: { roomAdmin: true, room: input.room },
  }));
  const signing = `${header}.${payload}`;
  const signature = createHmac("sha256", input.apiSecret)
    .update(signing, "utf8")
    .digest("base64url");
  return `${signing}.${signature}`;
}

function sameSeat(metadata: unknown, seatId: string): boolean {
  if (typeof metadata !== "string" || !metadata) return false;
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return Boolean(
      parsed &&
      typeof parsed === "object" &&
      "seatId" in parsed &&
      (parsed as { readonly seatId?: unknown }).seatId === seatId,
    );
  } catch {
    return false;
  }
}

export function createLiveKitTalkAiRuntimeDispatcher(input: Readonly<{
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  agentName?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}>): TalkAiRuntimeDispatcher {
  const url = input.serverUrl.trim()
    .replace(/^wss:/u, "https:")
    .replace(/^ws:/u, "http:")
    .replace(/\/$/u, "");
  const apiKey = input.apiKey.trim();
  const apiSecret = input.apiSecret.trim();
  const agentName = input.agentName?.trim() || "masanawa-talk-ai";
  if (!/^https?:\/\//u.test(url)) throw new TypeError("LiveKit server URL is invalid");
  if (!apiKey || apiSecret.length < 16) {
    throw new TypeError("LiveKit dispatch credentials are invalid");
  }
  if (!agentName || agentName.length > 128) {
    throw new TypeError("LiveKit agent name is invalid");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  async function call(
    method: "ListDispatch" | "CreateDispatch",
    room: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const response = await fetchImpl(
      `${url}/twirp/livekit.AgentDispatchService/${method}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${roomAdminToken({
            apiKey,
            apiSecret,
            room,
            now: now(),
          })}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(`talks.ai_dispatch_${method.toLowerCase()}_failed`);
    }
    return response.json();
  }

  return Object.freeze({
    async dispatch(request) {
      const metadata = JSON.stringify({
        schemaVersion: 1,
        tenantId: request.tenantId,
        talkId: request.talkId,
        seatId: request.seatId,
        personaId: request.personaId,
        kind: request.kind,
      });
      const listed = await call("ListDispatch", request.talkId, {
        room: request.talkId,
      }) as {
        readonly agent_dispatches?: readonly {
          readonly agent_name?: unknown;
          readonly metadata?: unknown;
        }[];
        readonly agentDispatches?: readonly {
          readonly agentName?: unknown;
          readonly metadata?: unknown;
        }[];
      };
      const dispatches = listed.agent_dispatches ?? listed.agentDispatches ?? [];
      if (
        dispatches.some((item) => {
          const name = "agent_name" in item ? item.agent_name : item.agentName;
          return name === agentName && sameSeat(item.metadata, request.seatId);
        })
      ) {
        return;
      }
      await call("CreateDispatch", request.talkId, {
        room: request.talkId,
        agent_name: agentName,
        metadata,
      });
    },
  });
}
