import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  isCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { parseTraceparent } from "@masanawa/telemetry";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("gateway service bootstrap", () => {
  it("reports health without implying dependency readiness", async () => {
    const app = createGatewayApp({
      now: () => toInstant("2026-10-01T16:00:00Z"),
      readinessChecks: [
        {
          name: "database",
          check: async () => ({ ready: false, reason: "unavailable" }),
        },
      ],
    });
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({
      service: "gateway",
      status: "ok",
      time: "2026-10-01T16:00:00.000Z",
    });

    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(readiness.statusCode).toBe(503);
    expect(readiness.json().status).toBe("not-ready");
  });

  it("normalizes public request correlation without trusting caller IDs", async () => {
    const app = createGatewayApp();
    apps.push(app);

    const suppliedRequestId = createCanonicalId("request");
    const suppliedCorrelationId = createCanonicalId("correlation");
    const parentTrace =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

    const response = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: {
        traceparent: parentTrace,
        "x-request-id": suppliedRequestId,
        "x-correlation-id": suppliedCorrelationId,
      },
    });

    const requestId = response.headers["x-request-id"];
    const correlationId = response.headers["x-correlation-id"];
    const traceparent = response.headers.traceparent;
    expect(typeof requestId).toBe("string");
    expect(typeof correlationId).toBe("string");
    expect(typeof traceparent).toBe("string");
    expect(isCanonicalId("request", requestId)).toBe(true);
    expect(isCanonicalId("correlation", correlationId)).toBe(true);
    expect(requestId).not.toBe(suppliedRequestId);
    expect(correlationId).not.toBe(suppliedCorrelationId);

    const parsed = parseTraceparent(traceparent);
    expect(parsed?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(parsed?.spanId).not.toBe("00f067aa0ba902b7");
  });

  it("fails readiness closed when a probe throws", async () => {
    const app = createGatewayApp({
      readinessChecks: [
        {
          name: "dependency",
          check: async () => {
            throw new Error("secret internal failure");
          },
        },
      ],
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(503);
    expect(response.json().checks).toEqual([
      {
        name: "dependency",
        ready: false,
        reason: "readiness check failed",
      },
    ]);
    expect(response.body).not.toContain("secret internal failure");
  });
});
