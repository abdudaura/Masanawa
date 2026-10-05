import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type ApprovalId,
  type Instant,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import {
  normalizeWorkflowCheckpoint,
  type JsonValue,
  type WorkflowCheckpoint,
  type WorkflowRun,
  type WorkflowRunRepository,
  type WorkflowRunScope,
} from "./workflow-run.js";

export interface WorkflowGraphNode {
  readonly nodeId: string;
  readonly nextNodeIds: readonly string[];
  readonly terminal?: boolean;
}

export interface WorkflowGraph {
  readonly workflowVersionId: WorkflowRun["workflowVersionId"];
  readonly graphSignature: string;
  readonly entryNodeId: string;
  readonly nodes: readonly WorkflowGraphNode[];
}

export interface NormalizedWorkflowGraph {
  readonly workflowVersionId: WorkflowRun["workflowVersionId"];
  readonly graphSignature: string;
  readonly entryNodeId: string;
  readonly nodes: ReadonlyMap<string, Readonly<WorkflowGraphNode>>;
}

export interface WorkflowNodeExecutionInput {
  readonly authority: AuthorityContext;
  readonly run: WorkflowRun;
  readonly node: Readonly<WorkflowGraphNode>;
  readonly committedState: Readonly<Record<string, JsonValue>>;
  readonly edgeState: Readonly<Record<string, JsonValue>>;
  readonly signal?: AbortSignal;
}

interface WorkflowNodeStateResult {
  readonly committedState?: Readonly<Record<string, JsonValue>>;
  readonly edgeState?: Readonly<Record<string, JsonValue>>;
}

export type WorkflowNodeExecutionResult =
  | (WorkflowNodeStateResult & {
      readonly kind: "advance";
      readonly nextNodeId: string;
    })
  | (WorkflowNodeStateResult & {
      readonly kind: "wait_approval";
      readonly resumeNodeId: string;
      readonly pendingApprovalIds: readonly ApprovalId[];
    })
  | (WorkflowNodeStateResult & {
      readonly kind: "wait_external";
      readonly resumeNodeId: string;
    })
  | (WorkflowNodeStateResult & {
      readonly kind: "complete";
    })
  | (WorkflowNodeStateResult & {
      readonly kind: "fail";
      readonly failureCode: string;
    });

export interface WorkflowNodeExecutor {
  execute(input: WorkflowNodeExecutionInput): Promise<WorkflowNodeExecutionResult>;
}

export interface WorkflowCurrentAuthorityGate {
  assertCurrent(input: {
    readonly authority: AuthorityContext;
    readonly run: WorkflowRun;
    readonly nodeId: string;
  }): Promise<void>;
}

export interface WorkflowResumeRequest {
  readonly authority: AuthorityContext;
  readonly scope: WorkflowRunScope;
  readonly workflowRunId: WorkflowRun["workflowRunId"];
  readonly graph: WorkflowGraph;
  readonly signal?: AbortSignal;
}

export interface WorkflowResumeResult {
  readonly disposition: "paused" | "yielded" | "terminal";
  readonly run: WorkflowRun;
  readonly checkpoint: WorkflowCheckpoint | null;
  readonly stepsExecuted: number;
}

export interface WorkflowExecutor {
  resume(input: WorkflowResumeRequest): Promise<WorkflowResumeResult>;
}

function boundedNodeId(value: string, name: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 160 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function boundedGraphSignature(value: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 256 ||
    /[\r\n\0]/u.test(normalized)
  ) {
    throw new TypeError("Workflow graphSignature is invalid");
  }
  return normalized;
}

export function normalizeWorkflowGraph(
  input: WorkflowGraph,
): NormalizedWorkflowGraph {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.nodes) ||
    input.nodes.length < 1 ||
    input.nodes.length > 512
  ) {
    throw new TypeError("Workflow graph is invalid");
  }
  const workflowVersionId = parseCanonicalId(
    "workflow-version",
    input.workflowVersionId,
  );
  const graphSignature = boundedGraphSignature(input.graphSignature);
  const entryNodeId = boundedNodeId(input.entryNodeId, "entryNodeId");

  const mutable = new Map<string, Readonly<WorkflowGraphNode>>();
  for (const raw of input.nodes) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !Array.isArray(raw.nextNodeIds) ||
      raw.nextNodeIds.length > 64
    ) {
      throw new TypeError("Workflow graph node is invalid");
    }
    const nodeId = boundedNodeId(raw.nodeId, "nodeId");
    if (mutable.has(nodeId)) {
      throw new TypeError("Workflow graph node IDs must be unique");
    }
    const nextNodeIds = raw.nextNodeIds.map((value) =>
      boundedNodeId(value, "nextNodeId"),
    );
    if (new Set(nextNodeIds).size !== nextNodeIds.length) {
      throw new TypeError("Workflow graph edges must be unique");
    }
    mutable.set(
      nodeId,
      Object.freeze({
        nodeId,
        nextNodeIds: Object.freeze(nextNodeIds),
        ...(raw.terminal === undefined ? {} : { terminal: raw.terminal }),
      }),
    );
  }
  if (!mutable.has(entryNodeId)) {
    throw new TypeError("Workflow entry node does not exist");
  }
  for (const node of mutable.values()) {
    for (const next of node.nextNodeIds) {
      if (!mutable.has(next)) {
        throw new TypeError("Workflow graph edge targets a missing node");
      }
    }
    if (node.terminal === true && node.nextNodeIds.length > 0) {
      throw new TypeError("Terminal Workflow node cannot have outgoing edges");
    }
  }

  return Object.freeze({
    workflowVersionId,
    graphSignature,
    entryNodeId,
    nodes: mutable,
  });
}

function executorCursor(checkpoint: WorkflowCheckpoint): {
  readonly currentNodeId: string | null;
  readonly stepCount: number;
} {
  const current = checkpoint.executorState["currentNodeId"];
  const steps = checkpoint.executorState["stepCount"];
  if (
    !(
      current === null ||
      (typeof current === "string" && current.trim().length > 0)
    ) ||
    typeof steps !== "number" ||
    !Number.isSafeInteger(steps) ||
    steps < 0
  ) {
    throw new PlatformError({
      code: "workflows.checkpoint_executor_state_invalid",
      category: "conflict",
      message: "Workflow checkpoint executor cursor is invalid",
      retryable: false,
    });
  }
  return Object.freeze({
    currentNodeId:
      current === null ? null : boundedNodeId(current, "checkpoint currentNodeId"),
    stepCount: steps,
  });
}

function incompatible(message: string): PlatformError {
  return new PlatformError({
    code: "workflows.restore_incompatible",
    category: "conflict",
    message,
    retryable: false,
  });
}

function illegalEdge(message: string): PlatformError {
  return new PlatformError({
    code: "workflows.edge_invalid",
    category: "conflict",
    message,
    retryable: false,
  });
}

function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new PlatformError({
      code: "workflows.execution_aborted",
      category: "conflict",
      message: "Workflow execution was aborted",
      retryable: true,
    });
  }
}

function stateOrPrevious(
  value: Readonly<Record<string, JsonValue>> | undefined,
  previous: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  return value ?? previous;
}

function nextAllowed(
  graph: NormalizedWorkflowGraph,
  current: Readonly<WorkflowGraphNode>,
  nextNodeId: string,
  allowSame: boolean,
): string {
  const normalized = boundedNodeId(nextNodeId, "nextNodeId");
  if (
    (!allowSame || normalized !== current.nodeId) &&
    !current.nextNodeIds.includes(normalized)
  ) {
    throw illegalEdge(
      `Workflow node ${current.nodeId} cannot advance to ${normalized}`,
    );
  }
  if (!graph.nodes.has(normalized)) {
    throw illegalEdge("Workflow next node does not exist");
  }
  return normalized;
}

function checkpointFor(input: {
  readonly run: WorkflowRun;
  readonly graph: NormalizedWorkflowGraph;
  readonly prior: WorkflowCheckpoint | null;
  readonly currentNodeId: string | null;
  readonly stepCount: number;
  readonly committedState: Readonly<Record<string, JsonValue>>;
  readonly edgeState: Readonly<Record<string, JsonValue>>;
  readonly pendingApprovalIds: readonly ApprovalId[];
  readonly createdAt: Instant;
}): WorkflowCheckpoint {
  return normalizeWorkflowCheckpoint({
    schemaVersion: 1,
    workflowRunId: input.run.workflowRunId,
    checkpointRevision: input.run.checkpointRevision + 1,
    graphSignature: input.graph.graphSignature,
    committedState: input.committedState,
    executorState: Object.freeze({
      currentNodeId: input.currentNodeId,
      stepCount: input.stepCount,
    }),
    edgeState: input.edgeState,
    pendingApprovalIds: input.pendingApprovalIds,
    createdAt: input.createdAt,
  });
}

function pausedResult(
  run: WorkflowRun,
  checkpoint: WorkflowCheckpoint | null,
): WorkflowResumeResult {
  return Object.freeze({
    disposition:
      run.state === "completed" ||
      run.state === "failed" ||
      run.state === "cancelled"
        ? "terminal"
        : "paused",
    run,
    checkpoint,
    stepsExecuted: 0,
  });
}

export function createWorkflowExecutor(input: {
  readonly runs: WorkflowRunRepository;
  readonly authorityGate: WorkflowCurrentAuthorityGate;
  readonly nodeExecutor: WorkflowNodeExecutor;
  readonly now?: () => Instant;
  readonly maxStepsPerResume?: number;
}): WorkflowExecutor {
  const maxSteps = input.maxStepsPerResume ?? 32;
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 256) {
    throw new RangeError("Workflow maxStepsPerResume is invalid");
  }
  const now = input.now ?? (() => toInstant(new Date()));

  return Object.freeze({
    async resume(request) {
      aborted(request.signal);
      const graph = normalizeWorkflowGraph(request.graph);
      const workflowRunId = parseCanonicalId(
        "workflow-run",
        request.workflowRunId,
      );

      let run = await input.runs.read({
        authority: request.authority,
        scope: request.scope,
        workflowRunId,
      });
      let checkpoint = await input.runs.readLatestCheckpoint({
        authority: request.authority,
        scope: request.scope,
        workflowRunId,
      });

      if (run.workflowVersionId !== graph.workflowVersionId) {
        throw incompatible("Workflow version does not match the persisted run");
      }
      if (run.checkpointRevision === 0 && checkpoint !== null) {
        throw incompatible("WorkflowRun checkpoint revision is inconsistent");
      }
      if (
        run.checkpointRevision > 0 &&
        (checkpoint === null ||
          checkpoint.checkpointRevision !== run.checkpointRevision)
      ) {
        throw incompatible("Latest Workflow checkpoint is missing or stale");
      }
      if (
        checkpoint !== null &&
        checkpoint.graphSignature !== graph.graphSignature
      ) {
        throw incompatible("Workflow graph signature changed since checkpoint");
      }

      if (run.state !== "running") {
        return pausedResult(run, checkpoint);
      }

      let committedState: Readonly<Record<string, JsonValue>> =
        checkpoint?.committedState ?? Object.freeze({});
      let edgeState: Readonly<Record<string, JsonValue>> =
        checkpoint?.edgeState ?? Object.freeze({});
      let currentNodeId = graph.entryNodeId;
      let persistedStepCount = 0;

      if (checkpoint !== null) {
        const cursor = executorCursor(checkpoint);
        if (cursor.currentNodeId === null) {
          throw incompatible(
            "Running WorkflowRun has a terminal checkpoint cursor",
          );
        }
        if (!graph.nodes.has(cursor.currentNodeId)) {
          throw incompatible(
            "Checkpoint current node is not present in this graph",
          );
        }
        currentNodeId = cursor.currentNodeId;
        persistedStepCount = cursor.stepCount;
      }

      let stepsExecuted = 0;
      while (stepsExecuted < maxSteps) {
        aborted(request.signal);
        const node = graph.nodes.get(currentNodeId);
        if (!node) {
          throw incompatible("Workflow current node is missing");
        }

        await input.authorityGate.assertCurrent({
          authority: request.authority,
          run,
          nodeId: node.nodeId,
        });
        aborted(request.signal);

        const outcome = await input.nodeExecutor.execute({
          authority: request.authority,
          run,
          node,
          committedState,
          edgeState,
          ...(request.signal ? { signal: request.signal } : {}),
        });
        stepsExecuted += 1;
        persistedStepCount += 1;
        committedState = stateOrPrevious(
          outcome.committedState,
          committedState,
        );
        edgeState = stateOrPrevious(outcome.edgeState, edgeState);

        if (outcome.kind === "advance") {
          const nextNodeId = nextAllowed(
            graph,
            node,
            outcome.nextNodeId,
            false,
          );
          const nextCheckpoint = checkpointFor({
            run,
            graph,
            prior: checkpoint,
            currentNodeId: nextNodeId,
            stepCount: persistedStepCount,
            committedState,
            edgeState,
            pendingApprovalIds: [],
            createdAt: now(),
          });
          run = await input.runs.appendCheckpoint({
            authority: request.authority,
            scope: request.scope,
            expectedRunRevision: run.revision,
            checkpoint: nextCheckpoint,
          });
          checkpoint = nextCheckpoint;
          currentNodeId = nextNodeId;
          continue;
        }

        if (outcome.kind === "wait_approval") {
          const resumeNodeId = nextAllowed(
            graph,
            node,
            outcome.resumeNodeId,
            true,
          );
          if (outcome.pendingApprovalIds.length === 0) {
            throw new TypeError(
              "wait_approval requires pending approval IDs",
            );
          }
          const nextCheckpoint = checkpointFor({
            run,
            graph,
            prior: checkpoint,
            currentNodeId: resumeNodeId,
            stepCount: persistedStepCount,
            committedState,
            edgeState,
            pendingApprovalIds: outcome.pendingApprovalIds,
            createdAt: now(),
          });
          run = await input.runs.commitCheckpoint({
            authority: request.authority,
            scope: request.scope,
            expectedRunRevision: run.revision,
            checkpoint: nextCheckpoint,
            transition: {
              to: "waiting_approval",
              pendingApprovalIds: outcome.pendingApprovalIds,
            },
          });
          checkpoint = nextCheckpoint;
          return Object.freeze({
            disposition: "paused",
            run,
            checkpoint,
            stepsExecuted,
          });
        }

        if (outcome.kind === "wait_external") {
          const resumeNodeId = nextAllowed(
            graph,
            node,
            outcome.resumeNodeId,
            true,
          );
          const nextCheckpoint = checkpointFor({
            run,
            graph,
            prior: checkpoint,
            currentNodeId: resumeNodeId,
            stepCount: persistedStepCount,
            committedState,
            edgeState,
            pendingApprovalIds: [],
            createdAt: now(),
          });
          run = await input.runs.commitCheckpoint({
            authority: request.authority,
            scope: request.scope,
            expectedRunRevision: run.revision,
            checkpoint: nextCheckpoint,
            transition: { to: "waiting_external" },
          });
          checkpoint = nextCheckpoint;
          return Object.freeze({
            disposition: "paused",
            run,
            checkpoint,
            stepsExecuted,
          });
        }

        if (outcome.kind === "complete") {
          if (node.terminal !== true) {
            throw illegalEdge(
              "Only a terminal Workflow node may complete the run",
            );
          }
          const nextCheckpoint = checkpointFor({
            run,
            graph,
            prior: checkpoint,
            currentNodeId: null,
            stepCount: persistedStepCount,
            committedState,
            edgeState,
            pendingApprovalIds: [],
            createdAt: now(),
          });
          run = await input.runs.commitCheckpoint({
            authority: request.authority,
            scope: request.scope,
            expectedRunRevision: run.revision,
            checkpoint: nextCheckpoint,
            transition: { to: "completed" },
          });
          checkpoint = nextCheckpoint;
          return Object.freeze({
            disposition: "terminal",
            run,
            checkpoint,
            stepsExecuted,
          });
        }

        const nextCheckpoint = checkpointFor({
          run,
          graph,
          prior: checkpoint,
          currentNodeId: null,
          stepCount: persistedStepCount,
          committedState,
          edgeState,
          pendingApprovalIds: [],
          createdAt: now(),
        });
        run = await input.runs.commitCheckpoint({
          authority: request.authority,
          scope: request.scope,
          expectedRunRevision: run.revision,
          checkpoint: nextCheckpoint,
          transition: {
            to: "failed",
            failureCode: outcome.failureCode,
          },
        });
        checkpoint = nextCheckpoint;
        return Object.freeze({
          disposition: "terminal",
          run,
          checkpoint,
          stepsExecuted,
        });
      }

      return Object.freeze({
        disposition: "yielded",
        run,
        checkpoint,
        stepsExecuted,
      });
    },
  });
}
