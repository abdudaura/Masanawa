import type { PresenceSession } from "./presence-session.js";
import { normalizePresenceSession } from "./presence-session.js";

export interface CharacterSessionBridgeSnapshot {
  readonly schemaVersion: 1;
  readonly tenantId: string;
  readonly userId: string;
  readonly relationshipId: string;
  readonly characterId: string;
  readonly characterSessionId: string;
  readonly state: "active" | "closed";
  readonly bindings: {
    readonly presenceSessionId: string | null;
  };
}

export interface CharacterSessionPresenceBindingPatch {
  readonly presenceSessionId: string;
}

export function assertPresenceCharacterSessionBridge(input: {
  readonly presence: PresenceSession;
  readonly characterSession: CharacterSessionBridgeSnapshot;
}): void {
  const presence = normalizePresenceSession(input.presence);
  const session = input.characterSession;

  if (session.schemaVersion !== 1) {
    throw new TypeError("Unsupported CharacterSession schemaVersion");
  }
  if (session.state !== "active") {
    throw new Error("PresenceSession requires an active CharacterSession");
  }

  if (
    presence.tenantId !== session.tenantId ||
    presence.userId !== session.userId ||
    presence.relationshipId !== session.relationshipId ||
    presence.characterId !== session.characterId ||
    presence.characterSessionId !== session.characterSessionId
  ) {
    throw new Error("PresenceSession scope does not match CharacterSession");
  }

  if (
    session.bindings.presenceSessionId !== null &&
    session.bindings.presenceSessionId !== presence.presenceSessionId
  ) {
    throw new Error(
      "CharacterSession is already bound to a different PresenceSession",
    );
  }
}

export function presenceBindingPatch(input: {
  readonly presence: PresenceSession;
  readonly characterSession: CharacterSessionBridgeSnapshot;
}): CharacterSessionPresenceBindingPatch {
  assertPresenceCharacterSessionBridge(input);
  return Object.freeze({
    presenceSessionId: normalizePresenceSession(input.presence)
      .presenceSessionId,
  });
}
