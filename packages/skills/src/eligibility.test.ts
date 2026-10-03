import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type SkillId,
  type SkillVersionId,
} from "@masanawa/contracts";
import type { SkillVersion } from "./model.js";
import {
  createSkillRevisionPin,
  evaluateSkillEligibility,
  resolveSkillRevisionPin,
} from "./eligibility.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";

function skillVersion(
  options: {
    readonly skillId?: SkillId;
    readonly skillVersionId?: SkillVersionId;
    readonly key?: string;
    readonly version?: string;
    readonly dependencies?: readonly SkillVersionId[];
    readonly visibility?: SkillVersion["visibility"];
  } = {},
): SkillVersion {
  const skillVersionId =
    options.skillVersionId ?? createCanonicalId("skill-version");
  const key = options.key ?? "eligible.skill";
  const version = options.version ?? "1.0.0";
  return {
    skillId: options.skillId ?? createCanonicalId("skill"),
    skillVersionId,
    key,
    version,
    displayName: key,
    description: `Canonical eligible skill ${key}`,
    activationExamples: [`Use ${key}`],
    negativeActivationExamples: [`Do not use ${key}`],
    capabilities: [normalizeCapabilityKey(key)],
    requiredToolCapabilities: [],
    toolReferences: [],
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
      sourceRevision: version,
      sourceContentHash: `sha256:${"a".repeat(64)}`,
      publisher: {
        publisherKey: "masanawa",
        displayName: "Masanawa",
        kind: "first-party",
        reference: null,
      },
      trust: {
        tier: "first-party",
        evaluatorKey: "masanawa.skill-admission",
        evaluatedAt: toInstant("2026-10-03T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"b".repeat(64)}`,
      certifiedAt: toInstant("2026-10-03T00:01:00.000Z"),
      certifierKey: "masanawa.foundation",
      cases: [
        {
          caseKey: "activation.basic",
          kind: "activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-03T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/activation.basic",
          evidenceHash: `sha256:${"c".repeat(64)}`,
        },
        {
          caseKey: "negative.basic",
          kind: "negative-activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-03T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/negative.basic",
          evidenceHash: `sha256:${"d".repeat(64)}`,
        },
      ],
      testCaseCount: 2,
      passedTestCaseCount: 2,
    },
  };
}

function setReady(
  registry: SkillRegistry,
  skill: SkillVersion,
  advertised = false,
): void {
  registry.setReadiness({
    skillVersionId: skill.skillVersionId,
    state: "ready",
    advertised,
    reasonCode: null,
    checkedAt: toInstant("2026-10-03T00:02:00.000Z"),
  });
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("Skill readiness and eligibility", () => {
  it("publishes explicit exact-graph eligibility and advertisement state", () => {
    const registry = createSkillRegistry();
    const dependency = skillVersion({
      key: "eligible.hidden",
      visibility: "model-hidden",
    });
    const root = skillVersion({
      key: "eligible.root",
      dependencies: [dependency.skillVersionId],
    });
    registry.registerBatch([root, dependency]);
    setReady(registry, dependency);
    setReady(registry, root, true);

    const eligibility = evaluateSkillEligibility(
      registry,
      root.skillVersionId,
    );

    expect(eligibility).toMatchObject({
      rootSkillVersionId: root.skillVersionId,
      eligible: true,
      advertisable: true,
      advertised: true,
      blockers: [],
    });
    expect(eligibility.orderedSkillVersionIds).toEqual([
      dependency.skillVersionId,
      root.skillVersionId,
    ]);
    expect(Object.isFrozen(eligibility)).toBe(true);
    expect(Object.isFrozen(eligibility.blockers)).toBe(true);
  });

  it("fails eligibility when an exact dependency lacks readiness or becomes degraded", () => {
    const registry = createSkillRegistry();
    const dependency = skillVersion({ key: "eligible.dependency" });
    const root = skillVersion({
      key: "eligible.root",
      dependencies: [dependency.skillVersionId],
    });
    registry.registerBatch([root, dependency]);
    setReady(registry, root, true);

    let eligibility = evaluateSkillEligibility(
      registry,
      root.skillVersionId,
    );
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.blockers).toEqual([
      {
        skillVersionId: dependency.skillVersionId,
        state: "missing-readiness",
        reasonCode: "skill.readiness.missing",
      },
    ]);

    registry.setReadiness({
      skillVersionId: dependency.skillVersionId,
      state: "degraded",
      advertised: false,
      reasonCode: "provider.unavailable",
      checkedAt: toInstant("2026-10-03T00:03:00.000Z"),
    });
    eligibility = evaluateSkillEligibility(
      registry,
      root.skillVersionId,
    );
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.blockers[0]).toMatchObject({
      skillVersionId: dependency.skillVersionId,
      state: "degraded",
      reasonCode: "provider.unavailable",
    });
  });
});

describe("Skill exact revision pinning", () => {
  it("keeps a pinned revision exact when a newer logical Skill version is published", () => {
    const registry = createSkillRegistry();
    const skillId = createCanonicalId("skill");
    const dependency = skillVersion({ key: "pin.dependency" });
    const v1 = skillVersion({
      skillId,
      key: "pin.root",
      version: "1.0.0",
      dependencies: [dependency.skillVersionId],
    });

    registry.registerBatch([v1, dependency]);
    setReady(registry, dependency);
    setReady(registry, v1, true);
    const pin = createSkillRevisionPin(registry, v1.skillVersionId);

    const v2 = skillVersion({
      skillId,
      key: "pin.root",
      version: "2.0.0",
      dependencies: [dependency.skillVersionId],
    });
    registry.register(v2);
    setReady(registry, v2, true);
    registry.setReadiness({
      skillVersionId: v1.skillVersionId,
      state: "ready",
      advertised: false,
      reasonCode: null,
      checkedAt: toInstant("2026-10-03T00:04:00.000Z"),
    });

    const plan = resolveSkillRevisionPin(registry, pin);
    expect(plan.rootSkillVersionId).toBe(v1.skillVersionId);
    expect(plan.orderedSkillVersionIds).toEqual([
      dependency.skillVersionId,
      v1.skillVersionId,
    ]);
    expect(plan.orderedSkillVersionIds).not.toContain(v2.skillVersionId);
    expect(pin.orderedVersions.at(-1)).toMatchObject({
      skillVersionId: v1.skillVersionId,
      key: "pin.root",
      version: "1.0.0",
    });
    expect(pin.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(pin)).toBe(true);
    expect(Object.isFrozen(pin.orderedVersions)).toBe(true);
  });

  it("rechecks current readiness instead of freezing operational eligibility into the pin", () => {
    const registry = createSkillRegistry();
    const dependency = skillVersion({ key: "pin.live-readiness" });
    const root = skillVersion({
      key: "pin.live-root",
      dependencies: [dependency.skillVersionId],
    });
    registry.registerBatch([root, dependency]);
    setReady(registry, dependency);
    setReady(registry, root);

    const pin = createSkillRevisionPin(registry, root.skillVersionId);
    registry.setReadiness({
      skillVersionId: dependency.skillVersionId,
      state: "blocked",
      advertised: false,
      reasonCode: "operator.blocked",
      checkedAt: toInstant("2026-10-03T00:05:00.000Z"),
    });

    expect(errorCode(() => resolveSkillRevisionPin(registry, pin))).toBe(
      "skill.pin_not_eligible",
    );
  });

  it("fails closed on tampered pin contents or definition evidence", () => {
    const registry = createSkillRegistry();
    const root = skillVersion({ key: "pin.tamper" });
    registry.register(root);
    setReady(registry, root);
    const pin = createSkillRevisionPin(registry, root.skillVersionId);

    const tamperedHash = {
      ...pin,
      contentHash: `sha256:${"0".repeat(64)}`,
    };
    expect(
      errorCode(() => resolveSkillRevisionPin(registry, tamperedHash)),
    ).toBe("skill.pin_hash_mismatch");

    const changedEntry = {
      ...pin,
      orderedVersions: [
        {
          ...pin.orderedVersions[0]!,
          definitionHash: `sha256:${"f".repeat(64)}`,
        },
      ],
    };
    const changedEntryWithValidEnvelope = {
      ...changedEntry,
      contentHash: createSkillRevisionPin(
        registry,
        root.skillVersionId,
      ).contentHash,
    };
    expect(
      errorCode(() =>
        resolveSkillRevisionPin(registry, changedEntryWithValidEnvelope),
      ),
    ).toBe("skill.pin_hash_mismatch");
  });
});
