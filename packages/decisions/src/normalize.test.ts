import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  createDecisionDefinition,
  createDecisionRequest,
  createDecisionResult,
  decisionLimits,
  type DecisionDefinition,
} from "./index.js";

function definitionInput(): DecisionDefinition {
  return {
    decisionClass: "star_skill_route",
    schemaVersion: "star_skill_route.v1",
    risk: "medium",
    rollout: "shadow",
    deterministicFallback: "Use the existing deterministic routing policy.",
    questions: {
      route: {
        type: "choice",
        instructions: "Choose only from the supplied eligible routing classes.",
        criteria: {
          current_star_skill: "Use the current Star's eligible skill.",
          specialist_skill: "Use an already-eligible specialist skill.",
          no_skill_needed: "No skill workflow is required.",
          unclear: "The bounded state is insufficient.",
        },
      },
      needs_review: {
        type: "noul",
        instructions: "Does this bounded decision need operator review?",
      },
      confidence_band: {
        type: "score",
        instructions: "Score bounded routing confidence.",
        min: 0,
        max: 5,
        criteria: ["0 means no confidence", "5 means strong confidence"],
      },
    },
  };
}

describe("Decision/JEV contracts", () => {
  it("normalizes definitions deterministically and snapshots mutable inputs", () => {
    const input = definitionInput();
    const definition = createDecisionDefinition(input);
    const before = JSON.stringify(definition);

    (input.questions.route as { criteria: Record<string, string> }).criteria
      .current_star_skill = "mutated";
    (input.questions as Record<string, unknown>).later = {
      type: "noul",
      instructions: "late mutation",
    };

    expect(JSON.stringify(definition)).toBe(before);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.questions)).toBe(true);
    expect(Object.keys(definition.questions)).toEqual([
      "confidence_band",
      "needs_review",
      "route",
    ]);
  });

  it("normalizes packets recursively and preserves canonical trace references", () => {
    const operationA = createCanonicalId("operation");
    const operationB = createCanonicalId("operation");
    const nested = {
      zeta: "last",
      alpha: {
        items: ["one", "two"],
        enabled: true,
      },
    };

    const request = createDecisionRequest({
      decisionClass: "star_skill_route",
      schemaVersion: "star_skill_route.v1",
      packet: nested,
      trace: {
        tenantId: createCanonicalId("tenant"),
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
        taskId: createCanonicalId("task"),
        workflowRunId: createCanonicalId("workflow-run"),
        operationIds: [operationA, operationA, operationB],
      },
    });

    expect(Object.keys(request.packet)).toEqual(["alpha", "zeta"]);
    expect(request.trace.operationIds).toEqual([operationA, operationB]);
    expect(Object.isFrozen(request.packet.alpha)).toBe(true);
    expect(Object.isFrozen(request.trace.operationIds)).toBe(true);
  });

  it("accepts only complete answers that satisfy the declared closed sets", () => {
    const definition = createDecisionDefinition(definitionInput());
    const result = createDecisionResult(definition, {
      decisionClass: "star_skill_route",
      schemaVersion: "star_skill_route.v1",
      answers: {
        route: "specialist_skill",
        needs_review: false,
        confidence_band: 4,
      },
      confidence: 0.82,
      evidenceRefs: ["eligible-skill:specialist", "eligible-skill:specialist"],
    });

    expect(result.answers.route).toBe("specialist_skill");
    expect(result.evidenceRefs).toEqual(["eligible-skill:specialist"]);
    expect(Object.isFrozen(result.answers)).toBe(true);

    expect(() =>
      createDecisionResult(definition, {
        ...result,
        answers: {
          route: "invented_skill",
          needs_review: false,
          confidence_band: 4,
        },
      }),
    ).toThrow(/closed-set choices/u);

    expect(() =>
      createDecisionResult(definition, {
        ...result,
        answers: {
          route: "current_star_skill",
          needs_review: false,
        },
      }),
    ).toThrow(/every declared question exactly once/u);
  });

  it("rejects malformed schema keys, unbounded packets and invalid scores", () => {
    expect(() =>
      createDecisionDefinition({
        ...definitionInput(),
        decisionClass: "Bad Class",
      }),
    ).toThrow(/stable lowercase decision key/u);

    expect(() =>
      createDecisionRequest({
        decisionClass: "star_skill_route",
        schemaVersion: "star_skill_route.v1",
        packet: {
          text: "x".repeat(decisionLimits.maxStringLength + 1),
        },
        trace: {
          tenantId: createCanonicalId("tenant"),
          requestId: createCanonicalId("request"),
          correlationId: createCanonicalId("correlation"),
          taskId: null,
          workflowRunId: null,
          operationIds: [],
        },
      }),
    ).toThrow(/maximum string length/u);

    const definition = createDecisionDefinition(definitionInput());
    expect(() =>
      createDecisionResult(definition, {
        decisionClass: definition.decisionClass,
        schemaVersion: definition.schemaVersion,
        answers: {
          route: "current_star_skill",
          needs_review: false,
          confidence_band: 99,
        },
        confidence: 1.1,
        evidenceRefs: [],
      }),
    ).toThrow(/score range/u);
  });

  it("rejects excessive depth, cardinality and mismatched schema identity", () => {
    let value: unknown = "leaf";
    for (let index = 0; index < decisionLimits.maxDepth + 1; index += 1) {
      value = { next: value };
    }

    expect(() =>
      createDecisionRequest({
        decisionClass: "star_skill_route",
        schemaVersion: "star_skill_route.v1",
        packet: { deep: value as never },
        trace: {
          tenantId: createCanonicalId("tenant"),
          requestId: createCanonicalId("request"),
          correlationId: createCanonicalId("correlation"),
          taskId: null,
          workflowRunId: null,
          operationIds: [],
        },
      }),
    ).toThrow(/maximum decision packet depth/u);

    const definition = createDecisionDefinition(definitionInput());
    expect(() =>
      createDecisionResult(definition, {
        decisionClass: "other_route",
        schemaVersion: "other_route.v1",
        answers: {
          route: "current_star_skill",
          needs_review: false,
          confidence_band: 3,
        },
        confidence: null,
        evidenceRefs: [],
      }),
    ).toThrow(/does not match the declared decision schema/u);
  });
});
