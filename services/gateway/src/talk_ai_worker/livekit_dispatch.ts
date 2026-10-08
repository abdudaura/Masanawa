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

interface DispatchMetadata extends TalkAiRuntimeDispatch {
  readonly schemaVersion: 1;
}

interface RemoteDispatch {
  readonly id?: unknown;
  readonly agent_name?: unknown;
  readonly agentName?: unknown;
  readonly room?: unknown;
  readonly metadata?: unknown;
  readonly state?: unknown;
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

function normalizedId(value: string, name: string): string {
  if (typeof value !== "string") throw new TypeError(`talks.ai_dispatch_${name}_invalid`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160 || /\s/u.test(trimmed)) {
    throw new TypeError(`talks.ai_dispatch_${name}_invalid`);
  }
  return trimmed;
}

function identity(input: TalkAiRuntimeDispatch): DispatchMetadata {
  if (input.kind !== "expert" && input.kind !== "twin") {
    throw new TypeError("talks.ai_dispatch_kind_invalid");
  }
  return Object.freeze({
    schemaVersion: 1 as const,
    tenantId: normalizedId(input.tenantId, "tenant"),
    talkId: normalizedId(input.talkId, "talk"),
    seatId: normalizedId(input.seatId, "seat"),
    personaId: normalizedId(input.personaId, "persona"),
    kind: input.kind,
  });
}

function storedMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value || value.length > 8192) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function matches(meta: Record<string, unknown>, expected: DispatchMetadata): boolean {
  return meta.schemaVersion === expected.schemaVersion &&
    meta.tenantId === expected.tenantId &&
    meta.talkId === expected.talkId &&
    meta.seatId === expected.seatId &&
    meta.personaId === expected.personaId &&
    meta.kind === expected.kind;
}

function deleted(remote: RemoteDispatch): boolean {
  if (!remote.state || typeof remote.state !== "object") return false;
  const state = remote.state as Record<string, unknown>;
  const time = state.deleted_at ?? state.deletedAt;
  return typeof time === "number" ? time > 0 : typeof time === "string" && Number(time) > 0;
}

function remoteAgent(remote: RemoteDispatch): unknown {
  return remote.agent_name ?? remote.agentName;
}

function validateDispatchList(value: unknown): readonly RemoteDispatch[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("talks.ai_dispatch_list_invalid");
  }
  const payload = value as Record<string, unknown>;
  // Proto3 JSON omits an empty repeated field: {} is the normal, valid
  // response when a Talk has no existing AI dispatches yet.
  const present = "agent_dispatches" in payload || "agentDispatches" in payload;
  if (!present) return [];
  const list = payload.agent_dispatches ?? payload.agentDispatches;
  if (!Array.isArray(list) || list.length > 128 ||
      list.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("talks.ai_dispatch_list_invalid");
  }
  return list as readonly RemoteDispatch[];
}

function currentSeatDispatch(
  list: readonly RemoteDispatch[],
  expected: DispatchMetadata,
  agentName: string,
): boolean {
  let found = false;
  for (const remote of list) {
    if (deleted(remote)) continue;
    const meta = storedMetadata(remote.metadata);
    if (meta?.seatId !== expected.seatId) continue;
    // Matching the Seat ID alone is unsafe. An old persona, another tenant,
    // different Talk or worker would speak under the wrong AI identity.
    if (!matches(meta, expected) || remoteAgent(remote) !== agentName ||
        (remote.room !== undefined && remote.room !== expected.talkId) || found) {
      throw new Error("talks.ai_dispatch_identity_conflict");
    }
    found = true;
  }
  return found;
}

/**
 * Uses LiveKit AgentDispatchService's exact room+agent+metadata contract.
 * A process-level Seat lock coalesces concurrent identical requests and
 * refuses simultaneous reassignment. Cross-process serialization remains the
 * canonical admitted Seat transaction's responsibility.
 */
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
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(agentName)) {
    throw new TypeError("LiveKit agent name is invalid");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());
  const pendingSeats = new Map<string, { metadata: DispatchMetadata; promise: Promise<void> }>();
  // A timed-out CreateDispatch might already be running remotely. Without a
  // provider idempotency key, blind retries can create two audible AI jobs.
  // An unresolved Seat must be read-only until LiveKit confirms its identity.
  // Bounded state is intentionally fail-closed; durable cross-process recovery
  // requires a persistent admission/dispatch reconciliation job.
  const uncertainSeats = new Map<string, DispatchMetadata>();
  const MAX_UNCERTAIN_SEATS = 4096;

  async function call(
    method: "ListDispatch" | "CreateDispatch",
    room: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    const operation = method.toLowerCase();
    let response: Response;
    try {
      response = await fetchImpl(
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
    } catch {
      // Network failure can occur after the server accepted CreateDispatch.
      // Never copy provider exception text that might contain credentials.
      throw new Error(`talks.ai_dispatch_${operation}_unconfirmed`);
    }
    if (!response.ok) {
      throw new Error(`talks.ai_dispatch_${operation}_failed`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`talks.ai_dispatch_${operation}_invalid_response`);
    }
  }

  async function dispatchOnce(request: DispatchMetadata, key: string): Promise<void> {
    const list = validateDispatchList(
      await call("ListDispatch", request.talkId, { room: request.talkId }),
    );
    if (currentSeatDispatch(list, request, agentName)) {
      uncertainSeats.delete(key);
      return;
    }
    if (uncertainSeats.has(key)) {
      // A missing dispatch may still materialize after Create timed out.
      // Another attempt must not create a second speaker for a paid Seat.
      throw new Error("talks.ai_dispatch_createdispatch_unconfirmed");
    }
    if (uncertainSeats.size >= MAX_UNCERTAIN_SEATS) {
      throw new Error("talks.ai_dispatch_reconciliation_capacity");
    }
    let created: unknown;
    try {
      created = await call("CreateDispatch", request.talkId, {
        room: request.talkId,
        agent_name: agentName,
        metadata: JSON.stringify(request),
      });
    } catch {
      uncertainSeats.set(key, request);
      throw new Error("talks.ai_dispatch_createdispatch_unconfirmed");
    }
    if (created === null || typeof created !== "object" || Array.isArray(created)) {
      uncertainSeats.set(key, request);
      throw new Error("talks.ai_dispatch_create_invalid");
    }
    const remote = created as RemoteDispatch;
    if (typeof remote.id !== "string" || !remote.id ||
        (remote.metadata !== undefined &&
          !matches(storedMetadata(remote.metadata) ?? {}, request)) ||
        (remoteAgent(remote) !== undefined && remoteAgent(remote) !== agentName) ||
        (remote.room !== undefined && remote.room !== request.talkId)) {
      uncertainSeats.set(key, request);
      throw new Error("talks.ai_dispatch_create_invalid");
    }
  }

  return Object.freeze<TalkAiRuntimeDispatcher>({
    async dispatch(raw) {
      const request = identity(raw);
      const key = JSON.stringify([request.tenantId, request.talkId, request.seatId]);
      const uncertain = uncertainSeats.get(key);
      if (uncertain && !matches({...uncertain}, request)) {
        throw new Error("talks.ai_dispatch_identity_conflict");
      }
      const existing = pendingSeats.get(key);
      if (existing) {
        if (!matches({...existing.metadata}, request)) {
          throw new Error("talks.ai_dispatch_identity_conflict");
        }
        return existing.promise;
      }
      const promise = dispatchOnce(request, key);
      pendingSeats.set(key, { metadata: request, promise });
      try {
        await promise;
      } finally {
        if (pendingSeats.get(key)?.promise === promise) pendingSeats.delete(key);
      }
    },
  });
}

