import { describe, expect, it } from "vitest";
import {
  PlatformError,
  createCanonicalId,
} from "@masanawa/contracts";
import type { SkillTraceMetadata } from "./trace.js";
import { normalizeSkillFailure } from "./failure.js";

function trace(): SkillTraceMetadata {
  return Object.freeze({
    schemaVersion: 1,
    kind: "step",
    rootSkillVersionId: createCanonicalId("skill-version"),
    skillVersionId: createCanonicalId("skill-version"),
    stepOrdinal: 0,
    planHash: `sha256:${"a".repeat(64)}`,
    referenceKey: null,
    toolVersionId: null,
    targetSkillVersionId: null,
  });
}

describe("Skill deterministic failure semantics", () => {
  it("preserves typed ambiguity and Operation identity for reconciliation", () => {
    const operationId = createCanonicalId("operation");
    const correlationId = createCanonicalId("correlation");
    const failure = normalizeSkillFailure(
      trace(),
      "tool",
      new PlatformError({
        code: "provider.dispatch_ambiguous",
        category: "ambiguous",
        message: "Provider outcome is uncertain",
        retryable: false,
        operationId,
        correlationId,
        details: { secret: "must-not-propagate" },
      }),
    );

    expect(failure).toMatchObject({
      source: "tool",
      code: "provider.dispatch_ambiguous",
      category: "ambiguous",
      retryable: false,
      disposition: "reconcile",
      message: "Provider outcome is uncertain",
      operationId,
      correlationId,
    });
    expect(failure).not.toHaveProperty("details");
    expect(JSON.stringify(failure)).not.toContain("must-not-propagate");
    expect(Object.isFrozen(failure)).toBe(true);
  });

  it("preserves typed retryability without inventing a Skill retry policy", () => {
    const failure = normalizeSkillFailure(
      trace(),
      "dependency",
      new PlatformError({
        code: "provider.temporarily_unavailable",
        category: "unavailable",
        message: "Provider is temporarily unavailable",
        retryable: true,
      }),
    );

    expect(failure).toMatchObject({
      source: "dependency",
      code: "provider.temporarily_unavailable",
      category: "unavailable",
      retryable: true,
      disposition: "retry",
      operationId: null,
      correlationId: null,
    });
  });

  it("keeps deterministic terminal semantics for typed non-retryable failures", () => {
    const failure = normalizeSkillFailure(
      trace(),
      "subskill",
      new PlatformError({
        code: "skill.subskill_not_declared",
        category: "authorization",
        message: "Subskill is not declared",
        retryable: false,
      }),
    );

    expect(failure.disposition).toBe("terminal");
    expect(failure.retryable).toBe(false);
    expect(failure.code).toBe("skill.subskill_not_declared");
  });

  it("redacts unknown exceptions behind a stable source-specific failure", () => {
    const failure = normalizeSkillFailure(
      trace(),
      "tool",
      new Error("raw provider token sk-secret-value"),
    );

    expect(failure).toMatchObject({
      source: "tool",
      code: "skill.tool_failed",
      category: "internal",
      retryable: false,
      disposition: "terminal",
      message: "Skill Tool execution failed",
      operationId: null,
      correlationId: null,
    });
    expect(JSON.stringify(failure)).not.toContain("sk-secret-value");
  });
});
