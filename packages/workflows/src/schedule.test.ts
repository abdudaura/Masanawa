import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  createWorkflowSchedule,
  workflowOccurrenceAt,
  workflowScheduleFingerprint,
} from "./index.js";

function base() {
  return {
    tenantId: createCanonicalId("tenant"),
    workflowRunId: createCanonicalId("workflow-run"),
    workflowVersionId: createCanonicalId("workflow-version"),
    graphSignature: `sha256:${"a".repeat(64)}`,
    scheduleKey: "daily_follow_up",
    targetNodeKey: "follow_up",
    createdAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
  };
}

describe("Workflow schedule contracts", () => {
  it("normalizes one-shot schedules and emits exactly one occurrence", () => {
    const schedule = createWorkflowSchedule({
      ...base(),
      spec: {
        kind: "once",
        at: toInstant(new Date("2026-10-05T08:00:00.000Z")),
      },
    });

    expect(workflowOccurrenceAt(schedule, 1)).toEqual({
      sequence: 1,
      dueAt: toInstant(new Date("2026-10-05T08:00:00.000Z")),
    });
    expect(workflowOccurrenceAt(schedule, 2)).toBeNull();
  });

  it("calculates deterministic bounded interval occurrences", () => {
    const schedule = createWorkflowSchedule({
      ...base(),
      spec: {
        kind: "interval",
        firstAt: toInstant(new Date("2026-10-05T08:00:00.000Z")),
        everyMs: 60_000,
        maxOccurrences: 3,
        endAt: null,
      },
    });

    expect(workflowOccurrenceAt(schedule, 1)?.dueAt).toBe(
      toInstant(new Date("2026-10-05T08:00:00.000Z")),
    );
    expect(workflowOccurrenceAt(schedule, 2)?.dueAt).toBe(
      toInstant(new Date("2026-10-05T08:01:00.000Z")),
    );
    expect(workflowOccurrenceAt(schedule, 3)?.dueAt).toBe(
      toInstant(new Date("2026-10-05T08:02:00.000Z")),
    );
    expect(workflowOccurrenceAt(schedule, 4)).toBeNull();
  });

  it("respects inclusive end boundary", () => {
    const schedule = createWorkflowSchedule({
      ...base(),
      spec: {
        kind: "interval",
        firstAt: toInstant(new Date("2026-10-05T08:00:00.000Z")),
        everyMs: 60_000,
        maxOccurrences: null,
        endAt: toInstant(new Date("2026-10-05T08:01:00.000Z")),
      },
    });

    expect(workflowOccurrenceAt(schedule, 2)).not.toBeNull();
    expect(workflowOccurrenceAt(schedule, 3)).toBeNull();
  });

  it("fingerprints equivalent normalized schedules deterministically", () => {
    const schedule = createWorkflowSchedule({
      ...base(),
      spec: {
        kind: "interval",
        firstAt: toInstant(new Date("2026-10-05T08:00:00.000Z")),
        everyMs: 60_000,
        maxOccurrences: 3,
        endAt: null,
      },
    });

    expect(workflowScheduleFingerprint(schedule)).toBe(
      workflowScheduleFingerprint({ ...schedule }),
    );
    expect(workflowScheduleFingerprint(schedule)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects invalid bounds and malformed keys/signatures", () => {
    expect(() =>
      createWorkflowSchedule({
        ...base(),
        scheduleKey: "Bad Key",
        spec: {
          kind: "once",
          at: toInstant(new Date("2026-10-05T08:00:00.000Z")),
        },
      }),
    ).toThrow(/stable bounded lowercase/u);

    expect(() =>
      createWorkflowSchedule({
        ...base(),
        graphSignature: "invalid",
        spec: {
          kind: "once",
          at: toInstant(new Date("2026-10-05T08:00:00.000Z")),
        },
      }),
    ).toThrow(/canonical sha256/u);

    expect(() =>
      createWorkflowSchedule({
        ...base(),
        spec: {
          kind: "interval",
          firstAt: toInstant(new Date("2026-10-05T08:00:00.000Z")),
          everyMs: 0,
          maxOccurrences: null,
          endAt: null,
        },
      }),
    ).toThrow(/everyMs is out of bounds/u);
  });
});
