import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
} from "@masanawa/contracts";
import type { TeachingRuntimeProjection } from "./teaching-runtime.js";
import { projectTeachingToShellDocument } from "./teaching-shell.js";

function scope() {
  return {
    relationshipId: createCanonicalId("relationship"),
    skillVersionId: createCanonicalId("skill-version"),
  };
}

describe("Teaching ShellDocument v1 projection", () => {
  it("maps a bound selectable exercise to existing options/button primitives only", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "exercise",
      ...ids,
      actionKey: "teach.action.fractions.1",
      actionExpiresAt: "2099-01-01T00:00:00.000Z",
      card: {
        ...ids,
        lessonStepKey: "fractions",
        exerciseKey: "common-denominator",
        prompt: "Which denominator works for 1/2 and 1/3?",
        kind: "single-select",
        options: [
          { optionKey: "six", label: "6" },
          { optionKey: "five", label: "5" },
        ],
      },
    };

    const document = projectTeachingToShellDocument(projection, {
      documentId: "teaching.fractions.exercise.1",
      revision: 1,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    expect(document).toMatchObject({
      version: 1,
      id: "teaching.fractions.exercise.1",
      revision: 1,
      expiresAt: "2099-01-01T00:00:00.000Z",
      nodes: [
        { type: "heading" },
        { type: "text" },
        {
          type: "options",
          children: [
            {
              type: "button",
              id: "six",
              action: "teaching.select",
              token: "teach.action.fractions.1",
            },
            {
              type: "button",
              id: "five",
              action: "teaching.select",
              token: "teach.action.fractions.1",
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(document)).not.toContain("correctOptionKeys");
    expect(JSON.stringify(document)).not.toContain("rubric");
    expect(JSON.stringify(document)).not.toContain(ids.relationshipId);
    expect(JSON.stringify(document)).not.toContain(ids.skillVersionId);
  });

  it("derives expiry from the bound action even when projection options omit it", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "exercise",
      ...ids,
      actionKey: "teach.action.fractions.2",
      actionExpiresAt: "2099-01-01T00:00:00.000Z",
      card: {
        ...ids,
        lessonStepKey: "fractions",
        exerciseKey: "common-denominator",
        prompt: "Choose.",
        kind: "single-select",
        options: [{ optionKey: "six", label: "6" }],
      },
    };

    const document = projectTeachingToShellDocument(projection, {
      documentId: "teaching.fractions.exercise.2",
      revision: 0,
    });
    expect(document.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  });

  it("renders free response as non-executable readable content", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "exercise",
      ...ids,
      actionKey: null,
      actionExpiresAt: null,
      card: {
        ...ids,
        lessonStepKey: "fractions",
        exerciseKey: "explain",
        prompt: "Explain why 1/2 equals 3/6.",
        kind: "free-response",
        options: [],
      },
    };

    const document = projectTeachingToShellDocument(projection, {
      documentId: "teaching.fractions.free-response",
      revision: 0,
    });

    expect(document.expiresAt).toBeUndefined();
    expect(document.nodes).toEqual([
      { type: "heading", text: "Check your understanding" },
      { type: "text", text: "Explain why 1/2 equals 3/6." },
      {
        type: "notice",
        tone: "info",
        text:
          "Answer this in the conversation. This card does not grant an executable action.",
      },
    ]);
  });

  it("maps feedback using semantic notice/detail primitives", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "feedback",
      ...ids,
      exerciseKey: "common-denominator",
      persistence: "stored",
      evaluation: {
        assessmentKind: "formative",
        correct: false,
        feedback: "Not yet. Try a shared multiple.",
        misconception: "Used a denominator that is not shared.",
        alternativeExplanation: "List multiples of both denominators.",
        nextCheckpointState: "needs-reteaching",
      },
      continuation: {
        currentStep: {
          stepKey: "fractions",
          title: "Fractions",
          objective: "Find a common denominator.",
          explanation: "Use common multiples.",
          examples: [],
          workedSolutions: [],
          exercisePrompts: [],
          resourceKeys: [],
        },
        nextStep: {
          stepKey: "fractions",
          title: "Fractions",
          objective: "Find a common denominator.",
          explanation: "Use common multiples.",
          examples: [],
          workedSolutions: [],
          exercisePrompts: [],
          resourceKeys: [],
        },
        sequenceCompleted: false,
        reason: "reteach-current",
      },
    };

    const document = projectTeachingToShellDocument(projection, {
      documentId: "teaching.fractions.feedback",
      revision: 2,
    });

    expect(document.nodes).toEqual([
      {
        type: "notice",
        tone: "warning",
        text: "Not yet. Try a shared multiple.",
      },
      {
        type: "detail",
        text: "List multiples of both denominators.",
      },
    ]);
  });

  it("keeps artifacts reference-only and does not invent native authority", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "artifact",
      ...ids,
      artifact: {
        ...ids,
        lessonStepKey: "fractions",
        artifactKey: "bars",
        kind: "diagram",
        title: "Fraction bars",
        reference: "artifact://teaching/fractions/bars",
        mimeType: "image/svg+xml",
        contentHash: `sha256:${"a".repeat(64)}`,
        altText: "Fraction bars comparing one half and one third.",
      },
    };

    const document = projectTeachingToShellDocument(projection, {
      documentId: "teaching.fractions.artifact",
      revision: 0,
    });

    expect(JSON.stringify(document)).toContain(
      "artifact://teaching/fractions/bars",
    );
    expect(JSON.stringify(document)).not.toContain("contentHash");
    expect(JSON.stringify(document)).not.toContain("provider");
    expect(JSON.stringify(document)).not.toContain("credential");
  });
});


describe("Teaching ShellDocument action expiry binding", () => {
  it("rejects a shell expiry that differs from the server Teaching action expiry", () => {
    const ids = scope();
    const projection: TeachingRuntimeProjection = {
      kind: "exercise",
      ...ids,
      actionKey: "teach.action.fractions.expiry",
      actionExpiresAt: "2099-01-01T00:00:00.000Z",
      card: {
        ...ids,
        lessonStepKey: "fractions",
        exerciseKey: "common-denominator",
        prompt: "Choose.",
        kind: "single-select",
        options: [{ optionKey: "six", label: "6" }],
      },
    };

    expect(() =>
      projectTeachingToShellDocument(projection, {
        documentId: "teaching.fractions.expiry",
        revision: 0,
        expiresAt: "2100-01-01T00:00:00.000Z",
      }),
    ).toThrow(/must match the bound action expiry/);
  });
});
