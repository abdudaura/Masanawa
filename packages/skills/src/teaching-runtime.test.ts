import { describe, expect, it } from "vitest";
import { fingerprintCanonicalJson } from "@masanawa/security";
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
  createTeachingRuntimeBindingFromAdmission,
  createTeachingSelectionActionBinding,
  createTeachingChannelSelectionBinding,
  createTeachingChannelSingleSelectProjection,
  resolveTeachingChannelSelection,
  fingerprintTeachingLessonPlan,
  fingerprintTeachingSelectionAttempt,
  resolveTeachingOpaqueSelection,
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

function admissionEvidence(
  active: TeachingLessonPlan,
  key = "core.teaching",
) {
  const orderedVersions = [
    {
      ordinal: 0,
      skillVersionId: active.skillVersionId,
      key,
      version: "1.0.0",
      definitionHash: `sha256:${"d".repeat(64)}`,
    },
  ] as const;
  return {
    revisionPin: {
      schemaVersion: 1 as const,
      rootSkillVersionId: active.skillVersionId,
      orderedVersions,
      contentHash: `sha256:${fingerprintCanonicalJson({
        schemaVersion: 1,
        rootSkillVersionId: active.skillVersionId,
        orderedVersions,
      })}`,
    },
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
  progress: { planHash: string; progress: TeachingProgressHandoff } | null = null;
  readonly attempts = new Map<RequestId, TeachingSelectionAttempt>();

  async load(
    key: TeachingProgressKey,
  ): Promise<{ planHash: string; progress: TeachingProgressHandoff } | null> {
    if (
      this.progress !== null &&
      (this.progress.progress.relationshipId !== key.relationshipId ||
        this.progress.progress.skillVersionId !== key.skillVersionId)
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
    this.progress = {
      planHash: attempt.planHash,
      progress: attempt.progress,
    };
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


describe("Teaching evidence integration", () => {
  it("fails closed with explicit uncertainty when no evidence port is configured", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });

    const result = await coordinator.resolveEvidence(binding(active), {
      relationshipId: active.learner.relationshipId,
      skillVersionId: active.skillVersionId,
      lessonStepKey: "common-denominator",
      query: "What is the current official curriculum requirement for this topic?",
      purpose: "current-claim",
    });

    expect(result).toEqual({
      status: "insufficient",
      evidence: [],
      uncertaintyNote:
        "No evidence-capable Teaching integration is available for this claim.",
    });
  });

  it("accepts bounded hashed evidence from an external authority-preserving resolver", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
      evidence: {
        async resolve() {
          return {
            status: "verified" as const,
            evidence: [
              {
                resourceKey: "curriculum-reference",
                title: "Reviewed curriculum reference",
                reference: "evidence://curriculum/fractions/2026",
                contentHash: `sha256:${"c".repeat(64)}`,
                checkedAt: toInstant("2026-10-04T17:30:00.000Z"),
              },
            ],
            uncertaintyNote: null,
          };
        },
      },
    });

    const result = await coordinator.resolveEvidence(binding(active), {
      relationshipId: active.learner.relationshipId,
      skillVersionId: active.skillVersionId,
      lessonStepKey: "common-denominator",
      query: "Check the current curriculum requirement.",
      purpose: "source-check",
    });

    expect(result).toMatchObject({
      status: "verified",
      evidence: [
        {
          resourceKey: "curriculum-reference",
          contentHash: `sha256:${"c".repeat(64)}`,
        },
      ],
      uncertaintyNote: null,
    });
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("rejects a resolver that labels empty evidence as verified", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
      evidence: {
        async resolve() {
          return {
            status: "verified" as const,
            evidence: [],
            uncertaintyNote: null,
          };
        },
      },
    });

    await expect(
      coordinator.resolveEvidence(binding(active), {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        query: "Verify this current claim.",
        purpose: "current-claim",
      }),
    ).rejects.toThrow(/requires evidence/);
  });

  it("rejects evidence requests outside the admitted Relationship scope", async () => {
    const active = lesson();
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });

    await expect(
      coordinator.resolveEvidence(binding(active), {
        relationshipId: createCanonicalId("relationship"),
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        query: "Verify this claim.",
        purpose: "specialist-claim",
      }),
    ).rejects.toThrow(/must match the admitted Relationship and SkillVersion/);
  });
});


describe("Teaching opaque action binding", () => {
  it("reconstructs the full scoped submission from an opaque client selection", async () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.1",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    const resolved = resolveTeachingOpaqueSelection({
      binding: admitted,
      action,
      selection: {
        actionKey: "teach.action.denominator-choice.1",
        selectedOptionKeys: ["six"],
      },
      now: toInstant("2026-10-04T18:00:00.000Z"),
    });

    expect(resolved).toMatchObject({
      requestId: action.requestId,
      rubric: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
      },
      submission: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        selectedOptionKeys: ["six"],
      },
    });
  });

  it("submits opaque selections with the binding RequestId rather than client scope", async () => {
    const active = lesson();
    const admitted = binding(active);
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.2",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    const result = await coordinator.submitOpaqueSelection({
      binding: admitted,
      action,
      selection: {
        actionKey: action.actionKey,
        selectedOptionKeys: ["six"],
      },
      plan: active,
      now: toInstant("2026-10-04T18:01:00.000Z"),
    });

    expect(result).toMatchObject({
      kind: "feedback",
      persistence: "stored",
      evaluation: { correct: true },
    });
    expect(progress.attempts.has(action.requestId)).toBe(true);
  });

  it("rejects client action swapping and expired action use", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.3",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    expect(() =>
      resolveTeachingOpaqueSelection({
        binding: admitted,
        action,
        selection: {
          actionKey: "teach.action.different.3",
          selectedOptionKeys: ["six"],
        },
        now: toInstant("2026-10-04T18:02:00.000Z"),
      }),
    ).toThrow(/action key does not match/);

    expect(() =>
      resolveTeachingOpaqueSelection({
        binding: admitted,
        action,
        selection: {
          actionKey: action.actionKey,
          selectedOptionKeys: ["six"],
        },
        now: toInstant("2100-01-01T00:00:00.000Z"),
      }),
    ).toThrow(/expired/);
  });

  it("rejects tampered server-side action payloads before evaluation", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.4",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    const tampered = {
      ...action,
      exerciseKey: "forged-exercise",
    };

    expect(() =>
      resolveTeachingOpaqueSelection({
        binding: admitted,
        action: tampered,
        selection: {
          actionKey: action.actionKey,
          selectedOptionKeys: ["six"],
        },
        now: toInstant("2026-10-04T18:03:00.000Z"),
      }),
    ).toThrow(/binding hash does not match payload/);
  });
});


describe("Teaching bound exercise projection", () => {
  it("exposes only the opaque action key while keeping the answer rubric server-side", async () => {
    const active = lesson();
    const admitted = binding(active);
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.bound",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    const projection = await coordinator.presentBoundExercise(
      admitted,
      {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        prompt: "Which is a common denominator for 1/2 and 1/3?",
        kind: "single-select",
        options: [
          { optionKey: "six", label: "6" },
          { optionKey: "five", label: "5" },
        ],
      },
      action,
    );

    expect(projection).toMatchObject({
      kind: "exercise",
      actionKey: "teach.action.denominator-choice.bound",
      card: {
        exerciseKey: "denominator-choice",
      },
    });
    if (projection.kind === "exercise") {
      expect(projection.card).not.toHaveProperty("correctOptionKeys");
      expect(projection).not.toHaveProperty("rubric");
    }
  });

  it("rejects a visible card whose option set drifts from the hidden rubric", async () => {
    const active = lesson();
    const admitted = binding(active);
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.drift",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    await expect(
      coordinator.presentBoundExercise(
        admitted,
        {
          relationshipId: active.learner.relationshipId,
          skillVersionId: active.skillVersionId,
          lessonStepKey: "common-denominator",
          exerciseKey: "denominator-choice",
          prompt: "Which is a common denominator?",
          kind: "single-select",
          options: [
            { optionKey: "six", label: "6" },
            { optionKey: "twelve", label: "12" },
          ],
        },
        action,
      ),
    ).rejects.toThrow(/options must match the server rubric/);
  });

  it("rejects a card bound to a different exercise even inside the same lesson", async () => {
    const active = lesson();
    const admitted = binding(active);
    const coordinator = new TeachingRuntimeCoordinator({
      progress: new MemoryProgressPort(),
    });
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.scope",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    await expect(
      coordinator.presentBoundExercise(
        admitted,
        {
          relationshipId: active.learner.relationshipId,
          skillVersionId: active.skillVersionId,
          lessonStepKey: "common-denominator",
          exerciseKey: "different-exercise",
          prompt: "Choose.",
          kind: "single-select",
          options: [
            { optionKey: "six", label: "6" },
            { optionKey: "five", label: "5" },
          ],
        },
        action,
      ),
    ).rejects.toThrow(/must match the server action binding scope/);
  });
});


describe("Teaching lesson plan identity", () => {
  it("keeps the same plan hash across language and modality preference changes", () => {
    const active = lesson();
    const changed: TeachingLessonPlan = {
      ...active,
      learner: {
        ...active.learner,
        language: "ha",
        accessibilityPreferences: ["Prefer shorter sentences"],
        preferredModalities: ["voice"],
      },
    };

    expect(fingerprintTeachingLessonPlan(changed)).toBe(
      fingerprintTeachingLessonPlan(active),
    );
  });

  it("changes the plan hash when pedagogical sequence changes", () => {
    const active = lesson();
    const changed: TeachingLessonPlan = {
      ...active,
      steps: [
        ...active.steps,
        {
          ...active.steps[1]!,
          stepKey: "simplify-answer",
          title: "Simplify the answer",
        },
      ],
    };

    expect(fingerprintTeachingLessonPlan(changed)).not.toBe(
      fingerprintTeachingLessonPlan(active),
    );
  });

  it("refuses to resume durable progress against a different lesson plan", async () => {
    const active = lesson();
    const progress = new MemoryProgressPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress });

    await coordinator.submitSelection(binding(active), {
      requestId: createCanonicalId("request"),
      plan: active,
      rubric: rubric(active),
      submission: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T18:20:00.000Z"),
    });

    const drifted: TeachingLessonPlan = {
      ...active,
      steps: [
        active.steps[0]!,
        {
          ...active.steps[1]!,
          objective: "A changed objective that was not part of the persisted plan.",
        },
      ],
    };

    await expect(
      coordinator.resume(binding(drifted), drifted),
    ).rejects.toThrow(/different lesson plan/);
  });
});


describe("Teaching admission evidence bridge", () => {
  it("creates a Teaching runtime binding from the exact admitted root revision pin", () => {
    const active = lesson();
    const result = createTeachingRuntimeBindingFromAdmission({
      relationshipId: active.learner.relationshipId,
      admission: admissionEvidence(active),
      guideContentHash: `sha256:${"a".repeat(64)}`,
    });

    expect(result).toEqual({
      relationshipId: active.learner.relationshipId,
      skillVersionId: active.skillVersionId,
      skillKey: "core.teaching",
      guideContentHash: `sha256:${"a".repeat(64)}`,
    });
  });

  it("refuses an admitted non-Teaching root even when the revision pin is valid", () => {
    const active = lesson();
    expect(() =>
      createTeachingRuntimeBindingFromAdmission({
        relationshipId: active.learner.relationshipId,
        admission: admissionEvidence(active, "research.web"),
        guideContentHash: `sha256:${"a".repeat(64)}`,
      }),
    ).toThrow(/must pin core\.teaching/);
  });

  it("refuses a tampered admission revision pin hash", () => {
    const active = lesson();
    const valid = admissionEvidence(active);
    expect(() =>
      createTeachingRuntimeBindingFromAdmission({
        relationshipId: active.learner.relationshipId,
        admission: {
          revisionPin: {
            ...valid.revisionPin,
            contentHash: `sha256:${"f".repeat(64)}`,
          },
        },
        guideContentHash: `sha256:${"a".repeat(64)}`,
      }),
    ).toThrow(/hash does not match its contents/);
  });

  it("refuses a revision pin whose root is not the final ordered entry", () => {
    const active = lesson();
    const dependencyId = createCanonicalId("skill-version");
    const orderedVersions = [
      {
        ordinal: 0,
        skillVersionId: active.skillVersionId,
        key: "core.teaching",
        version: "1.0.0",
        definitionHash: `sha256:${"d".repeat(64)}`,
      },
      {
        ordinal: 1,
        skillVersionId: dependencyId,
        key: "subject.math",
        version: "1.0.0",
        definitionHash: `sha256:${"e".repeat(64)}`,
      },
    ] as const;
    const admission = {
      revisionPin: {
        schemaVersion: 1 as const,
        rootSkillVersionId: active.skillVersionId,
        orderedVersions,
        contentHash: `sha256:${fingerprintCanonicalJson({
          schemaVersion: 1,
          rootSkillVersionId: active.skillVersionId,
          orderedVersions,
        })}`,
      },
    };

    expect(() =>
      createTeachingRuntimeBindingFromAdmission({
        relationshipId: active.learner.relationshipId,
        admission,
        guideContentHash: `sha256:${"a".repeat(64)}`,
      }),
    ).toThrow(/exact root SkillVersion/);
  });
});


describe("Teaching channel callback binding", () => {
  it("maps a compact provider callback token to the same opaque Teaching selection", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.channel",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    const channel = createTeachingChannelSelectionBinding({
      action,
      callbackToken: "tch_cb_AbC12345",
      optionKey: "six",
    });

    expect(
      resolveTeachingChannelSelection({
        selectionId: "tch_cb_AbC12345",
        binding: channel,
        action,
        now: toInstant("2026-10-04T18:40:00.000Z"),
      }),
    ).toEqual({
      actionKey: action.actionKey,
      selectedOptionKeys: ["six"],
    });
    expect(channel.callbackToken.length).toBeLessThanOrEqual(64);
  });

  it("rejects provider callback tokens for options not allowed by the hidden rubric", () => {
    const active = lesson();
    const action = createTeachingSelectionActionBinding({
      binding: binding(active),
      actionKey: "teach.action.denominator-choice.channel2",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    expect(() =>
      createTeachingChannelSelectionBinding({
        action,
        callbackToken: "tch_cb_AbC12346",
        optionKey: "forged-option",
      }),
    ).toThrow(/must be allowed by the server rubric/);
  });

  it("rejects callback swapping, expiry and binding tampering", () => {
    const active = lesson();
    const action = createTeachingSelectionActionBinding({
      binding: binding(active),
      actionKey: "teach.action.denominator-choice.channel3",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    const channel = createTeachingChannelSelectionBinding({
      action,
      callbackToken: "tch_cb_AbC12347",
      optionKey: "six",
    });

    expect(() =>
      resolveTeachingChannelSelection({
        selectionId: "tch_cb_Different",
        binding: channel,
        action,
        now: toInstant("2026-10-04T18:40:00.000Z"),
      }),
    ).toThrow(/does not match binding/);

    expect(() =>
      resolveTeachingChannelSelection({
        selectionId: channel.callbackToken,
        binding: channel,
        action,
        now: toInstant("2100-01-01T00:00:00.000Z"),
      }),
    ).toThrow(/expired/);

    expect(() =>
      resolveTeachingChannelSelection({
        selectionId: channel.callbackToken,
        binding: {
          ...channel,
          optionKey: "five",
        },
        action,
        now: toInstant("2026-10-04T18:40:00.000Z"),
      }),
    ).toThrow(/binding hash does not match payload/);
  });

  it("rejects a valid callback paired with a different exact Teaching action", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.shared",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    const channel = createTeachingChannelSelectionBinding({
      action,
      callbackToken: "tch_cb_AbC12348",
      optionKey: "six",
    });
    const otherAction = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.shared",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    expect(() =>
      resolveTeachingChannelSelection({
        selectionId: channel.callbackToken,
        binding: channel,
        action: otherAction,
        now: toInstant("2026-10-04T18:40:00.000Z"),
      }),
    ).toThrow(/does not match the exact action binding/);
  });

  it("enforces the common Telegram-safe 64-character callback limit", () => {
    const active = lesson();
    const action = createTeachingSelectionActionBinding({
      binding: binding(active),
      actionKey: "teach.action.denominator-choice.channel4",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    expect(() =>
      createTeachingChannelSelectionBinding({
        action,
        callbackToken: "x".repeat(65),
        optionKey: "six",
      }),
    ).toThrow(/callback token is invalid/);
  });
});


describe("Teaching outbound channel option projection", () => {
  it("emits provider-safe labels and compact selection ids without exposing action/rubric data", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.outbound",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    const projection = createTeachingChannelSingleSelectProjection({
      binding: admitted,
      card: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "denominator-choice",
        prompt: "Which denominator works for 1/2 and 1/3?",
        kind: "single-select",
        options: [
          { optionKey: "six", label: "6" },
          { optionKey: "five", label: "5" },
        ],
      },
      action,
      callbackTokens: {
        six: "tch_cb_six_0001",
        five: "tch_cb_five_0001",
      },
    });

    expect(projection.options).toEqual([
      { optionKey: "six", label: "6", selectionId: "tch_cb_six_0001" },
      { optionKey: "five", label: "5", selectionId: "tch_cb_five_0001" },
    ]);
    expect(JSON.stringify(projection.options)).not.toContain(action.actionKey);
    expect(JSON.stringify(projection.options)).not.toContain("correctOptionKeys");
    expect(projection.bindings).toHaveLength(2);
    expect(projection.bindings.every((item) => item.callbackToken.length <= 64)).toBe(true);
  });

  it("requires one unique callback token for every visible option", () => {
    const active = lesson();
    const admitted = binding(active);
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.outbound2",
      requestId: createCanonicalId("request"),
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    const card = {
      relationshipId: active.learner.relationshipId,
      skillVersionId: active.skillVersionId,
      lessonStepKey: "common-denominator",
      exerciseKey: "denominator-choice",
      prompt: "Choose.",
      kind: "single-select" as const,
      options: [
        { optionKey: "six", label: "6" },
        { optionKey: "five", label: "5" },
      ],
    };

    expect(() =>
      createTeachingChannelSingleSelectProjection({
        binding: admitted,
        card,
        action,
        callbackTokens: { six: "tch_cb_same_0001" },
      }),
    ).toThrow(/cover every visible option exactly/);

    expect(() =>
      createTeachingChannelSingleSelectProjection({
        binding: admitted,
        card,
        action,
        callbackTokens: {
          six: "tch_cb_same_0001",
          five: "tch_cb_same_0001",
        },
      }),
    ).toThrow(/must be unique/);
  });

  it("refuses multi-select channel projection until a real multi-selection channel flow exists", () => {
    const active = lesson();
    const admitted = binding(active);
    const multiRubric = {
      ...rubric(active),
      kind: "multi-select" as const,
      allowedOptionKeys: ["six", "twelve"],
      correctOptionKeys: ["six", "twelve"],
    };
    const action = createTeachingSelectionActionBinding({
      binding: admitted,
      actionKey: "teach.action.denominator-choice.multi-outbound",
      requestId: createCanonicalId("request"),
      rubric: multiRubric,
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    expect(() =>
      createTeachingChannelSingleSelectProjection({
        binding: admitted,
        card: {
          relationshipId: active.learner.relationshipId,
          skillVersionId: active.skillVersionId,
          lessonStepKey: "common-denominator",
          exerciseKey: "denominator-choice",
          prompt: "Choose all valid answers.",
          kind: "multi-select",
          options: [
            { optionKey: "six", label: "6" },
            { optionKey: "twelve", label: "12" },
          ],
        },
        action,
        callbackTokens: {
          six: "tch_cb_six_multi",
          twelve: "tch_cb_twelve_multi",
        },
      }),
    ).toThrow(/supports single-select only/);
  });
});
