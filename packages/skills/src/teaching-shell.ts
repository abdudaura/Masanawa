import {
  applyTeachingMultiSelectStageCommand,
  validateTeachingMultiSelectStage,
  type TeachingMultiSelectStage,
  type TeachingRuntimeBinding,
  type TeachingRuntimeProjection,
  type TeachingSelectionActionBinding,
} from "./teaching-runtime.js";
import type { Instant } from "@masanawa/contracts";

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

export interface TeachingShellActionInput {
  readonly documentId: string;
  readonly revision: number;
  readonly nodeId: string;
  readonly actionId: string;
  readonly token: string;
  readonly values: Readonly<Record<string, string>>;
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

  if (projection.card.kind === "multi-select") {
    throw new TypeError(
      "Teaching ShellDocument v1 does not support actionable multi-select",
    );
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

function assertShellDocumentBounds(document: TeachingShellDocumentV1): void {
  let remainingNodes = 100;
  let textBudget = 24_000 - document.fallback.length;

  function consume(value: string | undefined): void {
    if (value === undefined) return;
    textBudget -= value.length;
    if (textBudget < 0) {
      throw new RangeError("Teaching shell document exceeds text budget");
    }
  }

  function visit(node: TeachingShellNode, depth: number): void {
    remainingNodes -= 1;
    if (remainingNodes < 0 || depth > 6) {
      throw new RangeError("Teaching shell document exceeds node/depth limits");
    }
    consume(node.id);
    consume(node.text);
    consume(node.value);
    consume(node.subtitle);
    consume(node.action);
    consume(node.token);
    for (const child of node.children ?? []) {
      visit(child, depth + 1);
    }
  }

  for (const node of document.nodes) {
    visit(node, 0);
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

  const document = Object.freeze({
    version: 1 as const,
    id: options.documentId,
    revision: options.revision,
    fallback: fallbackFor(projection),
    ...(expiresAt === undefined ? {} : { expiresAt }),
    nodes,
  });
  assertShellDocumentBounds(document);
  return document;
}



export function projectTeachingMultiSelectToShellDocument(input: {
  readonly runtimeBinding: TeachingRuntimeBinding;
  readonly action: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly projection: Extract<TeachingRuntimeProjection, { kind: "exercise" }>;
  readonly options: TeachingShellProjectionOptions;
}): TeachingShellDocumentV1 {
  const options = validateOptions(input.options);
  const stage = validateTeachingMultiSelectStage({
    binding: input.runtimeBinding,
    action: input.action,
    stage: input.stage,
  });
  const projection = input.projection;
  if (
    projection.card.kind !== "multi-select" ||
    projection.actionKey !== input.action.actionKey ||
    projection.actionExpiresAt !== input.action.expiresAt ||
    stage.actionKey !== projection.actionKey ||
    stage.expiresAt !== projection.actionExpiresAt
  ) {
    throw new TypeError(
      "Teaching multi-select shell projection does not match the exact action stage",
    );
  }
  if (stage.state !== "collecting") {
    throw new TypeError(
      "Committed Teaching multi-select cannot be projected for editing",
    );
  }
  if (options.revision !== stage.revision) {
    throw new TypeError(
      "Teaching multi-select shell revision must match the server stage revision",
    );
  }
  if (
    options.expiresAt !== undefined &&
    options.expiresAt !== stage.expiresAt
  ) {
    throw new TypeError(
      "Teaching multi-select shell expiry must match the bound action expiry",
    );
  }

  const selected = new Set(stage.selectedOptionKeys);
  const optionButtons = projection.card.options.map((option) =>
    Object.freeze({
      type: "button",
      id: option.optionKey,
      text: boundedText(
        `${selected.has(option.optionKey) ? "✓ " : ""}${option.label}`,
        4000,
      ),
      action: "teaching.multiselect.toggle",
      token: stage.actionKey,
    }),
  );

  const nodes: readonly TeachingShellNode[] = Object.freeze([
    Object.freeze({
      type: "heading",
      text: "Choose all that apply",
    }),
    Object.freeze({
      type: "text",
      text: boundedText(projection.card.prompt, 4000),
    }),
    Object.freeze({
      type: "options",
      children: Object.freeze(optionButtons),
    }),
    Object.freeze({
      type: "notice",
      tone: "info",
      text:
        stage.selectedOptionKeys.length === 0
          ? "Select one or more answers, then submit."
          : `${stage.selectedOptionKeys.length} answer${stage.selectedOptionKeys.length === 1 ? "" : "s"} selected.`,
    }),
    Object.freeze({
      type: "button",
      id: "commit",
      text: "Submit answers",
      action: "teaching.multiselect.commit",
      token: stage.actionKey,
    }),
  ]);

  const document = Object.freeze({
    version: 1 as const,
    id: options.documentId,
    revision: stage.revision,
    fallback: boundedText(projection.card.prompt, 4000),
    expiresAt: stage.expiresAt,
    nodes,
  });
  assertShellDocumentBounds(document);
  return document;
}

export function applyTeachingMultiSelectShellAction(input: {
  readonly action: TeachingShellActionInput;
  readonly runtimeBinding: TeachingRuntimeBinding;
  readonly actionBinding: TeachingSelectionActionBinding;
  readonly stage: TeachingMultiSelectStage;
  readonly now: Instant;
}): ReturnType<typeof applyTeachingMultiSelectStageCommand> {
  const stage = validateTeachingMultiSelectStage({
    binding: input.runtimeBinding,
    action: input.actionBinding,
    stage: input.stage,
  });
  const action = input.action;
  if (
    !documentIdPattern.test(action.documentId) ||
    !Number.isSafeInteger(action.revision) ||
    action.revision !== stage.revision
  ) {
    throw new TypeError(
      "Teaching multi-select shell action has stale document scope",
    );
  }
  if (
    action.token !== stage.actionKey ||
    action.values === null ||
    typeof action.values !== "object" ||
    Object.keys(action.values).length !== 0
  ) {
    throw new TypeError(
      "Teaching multi-select shell action payload is invalid",
    );
  }

  if (action.actionId === "teaching.multiselect.commit") {
    if (action.nodeId !== "commit") {
      throw new TypeError(
        "Teaching multi-select commit node is invalid",
      );
    }
    return applyTeachingMultiSelectStageCommand({
      binding: input.runtimeBinding,
      action: input.actionBinding,
      stage,
      command: Object.freeze({ kind: "commit" as const }),
      now: input.now,
    });
  }

  if (action.actionId !== "teaching.multiselect.toggle") {
    throw new TypeError(
      "Teaching multi-select shell action id is invalid",
    );
  }
  if (
    typeof action.nodeId !== "string" ||
    !input.actionBinding.rubric.allowedOptionKeys.includes(
      action.nodeId.trim().toLowerCase(),
    )
  ) {
    throw new TypeError(
      "Teaching multi-select shell option is invalid",
    );
  }

  return applyTeachingMultiSelectStageCommand({
    binding: input.runtimeBinding,
    action: input.actionBinding,
    stage,
    command: Object.freeze({
      kind: "toggle" as const,
      optionKey: action.nodeId,
    }),
    now: input.now,
  });
}

export function resolveTeachingShellAction(
  action: TeachingShellActionInput,
): Readonly<{
  actionKey: string;
  selectedOptionKeys: readonly string[];
}> {
  if (
    !documentIdPattern.test(action.documentId) ||
    !Number.isSafeInteger(action.revision) ||
    action.revision < 0
  ) {
    throw new TypeError("Teaching shell action document scope is invalid");
  }
  if (action.actionId !== "teaching.select") {
    throw new TypeError("Teaching shell action id is invalid");
  }
  if (
    typeof action.token !== "string" ||
    action.token.length < 8 ||
    action.token.length > 2048
  ) {
    throw new TypeError("Teaching shell action token is invalid");
  }
  if (
    typeof action.nodeId !== "string" ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(action.nodeId)
  ) {
    throw new TypeError("Teaching shell option key is invalid");
  }
  if (
    action.values === null ||
    typeof action.values !== "object" ||
    Object.keys(action.values).length !== 0
  ) {
    throw new TypeError(
      "Teaching single-select shell action must not carry form values",
    );
  }
  return Object.freeze({
    actionKey: action.token,
    selectedOptionKeys: Object.freeze([action.nodeId]),
  });
}
