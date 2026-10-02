import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type CapabilityKey,
  type SkillVersionId,
} from "@masanawa/contracts";
import type { SkillVersion } from "./model.js";
import { composeSkillExecutionPlan } from "./planning.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";

function skillVersion(
  key: string,
  options: {
    readonly dependencies?: readonly SkillVersionId[];
    readonly toolCapability?: CapabilityKey;
    readonly visibility?: SkillVersion["visibility"];
  } = {},
): SkillVersion {
  const toolCapability = options.toolCapability;
  return {
    skillId: createCanonicalId("skill"),
    skillVersionId: createCanonicalId("skill-version"),
    key,
    version: "1.0.0",
    displayName: key,
    description: `Canonical skill ${key}`,
    activationExamples: [`Use ${key}`],
    negativeActivationExamples: [`Do not use ${key}`],
    capabilities: [normalizeCapabilityKey(key)],
    requiredToolCapabilities:
      toolCapability === undefined ? [] : [toolCapability],
    toolReferences:
      toolCapability === undefined
        ? []
        : [
            {
              referenceKey: "tool",
              capability: toolCapability,
              toolVersionId: null,
            },
          ],
    requiredAuthorityCapabilities: [],
    dependencies: options.dependencies ?? [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: options.visibility ?? "model-visible",
    riskClass: "read-only",
    sideEffectClass: "none",
    sensitivity: "public",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode: "not-required",
    reconciliationMode: "none",
    timeoutMs: 30_000,
    provenance: {
      sourceKind: "authored",
      sourceSystem: "masanawa",
      sourceReference: `skills/${key}`,
      sourceRevision: "1.0.0",
      sourceContentHash: `sha256:${"d".repeat(64)}`,
      trustTier: "first-party",
    },
    certification: {
      profile: "foundation",
      certifiedAt: toInstant("2026-10-02T00:00:00.000Z"),
      certifierKey: "masanawa.foundation",
      testCaseCount: 1,
      passedTestCaseCount: 1,
    },
  };
}

function markReady(
  registry: SkillRegistry,
  versions: readonly SkillVersion[],
): void {
  versions.forEach((skill, index) => {
    registry.setReadiness({
      skillVersionId: skill.skillVersionId,
      state: "ready",
      advertised:
        skill.visibility === "model-visible" && index === versions.length - 1,
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T00:01:00.000Z"),
    });
  });
}

describe("Skill execution planning", () => {
  it("composes a deterministic dependency-first plan and deduplicates a diamond graph", () => {
    const registry = createSkillRegistry();
    const storage = normalizeCapabilityKey("storage.read");
    const search = normalizeCapabilityKey("web.search");

    const shared = skillVersion("compose.shared", {
      toolCapability: storage,
      visibility: "model-hidden",
    });
    const left = skillVersion("compose.left", {
      dependencies: [shared.skillVersionId],
      toolCapability: search,
    });
    const right = skillVersion("compose.right", {
      dependencies: [shared.skillVersionId],
    });
    const root = skillVersion("compose.root", {
      dependencies: [right.skillVersionId, left.skillVersionId],
    });

    registry.registerBatch([root, right, shared, left]);
    markReady(registry, [shared, left, right, root]);

    const plan = composeSkillExecutionPlan(
      registry,
      root.skillVersionId,
    );

    expect(plan.rootSkillVersionId).toBe(root.skillVersionId);
    expect(plan.orderedSkillVersionIds).toEqual([
      shared.skillVersionId,
      left.skillVersionId,
      right.skillVersionId,
      root.skillVersionId,
    ]);
    expect(plan.steps.map((step) => step.ordinal)).toEqual([0, 1, 2, 3]);
    expect(plan.steps[1]?.dependencyOrdinals).toEqual([0]);
    expect(plan.steps[2]?.dependencyOrdinals).toEqual([0]);
    expect(plan.steps[3]?.dependencyOrdinals).toEqual([1, 2]);
    expect(plan.requiredToolCapabilities).toEqual([storage, search].sort());
    expect(
      plan.orderedSkillVersionIds.filter(
        (id) => id === shared.skillVersionId,
      ),
    ).toHaveLength(1);
  });

  it("keeps the plan and step collections immutable", () => {
    const registry = createSkillRegistry();
    const root = skillVersion("compose.immutable");
    registry.register(root);
    markReady(registry, [root]);

    const plan = composeSkillExecutionPlan(
      registry,
      root.skillVersionId,
    );

    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.steps)).toBe(true);
    expect(Object.isFrozen(plan.steps[0])).toBe(true);
    expect(Object.isFrozen(plan.steps[0]?.dependencyOrdinals)).toBe(true);
    expect(Object.isFrozen(plan.orderedSkillVersionIds)).toBe(true);
    expect(Object.isFrozen(plan.requiredToolCapabilities)).toBe(true);
  });

  it("fails closed when the root or any exact dependency is not ready", () => {
    const registry = createSkillRegistry();
    const dependency = skillVersion("compose.not-ready-dependency");
    const root = skillVersion("compose.not-ready-root", {
      dependencies: [dependency.skillVersionId],
    });
    registry.registerBatch([root, dependency]);

    registry.setReadiness({
      skillVersionId: root.skillVersionId,
      state: "ready",
      advertised: true,
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T00:01:00.000Z"),
    });

    expect(() =>
      composeSkillExecutionPlan(registry, root.skillVersionId),
    ).toThrow(
      expect.objectContaining({ code: "skill.version_not_ready" }),
    );
  });

  it("allows a ready model-hidden SkillVersion as an exact dependency without advertising it", () => {
    const registry = createSkillRegistry();
    const hidden = skillVersion("compose.hidden", {
      visibility: "model-hidden",
    });
    const root = skillVersion("compose.visible", {
      dependencies: [hidden.skillVersionId],
    });
    registry.registerBatch([root, hidden]);
    markReady(registry, [hidden, root]);

    const plan = composeSkillExecutionPlan(
      registry,
      root.skillVersionId,
    );

    expect(plan.orderedSkillVersionIds).toEqual([
      hidden.skillVersionId,
      root.skillVersionId,
    ]);
    expect(registry.listAdvertised().map((skill) => skill.skillVersionId)).toEqual([
      root.skillVersionId,
    ]);
  });
});
