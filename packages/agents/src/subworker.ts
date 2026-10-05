import {
  PlatformError,
  parseCanonicalId,
  type AgentRunId,
  type SkillVersionId,
} from "@masanawa/contracts";
import {
  principalKey,
  type AuthorityContext,
  type AuthorityResourceScope,
} from "@masanawa/security";
import type {
  AgentRun,
  AgentRunScope,
} from "./run.js";
import type { AgentRunRepository } from "./run-repository.js";

export interface SubworkerAuthorityAttenuator {
  attenuate(input: {
    readonly parentAuthority: AuthorityContext;
    readonly parentRun: AgentRun;
    readonly childAgentRunId: AgentRunId;
    readonly requestedCapabilities: readonly string[];
  }): Promise<AuthorityContext>;
}

export interface SubworkerSafetyPolicy {
  assertSafe(input: {
    readonly parentAuthority: AuthorityContext;
    readonly childAuthority: AuthorityContext;
    readonly parentRun: AgentRun;
  }): Promise<void>;
}

export interface SubworkerLineageReader {
  countDirectChildren(input: {
    readonly authority: AuthorityContext;
    readonly parentAgentRunId: AgentRunId;
  }): Promise<number>;
}

export interface SubworkerAdmission {
  readonly run: AgentRun;
  readonly authority: AuthorityContext;
  readonly skillVersionIds: readonly SkillVersionId[];
}

export interface CreateSubworkerServiceOptions {
  readonly runs: AgentRunRepository;
  readonly attenuator: SubworkerAuthorityAttenuator;
  readonly safety: SubworkerSafetyPolicy;
  readonly lineage: SubworkerLineageReader;
  readonly maxDepth?: number;
  readonly maxDirectChildren?: number;
  readonly maxSkills?: number;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function authorization(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "authorization",
    message,
    retryable: false,
  });
}

function boundedPositive(
  value: number | undefined,
  fallback: number,
  max: number,
  name: string,
): number {
  const actual = value ?? fallback;
  if (!Number.isSafeInteger(actual) || actual < 1 || actual > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return actual;
}

function assertSubset(
  child: readonly string[] | undefined,
  parent: readonly string[] | undefined,
  label: string,
): void {
  if (child === undefined || child.length === 0) return;
  if (parent === undefined) {
    throw authorization(
      "agents.subworker_authority_widened",
      `Subworker authority widened ${label}`,
    );
  }
  const allowed = new Set(parent);
  if (child.some((value) => !allowed.has(value))) {
    throw authorization(
      "agents.subworker_authority_widened",
      `Subworker authority widened ${label}`,
    );
  }
}

function assertResourceSubset(
  child: AuthorityResourceScope,
  parent: AuthorityResourceScope,
): void {
  assertSubset(child.relationshipIds, parent.relationshipIds, "Relationship scope");
  assertSubset(child.worldIds, parent.worldIds, "World scope");
  assertSubset(child.taskIds, parent.taskIds, "Task scope");
  assertSubset(child.workflowRunIds, parent.workflowRunIds, "WorkflowRun scope");
  assertSubset(child.resourceKeys, parent.resourceKeys, "resource scope");
}

export function assertSubworkerAuthorityAttenuated(input: {
  readonly parent: AuthorityContext;
  readonly child: AuthorityContext;
}): void {
  const { parent, child } = input;
  if (
    child.tenantId !== parent.tenantId ||
    principalKey(child.principal) !== principalKey(parent.principal) ||
    child.policyRevision !== parent.policyRevision ||
    child.requestId !== parent.requestId ||
    child.correlationId !== parent.correlationId
  ) {
    throw authorization(
      "agents.subworker_authority_identity_changed",
      "Subworker authority changed canonical request or principal identity",
    );
  }

  assertSubset(child.scopes, parent.scopes, "scope");
  assertSubset(child.capabilities, parent.capabilities, "capability");
  assertResourceSubset(child.resourceScope, parent.resourceScope);

  if (child.approvalIds.length !== 0) {
    throw authorization(
      "agents.subworker_approval_inheritance_forbidden",
      "Subworkers cannot inherit approval authority",
    );
  }

  const expectedChain = [...parent.delegationChain, parent.authorityContextId];
  if (
    child.delegationChain.length !== expectedChain.length ||
    child.delegationChain.some((value, index) => value !== expectedChain[index])
  ) {
    throw authorization(
      "agents.subworker_delegation_chain_invalid",
      "Subworker authority must extend the parent delegation chain exactly",
    );
  }

  if (child.issuedAt < parent.issuedAt) {
    throw authorization(
      "agents.subworker_authority_time_widened",
      "Subworker authority cannot predate its parent",
    );
  }
  if (
    parent.expiresAt !== undefined &&
    (child.expiresAt === undefined || child.expiresAt > parent.expiresAt)
  ) {
    throw authorization(
      "agents.subworker_authority_time_widened",
      "Subworker authority cannot outlive its parent",
    );
  }
}

function normalizeSkillSubset(input: {
  readonly parent: readonly SkillVersionId[];
  readonly requested: readonly SkillVersionId[];
  readonly maxSkills: number;
}): readonly SkillVersionId[] {
  if (!Array.isArray(input.requested) || input.requested.length > input.maxSkills) {
    throw new RangeError("Subworker Skill selection exceeds its bound");
  }
  const parent = new Set(
    input.parent.map((id) => parseCanonicalId("skill-version", id)),
  );
  const requested = [
    ...new Set(
      input.requested.map((id) => parseCanonicalId("skill-version", id)),
    ),
  ].sort();
  if (requested.some((id) => !parent.has(id))) {
    throw authorization(
      "agents.subworker_skill_widened",
      "Subworker requested a SkillVersion not admitted to the parent harness",
    );
  }
  return Object.freeze(requested);
}

export function createSubworkerService(options: CreateSubworkerServiceOptions) {
  const maxDepth = boundedPositive(options.maxDepth, 4, 16, "maxDepth");
  const maxDirectChildren = boundedPositive(
    options.maxDirectChildren,
    4,
    32,
    "maxDirectChildren",
  );
  const maxSkills = boundedPositive(options.maxSkills, 8, 32, "maxSkills");

  return Object.freeze({
    async admit(input: {
      readonly parentAuthority: AuthorityContext;
      readonly scope: AgentRunScope;
      readonly parentAgentRunId: AgentRunId;
      readonly childAgentRunId: AgentRunId;
      readonly parentSkillVersionIds: readonly SkillVersionId[];
      readonly requestedSkillVersionIds: readonly SkillVersionId[];
      readonly requestedCapabilities: readonly string[];
    }): Promise<SubworkerAdmission> {
      const parentAgentRunId = parseCanonicalId(
        "agent-run",
        input.parentAgentRunId,
      );
      const childAgentRunId = parseCanonicalId(
        "agent-run",
        input.childAgentRunId,
      );
      if (parentAgentRunId === childAgentRunId) {
        throw new TypeError("Subworker AgentRun must differ from its parent");
      }

      const parent = await options.runs.read({
        authority: input.parentAuthority,
        scope: input.scope,
        agentRunId: parentAgentRunId,
      });
      if (parent.state !== "running") {
        throw conflict(
          "agents.subworker_parent_terminal",
          "Subworkers may be admitted only while the parent AgentRun is running",
        );
      }

      const depth = parent.lineage.depth + 1;
      if (depth > maxDepth) {
        throw conflict(
          "agents.subworker_depth_exceeded",
          "Subworker lineage depth exceeds the harness bound",
        );
      }

      const directChildren = await options.lineage.countDirectChildren({
        authority: input.parentAuthority,
        parentAgentRunId,
      });
      if (
        !Number.isSafeInteger(directChildren) ||
        directChildren < 0 ||
        directChildren >= maxDirectChildren
      ) {
        throw conflict(
          "agents.subworker_fanout_exceeded",
          "Subworker direct-child fan-out exceeds the harness bound",
        );
      }

      const skillVersionIds = normalizeSkillSubset({
        parent: input.parentSkillVersionIds,
        requested: input.requestedSkillVersionIds,
        maxSkills,
      });
      const requestedCapabilities = Object.freeze([
        ...new Set(input.requestedCapabilities.map((value) => value.trim())),
      ].filter(Boolean).sort());
      if (requestedCapabilities.length > 64) {
        throw new RangeError("Subworker capability request exceeds its bound");
      }

      const childAuthority = await options.attenuator.attenuate({
        parentAuthority: input.parentAuthority,
        parentRun: parent,
        childAgentRunId,
        requestedCapabilities,
      });
      assertSubworkerAuthorityAttenuated({
        parent: input.parentAuthority,
        child: childAuthority,
      });
      await options.safety.assertSafe({
        parentAuthority: input.parentAuthority,
        childAuthority,
        parentRun: parent,
      });

      const child = await options.runs.create({
        authority: childAuthority,
        scope: {
          tenantId: parent.tenantId,
          userId: parent.userId,
          characterId: parent.characterId,
          relationshipId: parent.relationshipId,
        },
        agentRunId: childAgentRunId,
        characterSessionId: parent.characterSessionId,
        characterVersionId: parent.characterVersionId,
        lineage: {
          parentAgentRunId: parent.agentRunId,
          rootAgentRunId: parent.lineage.rootAgentRunId,
          depth,
        },
        trace: {
          requestId: parent.trace.requestId,
          correlationId: parent.trace.correlationId,
          taskId: parent.trace.taskId,
          workflowRunId: parent.trace.workflowRunId,
          operationIds: [],
        },
      });

      if (
        child.characterSessionId !== parent.characterSessionId ||
        child.characterVersionId !== parent.characterVersionId ||
        child.lineage.parentAgentRunId !== parent.agentRunId ||
        child.lineage.rootAgentRunId !== parent.lineage.rootAgentRunId ||
        child.trace.taskId !== parent.trace.taskId ||
        child.trace.workflowRunId !== parent.trace.workflowRunId
      ) {
        throw conflict(
          "agents.subworker_custody_mismatch",
          "Created subworker did not preserve parent harness custody",
        );
      }

      return Object.freeze({
        run: child,
        authority: childAuthority,
        skillVersionIds,
      });
    },
  });
}
