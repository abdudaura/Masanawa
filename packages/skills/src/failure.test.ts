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
  it.each([new Error("private exception"), new PlatformError({
    code: "provider.unavailable", category: "unavailable",
    message: "Provider unavailable", retryable: true,
  })])("copies bounded trace evidence for typed and unknown failures", (error) => {
    const input = { ...trace(), prompt: "private prompt", credential: "secret" };
    const expected = trace();
    const originalId = input.skillVersionId;
    const failure = normalizeSkillFailure(input, "tool", error);
    input.skillVersionId = expected.skillVersionId;
    input.planHash = `sha256:${"b".repeat(64)}`;
    expect(failure.trace.skillVersionId).toBe(originalId);
    expect(failure.trace.planHash).toBe(`sha256:${"a".repeat(64)}`);
    expect(failure.trace).not.toBe(input);
    expect(Object.isFrozen(failure.trace)).toBe(true);
    expect(failure.trace).not.toHaveProperty("prompt");
    expect(failure.trace).not.toHaveProperty("credential");
    expect(JSON.stringify(failure)).not.toContain("private prompt");
  });

  it("reconciles ambiguity even when the underlying typed error is retryable", () => {
    const failure = normalizeSkillFailure(trace(), "tool", new PlatformError({
      code: "provider.ambiguous", category: "ambiguous",
      message: "Outcome is uncertain", retryable: true,
    }));
    expect(failure.disposition).toBe("reconcile");
    expect(failure.retryable).toBe(true);
  });

  it("rejects malformed trace evidence before publishing a failure", () => {
    expect(() => normalizeSkillFailure({ ...trace(), planHash: "private text" },
      "tool", new Error("secret"))).toThrow("Skill trace metadata is invalid");
  });

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
