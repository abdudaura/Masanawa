import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createWorkflowHumanRequest } from "./index.js";

const pending = {
  tenantId: createCanonicalId("tenant"),
  humanRequestId: createCanonicalId("request"),
  workflowRunId: createCanonicalId("workflow-run"),
  taskId: createCanonicalId("task"),
  workflowVersionId: createCanonicalId("workflow-version"),
  graphSignature: `sha256:${"a".repeat(64)}`,
  kind: "confirmation" as const,
  state: "pending" as const,
  prompt: "Continue with this action?",
  approvalId: null,
  response: null,
  requestedAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
  resolvedAt: null,
};

describe("workflow human request contracts", () => {
  it("creates immutable bounded pending requests", () => {
    const request = createWorkflowHumanRequest(pending);
    expect(Object.isFrozen(request)).toBe(true);
    expect(request.state).toBe("pending");
  });

  it("requires ApprovalId only for approval requests", () => {
    expect(() =>
      createWorkflowHumanRequest({
        ...pending,
        kind: "approval",
      }),
    ).toThrow(/ApprovalId/u);

    expect(() =>
      createWorkflowHumanRequest({
        ...pending,
        approvalId: createCanonicalId("approval"),
      }),
    ).toThrow(/ApprovalId/u);
  });

  it("validates terminal response semantics", () => {
    const resolvedAt = toInstant(new Date("2026-10-04T18:01:00.000Z"));
    expect(
      createWorkflowHumanRequest({
        ...pending,
        state: "answered",
        response: true,
        resolvedAt,
      }),
    ).toMatchObject({ state: "answered", response: true });

    expect(
      createWorkflowHumanRequest({
        ...pending,
        state: "rejected",
        response: false,
        resolvedAt,
      }),
    ).toMatchObject({ state: "rejected", response: false });

    expect(() =>
      createWorkflowHumanRequest({
        ...pending,
        state: "answered",
        response: false,
        resolvedAt,
      }),
    ).toThrow(/requires true response/u);
  });

  it("supports bounded information responses but not information rejection", () => {
    const resolvedAt = toInstant(new Date("2026-10-04T18:01:00.000Z"));
    expect(
      createWorkflowHumanRequest({
        ...pending,
        kind: "information",
        state: "answered",
        prompt: "What account should be used?",
        response: "Primary account",
        resolvedAt,
      }),
    ).toMatchObject({
      kind: "information",
      response: "Primary account",
    });

    expect(() =>
      createWorkflowHumanRequest({
        ...pending,
        kind: "information",
        state: "rejected",
        response: "no",
        resolvedAt,
      }),
    ).toThrow(/cannot use rejected state/u);
  });
});
