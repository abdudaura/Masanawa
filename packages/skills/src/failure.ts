import {
  PlatformError,
  type CorrelationId,
  type ErrorCategory,
  type OperationId,
} from "@masanawa/contracts";
import { normalizeSkillTraceMetadata, type SkillTraceMetadata } from "./trace.js";

export const skillFailureSources = [
  "skill",
  "tool",
  "subskill",
  "dependency",
] as const;
export type SkillFailureSource =
  (typeof skillFailureSources)[number];

export const skillFailureDispositions = [
  "terminal",
  "retry",
  "reconcile",
] as const;
export type SkillFailureDisposition =
  (typeof skillFailureDispositions)[number];

export interface SkillFailure {
  readonly trace: SkillTraceMetadata;
  readonly source: SkillFailureSource;
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly disposition: SkillFailureDisposition;
  readonly message: string;
  readonly correlationId: CorrelationId | null;
  readonly operationId: OperationId | null;
}

const fallbackBySource: Readonly<
  Record<
    SkillFailureSource,
    { readonly code: string; readonly message: string }
  >
> = {
  skill: {
    code: "skill.execution_failed",
    message: "Skill execution failed",
  },
  tool: {
    code: "skill.tool_failed",
    message: "Skill Tool execution failed",
  },
  subskill: {
    code: "skill.subskill_failed",
    message: "Skill subskill execution failed",
  },
  dependency: {
    code: "skill.dependency_failed",
    message: "Skill dependency execution failed",
  },
};

function disposition(
  category: ErrorCategory,
  retryable: boolean,
): SkillFailureDisposition {
  if (category === "ambiguous") return "reconcile";
  if (retryable) return "retry";
  return "terminal";
}

export function normalizeSkillFailure(
  trace: SkillTraceMetadata,
  source: SkillFailureSource,
  error: unknown,
): SkillFailure {
  if (!(skillFailureSources as readonly string[]).includes(source)) {
    throw new TypeError("skill failure source is invalid");
  }
  const safeTrace = normalizeSkillTraceMetadata(trace);

  if (error instanceof PlatformError) {
    return Object.freeze({
      trace: safeTrace,
      source,
      code: error.code,
      category: error.category,
      retryable: error.retryable,
      disposition: disposition(error.category, error.retryable),
      message: error.message,
      correlationId: error.correlationId ?? null,
      operationId: error.operationId ?? null,
    });
  }

  const fallback = fallbackBySource[source];
  return Object.freeze({
    trace: safeTrace,
    source,
    code: fallback.code,
    category: "internal" as const,
    retryable: false,
    disposition: "terminal" as const,
    message: fallback.message,
    correlationId: null,
    operationId: null,
  });
}
