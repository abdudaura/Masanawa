import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  materializeTeachingLessonPlan,
  normalizeTeachingSequenceProposal,
  resolveTeachingAdaptiveIntake,
} from "./teaching-plan.js";

const relationshipId = createCanonicalId("relationship");
const skillVersionId = createCanonicalId("skill-version");

function proposal() {
  return {
    sequenceTitle: "Fractions from first principles",
    rationale: "Start concrete, then move to symbolic practice.",
    steps: [
      {
        stepKey: "fraction-meaning",
        title: "What a fraction means",
        objective: "Connect fractions to equal parts of a whole.",
        explanation: "A fraction names how many equal parts are selected.",
        examples: ["Three out of four equal slices is 3/4."],
        workedSolutions: ["Shade 3 of 4 equal boxes to represent 3/4."],
        exercisePrompts: ["Which picture represents 2/3?"],
        resourceKeys: [],
      },
      {
        stepKey: "equivalent-fractions",
        title: "Equivalent fractions",
        objective: "Recognize fractions with the same value.",
        explanation: "Multiplying numerator and denominator by the same nonzero number preserves value.",
        examples: ["1/2 = 2/4"],
        workedSolutions: ["1/3 × 2/2 = 2/6"],
        exercisePrompts: ["Give a fraction equivalent to 3/5."],
        resourceKeys: ["fractions-reference"],
      },
    ],
    uncertaintyNotes: [],
  } as const;
}

describe("adaptive Teaching intake", () => {
  it("resolves a minimal explicit topic without a lengthy questionnaire", () => {
    const result = resolveTeachingAdaptiveIntake({
      relationshipId,
      explicit: {
        topic: "Fractions",
      },
    });

    expect(result.ready).toBe(true);
    expect(result.clarificationQuestions).toEqual([]);
    expect(result.learner).toMatchObject({
      relationshipId,
      topic: "Fractions",
      level: "unspecified",
      goals: ["Understand Fractions clearly"],
      language: "en",
      preferredModalities: ["text"],
    });
    expect(result.assumptions).toContain("goal defaulted to clear understanding");
    expect(result.assumptions).toContain("language defaulted to en");
  });

  it("uses confident inference but explicit learner input wins", () => {
    const result = resolveTeachingAdaptiveIntake({
      relationshipId,
      explicit: {
        topic: "Quadratic equations",
        level: "beginner",
        language: "ha",
        preferredModalities: ["text", "voice"],
      },
      inferred: {
        topic: { value: "Linear equations", confidence: 0.99 },
        level: { value: "advanced", confidence: 0.99 },
        language: { value: "en", confidence: 0.99 },
        goals: {
          value: ["Solve factorable quadratics independently"],
          confidence: 0.91,
        },
      },
    });

    expect(result.learner).toMatchObject({
      topic: "Quadratic equations",
      level: "beginner",
      language: "ha",
      goals: ["Solve factorable quadratics independently"],
      preferredModalities: ["text", "voice"],
    });
    expect(result.assumptions).toContain("goals inferred from learner context");
    expect(result.assumptions).not.toContain("topic inferred from learner context");
  });

  it("rejects low-confidence topic inference and asks one bounded clarification", () => {
    const result = resolveTeachingAdaptiveIntake({
      relationshipId,
      explicit: {},
      inferred: {
        topic: { value: "Thermodynamics", confidence: 0.4 },
        level: { value: "intermediate", confidence: 0.9 },
      },
    });

    expect(result.ready).toBe(false);
    expect(result.learner).toBeNull();
    expect(result.clarificationQuestions).toEqual([
      {
        field: "topic",
        prompt: "What would you like to learn?",
        required: true,
      },
    ]);
  });

  it("rejects invalid inference confidence instead of silently trusting it", () => {
    expect(() =>
      resolveTeachingAdaptiveIntake({
        relationshipId,
        explicit: {},
        inferred: {
          topic: { value: "Biology", confidence: 2 },
        },
      }),
    ).toThrow(/confidence/);
  });
});

describe("adaptive Teaching sequence proposal", () => {
  it("normalizes a short sequence before resources are attached", () => {
    const normalized = normalizeTeachingSequenceProposal(proposal());
    expect(normalized.steps).toHaveLength(2);
    expect(normalized.steps[1]?.resourceKeys).toEqual(["fractions-reference"]);
    expect(Object.isFrozen(normalized.steps)).toBe(true);
  });

  it("rejects duplicate step keys and oversized sequences", () => {
    const base = proposal();
    expect(() =>
      normalizeTeachingSequenceProposal({
        ...base,
        steps: [base.steps[0], { ...base.steps[1], stepKey: "fraction-meaning" }],
      }),
    ).toThrow(/step keys must be unique/);

    expect(() =>
      normalizeTeachingSequenceProposal({
        ...base,
        steps: Array.from({ length: 25 }, (_, index) => ({
          ...base.steps[0],
          stepKey: `step-${index}`,
        })),
      }),
    ).toThrow(/steps are invalid/);
  });

  it("materializes only a resolved intake and reuses canonical plan validation", () => {
    const resolution = resolveTeachingAdaptiveIntake({
      relationshipId,
      explicit: {
        topic: "Fractions",
        level: "beginner",
        goals: ["Understand and compare fractions"],
        language: "en",
        accessibilityPreferences: ["Prefer short steps"],
        preferredModalities: ["text", "voice"],
      },
    });

    const plan = materializeTeachingLessonPlan({
      skillVersionId,
      resolution,
      proposal: proposal(),
      resources: [
        {
          resourceKey: "fractions-reference",
          title: "Reviewed fractions reference",
          reference: "resource://teaching/math/fractions/v1",
          contentHash: `sha256:${"a".repeat(64)}`,
          checkedAt: toInstant("2026-10-06T00:00:00.000Z"),
        },
      ],
    });

    expect(plan.skillVersionId).toBe(skillVersionId);
    expect(plan.learner.relationshipId).toBe(relationshipId);
    expect(plan.steps[1]?.resourceKeys).toEqual(["fractions-reference"]);
    expect(plan.uncertaintyNotes).toEqual([]);
  });

  it("fails closed when materializing before required clarification", () => {
    const resolution = resolveTeachingAdaptiveIntake({
      relationshipId,
      explicit: {},
    });

    expect(() =>
      materializeTeachingLessonPlan({
        skillVersionId,
        resolution,
        proposal: proposal(),
      }),
    ).toThrow(/requires clarification/);
  });
});
