import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import type { ToolInvocation } from "@masanawa/tools";
import type { SkillVersion } from "./model.js";
import type { SkillExecutionPlan } from "./planning.js";
import {
  createSkillStepTraceMetadata,
  createSkillSubskillTraceMetadata,
  createSkillToolTraceMetadata,
  skillExecutionPlanTraceHash,
  normalizeSkillTraceMetadata,
  type SkillTraceMetadata,
} from "./trace.js";

function plan(): SkillExecutionPlan {
  const dependencyId = createCanonicalId("skill-version");
  const rootId = createCanonicalId("skill-version");
  const toolVersionId = createCanonicalId("tool-version");
  const toolCapability = normalizeCapabilityKey("messages.send");

  const dependency = {
    skillVersionId: dependencyId,
    dependencies: [],
  } as unknown as SkillVersion;
  const root = {
    skillVersionId: rootId,
    dependencies: [dependencyId],
  } as unknown as SkillVersion;

  return Object.freeze({
    rootSkillVersionId: rootId,
    steps: Object.freeze([
      Object.freeze({
        ordinal: 0,
        skillVersionId: dependencyId,
        skill: dependency,
        dependencyOrdinals: Object.freeze([]),
        toolReferences: Object.freeze([]),
      }),
      Object.freeze({
        ordinal: 1,
        skillVersionId: rootId,
        skill: root,
        dependencyOrdinals: Object.freeze([0]),
        toolReferences: Object.freeze([
          Object.freeze({
            referenceKey: "send-message",
            capability: toolCapability,
            toolVersionId,
          }),
        ]),
      }),
    ]),
    orderedSkillVersionIds: Object.freeze([dependencyId, rootId]),
    requiredToolCapabilities: Object.freeze([toolCapability]),
  });
}

function invocation(toolVersionId: ToolInvocation["toolVersionId"]): ToolInvocation {
  return {
    toolVersionId,
    authority: {} as ToolInvocation["authority"],
    input: {},
    idempotencyKey: null,
    providerSelection: null,
  };
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("Skill trace metadata", () => {
  it.each([
    { schemaVersion: 2 }, { kind: "unknown" }, { stepOrdinal: -1 },
    { stepOrdinal: 0.5 }, { stepOrdinal: Number.NaN },
    { rootSkillVersionId: "skill-version_invalid" },
    { skillVersionId: "skill-version_invalid" }, { planHash: "private content" },
    { referenceKey: "unexpected" },
    { toolVersionId: createCanonicalId("tool-version") },
    { targetSkillVersionId: createCanonicalId("skill-version") },
  ])("rejects invalid step metadata %j", (change) => {
    const input = { ...createSkillStepTraceMetadata(plan(), 1), ...change };
    expect(errorCode(() => normalizeSkillTraceMetadata(
      input as SkillTraceMetadata,
    ))).toBe("skill.trace_metadata_invalid");
  });

  it("rejects malformed Tool and subskill field combinations", () => {
    const base = createSkillStepTraceMetadata(plan(), 1);
    const tool = { ...base, kind: "tool" as const,
      referenceKey: "send-message", toolVersionId: createCanonicalId("tool-version") };
    expect(normalizeSkillTraceMetadata(tool)).toEqual(tool);
    for (const referenceKey of ["PRIVATE TEXT", "a".repeat(129), ""]) {
      expect(errorCode(() => normalizeSkillTraceMetadata({ ...tool, referenceKey })))
        .toBe("skill.trace_metadata_invalid");
    }
    expect(errorCode(() => normalizeSkillTraceMetadata({ ...tool,
      targetSkillVersionId: createCanonicalId("skill-version") })))
      .toBe("skill.trace_metadata_invalid");
    expect(errorCode(() => normalizeSkillTraceMetadata({ ...base, kind: "subskill" })))
      .toBe("skill.trace_metadata_invalid");
  });

  it("produces deterministic exact step metadata and plan hashes", () => {
    const executionPlan = plan();
    const first = createSkillStepTraceMetadata(executionPlan, 1);
    const second = createSkillStepTraceMetadata(executionPlan, 1);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 1,
      kind: "step",
      rootSkillVersionId: executionPlan.rootSkillVersionId,
      skillVersionId: executionPlan.steps[1]!.skillVersionId,
      stepOrdinal: 1,
      referenceKey: null,
      toolVersionId: null,
      targetSkillVersionId: null,
    });
    expect(first.planHash).toBe(skillExecutionPlanTraceHash(executionPlan));
    expect(first.planHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("tags an exact bound Tool call without Provider metadata", () => {
    const executionPlan = plan();
    const toolVersionId =
      executionPlan.steps[1]!.toolReferences[0]!.toolVersionId!;
    const metadata = createSkillToolTraceMetadata(
      executionPlan,
      1,
      "SEND-MESSAGE",
      invocation(toolVersionId),
    );

    expect(metadata).toMatchObject({
      kind: "tool",
      referenceKey: "send-message",
      toolVersionId,
      targetSkillVersionId: null,
    });
    expect(metadata).not.toHaveProperty("providerId");

    expect(
      errorCode(() =>
        createSkillToolTraceMetadata(
          executionPlan,
          1,
          "send-message",
          invocation(createCanonicalId("tool-version")),
        ),
      ),
    ).toBe("skill.trace_tool_pin_mismatch");
  });

  it("tags only an exact direct subskill dependency represented by the plan", () => {
    const executionPlan = plan();
    const target = executionPlan.steps[0]!.skillVersionId;
    const metadata = createSkillSubskillTraceMetadata(
      executionPlan,
      1,
      target,
    );

    expect(metadata).toMatchObject({
      kind: "subskill",
      skillVersionId: executionPlan.rootSkillVersionId,
      targetSkillVersionId: target,
      stepOrdinal: 1,
    });

    expect(
      errorCode(() =>
        createSkillSubskillTraceMetadata(
          executionPlan,
          1,
          createCanonicalId("skill-version"),
        ),
      ),
    ).toBe("skill.trace_subskill_not_declared");
  });

  it("rejects trace ordinals outside the exact execution plan", () => {
    expect(
      errorCode(() => createSkillStepTraceMetadata(plan(), 99)),
    ).toBe("skill.trace_step_not_found");
  });
});
