import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  isCanonicalId,
} from "@masanawa/contracts";
import {
  admitTelemetryCorrelation,
  correlationAttributes,
  formatTraceparent,
  injectCorrelationHeaders,
  parseTraceparent,
  privacySafeAttributes,
} from "./index.js";

describe("OpenTelemetry-compatible correlation", () => {
  it("continues a valid W3C trace with a new span while preserving canonical IDs", () => {
    const requestId = createCanonicalId("request");
    const correlationId = createCanonicalId("correlation");
    const parent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

    const admitted = admitTelemetryCorrelation({
      acceptInboundCanonicalIds: true,
      carrier: {
        traceparent: parent,
        "x-request-id": requestId,
        "x-correlation-id": correlationId,
      },
    });

    expect(admitted.trace.traceId).toBe(
      "4bf92f3577b34da6a3ce929d0e0e4736",
    );
    expect(admitted.trace.spanId).not.toBe("00f067aa0ba902b7");
    expect(admitted.trace.sampled).toBe(true);
    expect(admitted.requestId).toBe(requestId);
    expect(admitted.correlationId).toBe(correlationId);
    expect(parseTraceparent(formatTraceparent(admitted.trace))).not.toBeNull();
  });

  it("does not trust caller-supplied canonical IDs by default", () => {
    const suppliedRequestId = createCanonicalId("request");
    const suppliedCorrelationId = createCanonicalId("correlation");
    const admitted = admitTelemetryCorrelation({
      carrier: {
        "x-request-id": suppliedRequestId,
        "x-correlation-id": suppliedCorrelationId,
      },
    });

    expect(admitted.requestId).not.toBe(suppliedRequestId);
    expect(admitted.correlationId).not.toBe(suppliedCorrelationId);
  });

  it("fails closed on invalid inbound correlation identifiers", () => {
    const admitted = admitTelemetryCorrelation({
      carrier: {
        traceparent: "00-00000000000000000000000000000000-0000000000000000-01",
        "x-request-id": "not-a-request-id",
        "x-correlation-id": "not-a-correlation-id",
      },
    });

    expect(isCanonicalId("request", admitted.requestId)).toBe(true);
    expect(isCanonicalId("correlation", admitted.correlationId)).toBe(true);
    expect(admitted.trace.traceId).not.toBe(
      "00000000000000000000000000000000",
    );
  });

  it("propagates only correlation headers and privacy-minimized attributes", () => {
    const operationId = createCanonicalId("operation");
    const admitted = admitTelemetryCorrelation({ operationId });
    const headers = injectCorrelationHeaders(admitted);
    const attributes = correlationAttributes(admitted);

    expect(headers).toEqual({
      traceparent: formatTraceparent(admitted.trace),
      "x-request-id": admitted.requestId,
      "x-correlation-id": admitted.correlationId,
    });
    expect(attributes.trace_id).toBe(admitted.trace.traceId);
    expect(attributes.span_id).toBe(admitted.trace.spanId);
    expect(attributes.trace_flags).toBe(admitted.trace.traceFlags);
    expect(attributes["masanawa.operation.id"]).toBe(operationId);
    expect(Object.keys(attributes)).not.toContain("tenant.id");
    expect(() =>
      privacySafeAttributes({ authorization: "Bearer secret" }),
    ).toThrow(/privacy-safe allowlist/);
    expect(() =>
      privacySafeAttributes({ "prompt.text": "private" }),
    ).toThrow(/privacy-safe allowlist/);
    expect(
      privacySafeAttributes({
        "service.name": "gateway",
        "http.response.status_code": 200,
      }),
    ).toEqual({
      "service.name": "gateway",
      "http.response.status_code": 200,
    });
  });
});
