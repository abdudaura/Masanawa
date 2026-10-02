import {
  createCanonicalId,
  normalizeCapabilityKey,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  normalizeProviderExecutionFailure,
  normalizeProviderExecutionObservation,
  providerExecutionTelemetryAttributes,
  providerFailureError,
} from "./index.js";

describe("provider execution failures and telemetry", () => {
  it("normalizes typed timeout failures into canonical unavailable errors", () => {
    const failure = normalizeProviderExecutionFailure({
      kind: "timeout",
      code: "request.timeout",
      retryable: true,
      dispatched: false,
      safeMessage: "Provider request timed out before a known result.",
      retryAfterMs: 2_000,
    });

    expect(providerFailureError(failure)).toMatchObject({
      code: "provider.request.timeout",
      category: "unavailable",
      retryable: true,
    });
  });

  it("emits only allowlisted provider execution telemetry", () => {
    const observation = normalizeProviderExecutionObservation({
      operationId: createCanonicalId("operation"),
      providerId: createCanonicalId("provider"),
      providerKey: "gemini",
      providerVersion: "v1",
      capability: normalizeCapabilityKey("llm.generate"),
      outcome: "failed",
      failure: {
        kind: "rate-limit",
        code: "quota.exhausted",
        retryable: true,
        dispatched: false,
        safeMessage: "Provider quota is temporarily exhausted.",
        retryAfterMs: 60_000,
      },
      durationMs: 123,
      costUnits: 4.5,
    });

    const attributes = providerExecutionTelemetryAttributes(observation);

    expect(attributes).toMatchObject({
      "masanawa.provider.key": "gemini",
      "masanawa.provider.version": "v1",
      "masanawa.provider.capability": "llm.generate",
      "masanawa.provider.outcome": "failed",
      "masanawa.provider.failure_kind": "rate-limit",
      "masanawa.provider.retryable": true,
      "masanawa.provider.dispatched": false,
      "masanawa.provider.retry_after_ms": 60_000,
      "masanawa.provider.duration_ms": 123,
      "masanawa.provider.cost_units": 4.5,
      "error.code": "provider.quota.exhausted",
    });

    expect(Object.keys(attributes).some((key) =>
      /credential|secret|payload|prompt|response|message/u.test(key),
    )).toBe(false);
  });

  it("rejects unsafe free-form failure codes and invalid cost measurements", () => {
    expect(() =>
      normalizeProviderExecutionFailure({
        kind: "transport",
        code: "Bearer secret token",
        retryable: true,
        dispatched: false,
        safeMessage: "Transport failed.",
        retryAfterMs: null,
      }),
    ).toThrow(/failure code is invalid/u);

    expect(() =>
      normalizeProviderExecutionObservation({
        operationId: createCanonicalId("operation"),
        providerId: createCanonicalId("provider"),
        providerKey: "provider",
        providerVersion: "v1",
        capability: normalizeCapabilityKey("search.web"),
        outcome: "failed",
        failure: null,
        durationMs: 1,
        costUnits: -1,
      }),
    ).toThrow(/costUnits is invalid/u);
  });
});
