import { afterEach, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  isCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { parseTraceparent } from "@masanawa/telemetry";
import { createGatewayApp } from "./app.js";
import type { CustomerAuthService } from "./customer_auth.js";
import type { BillingCheckoutService } from "./billing_checkout.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("gateway service bootstrap", () => {
  it("does not expose retired consumer creator or clone onboarding routes", async () => {
    const app = createGatewayApp();
    apps.push(app);
    for (const prefix of ["", "/v1"]) {
      for (const [method, path] of [["POST", "/creator/clone"], ["GET", "/creator/onboarding"],
        ["PUT", "/creator/onboarding/profile"], ["POST", "/creator/onboarding/confirm"]] as const) {
        expect((await app.inject({ method, url: `${prefix}${path}` })).statusCode).toBe(404);
      }
    }
  });
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
    if (typeof traceparent !== "string") {
      throw new TypeError("expected traceparent response header");
    }
    expect(isCanonicalId("request", requestId)).toBe(true);
    expect(isCanonicalId("correlation", correlationId)).toBe(true);
    expect(requestId).not.toBe(suppliedRequestId);
    expect(correlationId).not.toBe(suppliedCorrelationId);

    const parsed = parseTraceparent(traceparent);
    expect(parsed?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(parsed?.spanId).not.toBe("00f067aa0ba902b7");
  });

  it("projects canonical OTP capabilities without delivery configuration", async () => {
    const customerAuth: CustomerAuthService = {
      capabilities: () => ({ otpChannels: ["email"] }),
      async sendOtp() { throw new Error("unused"); },
      async verifyOtp() { throw new Error("unused"); },
      async refresh() { throw new Error("unused"); },
      async logout() {},
    };
    const app = createGatewayApp({ customerAuth });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/auth/capabilities",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ otpChannels: ["email"] });
  });

  it("keeps billing history behind the canonical customer token", async () => {
    const billingCheckout: BillingCheckoutService = {
      async createQuote() { throw new Error("unused"); },
      async startCheckout() { throw new Error("unused"); },
      async verifyAndPurchase() { throw new Error("unused"); },
      async read() { throw new Error("unused"); },
      async list(request) {
        if (request.authorizationHeader !== "Bearer customer") {
          throw new Error("financial.auth.unauthorized");
        }
        return [];
      },
      async reconcileFulfillment() { return null; },
      async verifyWalletConfirmAction() { throw new Error("unused"); },
      async executeShellAction() { throw new Error("unused"); },
    };
    const app = createGatewayApp({ billingCheckout });
    apps.push(app);

    const allowed = await app.inject({
      method: "GET",
      url: "/v1/commerce/bills/quotes?limit=10",
      headers: { authorization: "Bearer customer" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ quotes: [] });

    const denied = await app.inject({
      method: "GET",
      url: "/v1/commerce/bills/quotes",
    });
    expect(denied.statusCode).toBe(401);
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
