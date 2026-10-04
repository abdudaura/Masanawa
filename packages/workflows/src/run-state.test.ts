import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  assertChildTaskLineage,
  assertTaskBelongsToRun,
  assertWorkflowRunMatchesVersion,
  createWorkflowRun,
  createWorkflowVersion,
  createWorkflowTask,
  transitionWorkflowRun,
  transitionWorkflowTask,
  type WorkflowRun,
  type WorkflowTask,
} from "./index.js";

const t0 = toInstant(new Date("2026-10-04T18:00:00.000Z"));
const t1 = toInstant(new Date("2026-10-04T18:01:00.000Z"));
const t2 = toInstant(new Date("2026-10-04T18:02:00.000Z"));
const t3 = toInstant(new Date("2026-10-04T18:03:00.000Z"));

function pendingRun(): WorkflowRun {
  return {
    tenantId: createCanonicalId("tenant"),
    workflowRunId: createCanonicalId("workflow-run"),
    workflowId: createCanonicalId("workflow"),
    workflowVersionId: createCanonicalId("workflow-version"),
    graphSignature: `sha256:${"a".repeat(64)}`,
    initiatedByUserId: createCanonicalId("user"),
    state: "pending",
    revision: 1,
    createdAt: t0,
    updatedAt: t0,
    startedAt: null,
    terminalAt: null,
    waitReason: null,
    failure: null,
    cancellationReason: null,
  };
}

function rootTask(run = pendingRun()): WorkflowTask {
  const taskId = createCanonicalId("task");
  return {
    tenantId: run.tenantId,
    taskId,
    workflowRunId: run.workflowRunId,
    workflowVersionId: run.workflowVersionId,
    graphSignature: run.graphSignature,
    nodeKey: "start",
    lineage: {
      parentTaskId: null,
      rootTaskId: taskId,
      depth: 0,
    },
    state: "pending",
    revision: 1,
    createdAt: t0,
    updatedAt: t0,
    startedAt: null,
    terminalAt: null,
    waitReason: null,
    failure: null,
    cancellationReason: null,
  };
}

describe("WorkflowRun and Task canonical state", () => {
  it("progresses a WorkflowRun through waiting and completion with optimistic revisions", () => {
    const pending = createWorkflowRun(pendingRun());
    const running = transitionWorkflowRun(pending, "running", {
      expectedRevision: 1,
      at: t1,
    });
    expect(running).toMatchObject({
      state: "running",
      revision: 2,
      startedAt: t1,
      terminalAt: null,
    });

    const waiting = transitionWorkflowRun(running, "waiting", {
      expectedRevision: 2,
      at: t2,
      waitReason: "awaiting_human_input",
    });
    expect(waiting.waitReason).toBe("awaiting_human_input");

    const completed = transitionWorkflowRun(waiting, "completed", {
      expectedRevision: 3,
      at: t3,
    });
    expect(completed).toMatchObject({
      state: "completed",
      revision: 4,
      startedAt: t1,
      terminalAt: t3,
      waitReason: null,
      failure: null,
      cancellationReason: null,
    });
  });

  it("rejects stale revisions and all terminal rewrites", () => {
    const running = transitionWorkflowRun(createWorkflowRun(pendingRun()), "running", {
      expectedRevision: 1,
      at: t1,
    });

    expect(() =>
      transitionWorkflowRun(running, "waiting", {
        expectedRevision: 1,
        at: t2,
        waitReason: "stale",
      }),
    ).toThrow(/revision conflict/u);

    const completed = transitionWorkflowRun(running, "completed", {
      expectedRevision: 2,
      at: t2,
    });

    for (const target of ["running", "waiting", "failed", "cancelled"] as const) {
      expect(() =>
        transitionWorkflowRun(completed, target, {
          expectedRevision: 3,
          at: t3,
          ...(target === "waiting" ? { waitReason: "late" } : {}),
          ...(target === "failed"
            ? { failure: { code: "late.failure", message: "late" } }
            : {}),
          ...(target === "cancelled"
            ? { cancellationReason: "late cancellation" }
            : {}),
        }),
      ).toThrow(/illegal WorkflowRun transition/u);
    }
  });

  it("supports failure and cancellation metadata without inventing start time for pre-start cancellation", () => {
    const failed = transitionWorkflowRun(createWorkflowRun(pendingRun()), "failed", {
      expectedRevision: 1,
      at: t1,
      failure: {
        code: "workflow.invalid_input",
        message: "Required canonical input is unavailable.",
      },
    });
    expect(failed).toMatchObject({
      state: "failed",
      startedAt: t1,
      terminalAt: t1,
      failure: {
        code: "workflow.invalid_input",
      },
    });

    const cancelled = transitionWorkflowRun(
      createWorkflowRun(pendingRun()),
      "cancelled",
      {
        expectedRevision: 1,
        at: t1,
        cancellationReason: "User cancelled before execution.",
      },
    );
    expect(cancelled).toMatchObject({
      state: "cancelled",
      startedAt: null,
      terminalAt: t1,
    });
  });

  it("enforces root and child Task lineage", () => {
    const run = createWorkflowRun(pendingRun());
    const root = createWorkflowTask(rootTask(run));
    expect(root.lineage).toEqual({
      parentTaskId: null,
      rootTaskId: root.taskId,
      depth: 0,
    });

    const childId = createCanonicalId("task");
    const child = createWorkflowTask({
      ...rootTask(run),
      taskId: childId,
      nodeKey: "child",
      lineage: {
        parentTaskId: root.taskId,
        rootTaskId: root.taskId,
        depth: 1,
      },
    });
    expect(child.lineage.depth).toBe(1);

    expect(() =>
      createWorkflowTask({
        ...child,
        lineage: {
          parentTaskId: null,
          rootTaskId: root.taskId,
          depth: 1,
        },
      }),
    ).toThrow(/child task lineage requires a parent/u);

    expect(() =>
      createWorkflowTask({
        ...root,
        lineage: {
          parentTaskId: createCanonicalId("task"),
          rootTaskId: root.taskId,
          depth: 0,
        },
      }),
    ).toThrow(/root task lineage/u);
  });

  it("progresses Task pending -> ready -> running -> waiting -> ready -> running -> completed", () => {
    const task = createWorkflowTask(rootTask());
    const ready = transitionWorkflowTask(task, "ready", {
      expectedRevision: 1,
      at: t1,
    });
    expect(ready.startedAt).toBeNull();

    const running = transitionWorkflowTask(ready, "running", {
      expectedRevision: 2,
      at: t2,
    });
    expect(running.startedAt).toBe(t2);

    const waiting = transitionWorkflowTask(running, "waiting", {
      expectedRevision: 3,
      at: t3,
      waitReason: "awaiting_dependency",
    });
    expect(waiting.waitReason).toBe("awaiting_dependency");

    const readyAgain = transitionWorkflowTask(waiting, "ready", {
      expectedRevision: 4,
      at: toInstant(new Date("2026-10-04T18:04:00.000Z")),
    });
    expect(readyAgain.startedAt).toBe(t2);

    const runningAgain = transitionWorkflowTask(readyAgain, "running", {
      expectedRevision: 5,
      at: toInstant(new Date("2026-10-04T18:05:00.000Z")),
    });
    const completed = transitionWorkflowTask(runningAgain, "completed", {
      expectedRevision: 6,
      at: toInstant(new Date("2026-10-04T18:06:00.000Z")),
    });

    expect(completed).toMatchObject({
      state: "completed",
      revision: 7,
      startedAt: t2,
      terminalAt: toInstant(new Date("2026-10-04T18:06:00.000Z")),
    });
  });

  it("pins Tasks to exact tenant/run/version/graph identity", () => {
    const run = createWorkflowRun(pendingRun());
    const task = createWorkflowTask(rootTask(run));

    expect(() => assertTaskBelongsToRun(task, run)).not.toThrow();

    expect(() =>
      assertTaskBelongsToRun(
        {
          ...task,
          graphSignature: `sha256:${"b".repeat(64)}`,
        },
        run,
      ),
    ).toThrow(/not pinned/u);

    expect(() =>
      assertTaskBelongsToRun(
        {
          ...task,
          workflowVersionId: createCanonicalId("workflow-version"),
        },
        run,
      ),
    ).toThrow(/not pinned/u);
  });

  it("rejects invalid metadata/state combinations and malformed graph pins", () => {
    expect(() =>
      createWorkflowRun({
        ...pendingRun(),
        state: "waiting",
        startedAt: t1,
        updatedAt: t1,
        waitReason: null,
      }),
    ).toThrow(/waitReason/u);

    expect(() =>
      createWorkflowRun({
        ...pendingRun(),
        state: "bogus" as never,
      }),
    ).toThrow(/state is not supported/u);

    expect(() =>
      createWorkflowRun({
        ...pendingRun(),
        graphSignature: "not-a-signature",
      }),
    ).toThrow(/canonical sha256/u);

    expect(() =>
      createWorkflowRun({
        ...pendingRun(),
        updatedAt: toInstant(new Date("2026-10-04T17:59:00.000Z")),
      }),
    ).toThrow(/cannot precede createdAt/u);
  });

  it("requires state-specific transition metadata", () => {
    const run = transitionWorkflowRun(createWorkflowRun(pendingRun()), "running", {
      expectedRevision: 1,
      at: t1,
    });
    expect(() =>
      transitionWorkflowRun(run, "waiting", {
        expectedRevision: 2,
        at: t2,
      }),
    ).toThrow(/waitReason/u);

    expect(() =>
      transitionWorkflowRun(run, "failed", {
        expectedRevision: 2,
        at: t2,
      }),
    ).toThrow(/failure metadata is required/u);

    expect(() =>
      transitionWorkflowRun(run, "cancelled", {
        expectedRevision: 2,
        at: t2,
      }),
    ).toThrow(/cancellationReason/u);
  });

  it("verifies exact WorkflowVersion pinning", () => {
    const pending = pendingRun();
    const version = createWorkflowVersion({
      tenantId: pending.tenantId,
      workflowId: pending.workflowId,
      workflowVersionId: pending.workflowVersionId,
      versionNumber: 1,
      graph: {
        entryNodeKeys: ["start"],
        nodes: [
          {
            key: "start",
            kind: "terminal",
            label: "Done",
            executor: null,
          },
        ],
        edges: [],
      },
      createdAt: t0,
    });
    const run = createWorkflowRun({
      ...pending,
      graphSignature: version.graphSignature,
    });

    expect(() => assertWorkflowRunMatchesVersion(run, version)).not.toThrow();

    expect(() =>
      assertWorkflowRunMatchesVersion(
        run,
        {
          ...version,
          workflowVersionId: createCanonicalId("workflow-version"),
        },
      ),
    ).toThrow(/not pinned/u);
  });

  it("verifies child Task lineage against the actual parent Task", () => {
    const run = createWorkflowRun(pendingRun());
    const parent = createWorkflowTask(rootTask(run));
    const childId = createCanonicalId("task");
    const child = createWorkflowTask({
      ...rootTask(run),
      taskId: childId,
      nodeKey: "child",
      lineage: {
        parentTaskId: parent.taskId,
        rootTaskId: parent.taskId,
        depth: 1,
      },
    });

    expect(() => assertChildTaskLineage(child, parent)).not.toThrow();

    expect(() =>
      assertChildTaskLineage(
        {
          ...child,
          lineage: {
            ...child.lineage,
            depth: 2,
          },
        },
        parent,
      ),
    ).toThrow(/does not match the supplied parent/u);

    expect(() =>
      assertChildTaskLineage(
        {
          ...child,
          workflowRunId: createCanonicalId("workflow-run"),
        },
        parent,
      ),
    ).toThrow(/same WorkflowRun\/version\/graph/u);
  });

});
