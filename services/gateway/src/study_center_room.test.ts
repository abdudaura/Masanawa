import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createTeachingMultiSelectStage,
  createTeachingRuntimeBinding,
  createTeachingSelectionActionBinding,
  type TeachingLessonPlan,
  type TeachingRuntimeProjection,
  type TeachingStoredProgress,
} from "@masanawa/skills";
import { describe, expect, it } from "vitest";

import { projectStudyCenterRoom } from "./study_center_room.js";

const relationshipId = createCanonicalId("relationship");
const skillVersionId = createCanonicalId("skill-version");

function plan(): TeachingLessonPlan {
  return {
    skillVersionId,
    learner: {
      relationshipId,
      topic: "Basic economics",
      level: "beginner",
      goals: ["Understand supply and demand"],
      language: "en",
      accessibilityPreferences: [],
      preferredModalities: ["text", "voice"],
    },
    sequenceTitle: "Economics basics",
    steps: [
      {
        stepKey: "supply",
        title: "Supply",
        objective: "Understand supply",
        explanation: "Supply describes how much sellers offer.",
        examples: ["More sellers can increase supply."],
        workedSolutions: [],
        exercisePrompts: ["Explain supply."],
        resourceKeys: [],
      },
      {
        stepKey: "demand",
        title: "Demand",
        objective: "Understand demand",
        explanation: "Demand describes how much buyers want.",
        examples: ["Lower prices can increase demand."],
        workedSolutions: [],
        exercisePrompts: ["Explain demand."],
        resourceKeys: [],
      },
    ],
    resources: [],
    uncertaintyNotes: [],
  };
}

function stored(
  checkpointState: "planned" | "needs-reteaching" | "ready-to-advance" | "completed",
  lessonStepKey = "supply",
): TeachingStoredProgress {
  return {
    planHash: "sha256:" + "1".repeat(64),
    progress: {
      relationshipId,
      skillVersionId,
      lessonStepKey,
      checkpointState,
      demonstratedUnderstanding: [],
      misconceptionsToRevisit: [],
      nextSteps: [],
      recordedAt: toInstant(new Date("2026-10-06T10:00:00.000Z")),
    },
  };
}

function exercise(
  kind: "single-select" | "multi-select" | "free-response",
): Extract<TeachingRuntimeProjection, { kind: "exercise" }> {
  return {
    kind: "exercise",
    relationshipId,
    skillVersionId,
    card: {
      relationshipId,
      skillVersionId,
      lessonStepKey: "supply",
      exerciseKey: "check",
      prompt: "Choose the best answer.",
      kind,
      options:
        kind === "free-response"
          ? []
          : [
              { optionKey: "a", label: "Answer A" },
              { optionKey: "b", label: "Answer B" },
            ],
    },
    actionKey: null,
    actionExpiresAt: null,
  };
}

describe("Study Center room projection", () => {
  it("projects first lesson with text and voice capability", () => {
    const runtime: TeachingRuntimeProjection = {
      kind: "lesson-step",
      relationshipId,
      skillVersionId,
      step: plan().steps[0]!,
      continuationReason: "start",
      sequenceCompleted: false,
    };

    const view = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: null,
      runtime,
    });

    expect(view.topic).toBe("Basic economics");
    expect(view.capabilities).toEqual({
      textEnabled: true,
      voiceEnabled: true,
    });
    expect(view.progress).toEqual({
      completedSteps: 0,
      totalSteps: 2,
      continuation: "continue",
      canResume: false,
    });
    expect(view.card?.kind).toBe("lesson");
  });

  it("derives reteach and advance from canonical continuation resolver", () => {
    const reteach = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("needs-reteaching"),
      runtime: null,
    });
    const advance = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("ready-to-advance"),
      runtime: null,
    });

    expect(reteach.progress.continuation).toBe("reteach");
    expect(reteach.progress.completedSteps).toBe(0);
    expect(advance.progress.continuation).toBe("advance");
    expect(advance.progress.completedSteps).toBe(1);
  });

  it("projects bound single-select with opaque selection ids only", () => {
    const raw = exercise("single-select");
    const binding = createTeachingRuntimeBinding({
      relationshipId,
      skillVersionId,
      skillKey: "core.teaching",
      guideContentHash: "sha256:" + "2".repeat(64),
    });
    const action = createTeachingSelectionActionBinding({
      binding,
      actionKey: "teaching-action-123",
      requestId: createCanonicalId("request"),
      rubric: {
        relationshipId,
        skillVersionId,
        lessonStepKey: "supply",
        exerciseKey: "check",
        kind: "single-select",
        allowedOptionKeys: ["a", "b"],
        correctOptionKeys: ["a"],
        correctFeedback: "Correct",
        retryFeedback: "Try again",
        alternativeExplanation: null,
      },
      expiresAt: toInstant(new Date("2026-10-06T11:00:00.000Z")),
    });
    const runtime: Extract<TeachingRuntimeProjection, { kind: "exercise" }> = {
      ...raw,
      actionKey: action.actionKey,
      actionExpiresAt: action.expiresAt,
    };

    const view = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("planned"),
      runtime,
      interaction: {
        kind: "single-select",
        actionToken: action.actionKey,
        revision: 0,
        selectionIds: {
          a: "opaque-a",
          b: "opaque-b",
        },
      },
    });

    expect(view.card?.kind).toBe("single-select");
    expect(view.card?.actionToken).toBe("teaching-action-123");
    expect(view.card?.options.map((item) => item.selectionId)).toEqual([
      "opaque-a",
      "opaque-b",
    ]);
    expect(JSON.stringify(view)).not.toContain("correctOptionKeys");
    expect(JSON.stringify(view)).not.toContain(relationshipId);
    expect(JSON.stringify(view)).not.toContain(skillVersionId);
  });

  it("projects staged multi-select revision and selected options", () => {
    const binding = createTeachingRuntimeBinding({
      relationshipId,
      skillVersionId,
      skillKey: "core.teaching",
      guideContentHash: "sha256:" + "3".repeat(64),
    });
    const action = createTeachingSelectionActionBinding({
      binding,
      actionKey: "teaching-multi-123",
      requestId: createCanonicalId("request"),
      rubric: {
        relationshipId,
        skillVersionId,
        lessonStepKey: "supply",
        exerciseKey: "check",
        kind: "multi-select",
        allowedOptionKeys: ["a", "b"],
        correctOptionKeys: ["a", "b"],
        correctFeedback: "Correct",
        retryFeedback: "Try again",
        alternativeExplanation: null,
      },
      expiresAt: toInstant(new Date("2026-10-06T11:00:00.000Z")),
    });
    const stage = createTeachingMultiSelectStage({ binding, action });
    const runtime: Extract<TeachingRuntimeProjection, { kind: "exercise" }> = {
      ...exercise("multi-select"),
      actionKey: action.actionKey,
      actionExpiresAt: action.expiresAt,
    };

    const view = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("planned"),
      runtime,
      interaction: {
        kind: "multi-select",
        actionToken: action.actionKey,
        stage,
        selectionIds: { a: "toggle-a", b: "toggle-b" },
      },
    });

    expect(view.card?.kind).toBe("multi-select");
    expect(view.card?.revision).toBe(0);
    expect(view.card?.options.every((item) => item.selected === false)).toBe(true);
  });

  it("projects free response using a server-held opaque pending-action token", () => {
    const runtime = exercise("free-response");
    const view = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("planned"),
      runtime,
      interaction: {
        kind: "free-response",
        actionToken: "pending-free-response-123",
        revision: 4,
      },
    });

    expect(view.card?.kind).toBe("free-response");
    expect(view.card?.options).toEqual([]);
    expect(view.card?.revision).toBe(4);
  });

  it("rejects missing or incomplete selectable action projection", () => {
    const runtime = {
      ...exercise("single-select"),
      actionKey: "teaching-action-456",
      actionExpiresAt: toInstant(new Date("2026-10-06T11:00:00.000Z")),
    } as Extract<TeachingRuntimeProjection, { kind: "exercise" }>;

    expect(() =>
      projectStudyCenterRoom({
        plan: plan(),
        storedProgress: stored("planned"),
        runtime,
      }),
    ).toThrow("Interactive Study exercise requires an opaque action projection");

    expect(() =>
      projectStudyCenterRoom({
        plan: plan(),
        storedProgress: stored("planned"),
        runtime,
        interaction: {
          kind: "single-select",
          actionToken: "teaching-action-456",
          revision: 0,
          selectionIds: { a: "only-a" },
        },
      }),
    ).toThrow("Study selection ids must cover every visible Teaching option exactly");
  });

  it("projects feedback without exposing Teaching scope", () => {
    const runtime: TeachingRuntimeProjection = {
      kind: "feedback",
      relationshipId,
      skillVersionId,
      exerciseKey: "check",
      evaluation: {
        assessmentKind: "formative",
        correct: true,
        feedback: "Good work",
        misconception: null,
        alternativeExplanation: null,
        nextCheckpointState: "ready-to-advance",
      },
      continuation: {
        currentStep: plan().steps[0]!,
        nextStep: plan().steps[1]!,
        sequenceCompleted: false,
        reason: "advance",
      },
      persistence: "stored",
    };

    const view = projectStudyCenterRoom({
      plan: plan(),
      storedProgress: stored("ready-to-advance"),
      runtime,
    });

    expect(view.card?.kind).toBe("feedback");
    expect(view.card?.feedbackPositive).toBe(true);
    expect(JSON.stringify(view)).not.toContain(relationshipId);
  });
});
