import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type RequestId,
} from "@masanawa/contracts";
import type {
  TeachingLessonPlan,
  TeachingProgressHandoff,
  TeachingSelectableExerciseRubric,
} from "./teaching.js";
import {
  createTeachingRuntimeBinding,
  fingerprintTeachingSelectionAttempt,
  TeachingRuntimeCoordinator,
  type TeachingProgressKey,
  type TeachingProgressPort,
  type TeachingRuntimeProjection,
  type TeachingSelectionAttempt,
} from "./teaching-runtime.js";

function lesson(): TeachingLessonPlan {
  return {
    skillVersionId: createCanonicalId("skill-version"),
    learner: {
      relationshipId: createCanonicalId("relationship"),
      topic: "Fractions",
      level: "beginner",
      goals: ["Add fractions with unlike denominators"],
      language: "en",
      accessibilityPreferences: [],
      preferredModalities: ["text"],
    },
    sequenceTitle: "Fractions",
    steps: [
      {
        stepKey: "common-denominator",
        title: "Find a common denominator",
        objective: "Find equivalent fractions with a shared denominator.",
        explanation: "Use a common multiple of both denominators.",
        examples: ["1/2 + 1/3"],
        workedSolutions: ["1/2 = 3/6 and 1/3 = 2/6"],
        exercisePrompts: ["Rewrite 1/4 and 1/6 with a common denominator"],
        resourceKeys: [],
      },
      {
        stepKey: "add-numerators",
        title: "Add numerators",
        objective: "Add equivalent fractions once denominators match.",
        explanation: "Keep the common denominator and add numerators.",
        examples: ["3/6 + 2/6"],
        workedSolutions: ["3/6 + 2/6 = 5/6"],
        exercisePrompts: ["Add 5/12 + 1/12"],
        resourceKeys: [],
      },
    ],
    resources: [],
    uncertaintyNotes: [],
  };
}

function binding(active: TeachingLessonPlan) {
  return createTeachingRuntimeBinding({
    relationshipId: active.learner.relationshipId,
    skillVersionId: active.skillVersionId,
    skillKey: "core.teaching",
    guideContentHash: `sha256:${"a".repeat(64)}`,
  });
}

function rubric(plan: TeachingLessonPlan): TeachingSelectableExerciseRubric {
  return {
    relationshipId: plan.learner.relationshipId,
    skillVersionId: plan.skillVersionId,
    lessonStepKey: "common-denominator",
    exerciseKey: "denominator-choice",
    kind: "single-select",
    allowedOptionKeys: ["six", "five"],
    correctOptionKeys: ["six"],
    correctFeedback: "Correct. Six is divisible by both 2 and 3.",
    retryFeedback: "Try a number divisible by both denominators.",
    alternativeExplanation: "List multiples of 2 and 3 and find the first overlap.",
  };
}

class MemoryProgressPort implements TeachingProgressPort {
  progress: TeachingProgressHandoff | null = null;
  readonly attempts = new Map<RequestId, TeachingSelectionAttempt>();

  async load(key: TeachingProgressKey): Promise<TeachingProgressHandoff | null> {
    if (
      this.progress !== null &&
      (this.progress.relationshipId !== key.relationshipId ||
        this.progress.skillVersionId !== key.skillVersionId)
    ) {
      return null;
    }
    return this.progress;
  }

  async commitSelectionAttempt(
    attempt: TeachingSelectionAttempt,
  ): Promise<"stored" | "replay"> {
    const existing = this.attempts.get(attempt.requestId);
    if (existing !== undefined) {
      if (existing.payloadHash !== attempt.payloadHash) {
        throw new TypeError("Teaching RequestId payload conflict");
      }
      return "replay";
    }
    this.attempts.set(attempt.requestId, attempt);
    this.progress = attempt.progress;
    return "stored";
  }
}

describe("TeachingRuntimeCoordinator", () => {
  it("resumes at the first step when no durable progress exists", async () => {
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const projection = await coordinator.resume(binding(lesson()), lesson());

    expect(projection).toMatchObject({
      kind: "lesson-step",
      continuationReason: "start",
      sequenceCompleted: false,
      step: { stepKey: "common-denominator" },
    });
  });

  it("publishes only the client-safe exercise card", async () => {
    const plan = lesson();
    const progress = new MemoryProgressPort();
    const published: TeachingRuntimeProjection[] = [];
    const coordinator = new TeachingRuntimeCoordinator({
      progress,
      presentation: {
        async publish(projection) {
          published.push(projection);
        },
      },
    });

    const projection = await coordinator.presentExercise(binding(plan), {
      relationshipId: plan.learner.relationshipId,
      skillVersionId: plan.skillVersionId,
      lessonStepKey: "common-denominator",
      exerciseKey: "denominator-choice",
      prompt: "Which is a common denominator for 1/2 and 1/3?",
      kind: "single-select",
      options: [
        { optionKey: "six", label: "6" },
        { optionKey: "five", label: "5" },
      ],
    });

    expect(projection.kind).toBe("exercise");
    if (projection.kind === "exercise") {
      expect(projection.card).not.toHaveProperty("correctOptionKeys");
    }
    expect(published).toEqual([projection]);
  });

  it("persists one scoped selection attempt before returning feedback", async () => {
    const plan = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const requestId = createCanonicalId("request");

    const result = await coordinator.submitSelection(binding(plan), {
      requestId,
      plan,
      rubric: rubric(plan),
      submission: {
        relationshipId: plan.learner.relationshipId,
        skillVersionId: plan.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T16:00:00.000Z"),
    });

    expect(result).toMatchObject({
      kind: "feedback",
      persistence: "stored",
      evaluation: { correct: true, nextCheckpointState: "ready-to-advance" },
      continuation: {
        reason: "advance",
        nextStep: { stepKey: "add-numerators" },
      },
    });
    expect(progress.attempts.get(requestId)?.progress.checkpointState).toBe(
      "ready-to-advance",
    );
  });

  it("replays the same durable RequestId without creating a second attempt", async () => {
    const plan = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const requestId = createCanonicalId("request");
    const input = {
      requestId,
      plan,
      rubric: rubric(plan),
      submission: {
        relationshipId: plan.learner.relationshipId,
        skillVersionId: plan.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T16:00:00.000Z"),
    } as const;

    await coordinator.submitSelection(binding(plan), input);
    const replay = await coordinator.submitSelection(binding(plan), input);

    expect(replay).toMatchObject({ kind: "feedback", persistence: "replay" });
    expect(progress.attempts.size).toBe(1);
  });

  it("fails before persistence when submission scope does not match the lesson", async () => {
    const plan = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });

    await expect(
      coordinator.submitSelection(binding(plan), {
        requestId: createCanonicalId("request"),
        plan,
        rubric: rubric(plan),
        submission: {
          relationshipId: createCanonicalId("relationship"),
          skillVersionId: plan.skillVersionId,
          lessonStepKey: "common-denominator",
          exerciseKey: "denominator-choice",
          selectedOptionKeys: ["six"],
        },
        recordedAt: toInstant("2026-10-04T16:00:00.000Z"),
      }),
    ).rejects.toThrow(/match rubric scope/);
    expect(progress.attempts.size).toBe(0);
  });
});


describe("Teaching selection replay identity", () => {
  it("fingerprints equivalent multi-select order identically", () => {
    const relationshipId = createCanonicalId("relationship");
    const skillVersionId = createCanonicalId("skill-version");
    const left = fingerprintTeachingSelectionAttempt({
      relationshipId,
      skillVersionId,
      lessonStepKey: "prime-numbers",
      exerciseKey: "choose-primes",
      selectedOptionKeys: ["two", "three"],
    });
    const right = fingerprintTeachingSelectionAttempt({
      relationshipId,
      skillVersionId,
      lessonStepKey: "prime-numbers",
      exerciseKey: "choose-primes",
      selectedOptionKeys: ["three", "two"],
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("rejects changed selection payload under the same RequestId", async () => {
    const plan = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const requestId = createCanonicalId("request");

    await coordinator.submitSelection(binding(plan), {
      requestId,
      plan,
      rubric: rubric(plan),
      submission: {
        relationshipId: plan.learner.relationshipId,
        skillVersionId: plan.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T16:00:00.000Z"),
    });

    await expect(
      coordinator.submitSelection(binding(plan), {
        requestId,
        plan,
        rubric: rubric(plan),
        submission: {
          relationshipId: plan.learner.relationshipId,
          skillVersionId: plan.skillVersionId,
          lessonStepKey: "common-denominator",
          exerciseKey: "denominator-choice",
          selectedOptionKeys: ["five"],
        },
        recordedAt: toInstant("2026-10-04T16:00:01.000Z"),
      }),
    ).rejects.toThrow(/payload conflict/);
    expect(progress.attempts.size).toBe(1);
  });
});


describe("Teaching runtime admission binding", () => {
  it("rejects non-Teaching skill keys at the integration boundary", () => {
    const active = lesson();
    expect(() =>
      createTeachingRuntimeBinding({
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        skillKey: "research.web",
        guideContentHash: `sha256:${"a".repeat(64)}`,
      }),
    ).toThrow(/requires core\.teaching/);
  });

  it("rejects a lesson or exercise outside the admitted Relationship/SkillVersion", async () => {
    const active = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const admitted = binding(active);
    const otherPlan: TeachingLessonPlan = {
      ...active,
      learner: {
        ...active.learner,
        relationshipId: createCanonicalId("relationship"),
      },
    };

    await expect(
      coordinator.resume(admitted, otherPlan),
    ).rejects.toThrow(/must match the admitted Relationship and SkillVersion/);
  });
});


describe("Teaching artifact presentation", () => {
  it("publishes an immutable authorized diagram projection", async () => {
    const active = lesson();
    const progress = new MemoryProgressPort();
    const published: TeachingRuntimeProjection[] = [];
    const coordinator = new TeachingRuntimeCoordinator({
      progress,
      presentation: {
        async publish(projection) {
          published.push(projection);
        },
      },
    });

    const projection = await coordinator.presentArtifact(binding(active), {
      relationshipId: active.learner.relationshipId,
      skillVersionId: active.skillVersionId,
      lessonStepKey: "common-denominator",
      artifactKey: "fraction-bars",
      kind: "diagram",
      title: "Fraction bars for one half and one third",
      reference: "artifact://teaching/fractions/fraction-bars-v1",
      mimeType: "image/svg+xml",
      contentHash: `sha256:${"b".repeat(64)}`,
      altText: "Two horizontal fraction bars showing one half and one third.",
    });

    expect(projection).toMatchObject({
      kind: "artifact",
      artifact: {
        artifactKey: "fraction-bars",
        kind: "diagram",
        mimeType: "image/svg+xml",
      },
    });
    if (projection.kind === "artifact") {
      expect(Object.isFrozen(projection.artifact)).toBe(true);
      expect(projection.artifact).not.toHaveProperty("toolCredential");
      expect(projection.artifact).not.toHaveProperty("providerId");
    }
    expect(published).toEqual([projection]);
  });

  it("rejects artifacts outside the admitted learner scope", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });

    await expect(
      coordinator.presentArtifact(binding(active), {
        relationshipId: createCanonicalId("relationship"),
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        artifactKey: "fraction-bars",
        kind: "diagram",
        title: "Fraction bars",
        reference: "artifact://teaching/fractions/fraction-bars-v1",
        mimeType: "image/svg+xml",
        contentHash: `sha256:${"b".repeat(64)}`,
        altText: "Fraction bars.",
      }),
    ).rejects.toThrow(/must match the admitted Relationship and SkillVersion/);
  });

  it("rejects unverified artifact bytes without an exact content hash", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });

    await expect(
      coordinator.presentArtifact(binding(active), {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        artifactKey: "worksheet",
        kind: "worksheet",
        title: "Practice worksheet",
        reference: "artifact://teaching/fractions/worksheet-v1",
        mimeType: "application/pdf",
        contentHash: "unknown",
        altText: "Fraction practice worksheet.",
      }),
    ).rejects.toThrow(/contentHash/);
  });
});
