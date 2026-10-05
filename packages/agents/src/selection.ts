import { PlatformError, parseCanonicalId, toInstant, type SkillVersionId, type Instant } from "@masanawa/contracts";
import { assertCurrentAuthority, createAuthorityContext, type AuthorityContext, type CurrentAuthoritySource } from "@masanawa/security";
import type { PreparedSkillSelection, SkillSelectionSource, SkillToolSelection } from "@masanawa/skills";
import { normalizeCharacterSkillAssignment, type CharacterSkillAssignment } from "./configuration.js";
import { assertAgentRunAccess, normalizeAgentRun, type AgentRun } from "./run.js";
import { assertCharacterSessionAccess, normalizeCharacterSession, type CharacterSession } from "./session.js";

export interface AgentSkillSelection extends PreparedSkillSelection {
  readonly agentRunId: AgentRun["agentRunId"];
  readonly characterSessionId: CharacterSession["characterSessionId"];
  readonly assignmentRevision: number;
  readonly characterVersionId: CharacterSession["characterVersionId"];
}
export interface AgentSkillSelector {
  prepare(input: { readonly authority: AuthorityContext; readonly session: CharacterSession;
    readonly run: AgentRun; readonly assignment: CharacterSkillAssignment; readonly skillVersionId: SkillVersionId;
    readonly tools: readonly SkillToolSelection[] }): Promise<AgentSkillSelection>;
}
/** Transient preparation. Durable run custody, Tool execution and approvals remain with their owners. */
export function createAgentSkillSelector(dependencies: {
  readonly skills: SkillSelectionSource;
  readonly currentAuthority: CurrentAuthoritySource;
  readonly now: () => Instant;
}): AgentSkillSelector {
  return Object.freeze({
    async prepare(input: Parameters<AgentSkillSelector["prepare"]>[0]) {
      const session = normalizeCharacterSession(input.session), run = normalizeAgentRun(input.run);
      const assignment = normalizeCharacterSkillAssignment(input.assignment);
      const skillVersionId = parseCanonicalId("skill-version", input.skillVersionId);
      if (!Array.isArray(input.tools) || input.tools.length > 64) throw new RangeError("Too many selected Tool references");
      const tools = Object.freeze(input.tools.map(value => Object.freeze({ ...value })));
      const authority = Object.freeze({ ...createAuthorityContext(input.authority),
        authorityContextId: parseCanonicalId("authority-context", input.authority.authorityContextId),
        principal: Object.freeze({ ...input.authority.principal }), issuedAt: toInstant(input.authority.issuedAt),
        ...(input.authority.expiresAt ? { expiresAt: toInstant(input.authority.expiresAt) } : {}) });
      if (!authority.capabilities.includes("agents.skill.select")) throw new PlatformError({
        code: "agents.selection_capability_missing", category: "authorization",
        message: "Agent Skill selection capability is required.", retryable: false });
      const admittedAt = toInstant(dependencies.now());
      assertCharacterSessionAccess(authority, session, "read", session.bindings, admittedAt);
      assertAgentRunAccess(authority, run, "read", run.trace, admittedAt);
      if (assignment.tenantId !== session.tenantId || assignment.characterId !== session.characterId ||
        !assignment.skillVersionIds.includes(skillVersionId) || !session.bindings.skillVersionIds.includes(skillVersionId) ||
        session.state !== "active" || session.expiresAt <= admittedAt || run.state !== "running" || run.characterSessionId !== session.characterSessionId ||
        run.characterVersionId !== session.characterVersionId || run.relationshipId !== session.relationshipId ||
        run.characterId !== session.characterId || run.userId !== session.userId || run.tenantId !== session.tenantId) {
        throw new PlatformError({ code: "agents.selection_binding_mismatch", category: "authorization",
          message: "Skill selection requires the matching active CharacterSession and running AgentRun.", retryable: false });
      }
      await assertCurrentAuthority(authority, dependencies.currentAuthority, admittedAt);
      const selection = dependencies.skills.prepare({ authority, skillVersionId, tools });
      await assertCurrentAuthority(authority, dependencies.currentAuthority, toInstant(dependencies.now()));
      const finalAt = toInstant(dependencies.now());
      assertCharacterSessionAccess(authority, session, "read", session.bindings, finalAt);
      assertAgentRunAccess(authority, run, "read", run.trace, finalAt);
      if (session.expiresAt <= finalAt) throw new PlatformError({ code: "agents.selection_session_expired",
        category: "authorization", message: "CharacterSession expired during selection admission.", retryable: false });
      const currentSelection = dependencies.skills.prepare({ authority, skillVersionId, tools });
      if (currentSelection.revisionPin.contentHash !== selection.revisionPin.contentHash) throw new PlatformError({
        code: "agents.selection_registry_changed", category: "conflict",
        message: "Skill graph changed during selection admission.", retryable: false });
      return Object.freeze({ ...currentSelection, agentRunId: run.agentRunId,
        characterSessionId: session.characterSessionId, assignmentRevision: assignment.revision, characterVersionId: session.characterVersionId });
    },
  });
}

/** Durable owner composition reads current assignment; strategies cannot supply it. */
export interface AgentSkillSelectionAdmission {
  prepare(input: { readonly authority: AuthorityContext; readonly session: CharacterSession;
    readonly run: AgentRun; readonly skillVersionId: SkillVersionId;
    readonly tools: readonly SkillToolSelection[] }): Promise<AgentSkillSelection>;
}

