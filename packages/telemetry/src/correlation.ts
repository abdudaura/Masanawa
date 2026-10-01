import { randomBytes } from "node:crypto";
import {
  createCanonicalId,
  isCanonicalId,
  type CharacterSessionId,
  type CorrelationId,
  type OperationId,
  type RequestId,
  type TaskId,
  type WorkflowRunId,
} from "@masanawa/contracts";

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/u;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/u;
const TRACE_FLAGS_PATTERN = /^[0-9a-f]{2}$/u;
const REQUEST_HEADER = "x-request-id";
const CORRELATION_HEADER = "x-correlation-id";
const TRACEPARENT_HEADER = "traceparent";

export interface W3cTraceContext {
  readonly version: "00";
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: string;
  readonly sampled: boolean;
}

export interface TelemetryCorrelation {
  readonly trace: W3cTraceContext;
  readonly requestId: RequestId;
  readonly correlationId: CorrelationId;
  readonly operationId?: OperationId;
  readonly taskId?: TaskId;
  readonly workflowRunId?: WorkflowRunId;
  readonly characterSessionId?: CharacterSessionId;
}

export interface CorrelationCarrier {
  readonly traceparent?: string | readonly string[];
  readonly "x-request-id"?: string | readonly string[];
  readonly "x-correlation-id"?: string | readonly string[];
}

export interface AdmitTelemetryCorrelationInput {
  readonly carrier?: CorrelationCarrier;
  readonly acceptInboundCanonicalIds?: boolean;
  readonly operationId?: OperationId;
  readonly taskId?: TaskId;
  readonly workflowRunId?: WorkflowRunId;
  readonly characterSessionId?: CharacterSessionId;
}

function firstHeader(
  value: string | readonly string[] | undefined,
): string | undefined {
  if (typeof value === "string" || value === undefined) {
    return value;
  }
  return value[0];
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function isAllZero(value: string): boolean {
  return /^0+$/u.test(value);
}

export function parseTraceparent(value: string | undefined): W3cTraceContext | null {
  if (!value) {
    return null;
  }

  const parts = value.trim().toLowerCase().split("-");
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, traceFlags] = parts;
  if (
    version !== "00" ||
    !traceId ||
    !spanId ||
    !traceFlags ||
    !TRACE_ID_PATTERN.test(traceId) ||
    !SPAN_ID_PATTERN.test(spanId) ||
    !TRACE_FLAGS_PATTERN.test(traceFlags) ||
    isAllZero(traceId) ||
    isAllZero(spanId)
  ) {
    return null;
  }

  return Object.freeze({
    version: "00" as const,
    traceId,
    spanId,
    traceFlags,
    sampled: (Number.parseInt(traceFlags, 16) & 0x01) === 0x01,
  });
}

export function formatTraceparent(context: W3cTraceContext): string {
  return `${context.version}-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

export function createRootTraceContext(sampled = true): W3cTraceContext {
  return Object.freeze({
    version: "00" as const,
    traceId: randomHex(16),
    spanId: randomHex(8),
    traceFlags: sampled ? "01" : "00",
    sampled,
  });
}

export function createChildTraceContext(parent: W3cTraceContext): W3cTraceContext {
  return Object.freeze({
    version: "00" as const,
    traceId: parent.traceId,
    spanId: randomHex(8),
    traceFlags: parent.traceFlags,
    sampled: parent.sampled,
  });
}

function canonicalHeaderId(
  kind: "request",
  value: string | undefined,
): RequestId;
function canonicalHeaderId(
  kind: "correlation",
  value: string | undefined,
): CorrelationId;
function canonicalHeaderId(
  kind: "request" | "correlation",
  value: string | undefined,
): RequestId | CorrelationId {
  if (kind === "request") {
    return value && isCanonicalId("request", value)
      ? value
      : createCanonicalId("request");
  }
  return value && isCanonicalId("correlation", value)
    ? value
    : createCanonicalId("correlation");
}

export function admitTelemetryCorrelation(
  input: AdmitTelemetryCorrelationInput = {},
): TelemetryCorrelation {
  const carrier = input.carrier ?? {};
  const parent = parseTraceparent(firstHeader(carrier[TRACEPARENT_HEADER]));
  const trace = parent ? createChildTraceContext(parent) : createRootTraceContext();

  return Object.freeze({
    trace,
    requestId: canonicalHeaderId(
      "request",
      input.acceptInboundCanonicalIds
        ? firstHeader(carrier[REQUEST_HEADER])
        : undefined,
    ),
    correlationId: canonicalHeaderId(
      "correlation",
      input.acceptInboundCanonicalIds
        ? firstHeader(carrier[CORRELATION_HEADER])
        : undefined,
    ),
    ...(input.operationId ? { operationId: input.operationId } : {}),
    ...(input.taskId ? { taskId: input.taskId } : {}),
    ...(input.workflowRunId ? { workflowRunId: input.workflowRunId } : {}),
    ...(input.characterSessionId
      ? { characterSessionId: input.characterSessionId }
      : {}),
  });
}

export function injectCorrelationHeaders(
  correlation: TelemetryCorrelation,
): Readonly<Record<string, string>> {
  return Object.freeze({
    [TRACEPARENT_HEADER]: formatTraceparent(correlation.trace),
    [REQUEST_HEADER]: correlation.requestId,
    [CORRELATION_HEADER]: correlation.correlationId,
  });
}
