import {
  PlatformError, parseCanonicalId, toInstant,
  type CharacterId, type CharacterSessionId, type CharacterVersionId, type ChannelSessionId,
  type PresenceSessionId, type Instant, type RelationshipId, type SkillVersionId,
  type TaskId, type TenantId, type UserId, type WorkflowRunId, type CanonicalIdKind, type CanonicalId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";

export interface CharacterSessionScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}
/** References are continuity metadata, never permissions, checkpoints or execution plans. */
export interface CharacterSessionBindings {
  readonly channelSessionId: ChannelSessionId | null;
  readonly presenceSessionId: PresenceSessionId | null;
  readonly skillVersionIds: readonly SkillVersionId[];
  readonly taskIds: readonly TaskId[];
  readonly workflowRunIds: readonly WorkflowRunId[];
}
export interface CharacterSession extends CharacterSessionScope {
  readonly schemaVersion: 1;
  readonly characterSessionId: CharacterSessionId;
  readonly characterVersionId: CharacterVersionId;
  readonly bindings: CharacterSessionBindings;
  readonly state: "active" | "closed";
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly expiresAt: Instant;
  readonly closedAt: Instant | null;
  readonly closeReason: "ended" | "reset" | null;
  readonly successorSessionId: CharacterSessionId | null;
}
export const emptyCharacterSessionBindings: CharacterSessionBindings = Object.freeze({
  channelSessionId: null, presenceSessionId: null,
  skillVersionIds: Object.freeze([]), taskIds: Object.freeze([]), workflowRunIds: Object.freeze([]),
});

function exactKeys(value: object, keys: readonly string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key))) throw new TypeError("Session value has unknown fields");
}
function ids<K extends CanonicalIdKind>(kind: K, values: readonly CanonicalId<K>[], limit: number): readonly CanonicalId<K>[] {
  if (!Array.isArray(values) || values.length > limit) throw new RangeError("Session references exceed their bound");
  const parsed = values.map(value => parseCanonicalId(kind, value));
  if (new Set(parsed).size !== parsed.length) throw new TypeError("Session references must be unique");
  return Object.freeze(parsed.sort());
}
export function normalizeCharacterSessionScope(input: CharacterSessionScope): CharacterSessionScope {
  exactKeys(input, ["tenantId", "userId", "characterId", "relationshipId"]);
  return Object.freeze({ tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId), characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId) });
}
export function normalizeCharacterSessionBindings(input: CharacterSessionBindings): CharacterSessionBindings {
  exactKeys(input, ["channelSessionId", "presenceSessionId", "skillVersionIds", "taskIds", "workflowRunIds"]);
  return Object.freeze({
    channelSessionId: input.channelSessionId === null ? null : parseCanonicalId("channel-session", input.channelSessionId),
    presenceSessionId: input.presenceSessionId === null ? null : parseCanonicalId("presence-session", input.presenceSessionId),
    skillVersionIds: ids("skill-version", input.skillVersionIds, 64),
    taskIds: ids("task", input.taskIds, 64), workflowRunIds: ids("workflow-run", input.workflowRunIds, 64),
  });
}
export function normalizeCharacterSession(input: CharacterSession): CharacterSession {
  exactKeys(input, ["schemaVersion", "tenantId", "userId", "characterId", "relationshipId", "characterSessionId",
    "characterVersionId", "bindings", "state", "revision", "createdAt", "updatedAt", "expiresAt", "closedAt", "closeReason", "successorSessionId"]);
  if (input.schemaVersion !== 1 || !["active", "closed"].includes(input.state)) throw new TypeError("Session schema or state is invalid");
  assertCharacterSessionRevision(input.revision);
  const scope = normalizeCharacterSessionScope({ tenantId: input.tenantId, userId: input.userId,
    characterId: input.characterId, relationshipId: input.relationshipId });
  const createdAt = toInstant(input.createdAt), updatedAt = toInstant(input.updatedAt), expiresAt = toInstant(input.expiresAt);
  const closedAt = input.closedAt === null ? null : toInstant(input.closedAt);
  const successorSessionId = input.successorSessionId === null ? null : parseCanonicalId("character-session", input.successorSessionId);
  if (expiresAt <= createdAt || updatedAt < createdAt ||
      (input.state === "active" && (closedAt !== null || input.closeReason !== null || successorSessionId !== null)) ||
      (input.state === "closed" && (closedAt === null || closedAt !== updatedAt ||
        !["ended", "reset"].includes(input.closeReason ?? "") ||
        (input.closeReason === "reset") !== (successorSessionId !== null))) ||
      successorSessionId === input.characterSessionId) throw new TypeError("Session lifecycle is inconsistent");
  return Object.freeze({ ...scope, schemaVersion: 1, characterSessionId: parseCanonicalId("character-session", input.characterSessionId),
    characterVersionId: parseCanonicalId("character-version", input.characterVersionId),
    bindings: normalizeCharacterSessionBindings(input.bindings), state: input.state, revision: input.revision,
    createdAt, updatedAt, expiresAt, closedAt, closeReason: input.closeReason, successorSessionId });
}
export function assertCharacterSessionRevision(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) throw new RangeError("Session revision is invalid");
}
export function assertCharacterSessionDuration(durationMs: number, maxDurationMs: number): void {
  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1 ||
      !Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > maxDurationMs) throw new RangeError("Session duration exceeds configured policy");
}
export function isCharacterSessionOpen(session: CharacterSession, at: Instant): boolean {
  const normalizedAt = toInstant(at);
  return session.state === "active" && session.createdAt <= normalizedAt && session.expiresAt > normalizedAt;
}
export type CharacterSessionAction = "create" | "read" | "update" | "close" | "reset";
/** Called after current-authority preparation and again at the transaction boundary. */
export function assertCharacterSessionAccess(
  authority: AuthorityContext, scope: CharacterSessionScope, action: CharacterSessionAction,
  bindings: CharacterSessionBindings, at: Instant,
): void {
  const valid = authority.tenantId === scope.tenantId &&
    authority.capabilities.includes(`agents.session.${action}`) &&
    authority.resourceScope.relationshipIds?.includes(scope.relationshipId) &&
    (authority.principal.kind === "user" ? authority.principal.userId === scope.userId :
      authority.capabilities.includes("agents.session.manage-other")) &&
    toInstant(authority.issuedAt) <= at && (!authority.expiresAt || toInstant(authority.expiresAt) > at) &&
    bindings.taskIds.every(id => authority.resourceScope.taskIds?.includes(id)) &&
    bindings.workflowRunIds.every(id => authority.resourceScope.workflowRunIds?.includes(id));
  if (!valid) throw new PlatformError({ code: "agents.session_access_denied", category: "authorization",
    message: "Current authority does not allow this session operation", retryable: false });
}
