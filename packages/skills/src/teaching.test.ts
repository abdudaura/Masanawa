import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant, type SkillVersionId } from "@masanawa/contracts";
import type { SkillCertification } from "./certification.js";
import {
  createCoreTeachingSkillBundle,
  normalizeTeachingAnswerEvaluation,
  normalizeTeachingExerciseCard,
  normalizeTeachingLessonPlan,
  normalizeTeachingProgressHandoff,
  normalizeTeachingSubjectReference,
  resolveTeachingContinuation,
  updateTeachingLearnerPreferences,
  type TeachingLessonPlan,
} from "./teaching.js";

function plan(): TeachingLessonPlan {
  return {
    skillVersionId: createCanonicalId("skill-version"),
    learner: {
      relationshipId: createCanonicalId("relationship"),
      topic: "Quadratic equations",
      level: "beginner",
      goals: ["Solve quadratic equations confidently"],
      language: "ha",
      accessibilityPreferences: ["Prefer short steps"],
      preferredModalities: ["text", "voice"],
    },
    sequenceTitle: "Quadratics from first principles",
    steps: [
      {
        stepKey: "factor-basics",
        title: "Factoring basics",
        objective: "Recognize a factorable quadratic.",
        explanation: "Connect multiplication of binomials to reversing the process.",
        examples: ["x² + 5x + 6"],
        workedSolutions: ["(x + 2)(x + 3)"],
        exercisePrompts: ["Factor x² + 7x + 12"],
        resourceKeys: ["quadratics-reference"],
      },
    ],
    resources: [
      {
        resourceKey: "quadratics-reference",
        title: "Reviewed quadratics reference",
        reference: "resource://teaching/math/quadratics/v1",
        contentHash: `sha256:${"a".repeat(64)}`,
        checkedAt: toInstant("2026-10-04T00:00:00.000Z"),
      },
    ],
    uncertaintyNotes: [],
  };
}

describe("Core Teaching contracts", () => {
  it("normalizes an adaptive plan with exact Skill and Relationship scope", () => {
    const normalized = normalizeTeachingLessonPlan(plan());
    expect(normalized.learner.topic).toBe("Quadratic equations");
    expect(normalized.steps[0]?.resourceKeys).toEqual(["quadratics-reference"]);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.learner)).toBe(true);
    expect(Object.isFrozen(normalized.steps)).toBe(true);
  });

  it("rejects lesson resources without provenance evidence", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        resources: [{ ...input.resources[0]!, contentHash: "unknown" }],
      }),
    ).toThrow(/contentHash/);
  });

  it("rejects steps that cite undeclared resources", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        steps: [{ ...input.steps[0]!, resourceKeys: ["missing-reference"] }],
      }),
    ).toThrow(/unknown resource evidence/);
  });

  it("keeps Core assessment formative and cannot mint certification", () => {
    expect(
      normalizeTeachingAnswerEvaluation({
        assessmentKind: "formative",
        correct: false,
        feedback: "The middle term needs both factors.",
        misconception: "Chose factors whose sum is not the middle coefficient.",
        alternativeExplanation: "Use a product-and-sum table before writing brackets.",
        nextCheckpointState: "needs-reteaching",
      }).nextCheckpointState,
    ).toBe("needs-reteaching");

    expect(() =>
      normalizeTeachingAnswerEvaluation({
        assessmentKind: "verified-certification",
        correct: true,
        feedback: "Passed.",
        misconception: null,
        alternativeExplanation: null,
        nextCheckpointState: "completed",
      }),
    ).toThrow(/separate certified assessment workflow/);
  });

  it("creates a bounded Relationship-scoped progress handoff rather than a second store", () => {
    const input = plan();
    const progress = normalizeTeachingProgressHandoff({
      relationshipId: input.learner.relationshipId,
      skillVersionId: input.skillVersionId,
      lessonStepKey: "factor-basics",
      checkpointState: "ready-to-advance",
      demonstratedUnderstanding: ["Can identify factor pairs"],
      misconceptionsToRevisit: [],
      nextSteps: ["Practice one harder example"],
      recordedAt: toInstant("2026-10-04T12:00:00.000Z"),
    });
    expect(progress.relationshipId).toBe(input.learner.relationshipId);
    expect(Object.isFrozen(progress.nextSteps)).toBe(true);
  });

  it("requires at least one delivery modality and a valid language tag", () => {
    const input = plan();
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        learner: { ...input.learner, preferredModalities: [] },
      }),
    ).toThrow(/preferredModalities/);
    expect(() =>
      normalizeTeachingLessonPlan({
        ...input,
        learner: { ...input.learner, language: "not a language tag!" },
      }),
    ).toThrow(/language/);
  });
});


function coreCertification(
  skillVersionId: SkillVersionId,
  omitCaseKey?: string,
): SkillCertification {
  const observedAt = toInstant("2026-10-04T00:00:00.000Z");
  const required = [
    ["activation.teaching-request", "activation"],
    ["negative.non-teaching-request", "negative-activation"],
    ["contract.language-switching", "contract"],
    ["contract.misconception-correction", "contract"],
    ["recovery.failed-understanding", "recovery"],
    ["contract.relationship-continuity", "contract"],
    ["recovery.source-uncertainty", "recovery"],
    ["contract.relationship-privacy", "contract"],
  ] as const;
  const cases = required
    .filter(([caseKey]) => caseKey !== omitCaseKey)
    .map(([caseKey, kind], index) => ({
      caseKey,
      kind,
      outcome: "passed" as const,
      observedAt,
      evidenceRef: `rehearsal://core-teaching/${caseKey}`,
      evidenceHash: `sha256:${String(index + 1).padStart(64, "0")}`,
    }));
  return {
    subjectSkillVersionId: skillVersionId,
    profile: "core-teaching",
    suiteKey: "skills.core-teaching",
    suiteRevision: "2026.10.04",
    suiteContentHash: `sha256:${"9".repeat(64)}`,
    certifiedAt: observedAt,
    certifierKey: "masanawa.core-teaching",
    cases,
    testCaseCount: cases.length,
    passedTestCaseCount: cases.length,
  };
}

function coreProvenance() {
  return {
    sourceKind: "authored" as const,
    sourceSystem: "masanawa",
    sourceReference: "skills/core.teaching",
    sourceRevision: "1.0.0",
    sourceContentHash: `sha256:${"8".repeat(64)}`,
    publisher: {
      publisherKey: "masanawa",
      displayName: "Masanawa",
      kind: "first-party" as const,
      reference: null,
    },
    trust: {
      tier: "first-party" as const,
      evaluatorKey: "masanawa.skill-admission",
      evaluatedAt: toInstant("2026-10-04T00:00:00.000Z"),
      reasonCodes: ["publisher.first-party"],
    },
  };
}

describe("Core Teaching Skill authoring", () => {
  it("builds one exact canonical SkillVersion and progressively disclosed SkillGuide", () => {
    const skillId = createCanonicalId("skill");
    const skillVersionId = createCanonicalId("skill-version");
    const bundle = createCoreTeachingSkillBundle({
      skillId,
      skillVersionId,
      version: "1.0.0",
      provenance: coreProvenance(),
      certification: coreCertification(skillVersionId),
      guideResources: [
        {
          path: "references/mathematics.md",
          kind: "reference",
          description: "Reviewed mathematics teaching reference.",
        },
      ],
    });

    expect(bundle.skillVersion).toMatchObject({
      skillId,
      skillVersionId,
      key: "core.teaching",
      billingMode: "none",
      confirmationPolicy: "not-required",
      sensitivity: "private",
    });
    expect(bundle.skillVersion.capabilities).toEqual(["teaching.core"]);
    expect(bundle.guide.skillVersionId).toBe(skillVersionId);
    expect(bundle.guide.resources[0]?.path).toBe("references/mathematics.md");
    expect(bundle.guide.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(bundle.guide.instructions).toContain("Relationship-scoped progress handoff");
    expect(Object.isFrozen(bundle)).toBe(true);
  });

  it("refuses production certification that omits a required teaching rehearsal", () => {
    const skillVersionId = createCanonicalId("skill-version");
    expect(() =>
      createCoreTeachingSkillBundle({
        skillId: createCanonicalId("skill"),
        skillVersionId,
        version: "1.0.0",
        provenance: coreProvenance(),
        certification: coreCertification(
          skillVersionId,
          "recovery.source-uncertainty",
        ),
      }),
    ).toThrow(/recovery\.source-uncertainty/);
  });

  it("keeps teaching free of hidden Tool, Provider and Offer authority", () => {
    const skillVersionId = createCanonicalId("skill-version");
    const bundle = createCoreTeachingSkillBundle({
      skillId: createCanonicalId("skill"),
      skillVersionId,
      version: "1.0.0",
      provenance: coreProvenance(),
      certification: coreCertification(skillVersionId),
    });

    expect(bundle.skillVersion.requiredToolCapabilities).toEqual([]);
    expect(bundle.skillVersion.toolReferences).toEqual([]);
    expect(bundle.skillVersion.requiredAuthorityCapabilities).toEqual([]);
    expect(bundle.skillVersion.dependencies).toEqual([]);
    expect(bundle.skillVersion).not.toHaveProperty("offerId");
    expect(bundle.skillVersion).not.toHaveProperty("providerId");
  });
});


describe("Teaching surface projections", () => {
  it("normalizes selectable exercises without exposing correctness in the card", () => {
    const relationshipId = createCanonicalId("relationship");
    const skillVersionId = createCanonicalId("skill-version");
    const card = normalizeTeachingExerciseCard({
      relationshipId,
      skillVersionId,
      lessonStepKey: "factor-basics",
      exerciseKey: "factor-choice-1",
      prompt: "Which factorization is correct?",
      kind: "single-select",
      options: [
        { optionKey: "choice-a", label: "(x + 2)(x + 3)" },
        { optionKey: "choice-b", label: "(x + 1)(x + 6)" },
      ],
    });

    expect(card.options).toHaveLength(2);
    expect(card.options[0]).toEqual({
      optionKey: "choice-a",
      label: "(x + 2)(x + 3)",
    });
    expect(card).not.toHaveProperty("correctOptionKey");
    expect(Object.isFrozen(card.options)).toBe(true);
  });

  it("rejects malformed selectable and free-response exercise shapes", () => {
    const base = {
      relationshipId: createCanonicalId("relationship"),
      skillVersionId: createCanonicalId("skill-version"),
      lessonStepKey: "step",
      exerciseKey: "exercise",
      prompt: "Answer this.",
    };
    expect(() =>
      normalizeTeachingExerciseCard({
        ...base,
        kind: "single-select",
        options: [{ optionKey: "only", label: "Only option" }],
      }),
    ).toThrow(/at least two options/);

    expect(() =>
      normalizeTeachingExerciseCard({
        ...base,
        kind: "free-response",
        options: [
          { optionKey: "hidden", label: "This should not be selectable" },
        ],
      }),
    ).toThrow(/cannot expose options/);
  });

  it("keeps subject resources and subskills exact and mutually exclusive", () => {
    const resource = normalizeTeachingSubjectReference({
      referenceKey: "quadratics-notes",
      kind: "resource",
      resourcePath: "references/math/quadratics.md",
      skillVersionId: null,
    });
    expect(resource).toEqual({
      referenceKey: "quadratics-notes",
      kind: "resource",
      resourcePath: "references/math/quadratics.md",
      skillVersionId: null,
    });

    const subjectSkillVersionId = createCanonicalId("skill-version");
    const subskill = normalizeTeachingSubjectReference({
      referenceKey: "calculus-module",
      kind: "subskill",
      resourcePath: null,
      skillVersionId: subjectSkillVersionId,
    });
    expect(subskill.skillVersionId).toBe(subjectSkillVersionId);
  });
});


describe("Teaching continuity decisions", () => {
  it("changes language or modality without changing Relationship, topic or goals", () => {
    const original = plan().learner;
    const updated = updateTeachingLearnerPreferences(original, {
      language: "en",
      preferredModalities: ["voice"],
      accessibilityPreferences: ["Use simpler sentence structure"],
    });

    expect(updated.relationshipId).toBe(original.relationshipId);
    expect(updated.topic).toBe(original.topic);
    expect(updated.goals).toEqual(original.goals);
    expect(updated.language).toBe("en");
    expect(updated.preferredModalities).toEqual(["voice"]);
  });

  it("reteaches the same lesson step after failed understanding", () => {
    const input = plan();
    const progress = normalizeTeachingProgressHandoff({
      relationshipId: input.learner.relationshipId,
      skillVersionId: input.skillVersionId,
      lessonStepKey: "factor-basics",
      checkpointState: "needs-reteaching",
      demonstratedUnderstanding: [],
      misconceptionsToRevisit: ["Factor pairs are being added incorrectly"],
      nextSteps: ["Explain with a multiplication grid"],
      recordedAt: toInstant("2026-10-04T12:00:00.000Z"),
    });

    const continuation = resolveTeachingContinuation(input, progress);
    expect(continuation.reason).toBe("reteach-current");
    expect(continuation.nextStep?.stepKey).toBe("factor-basics");
    expect(continuation.sequenceCompleted).toBe(false);
  });

  it("advances only after a ready/completed checkpoint and ends at the final step", () => {
    const input = plan();
    const extended = {
      ...input,
      steps: [
        input.steps[0]!,
        {
          ...input.steps[0]!,
          stepKey: "solve-by-factoring",
          title: "Solve by factoring",
        },
      ],
    };
    const ready = normalizeTeachingProgressHandoff({
      relationshipId: input.learner.relationshipId,
      skillVersionId: input.skillVersionId,
      lessonStepKey: "factor-basics",
      checkpointState: "ready-to-advance",
      demonstratedUnderstanding: ["Can factor simple quadratics"],
      misconceptionsToRevisit: [],
      nextSteps: ["Solve equations using the zero-product rule"],
      recordedAt: toInstant("2026-10-04T12:00:00.000Z"),
    });
    expect(resolveTeachingContinuation(extended, ready)).toMatchObject({
      reason: "advance",
      sequenceCompleted: false,
      nextStep: { stepKey: "solve-by-factoring" },
    });

    const done = normalizeTeachingProgressHandoff({
      ...ready,
      lessonStepKey: "solve-by-factoring",
      checkpointState: "completed",
    });
    expect(resolveTeachingContinuation(extended, done)).toMatchObject({
      reason: "sequence-complete",
      sequenceCompleted: true,
      nextStep: null,
    });
  });

  it("fails closed when progress belongs to another Relationship or SkillVersion", () => {
    const input = plan();
    const otherRelationship = normalizeTeachingProgressHandoff({
      relationshipId: createCanonicalId("relationship"),
      skillVersionId: input.skillVersionId,
      lessonStepKey: "factor-basics",
      checkpointState: "in-progress",
      demonstratedUnderstanding: [],
      misconceptionsToRevisit: [],
      nextSteps: ["Continue"],
      recordedAt: toInstant("2026-10-04T12:00:00.000Z"),
    });
    expect(() =>
      resolveTeachingContinuation(input, otherRelationship),
    ).toThrow(/must match the lesson SkillVersion and Relationship/);
  });
});
