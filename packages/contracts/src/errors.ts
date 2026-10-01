import type { CorrelationId, OperationId } from "./ids.js";

export const errorCategories = [
  "validation",
  "authentication",
  "authorization",
  "conflict",
  "not-found",
  "unavailable",
  "rate-limit",
  "ambiguous",
  "internal",
] as const;

export type ErrorCategory = (typeof errorCategories)[number];

export interface PlatformErrorShape {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly correlationId?: CorrelationId;
  readonly operationId?: OperationId;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class PlatformError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly correlationId?: CorrelationId;
  readonly operationId?: OperationId;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(shape: PlatformErrorShape) {
    super(shape.message);
    this.name = "PlatformError";
    this.code = shape.code;
    this.category = shape.category;
    this.retryable = shape.retryable;
    if (shape.correlationId !== undefined) {
      this.correlationId = shape.correlationId;
    }
    if (shape.operationId !== undefined) {
      this.operationId = shape.operationId;
    }
    if (shape.details !== undefined) {
      this.details = shape.details;
    }
  }

  toJSON(): PlatformErrorShape {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      ...(this.correlationId ? { correlationId: this.correlationId } : {}),
      ...(this.operationId ? { operationId: this.operationId } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
