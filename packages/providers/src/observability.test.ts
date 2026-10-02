import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import { privacySafeAttributes } from "@masanawa/telemetry";
import { describe, expect, it } from "vitest";
import {
  ProviderExecutionError,
  providerExecutionTelemetryAttributes,
  providerFailureToPlatformError,
  providerReadinessTelemetryAttributes,
} from "./observability.js";
import type { ProviderDefinition } from "./model.js";

function provider(): ProviderDefinition {
  return {
    providerId: createCanonicalId("provider"),
    key: "fixture-provider",
    version: "2026-10",
    displayName: "Fixture Provider",
    capabilities: [normalizeCapabilityKey("llm.generate")],
    selectionPriority: 1,
    credentialSlots: [],
  };
}

describe("provider observability", () => {
  it("maps known not-dispatched timeout failures to retryable platform errors", () => {
    const operationId = createCanonicalId("operation");
    const failure = {
      kind: "timeout",
      code: "request-timeout",
      phase: "pre-dispatch",
      dispatchCertainty: "not-dispatched",
      retryable: true,
      timeoutMs: 5_000,
      retryAfterMs: null,
    } as const;

    const error = providerFailureToPlatformError(
      failure,
      operationId,
    );

    expect(error).toMatchObject({
      code: "provider.request-timeout",
      category: "unavailable",
      retryable: true,
      operationId,
      details: {
        kind: "timeout",
        phase: "pre-dispatch",
        dispatchCertainty: "not-dispatched",
        timeoutMs: 5_000,
      },
    });
  });

  it("never marks ambiguous post-dispatch provider failures as retryable", () => {
    const error = providerFailureToPlatformError({
      kind: "transport",
      code: "connection-reset",
      phase: "post-dispatch",
      dispatchCertainty: "unknown",
      retryable: true,
      timeoutMs: null,
      retryAfterMs: 1_000,
    });

    expect(error.category).toBe("ambiguous");
    expect(error.retryable).toBe(false);

    const typed = new ProviderExecutionError({
      kind: "transport",
      code: "connection-reset",
      phase: "post-dispatch",
      dispatchCertainty: "unknown",
      retryable: true,
      timeoutMs: null,
      retryAfterMs: null,
    });
    expect(typed.failure.dispatchCertainty).toBe("unknown");
    expect(typed.message).toBe("connection-reset");
  });

  it("emits only bounded privacy-safe provider readiness attributes", () => {
    const definition = provider();
    const attrs = providerReadinessTelemetryAttributes(definition, {
      providerId: definition.providerId,
      state: "degraded",
      reasonCode: "quota-near-limit",
      checkedAt: toInstant("2026-10-02T10:00:00Z"),
    });

    expect(attrs).toEqual({
      "masanawa.provider.id": definition.providerId,
      "masanawa.provider.key": "fixture-provider",
      "masanawa.provider.version": "2026-10",
      "masanawa.provider.readiness": "degraded",
      "masanawa.provider.reason_code": "quota-near-limit",
    });
  });

  it("emits ids, status, latency and bounded usage without payloads or credentials", () => {
    const definition = provider();
    const operationId = createCanonicalId("operation");
    const toolVersionId = createCanonicalId("tool-version");
    const attrs = providerExecutionTelemetryAttributes({
      providerId: definition.providerId,
      providerKey: definition.key,
      providerVersion: definition.version,
      capability: normalizeCapabilityKey("llm.generate"),
      toolVersionId,
      operationId,
      outcome: "failed",
      latencyMs: 2_500,
      costMicros: 123_000,
      inputUnits: 900,
      outputUnits: 120,
      failure: {
        kind: "rate-limit",
        code: "quota-exhausted",
        phase: "pre-dispatch",
        dispatchCertainty: "not-dispatched",
        retryable: true,
        timeoutMs: null,
        retryAfterMs: 30_000,
      },
    });

    expect(attrs).toEqual({
      "masanawa.provider.id": definition.providerId,
      "masanawa.provider.key": definition.key,
      "masanawa.provider.version": definition.version,
      "masanawa.capability.key": "llm.generate",
      "masanawa.provider.outcome": "failed",
      "masanawa.provider.latency_ms": 2_500,
      "masanawa.tool_version.id": toolVersionId,
      "masanawa.operation.id": operationId,
      "masanawa.provider.cost_micros": 123_000,
      "masanawa.provider.input_units": 900,
      "masanawa.provider.output_units": 120,
      "masanawa.provider.failure_kind": "rate-limit",
      "masanawa.provider.failure_code": "quota-exhausted",
      "masanawa.provider.failure_phase": "pre-dispatch",
      "masanawa.provider.dispatch_certainty": "not-dispatched",
      "masanawa.provider.retry_after_ms": 30_000,
    });

    expect(() =>
      privacySafeAttributes({
        "masanawa.provider.api_key": "must-never-be-telemetry",
      }),
    ).toThrow(/not in the default privacy-safe allowlist/u);
  });
});
