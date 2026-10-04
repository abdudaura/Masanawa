import {
  workflowHumanRequestLimits,
  type WorkflowHumanRequest,
  type WorkflowHumanResponse,
} from "./human-request-model.js";

const graphSignaturePattern = /^sha256:[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    fail(`${name} must be non-empty and no longer than ${max} characters`);
  }
  return value;
}

function normalizeResponse(
  kind: WorkflowHumanRequest["kind"],
  state: WorkflowHumanRequest["state"],
  response: WorkflowHumanResponse,
): WorkflowHumanResponse {
  if (state === "pending") {
    if (response !== null) fail("pending human request cannot have a response");
    return null;
  }

  if (state === "cancelled") {
    if (response !== null) fail("cancelled human request cannot have a response");
    return null;
  }

  if (kind === "information") {
    if (typeof response !== "string") {
      fail("information human request requires a string response");
    }
    return bounded(
      response,
      "humanRequest.response",
      workflowHumanRequestLimits.maxResponseLength,
    );
  }

  if (typeof response !== "boolean") {
    fail(`${kind} human request requires a boolean response`);
  }
  return response;
}

export function createWorkflowHumanRequest(
  input: WorkflowHumanRequest,
): WorkflowHumanRequest {
  if (!graphSignaturePattern.test(input.graphSignature)) {
    fail("human request graphSignature must be canonical sha256");
  }
  if (!["information", "confirmation", "approval"].includes(input.kind)) {
    fail("human request kind is not supported");
  }
  if (!["pending", "answered", "rejected", "cancelled"].includes(input.state)) {
    fail("human request state is not supported");
  }
  if ((input.kind === "approval") !== (input.approvalId !== null)) {
    fail("approval human request must carry exactly one ApprovalId");
  }
  if ((input.state === "pending") !== (input.resolvedAt === null)) {
    fail("human request resolvedAt must be null only while pending");
  }
  if (
    input.state === "answered" &&
    (input.kind === "confirmation" || input.kind === "approval") &&
    input.response !== true
  ) {
    fail("answered confirmation/approval requires true response");
  }
  if (
    input.state === "rejected" &&
    (input.kind === "confirmation" || input.kind === "approval") &&
    input.response !== false
  ) {
    fail("rejected confirmation/approval requires false response");
  }
  if (input.kind === "information" && input.state === "rejected") {
    fail("information human request cannot use rejected state");
  }

  return Object.freeze({
    ...input,
    prompt: bounded(
      input.prompt,
      "humanRequest.prompt",
      workflowHumanRequestLimits.maxPromptLength,
    ),
    response: normalizeResponse(input.kind, input.state, input.response),
  });
}
