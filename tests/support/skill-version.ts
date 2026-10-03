import { createCanonicalId, normalizeCapabilityKey, toInstant, type SkillId, type SkillVersionId } from "@masanawa/contracts";
import type { SkillVersion } from "@masanawa/skills";

export function skillVersion(
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

