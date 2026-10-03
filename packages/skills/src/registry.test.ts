import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type SkillId,
  type SkillVersionId,
} from "@masanawa/contracts";
import type { SkillVersion } from "./model.js";
import { createSkillRegistry } from "./registry.js";

function skillVersion(
  options: {
    skillId?: SkillId;
    skillVersionId?: SkillVersionId;
    key?: string;
    version?: string;
    dependencies?: readonly SkillVersionId[];
    displayName?: string;
  } = {},
): SkillVersion {
  const skillVersionId =
    options.skillVersionId ?? createCanonicalId("skill-version");
  return {
    skillId: options.skillId ?? createCanonicalId("skill"),
    skillVersionId,
    key: options.key ?? "research.web",
    version: options.version ?? "1.0.0",
    displayName: options.displayName ?? "Web research",
    description: "Researches public sources through canonical Skills and Tools.",
    activationExamples: ["Research this topic"],
    negativeActivationExamples: ["Do not browse"],
    capabilities: [normalizeCapabilityKey("research.web")],
    requiredToolCapabilities: [],
    toolReferences: [],
    requiredAuthorityCapabilities: [],
    dependencies: options.dependencies ?? [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: "model-visible",
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
      sourceReference: `skills/${options.key ?? "research.web"}`,
      sourceRevision: options.version ?? "1.0.0",
      sourceContentHash: `sha256:${"c".repeat(64)}`,
      publisher: {
        publisherKey: "masanawa",
        displayName: "Masanawa",
        kind: "first-party",
        reference: null,
      },
      trust: {
        tier: "first-party",
        evaluatorKey: "masanawa.skill-admission",
        evaluatedAt: toInstant("2026-10-02T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"6".repeat(64)}`,
      certifiedAt: toInstant("2026-10-02T00:00:00.000Z"),
      certifierKey: "masanawa.foundation",
      cases: [
        {
          caseKey: "activation.basic",
          kind: "activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/activation.basic",
          evidenceHash: `sha256:${"1".repeat(64)}`,
        },
        {
          caseKey: "negative.basic",
          kind: "negative-activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/negative.basic",
          evidenceHash: `sha256:${"2".repeat(64)}`,
        },
      ],
      testCaseCount: 2,
      passedTestCaseCount: 2,
    },
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

describe("Skill dependency graph registration", () => {
  it("accepts a complete dependency batch regardless of input order", () => {
    const registry = createSkillRegistry();
    const child = skillVersion({
      key: "research.search",
      version: "1.0.0",
    });
    const parent = skillVersion({
      key: "research.web",
      dependencies: [child.skillVersionId],
    });

    const result = registry.registerBatch([parent, child]);

    expect(result.map((entry) => entry.skill.skillVersionId)).toEqual([
      parent.skillVersionId,
      child.skillVersionId,
    ]);
    expect(registry.listVersions()).toHaveLength(2);
  });

  it("rejects a missing dependency atomically", () => {
    const registry = createSkillRegistry();
    const root = skillVersion({
      dependencies: [createCanonicalId("skill-version")],
    });

    expect(errorCode(() => registry.register(root))).toBe(
      "skill.dependency_missing",
    );
    expect(registry.listVersions()).toEqual([]);
  });

  it("rejects cycles atomically", () => {
    const registry = createSkillRegistry();
    const aId = createCanonicalId("skill-version");
    const bId = createCanonicalId("skill-version");
    const a = skillVersion({
      skillVersionId: aId,
      key: "cycle.a",
      dependencies: [bId],
    });
    const b = skillVersion({
      skillVersionId: bId,
      key: "cycle.b",
      dependencies: [aId],
    });

    expect(errorCode(() => registry.registerBatch([a, b]))).toBe(
      "skill.dependency_cycle",
    );
    expect(registry.listVersions()).toEqual([]);
  });

  it("enforces the configured dependency depth atomically", () => {
    const registry = createSkillRegistry({ maxDependencyDepth: 2 });
    const leaf = skillVersion({ key: "depth.leaf" });
    const middle = skillVersion({
      key: "depth.middle",
      dependencies: [leaf.skillVersionId],
    });
    const root = skillVersion({
      key: "depth.root",
      dependencies: [middle.skillVersionId],
    });

    expect(
      errorCode(() => registry.registerBatch([root, middle, leaf])),
    ).toBe("skill.dependency_depth_exceeded");
    expect(registry.listVersions()).toEqual([]);
  });
});

describe("Skill registration conflicts", () => {
  it("treats exact replay as idempotent but rejects changed content for one SkillVersionId", () => {
    const registry = createSkillRegistry();
    const original = skillVersion();

    expect(registry.register(original).reused).toBe(false);
    expect(registry.register(original).reused).toBe(true);

    const changed = { ...original, displayName: "Changed name" };
    expect(errorCode(() => registry.register(changed))).toBe(
      "skill.registration_version_conflict",
    );
    expect(registry.listVersions()).toHaveLength(1);
  });

  it("rejects two SkillVersionIds for one key/version", () => {
    const registry = createSkillRegistry();
    const skillId = createCanonicalId("skill");
    registry.register(skillVersion({ skillId }));

    expect(
      errorCode(() =>
        registry.register(
          skillVersion({
            skillId,
            skillVersionId: createCanonicalId("skill-version"),
          }),
        ),
      ),
    ).toBe("skill.registration_key_version_conflict");
  });

  it("keeps one SkillId bound to one logical key", () => {
    const registry = createSkillRegistry();
    const skillId = createCanonicalId("skill");
    registry.register(skillVersion({ skillId, key: "identity.alpha" }));

    expect(
      errorCode(() =>
        registry.register(
          skillVersion({
            skillId,
            key: "identity.beta",
            version: "2.0.0",
          }),
        ),
      ),
    ).toBe("skill.registration_skill_id_conflict");
  });

  it("keeps one logical key bound to one stable SkillId across versions", () => {
    const registry = createSkillRegistry();
    registry.register(
      skillVersion({
        skillId: createCanonicalId("skill"),
        key: "identity.stable",
        version: "1.0.0",
      }),
    );

    expect(
      errorCode(() =>
        registry.register(
          skillVersion({
            skillId: createCanonicalId("skill"),
            key: "identity.stable",
            version: "2.0.0",
          }),
        ),
      ),
    ).toBe("skill.registration_skill_key_conflict");
    expect(registry.listVersions()).toHaveLength(1);
  });

  it("rejects conflicting logical identities inside one batch before mutation", () => {
    const registry = createSkillRegistry();
    const left = skillVersion({
      skillId: createCanonicalId("skill"),
      key: "identity.batch",
      version: "1.0.0",
    });
    const right = skillVersion({
      skillId: createCanonicalId("skill"),
      key: "identity.batch",
      version: "2.0.0",
    });

    expect(errorCode(() => registry.registerBatch([left, right]))).toBe(
      "skill.registration_skill_key_conflict",
    );
    expect(registry.listVersions()).toEqual([]);
  });
});
