import { describe, expect, it } from "vitest";
import { createCanonicalId } from "./ids.js";
import { PlatformError } from "./errors.js";

describe("PlatformError", () => {
  it("omits absent optional metadata from the JSON contract", () => {
    const error = new PlatformError({
      code: "test.failure",
      category: "internal",
      message: "safe failure",
      retryable: false,
    });

    expect(error.toJSON()).toEqual({
      code: "test.failure",
      category: "internal",
      message: "safe failure",
      retryable: false,
    });
  });

  it("preserves present correlation and operation metadata", () => {
    const correlationId = createCanonicalId("correlation");
    const operationId = createCanonicalId("operation");
    const error = new PlatformError({
      code: "test.ambiguous",
      category: "ambiguous",
      message: "outcome unknown",
      retryable: false,
      correlationId,
      operationId,
      details: { state: "unknown" },
    });

    expect(error.toJSON()).toEqual({
      code: "test.ambiguous",
      category: "ambiguous",
      message: "outcome unknown",
      retryable: false,
      correlationId,
      operationId,
      details: { state: "unknown" },
    });
  });
});
