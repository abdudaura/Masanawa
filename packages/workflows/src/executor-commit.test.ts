import { describe, expect, it } from "vitest";
import { normalizeWorkflowExecutorFence } from "./executor-commit.js";

describe("Workflow executor commit fence", () => {
  it("normalizes a bounded holder/fence pair", () => {
    expect(
      normalizeWorkflowExecutorFence({ holderId: " worker-a ", fence: 7 }),
    ).toEqual({ holderId: "worker-a", fence: 7 });
  });

  it("rejects malformed holders and fences", () => {
    expect(() =>
      normalizeWorkflowExecutorFence({ holderId: "", fence: 1 }),
    ).toThrow("holderId");
    expect(() =>
      normalizeWorkflowExecutorFence({ holderId: "worker a", fence: 1 }),
    ).toThrow("holderId");
    expect(() =>
      normalizeWorkflowExecutorFence({ holderId: "worker-a", fence: 0 }),
    ).toThrow("fence");
  });
});
