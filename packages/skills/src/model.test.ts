import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type SkillId,
} from "@masanawa/contracts";
import {
  normalizeSkill,
  normalizeSkillVersionDefinition,
  type SkillVersion,
} from "./model.js";

function version(overrides: Partial<SkillVersion> = {}): SkillVersion {
  const skillId = overrides.skillId ?? createCanonicalId("skill");
  const skillVersionId =
    overrides.skillVersionId ?? createCanonicalId("skill-version");
  return {
    skillId,
    skillVersionId,
    key: "research.web",
    version: "1.0.0",
    displayName: "Web research",
    description: "Researches public sources through provider-neutral tools.",
    activationExamples: ["Research this topic"],
    negativeActivationExamples: ["Do not browse"],
    capabilities: [normalizeCapabilityKey("research.web")],
    requiredToolCapabilities: [normalizeCapabilityKey("web.search")],
    toolReferences: [
      {
        referenceKey: "search",
        capability: normalizeCapabilityKey("web.search"),
        toolVersionId: null,
      },
    ],
    requiredAuthorityCapabilities: [],
    dependencies: [],
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
      sourceReference: "skills/research.web",
      sourceRevision: "1",
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
        evaluatedAt: toInstant("2026-10-02T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"8".repeat(64)}`,
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
    ...overrides,
  };
}

describe("canonical Skill identity", () => {
  it("normalizes stable logical identity independently from version content", () => {
    const skillId: SkillId = createCanonicalId("skill");
    const skill = normalizeSkill({
      skillId,
      key: " Research.Web ",
      createdAt: toInstant("2026-10-02T00:00:00.000Z"),
    });

    expect(skill).toEqual({
      skillId,
      key: "research.web",
      createdAt: "2026-10-02T00:00:00.000Z",
    });
    expect(Object.isFrozen(skill)).toBe(true);
  });
});

describe("immutable SkillVersion schema", () => {
  it("normalizes and recursively freezes version-owned content", () => {
    const normalized = normalizeSkillVersionDefinition(version());

    expect(normalized.key).toBe("research.web");
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.activationExamples)).toBe(true);
    expect(Object.isFrozen(normalized.capabilities)).toBe(true);
    expect(Object.isFrozen(normalized.toolReferences)).toBe(true);
    expect(Object.isFrozen(normalized.inputSchema)).toBe(true);
    expect(Object.isFrozen(normalized.provenance)).toBe(true);
    expect(Object.isFrozen(normalized.provenance.publisher)).toBe(true);
    expect(Object.isFrozen(normalized.provenance.trust)).toBe(true);
    expect(Object.isFrozen(normalized.provenance.trust.reasonCodes)).toBe(true);
    expect(normalized.provenance.publisher.publisherKey).toBe("masanawa");
    expect(normalized.provenance.trust.tier).toBe("first-party");
    expect(Object.isFrozen(normalized.certification)).toBe(true);
    expect(Object.isFrozen(normalized.certification.cases)).toBe(true);
    expect(normalized.certification.cases.every(Object.isFrozen)).toBe(true);
    expect(normalized.certification.subjectSkillVersionId).toBe(
      normalized.skillVersionId,
    );
  });

  it("keeps Tool references consistent with declared capability requirements", () => {
    expect(() =>
      normalizeSkillVersionDefinition(
        version({
          toolReferences: [
            {
              referenceKey: "send",
              capability: normalizeCapabilityKey("messages.send"),
              toolVersionId: null,
            },
          ],
        }),
      ),
    ).toThrow("must be declared as required");

    expect(() =>
      normalizeSkillVersionDefinition(
        version({ toolReferences: [] }),
      ),
    ).toThrow("each required Tool capability");
  });

  it("fails closed on malformed publisher identity and trust verdict evidence", () => {
    const base = version();

    expect(() =>
      normalizeSkillVersionDefinition({
        ...base,
        provenance: {
          ...base.provenance,
          publisher: {
            ...base.provenance.publisher,
            publisherKey: "Bad Publisher!",
          },
        },
      }),
    ).toThrow("publisherKey is invalid");

    expect(() =>
      normalizeSkillVersionDefinition({
        ...base,
        provenance: {
          ...base.provenance,
          trust: {
            ...base.provenance.trust,
            reasonCodes: ["bad reason!"],
          },
        },
      }),
    ).toThrow("trust reasonCode is invalid");
  });

  it("rejects a SkillVersion whose identity is not canonical", () => {
    expect(() =>
      normalizeSkillVersionDefinition(
        version({ skillVersionId: "skill-version_not-a-uuid" as SkillVersion["skillVersionId"] }),
      ),
    ).toThrow("skillVersionId is invalid");
  });

  it("requires complete passing rehearsal evidence before a version is canonical", () => {
    const base = version();
    const failedCases = base.certification.cases.map((item) =>
      item.kind === "negative-activation"
        ? { ...item, outcome: "failed" as const }
        : item,
    );

    expect(() =>
      normalizeSkillVersionDefinition({
        ...base,
        certification: {
          ...base.certification,
          cases: failedCases,
          passedTestCaseCount: 1,
        },
      }),
    ).toThrow("every rehearsal case to pass");
  });

  it("keeps consequential execution semantics fail-closed", () => {
    expect(() =>
      normalizeSkillVersionDefinition(
        version({
          riskClass: "consequential",
          idempotencyMode: "caller-key",
          reconciliationMode: "none",
        }),
      ),
    ).toThrow("operation-bound idempotency");
  });
});
