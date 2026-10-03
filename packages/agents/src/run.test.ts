import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
} from "@masanawa/security";
import {
  assertAgentRunAccess,
  normalizeAgentRun,
  normalizeAgentRunLineage,
  normalizeAgentRunTraceReferences,
} from "./run.js";

describe("AgentRun", () => {
  it("normalizes a root run with durable trace references", () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const relationshipId = createCanonicalId("relationship");
    const runId = createCanonicalId("agent-run");
    const sessionId = createCanonicalId("character-session");
    const versionId = createCanonicalId("character-version");
    const requestId = createCanonicalId("request");
    const correlationId = createCanonicalId("correlation");
    const at = nowInstant();

    const run = normalizeAgentRun({
      schemaVersion: 1,
      tenantId,
      userId,
      characterId,
      relationshipId,
      agentRunId: runId,
      characterSessionId: sessionId,
      characterVersionId: versionId,
      lineage: {
        parentAgentRunId: null,
        rootAgentRunId: runId,
        depth: 0,
      },
      trace: {
        requestId,
        correlationId,
        taskId: null,
        workflowRunId: null,
        operationIds: [],
      },
      state: "running",
      startedAt: at,
      updatedAt: at,
      completedAt: null,
      failureCode: null,
    });

    expect(run.agentRunId).toBe(runId);
    expect(run.lineage.rootAgentRunId).toBe(runId);
    expect(run.trace.requestId).toBe(requestId);
    expect(Object.isFrozen(run.trace.operationIds)).toBe(true);
  });

  it("rejects inconsistent child lineage", () => {
    const runId = createCanonicalId("agent-run");
    expect(() =>
      normalizeAgentRunLineage(
        {
          parentAgentRunId: null,
          rootAgentRunId: createCanonicalId("agent-run"),
          depth: 1,
        },
        runId,
      ),
    ).toThrow(/lineage/u);
  });

  it("rejects duplicate operation references", () => {
    const operationId = createCanonicalId("operation");
    expect(() =>
      normalizeAgentRunTraceReferences({
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId: null,
        workflowRunId: null,
        operationIds: [operationId, operationId],
      }),
    ).toThrow(/unique/u);
  });

  it("requires current relationship authority and scoped work references", () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const relationshipId = createCanonicalId("relationship");
    const taskId = createCanonicalId("task");
    const trace = normalizeAgentRunTraceReferences({
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      taskId,
      workflowRunId: null,
      operationIds: [],
    });
    const at = nowInstant();
    const authority = createAuthorityContext({
      tenantId,
      principal: { kind: "user", userId },
      scopes: [],
      capabilities: ["agents.run.create"],
      resourceScope: {
        relationshipIds: [relationshipId],
        taskIds: [taskId],
      },
      policyRevision: "1",
      approvalIds: [],
      delegationChain: [],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      issuedAt: at,
    });

    expect(() =>
      assertAgentRunAccess(
        authority,
        {
          tenantId,
          userId,
          characterId: createCanonicalId("character"),
          relationshipId,
        },
        "create",
        trace,
        at,
      ),
    ).not.toThrow();
  });
});
