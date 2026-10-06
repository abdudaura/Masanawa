import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type CharacterSessionId,
  type Instant,
  type PresenceSessionId,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  isCharacterSessionOpen,
  normalizeCharacterSession,
  type CharacterSession,
} from "@masanawa/agents";

export const presenceSessionModes = ["audio", "audio-video"] as const;
export type PresenceSessionMode = (typeof presenceSessionModes)[number];

export const presenceSessionStates = ["admitted", "active", "closed"] as const;
export type PresenceSessionState = (typeof presenceSessionStates)[number];

export const presenceCloseReasons = [
  "ended",
  "disconnected",
  "superseded",
  "character-session-closed",
] as const;
export type PresenceCloseReason = (typeof presenceCloseReasons)[number];

export interface PresenceSession {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly presenceSessionId: PresenceSessionId;
  readonly characterSessionId: CharacterSessionId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
  readonly mode: PresenceSessionMode;
  readonly state: PresenceSessionState;
  readonly revision: number;
  readonly connectionGeneration: number;
  readonly admittedAt: Instant;
  readonly activatedAt: Instant | null;
  readonly lastConnectedAt: Instant | null;
  readonly updatedAt: Instant;
  readonly closedAt: Instant | null;
  readonly closeReason: PresenceCloseReason | null;
}

export interface CharacterSessionPresenceBindingPlan {
  readonly tenantId: TenantId;
  readonly characterSessionId: CharacterSessionId;
  readonly presenceSessionId: PresenceSessionId;
  readonly expectedCharacterSessionRevision: number;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function positiveRevision(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function nonNegativeGeneration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("connectionGeneration must be a non-negative safe integer");
  }
  return value;
}

function mode(value: PresenceSessionMode): PresenceSessionMode {
  if (value !== "audio" && value !== "audio-video") {
    throw new TypeError("PresenceSession mode is invalid");
  }
  return value;
}

function assertCharacterSessionCanBind(
  characterSession: CharacterSession,
  presenceSessionId: PresenceSessionId,
  at: Instant,
): CharacterSession {
  const session = normalizeCharacterSession(characterSession);
  if (!isCharacterSessionOpen(session, at)) {
    throw conflict(
      "presence.character_session_unavailable",
      "CharacterSession is not active for Presence admission",
    );
  }
  if (
    session.bindings.presenceSessionId !== null &&
    session.bindings.presenceSessionId !== presenceSessionId
  ) {
    throw conflict(
      "presence.character_session_already_bound",
      "CharacterSession is already bound to another PresenceSession",
    );
  }
  return session;
}

export function admitPresenceSession(input: {
  readonly presenceSessionId: PresenceSessionId;
  readonly characterSession: CharacterSession;
  readonly mode: PresenceSessionMode;
  readonly admittedAt: Instant;
}): {
  readonly session: PresenceSession;
  readonly characterBinding: CharacterSessionPresenceBindingPlan;
} {
  const admittedAt = toInstant(input.admittedAt);
  const presenceSessionId = parseCanonicalId(
    "presence-session",
    input.presenceSessionId,
  );
  const characterSession = assertCharacterSessionCanBind(
    input.characterSession,
    presenceSessionId,
    admittedAt,
  );

  const session = Object.freeze<PresenceSession>({
    schemaVersion: 1,
    tenantId: characterSession.tenantId,
    presenceSessionId,
    characterSessionId: characterSession.characterSessionId,
    userId: characterSession.userId,
    characterId: characterSession.characterId,
    relationshipId: characterSession.relationshipId,
    mode: mode(input.mode),
    state: "admitted",
    revision: 1,
    connectionGeneration: 0,
    admittedAt,
    activatedAt: null,
    lastConnectedAt: null,
    updatedAt: admittedAt,
    closedAt: null,
    closeReason: null,
  });

  return Object.freeze({
    session,
    characterBinding: Object.freeze({
      tenantId: characterSession.tenantId,
      characterSessionId: characterSession.characterSessionId,
      presenceSessionId,
      expectedCharacterSessionRevision: characterSession.revision,
    }),
  });
}

export function assertPresenceCharacterSessionBridge(input: {
  readonly presenceSession: PresenceSession;
  readonly characterSession: CharacterSession;
  readonly at: Instant;
}): void {
  const characterSession = assertCharacterSessionCanBind(
    input.characterSession,
    input.presenceSession.presenceSessionId,
    toInstant(input.at),
  );
  const presence = input.presenceSession;
  if (
    presence.tenantId !== characterSession.tenantId ||
    presence.characterSessionId !== characterSession.characterSessionId ||
    presence.userId !== characterSession.userId ||
    presence.characterId !== characterSession.characterId ||
    presence.relationshipId !== characterSession.relationshipId
  ) {
    throw conflict(
      "presence.character_session_scope_mismatch",
      "PresenceSession scope does not match CharacterSession",
    );
  }
  if (presence.state === "closed") {
    throw conflict(
      "presence.session_closed",
      "Closed PresenceSession cannot bridge to CharacterSession",
    );
  }
}

export function activatePresenceSession(input: {
  readonly session: PresenceSession;
  readonly expectedRevision: number;
  readonly connectedAt: Instant;
}): PresenceSession {
  if (positiveRevision(input.expectedRevision, "expectedRevision") !== input.session.revision) {
    throw conflict("presence.stale_revision", "PresenceSession revision is stale");
  }
  if (input.session.state !== "admitted") {
    throw conflict(
      "presence.invalid_activation",
      "Only admitted PresenceSession can become active",
    );
  }
  const connectedAt = toInstant(input.connectedAt);
  if (connectedAt < input.session.admittedAt) {
    throw new RangeError("connectedAt cannot precede admittedAt");
  }

  return Object.freeze({
    ...input.session,
    state: "active" as const,
    revision: input.session.revision + 1,
    connectionGeneration: 1,
    activatedAt: connectedAt,
    lastConnectedAt: connectedAt,
    updatedAt: connectedAt,
  });
}

export function reconnectPresenceSession(input: {
  readonly session: PresenceSession;
  readonly expectedRevision: number;
  readonly reconnectedAt: Instant;
}): PresenceSession {
  if (positiveRevision(input.expectedRevision, "expectedRevision") !== input.session.revision) {
    throw conflict("presence.stale_revision", "PresenceSession revision is stale");
  }
  if (input.session.state !== "active") {
    throw conflict(
      "presence.reconnect_not_active",
      "Only active PresenceSession can reconnect",
    );
  }
  nonNegativeGeneration(input.session.connectionGeneration);
  const reconnectedAt = toInstant(input.reconnectedAt);
  if (
    input.session.lastConnectedAt !== null &&
    reconnectedAt < input.session.lastConnectedAt
  ) {
    throw new RangeError("reconnectedAt cannot move backwards");
  }

  return Object.freeze({
    ...input.session,
    revision: input.session.revision + 1,
    connectionGeneration: input.session.connectionGeneration + 1,
    lastConnectedAt: reconnectedAt,
    updatedAt: reconnectedAt,
  });
}

export function assertPresenceConnectionGeneration(input: {
  readonly session: PresenceSession;
  readonly connectionGeneration: number;
}): void {
  const candidate = nonNegativeGeneration(input.connectionGeneration);
  if (
    input.session.state !== "active" ||
    candidate !== input.session.connectionGeneration
  ) {
    throw conflict(
      "presence.stale_connection",
      "Presence transport generation is no longer current",
    );
  }
}

export function closePresenceSession(input: {
  readonly session: PresenceSession;
  readonly expectedRevision: number;
  readonly reason: PresenceCloseReason;
  readonly closedAt: Instant;
}): PresenceSession {
  if (positiveRevision(input.expectedRevision, "expectedRevision") !== input.session.revision) {
    throw conflict("presence.stale_revision", "PresenceSession revision is stale");
  }
  if (input.session.state === "closed") return input.session;
  if (!presenceCloseReasons.includes(input.reason)) {
    throw new TypeError("PresenceSession close reason is invalid");
  }
  const closedAt = toInstant(input.closedAt);
  if (closedAt < input.session.updatedAt) {
    throw new RangeError("closedAt cannot move backwards");
  }

  return Object.freeze({
    ...input.session,
    state: "closed" as const,
    revision: input.session.revision + 1,
    updatedAt: closedAt,
    closedAt,
    closeReason: input.reason,
  });
}
