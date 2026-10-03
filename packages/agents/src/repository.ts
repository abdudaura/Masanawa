import type { CharacterSessionId, CharacterVersionId } from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type { CharacterSession, CharacterSessionBindings, CharacterSessionScope } from "./session.js";

export interface CharacterSessionRequest {
  readonly authority: AuthorityContext;
  readonly scope: CharacterSessionScope;
  readonly characterSessionId: CharacterSessionId;
}
export interface CreateCharacterSessionInput extends CharacterSessionRequest {
  /** Caller allocates once per admission; same ID/normalized request replays its record. */
  readonly characterVersionId: CharacterVersionId;
  readonly durationMs: number;
  readonly bindings: CharacterSessionBindings;
}
export interface ChangeCharacterSessionInput extends CharacterSessionRequest {
  readonly expectedRevision: number;
}
export interface ResetCharacterSessionInput extends ChangeCharacterSessionInput {
  readonly successorSessionId: CharacterSessionId;
  readonly characterVersionId: CharacterVersionId;
  readonly durationMs: number;
}
/** Every operation requires current relationship authority; no unscoped list/read path. */
export interface CharacterSessionRepository {
  create(input: CreateCharacterSessionInput): Promise<CharacterSession>;
  read(input: CharacterSessionRequest): Promise<CharacterSession>;
  updateBindings(input: ChangeCharacterSessionInput & { readonly bindings: CharacterSessionBindings }): Promise<CharacterSession>;
  close(input: ChangeCharacterSessionInput): Promise<CharacterSession>;
  /** Atomically closes the old session and admits a fresh session with the same relationship and references. */
  reset(input: ResetCharacterSessionInput): Promise<{ readonly previous: CharacterSession; readonly current: CharacterSession }>;
}
