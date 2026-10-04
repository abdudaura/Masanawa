import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  assertWorkflowCheckpointCompatible,
  createWorkflowCheckpoint,
  createWorkflowCheckpointPayload,
  workflowCheckpointFingerprint,
  workflowCheckpointLimits,
} from "./index.js";

function payload() {
  return {
    runState: {
      state: "running",
      revision: 3,
    },
    taskStates: {
      task_a: {
        state: "waiting",
        revision: 4,
      },
    },
    executorStates: {
      executor_a: {
        cursor: 2,
      },
    },
    edgeStates: {
      edge_a: {
        delivered: true,
      },
    },
    pendingRequestStates: {
      request_a: {
        kind: "human_input",
        state: "pending",
      },
    },
    iteration: 2,
    superstep: 3,
    evidenceRefs: ["event:one", "event:one", "receipt:two"],
  } as const;
}

function checkpointInput() {
  return {
    schemaVersion: 1 as const,
    tenantId: createCanonicalId("tenant"),
    workflowRunId: createCanonicalId("workflow-run"),
    workflowVersionId: createCanonicalId("workflow-version"),
    graphSignature: `sha256:${"a".repeat(64)}`,
    sequence: 1,
    parentSequence: null,
    workflowRunRevision: 3,
    payload: payload(),
    createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
  };
}

describe("Workflow checkpoint contracts", () => {
  it("normalizes and freezes bounded checkpoint payloads deterministically", () => {
    const source = payload();
    const normalized = createWorkflowCheckpointPayload(source);
    const before = JSON.stringify(normalized);

    (source.taskStates.task_a as { state: string }).state = "mutated";

    expect(JSON.stringify(normalized)).toBe(before);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.taskStates)).toBe(true);
    expect(normalized.evidenceRefs).toEqual(["event:one", "receipt:two"]);
  });

  it("fingerprints equivalent payloads independent of input object ordering", () => {
    const first = payload();
    const second = {
      ...first,
      runState: {
        revision: 3,
        state: "running",
      },
    };

    expect(workflowCheckpointFingerprint(first)).toBe(
      workflowCheckpointFingerprint(second),
    );
    expect(workflowCheckpointFingerprint(first)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("creates immutable checkpoint sequence/parent lineage and exact fingerprint", () => {
    const first = createWorkflowCheckpoint(checkpointInput());
    expect(first).toMatchObject({
      schemaVersion: 1,
      sequence: 1,
      parentSequence: null,
      workflowRunRevision: 3,
    });
    expect(first.payloadFingerprint).toBe(
      workflowCheckpointFingerprint(first.payload),
    );

    const second = createWorkflowCheckpoint({
      ...checkpointInput(),
      sequence: 2,
      parentSequence: 1,
      workflowRunRevision: 4,
    });
    expect(second.parentSequence).toBe(1);

    expect(() =>
      createWorkflowCheckpoint({
        ...checkpointInput(),
        sequence: 2,
        parentSequence: null,
      }),
    ).toThrow(/requires parentSequence/u);
  });

  it("rejects restore compatibility drift", () => {
    const checkpoint = createWorkflowCheckpoint(checkpointInput());
    expect(() =>
      assertWorkflowCheckpointCompatible(checkpoint, {
        schemaVersion: 1,
        tenantId: checkpoint.tenantId,
        workflowRunId: checkpoint.workflowRunId,
        workflowVersionId: checkpoint.workflowVersionId,
        graphSignature: checkpoint.graphSignature,
      }),
    ).not.toThrow();

    expect(() =>
      assertWorkflowCheckpointCompatible(checkpoint, {
        schemaVersion: 1,
        tenantId: checkpoint.tenantId,
        workflowRunId: checkpoint.workflowRunId,
        workflowVersionId: createCanonicalId("workflow-version"),
        graphSignature: checkpoint.graphSignature,
      }),
    ).toThrow(/incompatible/u);
  });

  it("rejects restored authority/credential state and non-plain values", () => {
    expect(() =>
      createWorkflowCheckpointPayload({
        ...payload(),
        executorStates: {
          executor_a: {
            authorityContextId: "authority-context_example",
          },
        },
      }),
    ).toThrow(/forbidden restored-authority state/u);

    expect(() =>
      createWorkflowCheckpointPayload({
        ...payload(),
        runState: {
          when: new Date() as never,
        },
      }),
    ).toThrow(/plain JSON-like objects/u);
  });

  it("rejects excessive depth/cardinality and non-finite numbers", () => {
    let deep: unknown = "leaf";
    for (let index = 0; index < workflowCheckpointLimits.maxDepth + 1; index += 1) {
      deep = { next: deep };
    }
    expect(() =>
      createWorkflowCheckpointPayload({
        ...payload(),
        runState: {
          deep: deep as never,
        },
      }),
    ).toThrow(/maximum checkpoint depth/u);

    expect(() =>
      createWorkflowCheckpointPayload({
        ...payload(),
        runState: {
          score: Number.POSITIVE_INFINITY,
        },
      }),
    ).toThrow(/non-finite number/u);
  });

  it("rejects mismatched supplied fingerprints and malformed graph signatures", () => {
    expect(() =>
      createWorkflowCheckpoint({
        ...checkpointInput(),
        payloadFingerprint: "0".repeat(64),
      }),
    ).toThrow(/does not match payload/u);

    expect(() =>
      createWorkflowCheckpoint({
        ...checkpointInput(),
        graphSignature: "invalid",
      }),
    ).toThrow(/canonical sha256/u);
  });
});
