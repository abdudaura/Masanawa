import Fastify from "fastify";
import Type from "typebox";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { nowInstant, type Instant } from "@masanawa/contracts";
import {
  admitTelemetryCorrelation,
  injectCorrelationHeaders,
} from "@masanawa/telemetry";

export interface PresenceReadinessCheck {
  readonly name: string;
  check(): Promise<{ readonly ready: boolean; readonly reason?: string }>;
}

export interface PresenceAppOptions {
  readonly readinessChecks?: readonly PresenceReadinessCheck[];
  readonly now?: () => Instant;
  readonly isDraining?: () => boolean;
}

const HealthResponse = Type.Object({
  service: Type.Literal("presence"),
  status: Type.Literal("ok"),
  time: Type.String(),
}, { additionalProperties: false });

const ReadinessResponse = Type.Object({
  service: Type.Literal("presence"),
  status: Type.Union([Type.Literal("ready"), Type.Literal("not-ready")]),
  time: Type.String(),
  checks: Type.Array(Type.Object({
    name: Type.String(),
    ready: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  }, { additionalProperties: false })),
}, { additionalProperties: false });

export function createPresenceApp(options: PresenceAppOptions = {}) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576,
    requestTimeout: 30_000,
  }).withTypeProvider<TypeBoxTypeProvider>();
  const now = options.now ?? nowInstant;
  const checks = options.readinessChecks ?? [];

  app.addHook("onRequest", async (request, reply) => {
    const correlation = admitTelemetryCorrelation({
      carrier: {
        ...(request.headers.traceparent !== undefined
          ? { traceparent: request.headers.traceparent }
          : {}),
        ...(request.headers["x-request-id"] !== undefined
          ? { "x-request-id": request.headers["x-request-id"] }
          : {}),
        ...(request.headers["x-correlation-id"] !== undefined
          ? { "x-correlation-id": request.headers["x-correlation-id"] }
          : {}),
      },
    });
    const headers = injectCorrelationHeaders(correlation);
    reply.headers(headers);
  });

  app.get("/healthz", {
    schema: { response: { 200: HealthResponse } },
  }, async () => ({
    service: "presence" as const,
    status: "ok" as const,
    time: now(),
  }));

  app.get("/readyz", {
    schema: { response: { 200: ReadinessResponse, 503: ReadinessResponse } },
  }, async (_request, reply) => {
    const results = [
      ...(options.isDraining?.()
        ? [{ name: "lifecycle", ready: false, reason: "service is shutting down" }]
        : []),
      ...(await Promise.all(checks.map(async (check) => {
        try {
          const result = await check.check();
          return {
            name: check.name,
            ready: result.ready,
            ...(result.reason ? { reason: result.reason } : {}),
          };
        } catch {
          return { name: check.name, ready: false, reason: "readiness check failed" };
        }
      }))),
    ];
    const ready = results.every((result) => result.ready);
    if (!ready) reply.code(503);
    return {
      service: "presence" as const,
      status: ready ? ("ready" as const) : ("not-ready" as const),
      time: now(),
      checks: results,
    };
  });

  return app;
}
