import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
  type Instant,
} from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import {
  createWorkflowExecutor,
  type WorkflowCurrentAuthorityGate,
  type WorkflowGraph,
  type WorkflowNodeExecutor,
} from "./executor.js";
import {
  normalizeWorkflowRun,
  type WorkflowCheckpoint,
  type WorkflowRun,
  type WorkflowRunRepository,
  type WorkflowRunScope,
} from "./workflow-run.js";

class MemoryRuns implements WorkflowRunRepository {
  checkpoint: WorkflowCheckpoint | null = null;

  constructor(public run: WorkflowRun) {}

  async create(): Promise<WorkflowRun> {
    throw new Error("not used");
  }

  async read(): Promise<WorkflowRun> {
    return this.run;
  }

  async listForRelationship(): Promise<readonly WorkflowRun[]> {
    return [this.run];
  }

  async transition(): Promise<WorkflowRun> {
    throw new Error("not used");
  }

  async appendCheckpoint(input: Parameters<WorkflowRunRepository["appendCheckpoint"]>[0]) {
    if (input.expectedRunRevision !== this.run.revision) {
      throw new Error("stale revision");
    }
    this.checkpoint = input.checkpoint;
    this.run = normalizeWorkflowRun({
      ...this.run,
      revision: this.run.revision + 1,
      checkpointRevision: input.checkpoint.checkpointRevision,
      updatedAt: input.checkpoint.createdAt,
    });
    return this.run;
  }

  async commitCheckpoint(input: Parameters<WorkflowRunRepository["commitCheckpoint"]>[0]) {
    if (input.expectedRunRevision !== this.run.revision) {
      throw new Error("stale revision");
    }
    this.checkpoint = input.checkpoint;
    const terminal =
      input.transition.to === "completed" ||
      input.transition.to === "failed" ||
      input.transition.to === "cancelled";
    this.run = normalizeWorkflowRun({
      ...this.run,
      state: input.transition.to,
      revision: this.run.revision + 1,
      checkpointRevision: input.checkpoint.checkpointRevision,
      pendingApprovalIds:
        input.transition.to === "waiting_approval"
          ? input.checkpoint.pendingApprovalIds
          : [],
      updatedAt: input.checkpoint.createdAt,
      completedAt: terminal ? input.checkpoint.createdAt : null,
      failureCode:
        input.transition.to === "failed"
          ? input.transition.failureCode ?? "workflow.failed"
          : null,
    });
    return this.run;
  }

  async readLatestCheckpoint(): Promise<WorkflowCheckpoint | null> {
    return this.checkpoint;
  }
}

function fixture(state: WorkflowRun["state"] = "running") {
  const at = nowInstant();
  const scope: WorkflowRunScope = {
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
  };
  const workflowRunId = createCanonicalId("workflow-run");
  const workflowVersionId = createCanonicalId("workflow-version");
  const run = normalizeWorkflowRun({
    schemaVersion: 1,
    ...scope,
    workflowRunId,
    workflowVersionId,
    taskId: createCanonicalId("task"),
    state,
    revision: 1,
    checkpointRevision: 0,
    pendingApprovalIds:
      state === "waiting_approval" ? [createCanonicalId("approval")] : [],
    createdAt: at,
    updatedAt: at,
    completedAt:
      state === "completed" || state === "failed" || state === "cancelled"
        ? at
        : null,
    failureCode: state === "failed" ? "workflow.failed" : null,
  });
  const authority = createAuthorityContext({
    tenantId: scope.tenantId,
    principal: { kind: "user", userId: scope.userId },
    scopes: ["workflows"],
    capabilities: [
      "workflows.run.read",
      "workflows.run.update",
      "workflows.run.checkpoint",
    ],
    resourceScope: { relationshipIds: [scope.relationshipId] },
    policyRevision: "test",
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
    issuedAt: at,
  });
  const graph: WorkflowGraph = {
    workflowVersionId,
    graphSignature: "graph:test:v1",
    entryNodeId: "start",
    nodes: [
      { nodeId: "start", nextNodeIds: ["finish"] },
      { nodeId: "finish", nextNodeIds: [], terminal: true },
    ],
  };
  return { at, scope, run, authority, graph };
}

const openGuard = {
  async acquire() {
    return { async release() {} };
  },
};

describe("Workflow resume executor", () => {
  it("resumes from the persisted node after a process restart", async () => {
    const f = fixture();
    const runs = new MemoryRuns(f.run);
    const gated: string[] = [];
    const authorityGate: WorkflowCurrentAuthorityGate = {
      async assertCurrent({ nodeId }) {
        gated.push(nodeId);
      },
    };

    const firstNode: WorkflowNodeExecutor = {
      async execute({ node }) {
        expect(node.nodeId).toBe("start");
        return {
          kind: "advance",
          nextNodeId: "finish",
          committedState: { found: 3 },
          edgeState: { searched: true },
        };
      },
    };
    const first = createWorkflowExecutor({
      runs,
      authorityGate,
      nodeExecutor: firstNode,
      executionGuard: openGuard,
      maxStepsPerResume: 1,
      now: () => f.at,
    });
    const yielded = await first.resume({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.run.workflowRunId,
      graph: f.graph,
    });

    expect(yielded.disposition).toBe("yielded");
    expect(yielded.run.checkpointRevision).toBe(1);
    expect(yielded.checkpoint?.executorState.currentNodeId).toBe("finish");

    const secondNode: WorkflowNodeExecutor = {
      async execute({ node, committedState }) {
        expect(node.nodeId).toBe("finish");
        expect(committedState.found).toBe(3);
        return { kind: "complete" };
      },
    };
    const afterRestart = createWorkflowExecutor({
      runs,
      authorityGate,
      nodeExecutor: secondNode,
      executionGuard: openGuard,
      maxStepsPerResume: 4,
      now: () => f.at,
    });
    const completed = await afterRestart.resume({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.run.workflowRunId,
      graph: f.graph,
    });

    expect(completed.disposition).toBe("terminal");
    expect(completed.run.state).toBe("completed");
    expect(completed.run.checkpointRevision).toBe(2);
    expect(completed.checkpoint?.executorState.currentNodeId).toBeNull();
    expect(gated).toEqual(["start", "finish"]);
  });

  it("rejects graph signature drift before executing a resumed node", async () => {
    const f = fixture();
    const runs = new MemoryRuns(f.run);
    runs.checkpoint = {
      schemaVersion: 1,
      workflowRunId: f.run.workflowRunId,
      checkpointRevision: 1,
      graphSignature: "graph:old",
      committedState: {},
      executorState: { currentNodeId: "finish", stepCount: 1 },
      edgeState: {},
      pendingApprovalIds: [],
      createdAt: f.at,
    };
    runs.run = normalizeWorkflowRun({
      ...runs.run,
      revision: 2,
      checkpointRevision: 1,
    });
    let executed = false;
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: { async assertCurrent() {} },
      nodeExecutor: {
        async execute() {
          executed = true;
          return { kind: "complete" };
        },
      },
      executionGuard: openGuard,
    });

    await expect(
      executor.resume({
        authority: f.authority,
        scope: f.scope,
        workflowRunId: f.run.workflowRunId,
        graph: f.graph,
      }),
    ).rejects.toMatchObject({ code: "workflows.restore_incompatible" });
    expect(executed).toBe(false);
  });

  it("rejects an undeclared graph edge", async () => {
    const f = fixture();
    const runs = new MemoryRuns(f.run);
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: { async assertCurrent() {} },
      nodeExecutor: {
        async execute() {
          return { kind: "advance", nextNodeId: "start" };
        },
      },
      executionGuard: openGuard,
    });

    await expect(
      executor.resume({
        authority: f.authority,
        scope: f.scope,
        workflowRunId: f.run.workflowRunId,
        graph: f.graph,
      }),
    ).rejects.toMatchObject({ code: "workflows.edge_invalid" });
    expect(runs.checkpoint).toBeNull();
  });

  it("revalidates authority immediately before node execution", async () => {
    const f = fixture();
    const runs = new MemoryRuns(f.run);
    let executed = false;
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: {
        async assertCurrent() {
          throw new Error("revoked");
        },
      },
      nodeExecutor: {
        async execute() {
          executed = true;
          return { kind: "advance", nextNodeId: "finish" };
        },
      },
      executionGuard: openGuard,
    });

    await expect(
      executor.resume({
        authority: f.authority,
        scope: f.scope,
        workflowRunId: f.run.workflowRunId,
        graph: f.graph,
      }),
    ).rejects.toThrowError("revoked");
    expect(executed).toBe(false);
  });

  it("keeps waiting runs paused until their owning domain clears the wait", async () => {
    const f = fixture("waiting_external");
    const runs = new MemoryRuns(f.run);
    let gated = false;
    let executed = false;
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: {
        async assertCurrent() {
          gated = true;
        },
      },
      nodeExecutor: {
        async execute() {
          executed = true;
          return { kind: "complete" };
        },
      },
      executionGuard: openGuard,
    });

    const result = await executor.resume({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.run.workflowRunId,
      graph: f.graph,
    });

    expect(result.disposition).toBe("paused");
    expect(result.stepsExecuted).toBe(0);
    expect(gated).toBe(false);
    expect(executed).toBe(false);
  });

  it("does not execute when another worker owns the WorkflowRun", async () => {
    const f = fixture();
    const runs = new MemoryRuns(f.run);
    let executed = false;
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: { async assertCurrent() {} },
      nodeExecutor: {
        async execute() {
          executed = true;
          return { kind: "advance", nextNodeId: "finish" };
        },
      },
      executionGuard: { async acquire() { return null; } },
    });

    const result = await executor.resume({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.run.workflowRunId,
      graph: f.graph,
    });

    expect(result.disposition).toBe("busy");
    expect(result.stepsExecuted).toBe(0);
    expect(executed).toBe(false);
  });

  it("yields at the configured step bound instead of looping forever", async () => {
    const f = fixture();
    const loopGraph: WorkflowGraph = {
      ...f.graph,
      graphSignature: "graph:loop:v1",
      nodes: [
        { nodeId: "start", nextNodeIds: ["other"] },
        { nodeId: "other", nextNodeIds: ["start"] },
      ],
    };
    const runs = new MemoryRuns(f.run);
    const executor = createWorkflowExecutor({
      runs,
      authorityGate: { async assertCurrent() {} },
      nodeExecutor: {
        async execute({ node }) {
          return {
            kind: "advance",
            nextNodeId: node.nodeId === "start" ? "other" : "start",
          };
        },
      },
      executionGuard: openGuard,
      maxStepsPerResume: 2,
      now: () => f.at,
    });

    const result = await executor.resume({
      authority: f.authority,
      scope: f.scope,
      workflowRunId: f.run.workflowRunId,
      graph: loopGraph,
    });

    expect(result.disposition).toBe("yielded");
    expect(result.stepsExecuted).toBe(2);
    expect(result.run.checkpointRevision).toBe(2);
  });
});
