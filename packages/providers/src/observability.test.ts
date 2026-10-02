import {
  createCanonicalId,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import {
  normalizeProviderExecutionObservation,
  providerExecutionTelemetryAttributes,
  recordProviderExecutionSafely,
} from "./observability.js";

function observation() {
  return {
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
    operationId: createCanonicalId("operation"),
    toolVersionId: createCanonicalId("tool-version"),
    providerId: createCanonicalId("provider"),
    providerKey: "payments",
    providerVersion: "v1",
    readinessState: "ready" as const,
    outcome: "succeeded" as const,
    failureClass: "none" as const,
    durationMs: 125,
    timeoutMs: 30_000,
    costClass: "external" as const,
  };
}

describe("provider execution observability", () => {
  it("emits only allowlisted privacy-safe provider execution fields", () => {
    const input = observation();
    const attributes = providerExecutionTelemetryAttributes(input);

    expect(attributes).toMatchObject({
      "masanawa.request.id": input.requestId,
      "masanawa.correlation.id": input.correlationId,
      "masanawa.operation.id": input.operationId,
      "masanawa.tool.version_id": input.toolVersionId,
      "masanawa.provider.id": input.providerId,
      "masanawa.provider.key": "payments",
      "masanawa.provider.version": "v1",
      "masanawa.provider.readiness_state": "ready",
      "masanawa.provider.outcome": "succeeded",
      "masanawa.provider.failure_class": "none",
      "masanawa.provider.duration_ms": 125,
      "masanawa.provider.timeout_ms": 30_000,
      "masanawa.provider.cost_class": "external",
    });
    expect(Object.keys(attributes).some((key) => /credential|secret|input|output/u.test(key))).toBe(false);
  });

  it("requires typed failure classification for failed or ambiguous outcomes", () => {
    expect(() =>
      normalizeProviderExecutionObservation({
        ...observation(),
        outcome: "unknown",
        failureClass: "none",
      }),
    ).toThrow(/requires a failureClass/u);
  });

  it("never lets telemetry observer failure change execution truth", async () => {
    const input = observation();
    await expect(
      recordProviderExecutionSafely(
        {
          async record() {
            throw new Error("telemetry backend unavailable");
          },
        },
        input,
      ),
    ).resolves.toBe(false);
  });
});
