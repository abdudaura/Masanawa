import { describe, expect, it, vi } from "vitest";
import type { AuthorityContext } from "@masanawa/security";
import type { AgentRun } from "./run.js";
import type { AgentRunRepository } from "./run-repository.js";
import {
  assertSubworkerAuthorityAttenuated,
  createSubworkerService,
} from "./subworker.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;
const relationshipId = "relationship_00000000-0000-4000-8000-000000000004" as never;
const parentRunId = "agent-run_00000000-0000-4000-8000-000000000005" as never;
const childRunId = "agent-run_00000000-0000-4000-8000-000000000006" as never;
const rootRunId = "agent-run_00000000-0000-4000-8000-000000000007" as never;
const sessionId = "character-session_00000000-0000-4000-8000-000000000008" as never;
const versionId = "character-version_00000000-0000-4000-8000-000000000009" as never;
const taskId = "task_00000000-0000-4000-8000-000000000010" as never;
const workflowRunId = "workflow-run_00000000-0000-4000-8000-000000000011" as never;
const skillA = "skill-version_00000000-0000-4000-8000-000000000012" as never;
const skillB = "skill-version_00000000-0000-4000-8000-000000000013" as never;

const parentAuthority = {
  authorityContextId: "authority-context_00000000-0000-4000-8000-000000000014",
  tenantId,
  principal: { kind: "user", userId },
  scopes: ["agent"],
  capabilities: ["agents.run.create", "agents.run.read", "research.read", "commerce.spend"],
  resourceScope: {
    relationshipIds: [relationshipId],
    taskIds: [taskId],
    workflowRunIds: [workflowRunId],
    resourceKeys: ["character:1"],
  },
  policyRevision: "policy-1",
  approvalIds: ["approval_00000000-0000-4000-8000-000000000015"],
  delegationChain: [],
  issuedAt: "2026-10-05T09:00:00.000Z",
  expiresAt: "2026-10-05T11:00:00.000Z",
  requestId: "request_00000000-0000-4000-8000-000000000016",
  correlationId: "correlation_00000000-0000-4000-8000-000000000017",
} as unknown as AuthorityContext;

function parent(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    schemaVersion: 1,
    tenantId,
    userId,
    characterId,
    relationshipId,
    agentRunId: parentRunId,
    characterSessionId: sessionId,
    characterVersionId: versionId,
    lineage: {
      parentAgentRunId: rootRunId,
      rootAgentRunId: rootRunId,
      depth: 1,
    },
    trace: {
      requestId: parentAuthority.requestId as never,
      correlationId: parentAuthority.correlationId as never,
      taskId,
      workflowRunId,
      operationIds: [],
    },
    state: "running",
    startedAt: "2026-10-05T09:10:00.000Z" as never,
    updatedAt: "2026-10-05T09:10:00.000Z" as never,
    completedAt: null,
    failureCode: null,
    ...overrides,
  };
}

function childAuthority(overrides: Partial<AuthorityContext> = {}): AuthorityContext {
  return {
    ...parentAuthority,
    authorityContextId: "authority-context_00000000-0000-4000-8000-000000000018" as never,
    capabilities: ["agents.run.create", "agents.run.read", "research.read"],
    approvalIds: [],
    delegationChain: [parentAuthority.authorityContextId],
    issuedAt: "2026-10-05T09:15:00.000Z" as never,
    expiresAt: "2026-10-05T10:30:00.000Z" as never,
    ...overrides,
  } as AuthorityContext;
}

function harness(options: {
  parent?: AgentRun;
  directChildren?: number;
  childAuthority?: AuthorityContext;
} = {}) {
  const currentParent = options.parent ?? parent();
  const create = vi.fn(async (input: Parameters<AgentRunRepository["create"]>[0]) => ({
    ...currentParent,
    agentRunId: input.agentRunId,
    lineage: input.lineage,
    trace: input.trace,
  } as AgentRun));
  const runs = {
    async read() { return currentParent; },
    create,
  } as unknown as AgentRunRepository;
  const safety = vi.fn(async () => undefined);
  const service = createSubworkerService({
    runs,
    lineage: { async countDirectChildren() { return options.directChildren ?? 0; } },
    attenuator: {
      async attenuate() { return options.childAuthority ?? childAuthority(); },
    },
    safety: { assertSafe: safety },
    maxDepth: 4,
    maxDirectChildren: 3,
  });
  return { service, create, safety };
}

const scope = { tenantId, userId, characterId, relationshipId };

describe("bounded harness subworkers", () => {
  it("creates a child run with exact root/parent and Work custody", async () => {
    const { service, create, safety } = harness();
    const result = await service.admit({
      parentAuthority,
      scope,
      parentAgentRunId: parentRunId,
      childAgentRunId: childRunId,
      parentSkillVersionIds: [skillA, skillB],
      requestedSkillVersionIds: [skillA],
      requestedCapabilities: ["research.read"],
    });
    expect(result.skillVersionIds).toEqual([skillA]);
    expect(result.run.lineage).toEqual({
      parentAgentRunId: parentRunId,
      rootAgentRunId: rootRunId,
      depth: 2,
    });
    expect(result.run.trace.taskId).toBe(taskId);
    expect(result.run.trace.workflowRunId).toBe(workflowRunId);
    expect(result.run.trace.operationIds).toEqual([]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(safety).toHaveBeenCalledTimes(1);
  });

  it("rejects a SkillVersion not admitted to the parent harness", async () => {
    const { service, create } = harness();
    await expect(service.admit({
      parentAuthority,
      scope,
      parentAgentRunId: parentRunId,
      childAgentRunId: childRunId,
      parentSkillVersionIds: [skillA],
      requestedSkillVersionIds: [skillB],
      requestedCapabilities: [],
    })).rejects.toThrow("not admitted");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects terminal parents, excess depth and fan-out", async () => {
    await expect(harness({
      parent: parent({
        state: "completed",
        completedAt: "2026-10-05T09:20:00.000Z" as never,
        updatedAt: "2026-10-05T09:20:00.000Z" as never,
      }),
    }).service.admit({
      parentAuthority, scope, parentAgentRunId: parentRunId, childAgentRunId: childRunId,
      parentSkillVersionIds: [], requestedSkillVersionIds: [], requestedCapabilities: [],
    })).rejects.toThrow("only while");

    await expect(harness({
      parent: parent({ lineage: { parentAgentRunId: rootRunId, rootAgentRunId: rootRunId, depth: 4 } }),
    }).service.admit({
      parentAuthority, scope, parentAgentRunId: parentRunId, childAgentRunId: childRunId,
      parentSkillVersionIds: [], requestedSkillVersionIds: [], requestedCapabilities: [],
    })).rejects.toThrow("depth");

    await expect(harness({ directChildren: 3 }).service.admit({
      parentAuthority, scope, parentAgentRunId: parentRunId, childAgentRunId: childRunId,
      parentSkillVersionIds: [], requestedSkillVersionIds: [], requestedCapabilities: [],
    })).rejects.toThrow("fan-out");
  });

  it("mechanically rejects widened capabilities/resources and inherited approvals", () => {
    expect(() => assertSubworkerAuthorityAttenuated({
      parent: parentAuthority,
      child: childAuthority({ capabilities: [...parentAuthority.capabilities, "extra"] }),
    })).toThrow("widened capability");

    expect(() => assertSubworkerAuthorityAttenuated({
      parent: parentAuthority,
      child: childAuthority({ approvalIds: parentAuthority.approvalIds }),
    })).toThrow("cannot inherit approval");

    expect(() => assertSubworkerAuthorityAttenuated({
      parent: parentAuthority,
      child: childAuthority({ resourceScope: { ...parentAuthority.resourceScope, resourceKeys: ["new"] } }),
    })).toThrow("widened resource scope");
  });

  it("requires the injected safety policy before child creation", async () => {
    const currentParent = parent();
    const create = vi.fn();
    const service = createSubworkerService({
      runs: {
        async read() { return currentParent; },
        create,
      } as unknown as AgentRunRepository,
      lineage: { async countDirectChildren() { return 0; } },
      attenuator: { async attenuate() { return childAuthority(); } },
      safety: {
        async assertSafe() {
          throw new Error("financial capability forbidden");
        },
      },
    });
    await expect(service.admit({
      parentAuthority,
      scope,
      parentAgentRunId: parentRunId,
      childAgentRunId: childRunId,
      parentSkillVersionIds: [skillA],
      requestedSkillVersionIds: [skillA],
      requestedCapabilities: ["research.read"],
    })).rejects.toThrow("financial capability forbidden");
    expect(create).not.toHaveBeenCalled();
  });
});
