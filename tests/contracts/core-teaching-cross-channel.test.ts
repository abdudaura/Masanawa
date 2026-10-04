import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
  type RequestId,
} from "@masanawa/contracts";
import {
  createTeachingRuntimeBinding,
  createTeachingSelectionActionBinding,
  TeachingRuntimeCoordinator,
  type TeachingProgressKey,
  type TeachingProgressPort,
  type TeachingRuntimeProjection,
  type TeachingSelectionAttempt,
  type TeachingLessonPlan,
  type TeachingProgressHandoff,
  type TeachingSelectableExerciseRubric,
} from "@masanawa/skills";

type Surface = "app" | "whatsapp" | "telegram";

function plan(): TeachingLessonPlan {
  return {
    skillVersionId: createCanonicalId("skill-version"),
    learner: {
      relationshipId: createCanonicalId("relationship"),
      topic: "Fractions",
      level: "beginner",
      goals: ["Add fractions with unlike denominators"],
      language: "en",
      accessibilityPreferences: [],
      preferredModalities: ["text", "voice"],
    },
    sequenceTitle: "Fractions",
    steps: [
      {
        stepKey: "common-denominator",
        title: "Common denominators",
        objective: "Find equivalent fractions with a shared denominator.",
        explanation: "Use a common multiple of both denominators.",
        examples: ["1/2 + 1/3"],
        workedSolutions: ["1/2 = 3/6 and 1/3 = 2/6"],
        exercisePrompts: ["Choose a common denominator for 1/2 and 1/3."],
        resourceKeys: [],
      },
      {
        stepKey: "add-numerators",
        title: "Add numerators",
        objective: "Add equivalent fractions after denominators match.",
        explanation: "Keep the denominator and add the numerators.",
        examples: ["3/6 + 2/6"],
        workedSolutions: ["3/6 + 2/6 = 5/6"],
        exercisePrompts: ["Add 5/12 + 1/12."],
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

function rubric(active: TeachingLessonPlan): TeachingSelectableExerciseRubric {
  return {
    relationshipId: active.learner.relationshipId,
    skillVersionId: active.skillVersionId,
    lessonStepKey: "common-denominator",
    exerciseKey: "common-denominator-choice",
    kind: "single-select",
    allowedOptionKeys: ["six", "five"],
    correctOptionKeys: ["six"],
    correctFeedback: "Correct. Six is divisible by both denominators.",
    retryFeedback: "Try a number divisible by both 2 and 3.",
    alternativeExplanation: "List multiples of 2 and 3 and find the first overlap.",
  };
}

class DurableTeachingPort implements TeachingProgressPort {
  readonly attempts = new Map<RequestId, TeachingSelectionAttempt>();
  readonly progress = new Map<string, TeachingProgressHandoff>();

  #key(key: TeachingProgressKey): string {
    return `${key.relationshipId}:${key.skillVersionId}`;
  }

  async load(key: TeachingProgressKey): Promise<TeachingProgressHandoff | null> {
    return this.progress.get(this.#key(key)) ?? null;
  }

  async commitSelectionAttempt(
    attempt: TeachingSelectionAttempt,
  ): Promise<"stored" | "replay"> {
    const existing = this.attempts.get(attempt.requestId);
    if (existing !== undefined) {
      if (existing.payloadHash !== attempt.payloadHash) {
        throw new TypeError("request payload conflict");
      }
      return "replay";
    }
    this.attempts.set(attempt.requestId, attempt);
    this.progress.set(
      this.#key({
        relationshipId: attempt.relationshipId,
        skillVersionId: attempt.skillVersionId,
      }),
      attempt.progress,
    );
    return "stored";
  }
}

class SurfaceRecorder {
  readonly deliveries: Array<{
    readonly surface: Surface;
    readonly projection: TeachingRuntimeProjection;
  }> = [];
  failNext = false;

  adapter(surface: Surface) {
    return {
      publish: async (projection: TeachingRuntimeProjection) => {
        if (this.failNext) {
          this.failNext = false;
          throw new Error("simulated lost delivery response");
        }
        this.deliveries.push({ surface, projection });
      },
    };
  }
}

describe("Core Teaching cross-channel acceptance", () => {
  it("starts in app, survives lost feedback delivery, retries on WhatsApp, and resumes on Telegram exactly once", async () => {
    const active = plan();
    const durable = new DurableTeachingPort();
    const surfaces = new SurfaceRecorder();

    const app = new TeachingRuntimeCoordinator({
      progress: durable,
      presentation: surfaces.adapter("app"),
    });
    const appStart = await app.resume(binding(active), active);
    expect(appStart).toMatchObject({
      kind: "lesson-step",
      continuationReason: "start",
      step: { stepKey: "common-denominator" },
    });

    const requestId = createCanonicalId("request");
    const action = createTeachingSelectionActionBinding({
      binding: binding(active),
      actionKey: "teach.action.common-denominator.1",
      requestId,
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });

    const exerciseProjection = await app.presentBoundExercise(
      binding(active),
      {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "common-denominator-choice",
        prompt: "Which is a common denominator for 1/2 and 1/3?",
        kind: "single-select",
        options: [
          { optionKey: "six", label: "6" },
          { optionKey: "five", label: "5" },
        ],
      },
      action,
    );
    expect(exerciseProjection).toMatchObject({
      kind: "exercise",
      actionKey: "teach.action.common-denominator.1",
    });
    if (exerciseProjection.kind === "exercise") {
      expect(exerciseProjection).not.toHaveProperty("rubric");
      expect(exerciseProjection.card).not.toHaveProperty("correctOptionKeys");
    }

    surfaces.failNext = true;
    await expect(
      app.submitOpaqueSelection({
        binding: binding(active),
        action,
        selection: {
          actionKey: action.actionKey,
          selectedOptionKeys: ["six"],
        },
        plan: active,
        now: toInstant("2026-10-04T17:00:00.000Z"),
      }),
    ).rejects.toThrow(/lost delivery response/);

    expect(durable.attempts.size).toBe(1);
    expect(
      await durable.load({
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
      }),
    ).toMatchObject({ checkpointState: "ready-to-advance" });

    const whatsapp = new TeachingRuntimeCoordinator({
      progress: durable,
      presentation: surfaces.adapter("whatsapp"),
    });
    const retry = await whatsapp.submitOpaqueSelection({
      binding: binding(active),
      action,
      selection: {
        actionKey: action.actionKey,
        selectedOptionKeys: ["six"],
      },
      plan: active,
      now: toInstant("2026-10-04T17:00:10.000Z"),
    });
    expect(retry).toMatchObject({
      kind: "feedback",
      persistence: "replay",
      continuation: {
        reason: "advance",
        nextStep: { stepKey: "add-numerators" },
      },
    });
    expect(durable.attempts.size).toBe(1);

    const telegram = new TeachingRuntimeCoordinator({
      progress: durable,
      presentation: surfaces.adapter("telegram"),
    });
    const resumed = await telegram.resume(binding(active), active);
    expect(resumed).toMatchObject({
      kind: "lesson-step",
      continuationReason: "advance",
      step: { stepKey: "add-numerators" },
    });

    expect(surfaces.deliveries.map((item) => item.surface)).toEqual([
      "app",
      "whatsapp",
      "telegram",
    ]);
  });

  it("does not leak progress to another Relationship even for the same exact SkillVersion", async () => {
    const active = plan();
    const durable = new DurableTeachingPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress: durable });
    const requestId = createCanonicalId("request");

    await coordinator.submitSelection(binding(plan), {
      requestId,
      plan: active,
      rubric: rubric(active),
      submission: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "common-denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T17:00:00.000Z"),
    });

    const other: TeachingLessonPlan = {
      ...active,
      learner: {
        ...active.learner,
        relationshipId: createCanonicalId("relationship"),
      },
    };
    const otherResume = await coordinator.resume(binding(other), other);
    expect(otherResume).toMatchObject({
      kind: "lesson-step",
      continuationReason: "start",
      step: { stepKey: "common-denominator" },
    });
  });

  it("rejects a changed answer on another surface when it reuses the original RequestId", async () => {
    const active = plan();
    const durable = new DurableTeachingPort();
    const app = new TeachingRuntimeCoordinator({ progress: durable });
    const requestId = createCanonicalId("request");

    const action = createTeachingSelectionActionBinding({
      binding: binding(active),
      actionKey: "teach.action.common-denominator.2",
      requestId,
      rubric: rubric(active),
      expiresAt: toInstant("2099-01-01T00:00:00.000Z"),
    });
    await app.submitOpaqueSelection({
      binding: binding(active),
      action,
      selection: {
        actionKey: action.actionKey,
        selectedOptionKeys: ["six"],
      },
      plan: active,
      now: toInstant("2026-10-04T17:00:00.000Z"),
    });

    const whatsapp = new TeachingRuntimeCoordinator({ progress: durable });
    await expect(
      whatsapp.submitOpaqueSelection({
        binding: binding(active),
        action,
        selection: {
          actionKey: action.actionKey,
          selectedOptionKeys: ["five"],
        },
        plan: active,
        now: toInstant("2026-10-04T17:01:00.000Z"),
      }),
    ).rejects.toThrow(/payload conflict/);

    expect(durable.attempts.size).toBe(1);
  });
});


describe("Core Teaching language and modality continuity", () => {
  it("keeps progress when the learner switches from English text to Hausa voice", async () => {
    const active = plan();
    const durable = new DurableTeachingPort();
    const coordinator = new TeachingRuntimeCoordinator({ progress: durable });

    await coordinator.submitSelection(binding(active), {
      requestId: createCanonicalId("request"),
      plan: active,
      rubric: rubric(active),
      submission: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "common-denominator-choice",
        selectedOptionKeys: ["six"],
      },
      recordedAt: toInstant("2026-10-04T17:10:00.000Z"),
    });

    const hausaVoice: TeachingLessonPlan = {
      ...active,
      learner: {
        ...active.learner,
        language: "ha",
        preferredModalities: ["voice"],
      },
    };
    const resumed = await coordinator.resume(binding(hausaVoice), hausaVoice);
    expect(resumed).toMatchObject({
      kind: "lesson-step",
      continuationReason: "advance",
      step: { stepKey: "add-numerators" },
    });
    if (resumed.kind === "lesson-step") {
      expect(resumed.relationshipId).toBe(active.learner.relationshipId);
      expect(resumed.skillVersionId).toBe(active.skillVersionId);
    }
  });

  it("reteaches the same step after a wrong answer even when the learner returns on another surface", async () => {
    const active = plan();
    const durable = new DurableTeachingPort();
    const telegram = new TeachingRuntimeCoordinator({ progress: durable });

    const feedback = await telegram.submitSelection(binding(active), {
      requestId: createCanonicalId("request"),
      plan: active,
      rubric: rubric(active),
      submission: {
        relationshipId: active.learner.relationshipId,
        skillVersionId: active.skillVersionId,
        lessonStepKey: "common-denominator",
        exerciseKey: "common-denominator-choice",
        selectedOptionKeys: ["five"],
      },
      recordedAt: toInstant("2026-10-04T17:11:00.000Z"),
    });
    expect(feedback).toMatchObject({
      kind: "feedback",
      evaluation: { correct: false, nextCheckpointState: "needs-reteaching" },
      continuation: {
        reason: "reteach-current",
        nextStep: { stepKey: "common-denominator" },
      },
    });

    const app = new TeachingRuntimeCoordinator({ progress: durable });
    const resumed = await app.resume(binding(active), active);
    expect(resumed).toMatchObject({
      kind: "lesson-step",
      continuationReason: "reteach-current",
      step: { stepKey: "common-denominator" },
    });
  });
});
