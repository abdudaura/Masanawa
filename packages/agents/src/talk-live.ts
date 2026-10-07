import { toInstant, type Instant, type TenantId, type UserId } from "@masanawa/contracts";

export type TalkId = string & { readonly __talkId: unique symbol };
export type TalkSeatId = string & { readonly __talkSeatId: unique symbol };
export type TalkPersonaId = string & { readonly __talkPersonaId: unique symbol };

export type TalkSeatKind = "human" | "expert" | "twin";
export type TalkSeatRole = "host" | "speaker";
export type TalkLiveState = "live" | "host_reconnecting" | "ended";
export type TalkAiTurnState = "enabled" | "paused";
export type TalkLiveEndReason = "host_grace_expired" | "host_ended" | "platform_ended";

export interface TalkLivePolicy {
  readonly maxActiveSeats: number;
  readonly maxAiSeats: number;
  readonly hostReconnectGraceMs: number;
}

export const launchTalkLivePolicy: TalkLivePolicy = Object.freeze({
  maxActiveSeats: 6,
  maxAiSeats: 3,
  hostReconnectGraceMs: 30_000,
});

interface TalkSeatBase {
  readonly seatId: TalkSeatId;
  readonly kind: TalkSeatKind;
  readonly role: TalkSeatRole;
  readonly connected: boolean;
  readonly admittedAt: Instant;
}

export interface HumanTalkSeat extends TalkSeatBase {
  readonly kind: "human";
  readonly userId: UserId;
}

export interface AiTalkSeat extends TalkSeatBase {
  readonly kind: "expert" | "twin";
  readonly role: "speaker";
  readonly personaId: TalkPersonaId;
  /**
   * Opaque evidence from the higher Commerce/admission authority.
   * The live runtime never charges, releases, refunds, or settles it.
   */
  readonly commercialAuthorizationId: string;
}

export type TalkSeat = HumanTalkSeat | AiTalkSeat;

export interface TalkLiveSession {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly hostUserId: UserId;
  readonly hostSeatId: TalkSeatId;
  readonly state: TalkLiveState;
  readonly aiTurns: TalkAiTurnState;
  readonly seats: readonly TalkSeat[];
  readonly revision: number;
  readonly startedAt: Instant;
  readonly updatedAt: Instant;
  readonly hostReconnectDeadline: Instant | null;
  readonly endedAt: Instant | null;
  readonly endReason: TalkLiveEndReason | null;
}

export interface CreateTalkLiveSessionInput {
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly hostUserId: UserId;
  readonly hostSeatId: TalkSeatId;
  readonly startedAt: Instant;
}

export type TalkLiveCommand =
  | { readonly type: "host_disconnected"; readonly expectedRevision: number }
  | { readonly type: "host_reconnected"; readonly expectedRevision: number }
  | { readonly type: "host_grace_expired"; readonly expectedRevision: number }
  | {
      readonly type: "human_seat_admitted";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
      readonly userId: UserId;
    }
  | {
      readonly type: "ai_seat_admitted";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
      readonly kind: "expert" | "twin";
      readonly personaId: TalkPersonaId;
      readonly commercialAuthorizationId: string;
    }
  | {
      readonly type: "seat_removed";
      readonly expectedRevision: number;
      readonly seatId: TalkSeatId;
    }
  | {
      readonly type: "ended";
      readonly expectedRevision: number;
      readonly reason: "host_ended" | "platform_ended";
    };

export type TalkLiveEventType =
  | "host_disconnected"
  | "host_reconnected"
  | "host_grace_expired"
  | "human_seat_admitted"
  | "ai_seat_admitted"
  | "seat_removed"
  | "ended";

export interface TalkLiveEvent {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly talkId: TalkId;
  readonly type: TalkLiveEventType;
  readonly revision: number;
  readonly occurredAt: Instant;
  readonly seatId?: TalkSeatId;
}

export interface TalkLiveTransition {
  readonly session: TalkLiveSession;
  readonly event: TalkLiveEvent;
}

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must be non-empty`);
  return normalized;
}

function assertPolicy(policy: TalkLivePolicy): void {
  if (!Number.isSafeInteger(policy.maxActiveSeats) || policy.maxActiveSeats < 1) {
    throw new RangeError("Talk live maxActiveSeats must be a positive integer");
  }
  if (!Number.isSafeInteger(policy.maxAiSeats) || policy.maxAiSeats < 0 || policy.maxAiSeats >= policy.maxActiveSeats) {
    throw new RangeError("Talk live maxAiSeats must be non-negative and below total capacity");
  }
  if (!Number.isSafeInteger(policy.hostReconnectGraceMs) || policy.hostReconnectGraceMs < 1) {
    throw new RangeError("Talk host reconnect grace must be positive");
  }
}

function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Talk live revision is invalid");
  }
}

function instantAfter(base: Instant, milliseconds: number): Instant {
  return toInstant(new Date(Date.parse(base) + milliseconds).toISOString());
}

function hostSeat(session: TalkLiveSession): HumanTalkSeat {
  const seat = session.seats.find((candidate) => candidate.seatId === session.hostSeatId);
  if (!seat || seat.kind !== "human" || seat.role !== "host" || seat.userId !== session.hostUserId) {
    throw new TypeError("Talk live session must contain exactly one matching human Host seat");
  }
  return seat;
}

function assertSeatSet(session: TalkLiveSession, policy: TalkLivePolicy): void {
  if (session.seats.length < 1 || session.seats.length > policy.maxActiveSeats) {
    throw new RangeError("Talk live active Seat count violates policy");
  }
  if (new Set(session.seats.map((seat) => seat.seatId)).size !== session.seats.length) {
    throw new TypeError("Talk live Seat identifiers must be unique");
  }
  if (session.seats.filter((seat) => seat.role === "host").length !== 1) {
    throw new TypeError("Talk live session requires exactly one Host seat");
  }
  hostSeat(session);
  const aiSeats = session.seats.filter((seat) => seat.kind !== "human");
  if (aiSeats.length > policy.maxAiSeats) throw new RangeError("Talk live AI Seat count violates policy");
  for (const seat of aiSeats) {
    if (seat.role !== "speaker") throw new TypeError("AI cannot occupy the human Host role");
    requireNonEmpty(seat.commercialAuthorizationId, "AI Seat commercial authorization");
  }
}

export function createTalkLiveSession(
  input: CreateTalkLiveSessionInput,
  policy: TalkLivePolicy = launchTalkLivePolicy,
): TalkLiveSession {
  assertPolicy(policy);
  requireNonEmpty(input.talkId, "Talk id");
  requireNonEmpty(input.hostSeatId, "Host Seat id");
  const startedAt = toInstant(input.startedAt);
  const host: HumanTalkSeat = Object.freeze({
    seatId: input.hostSeatId,
    kind: "human",
    role: "host",
    connected: true,
    userId: input.hostUserId,
    admittedAt: startedAt,
  });
  const session: TalkLiveSession = Object.freeze({
    schemaVersion: 1,
    tenantId: input.tenantId,
    talkId: input.talkId,
    hostUserId: input.hostUserId,
    hostSeatId: input.hostSeatId,
    state: "live",
    aiTurns: "enabled",
    seats: Object.freeze([host]),
    revision: 1,
    startedAt,
    updatedAt: startedAt,
    hostReconnectDeadline: null,
    endedAt: null,
    endReason: null,
  });
  assertTalkLiveSession(session, policy);
  return session;
}

export function assertTalkLiveSession(
  session: TalkLiveSession,
  policy: TalkLivePolicy = launchTalkLivePolicy,
): void {
  assertPolicy(policy);
  if (session.schemaVersion !== 1) throw new TypeError("Unsupported Talk live schema");
  requireNonEmpty(session.talkId, "Talk id");
  assertRevision(session.revision);
  const startedAt = toInstant(session.startedAt);
  const updatedAt = toInstant(session.updatedAt);
  if (updatedAt < startedAt) throw new TypeError("Talk live timestamps are inconsistent");
  assertSeatSet(session, policy);
  const host = hostSeat(session);

  if (session.state === "live") {
    if (!host.connected || session.aiTurns !== "enabled" || session.hostReconnectDeadline !== null ||
        session.endedAt !== null || session.endReason !== null) {
      throw new TypeError("Live Talk state requires a connected human Host and enabled AI turns");
    }
    return;
  }

  if (session.state === "host_reconnecting") {
    if (host.connected || session.aiTurns !== "paused" || session.hostReconnectDeadline === null ||
        toInstant(session.hostReconnectDeadline) <= updatedAt || session.endedAt !== null || session.endReason !== null) {
      throw new TypeError("Host reconnecting state is inconsistent");
    }
    return;
  }

  if (session.state !== "ended" || session.aiTurns !== "paused" || session.hostReconnectDeadline !== null ||
      session.endedAt === null || toInstant(session.endedAt) !== updatedAt || session.endReason === null) {
    throw new TypeError("Ended Talk state is inconsistent");
  }
}

function event(
  session: TalkLiveSession,
  type: TalkLiveEvent["type"],
  at: Instant,
  seatId?: TalkSeatId,
): TalkLiveEvent {
  return Object.freeze({
    schemaVersion: 1 as const,
    tenantId: session.tenantId,
    talkId: session.talkId,
    type,
    revision: session.revision,
    occurredAt: at,
    ...(seatId === undefined ? {} : { seatId }),
  });
}

function withSeatConnection(
  session: TalkLiveSession,
  seatId: TalkSeatId,
  connected: boolean,
): readonly TalkSeat[] {
  return Object.freeze(session.seats.map((seat) =>
    seat.seatId === seatId ? Object.freeze({ ...seat, connected }) as TalkSeat : seat,
  ));
}

function next(
  previous: TalkLiveSession,
  patch: Omit<Partial<TalkLiveSession>, "revision" | "updatedAt">,
  at: Instant,
  policy: TalkLivePolicy,
): TalkLiveSession {
  const candidate = Object.freeze({
    ...previous,
    ...patch,
    revision: previous.revision + 1,
    updatedAt: at,
  }) as TalkLiveSession;
  assertTalkLiveSession(candidate, policy);
  return candidate;
}

export function transitionTalkLiveSession(
  session: TalkLiveSession,
  command: TalkLiveCommand,
  atInput: Instant,
  policy: TalkLivePolicy = launchTalkLivePolicy,
): TalkLiveTransition {
  assertTalkLiveSession(session, policy);
  if (command.expectedRevision !== session.revision) throw new Error("Talk live revision conflict");
  if (session.state === "ended") throw new Error("Ended Talk cannot transition");
  const at = toInstant(atInput);
  if (at < session.updatedAt) throw new TypeError("Talk live transition time cannot move backwards");

  switch (command.type) {
    case "host_disconnected": {
      if (session.state !== "live") throw new Error("Host is already reconnecting");
      const updated = next(session, {
        state: "host_reconnecting",
        aiTurns: "paused",
        seats: withSeatConnection(session, session.hostSeatId, false),
        hostReconnectDeadline: instantAfter(at, policy.hostReconnectGraceMs),
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "host_disconnected", at, session.hostSeatId) });
    }
    case "host_reconnected": {
      if (session.state !== "host_reconnecting" || session.hostReconnectDeadline === null) {
        throw new Error("Host is not awaiting reconnection");
      }
      if (at >= session.hostReconnectDeadline) throw new Error("Host reconnect grace has expired");
      const updated = next(session, {
        state: "live",
        aiTurns: "enabled",
        seats: withSeatConnection(session, session.hostSeatId, true),
        hostReconnectDeadline: null,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "host_reconnected", at, session.hostSeatId) });
    }
    case "host_grace_expired": {
      if (session.state !== "host_reconnecting" || session.hostReconnectDeadline === null) {
        throw new Error("Host grace expiry is not applicable");
      }
      if (at < session.hostReconnectDeadline) throw new Error("Host reconnect grace has not expired");
      const updated = next(session, {
        state: "ended",
        aiTurns: "paused",
        hostReconnectDeadline: null,
        endedAt: at,
        endReason: "host_grace_expired",
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "host_grace_expired", at, session.hostSeatId) });
    }
    case "human_seat_admitted": {
      if (session.state !== "live") throw new Error("Seats cannot be admitted while Host is absent");
      if (session.seats.length >= policy.maxActiveSeats) throw new RangeError("Talk live Seat capacity reached");
      if (session.seats.some((seat) => seat.seatId === command.seatId)) throw new Error("Seat already exists");
      if (command.userId === session.hostUserId) throw new Error("Host cannot occupy a second Seat");
      const seat: HumanTalkSeat = Object.freeze({
        seatId: command.seatId,
        kind: "human",
        role: "speaker",
        connected: true,
        userId: command.userId,
        admittedAt: at,
      });
      const updated = next(session, { seats: Object.freeze([...session.seats, seat]) }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "human_seat_admitted", at, command.seatId) });
    }
    case "ai_seat_admitted": {
      if (session.state !== "live") throw new Error("AI Seats cannot be admitted while Host is absent");
      if (session.seats.length >= policy.maxActiveSeats) throw new RangeError("Talk live Seat capacity reached");
      if (session.seats.filter((seat) => seat.kind !== "human").length >= policy.maxAiSeats) {
        throw new RangeError("Talk live AI Seat capacity reached");
      }
      if (session.seats.some((seat) => seat.seatId === command.seatId)) throw new Error("Seat already exists");
      const seat: AiTalkSeat = Object.freeze({
        seatId: command.seatId,
        kind: command.kind,
        role: "speaker",
        connected: true,
        personaId: command.personaId,
        commercialAuthorizationId: requireNonEmpty(
          command.commercialAuthorizationId,
          "AI Seat commercial authorization",
        ),
        admittedAt: at,
      });
      const updated = next(session, { seats: Object.freeze([...session.seats, seat]) }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "ai_seat_admitted", at, command.seatId) });
    }
    case "seat_removed": {
      if (command.seatId === session.hostSeatId) throw new Error("Host Seat cannot be removed from a live Talk");
      if (!session.seats.some((seat) => seat.seatId === command.seatId)) throw new Error("Seat does not exist");
      const updated = next(session, {
        seats: Object.freeze(session.seats.filter((seat) => seat.seatId !== command.seatId)),
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "seat_removed", at, command.seatId) });
    }
    case "ended": {
      const updated = next(session, {
        state: "ended",
        aiTurns: "paused",
        hostReconnectDeadline: null,
        endedAt: at,
        endReason: command.reason,
      }, at, policy);
      return Object.freeze({ session: updated, event: event(updated, "ended", at) });
    }
  }
}

export function isPublicAudioBroadcastAllowed(session: TalkLiveSession): boolean {
  assertTalkLiveSession(session);
  return session.state === "live" && hostSeat(session).connected;
}

export function assertAiAudioTurnAllowed(session: TalkLiveSession): void {
  assertTalkLiveSession(session);
  if (!isPublicAudioBroadcastAllowed(session) || session.aiTurns !== "enabled") {
    throw new Error("AI audio turn is paused until the human Host is present");
  }
}

export function assertSeatAudioFrameAllowed(session: TalkLiveSession, seatId: TalkSeatId): void {
  assertTalkLiveSession(session);
  if (!isPublicAudioBroadcastAllowed(session)) {
    throw new Error("Public Talk audio is paused while Host is absent");
  }
  const seat = session.seats.find((candidate) => candidate.seatId === seatId);
  if (!seat || !seat.connected) throw new Error("Seat is not connected to this live Talk");
}
