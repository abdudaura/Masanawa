import type {
  TeachingRuntimeProjection,
} from "./teaching-runtime.js";

export interface TeachingShellNode {
  readonly type: string;
  readonly id?: string;
  readonly text?: string;
  readonly value?: string;
  readonly subtitle?: string;
  readonly action?: string;
  readonly token?: string;
  readonly tone?: "info" | "success" | "warning" | "error";
  readonly progress?: number;
  readonly children?: readonly TeachingShellNode[];
}

export interface TeachingShellDocumentV1 {
  readonly version: 1;
  readonly id: string;
  readonly revision: number;
  readonly fallback: string;
  readonly expiresAt?: string;
  readonly nodes: readonly TeachingShellNode[];
}

export interface TeachingShellProjectionOptions {
  readonly documentId: string;
  readonly revision: number;
  readonly expiresAt?: string;
}

const documentIdPattern = /^[A-Za-z0-9._:-]{1,128}$/u;

function boundedText(value: string, limit: number): string {
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function validateOptions(
  options: TeachingShellProjectionOptions,
): TeachingShellProjectionOptions {
  if (!documentIdPattern.test(options.documentId)) {
    throw new TypeError("Teaching shell document id is invalid");
  }
  if (!Number.isSafeInteger(options.revision) || options.revision < 0) {
    throw new TypeError("Teaching shell revision is invalid");
  }
  if (options.expiresAt !== undefined) {
    const parsed = Date.parse(options.expiresAt);
    if (
      !Number.isFinite(parsed) ||
      !/(Z|[+-]\d{2}:\d{2})$/u.test(options.expiresAt)
    ) {
      throw new TypeError("Teaching shell expiry is invalid");
    }
  }
  return options;
}

function lessonNodes(
  projection: Extract<TeachingRuntimeProjection, { kind: "lesson-step" }>,
): readonly TeachingShellNode[] {
  const step = projection.step;
  const nodes: TeachingShellNode[] = [
    Object.freeze({
      type: "heading",
      text: boundedText(step.title, 4000),
    }),
    Object.freeze({
      type: "text",
      text: boundedText(step.explanation, 4000),
    }),
  ];

  if (step.examples.length > 0) {
    nodes.push(
      Object.freeze({
        type: "card",
        children: Object.freeze([
          Object.freeze({
            type: "heading",
            text: "Examples",
          }),
          ...step.examples.slice(0, 8).map((example) =>
            Object.freeze({
              type: "text",
              text: boundedText(example, 4000),
            }),
          ),
        ]),
      }),
    );
  }

  if (step.workedSolutions.length > 0) {
    nodes.push(
      Object.freeze({
        type: "card",
        children: Object.freeze([
          Object.freeze({
            type: "heading",
            text: "Worked solution",
          }),
          ...step.workedSolutions.slice(0, 8).map((solution) =>
            Object.freeze({
              type: "text",
              text: boundedText(solution, 4000),
            }),
          ),
        ]),
      }),
    );
  }

  if (projection.sequenceCompleted) {
    nodes.push(
      Object.freeze({
        type: "notice",
        tone: "success",
        text: "This teaching sequence is complete.",
      }),
    );
  }

  return Object.freeze(nodes);
}

function exerciseNodes(
  projection: Extract<TeachingRuntimeProjection, { kind: "exercise" }>,
): readonly TeachingShellNode[] {
  const nodes: TeachingShellNode[] = [
    Object.freeze({
      type: "heading",
      text: "Check your understanding",
    }),
    Object.freeze({
      type: "text",
      text: boundedText(projection.card.prompt, 4000),
    }),
  ];

  if (projection.card.kind === "free-response") {
    nodes.push(
      Object.freeze({
        type: "notice",
        tone: "info",
        text:
          "Answer this in the conversation. This card does not grant an executable action.",
      }),
    );
    return Object.freeze(nodes);
  }

  if (projection.actionKey === null) {
    throw new TypeError(
      "Selectable Teaching shell exercises require an opaque action key",
    );
  }

  const buttons = projection.card.options.map((option) =>
    Object.freeze({
      type: "button",
      id: option.optionKey,
      text: boundedText(option.label, 4000),
      action: "teaching.select",
      token: projection.actionKey,
    }),
  );
  nodes.push(
    Object.freeze({
      type: "options",
      children: Object.freeze(buttons),
    }),
  );
  return Object.freeze(nodes);
}

function feedbackNodes(
  projection: Extract<TeachingRuntimeProjection, { kind: "feedback" }>,
): readonly TeachingShellNode[] {
  const tone =
    projection.evaluation.correct === true
      ? "success"
      : projection.evaluation.correct === false
        ? "warning"
        : "info";
  const nodes: TeachingShellNode[] = [
    Object.freeze({
      type: "notice",
      tone,
      text: boundedText(projection.evaluation.feedback, 4000),
    }),
  ];
  if (projection.evaluation.alternativeExplanation !== null) {
    nodes.push(
      Object.freeze({
        type: "detail",
        text: boundedText(
          projection.evaluation.alternativeExplanation,
          4000,
        ),
      }),
    );
  }
  return Object.freeze(nodes);
}

function artifactNodes(
  projection: Extract<TeachingRuntimeProjection, { kind: "artifact" }>,
): readonly TeachingShellNode[] {
  return Object.freeze([
    Object.freeze({
      type: "card",
      children: Object.freeze([
        Object.freeze({
          type: "heading",
          text: boundedText(projection.artifact.title, 4000),
        }),
        Object.freeze({
          type: "detail",
          text: boundedText(projection.artifact.altText, 4000),
          subtitle: boundedText(projection.artifact.mimeType, 1000),
          value: boundedText(projection.artifact.reference, 512),
        }),
      ]),
    }),
  ]);
}

function fallbackFor(projection: TeachingRuntimeProjection): string {
  switch (projection.kind) {
    case "lesson-step":
      return boundedText(
        `${projection.step.title}: ${projection.step.explanation}`,
        4000,
      );
    case "exercise":
      return boundedText(projection.card.prompt, 4000);
    case "feedback":
      return boundedText(projection.evaluation.feedback, 4000);
    case "artifact":
      return boundedText(
        `${projection.artifact.title}: ${projection.artifact.altText}`,
        4000,
      );
  }
}

export function projectTeachingToShellDocument(
  projection: TeachingRuntimeProjection,
  optionsInput: TeachingShellProjectionOptions,
): TeachingShellDocumentV1 {
  const options = validateOptions(optionsInput);
  let nodes: readonly TeachingShellNode[];
  switch (projection.kind) {
    case "lesson-step":
      nodes = lessonNodes(projection);
      break;
    case "exercise":
      nodes = exerciseNodes(projection);
      break;
    case "feedback":
      nodes = feedbackNodes(projection);
      break;
    case "artifact":
      nodes = artifactNodes(projection);
      break;
  }

  const hasAction =
    projection.kind === "exercise" &&
    projection.card.kind !== "free-response";
  let expiresAt = options.expiresAt;
  if (hasAction) {
    if (projection.kind !== "exercise" || projection.actionExpiresAt === null) {
      throw new TypeError(
        "Actionable Teaching shell documents require action expiry",
      );
    }
    if (
      options.expiresAt !== undefined &&
      options.expiresAt !== projection.actionExpiresAt
    ) {
      throw new TypeError(
        "Teaching shell expiry must match the bound action expiry",
      );
    }
    expiresAt = projection.actionExpiresAt;
  }

  return Object.freeze({
    version: 1 as const,
    id: options.documentId,
    revision: options.revision,
    fallback: fallbackFor(projection),
    ...(expiresAt === undefined ? {} : { expiresAt }),
    nodes,
  });
}
