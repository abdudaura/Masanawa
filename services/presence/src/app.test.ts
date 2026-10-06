import { afterEach, describe, expect, it } from "vitest";
import { createPresenceApp } from "./app.js";

const apps = new Array<ReturnType<typeof createPresenceApp>>();

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Presence service shell", () => {
  it("exposes canonical health and readiness without transport assumptions", async () => {
    const app = createPresenceApp({
      now: () => "2026-10-06T10:00:00.000Z" as never,
      readinessChecks: [{
        name: "session-store",
        async check() {
          return { ready: true };
        },
      }],
    });
    apps.push(app);

    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ service: "presence", status: "ok" });

    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toMatchObject({ service: "presence", status: "ready" });
  });

  it("fails readiness while draining or when a dependency fails", async () => {
    const app = createPresenceApp({
      isDraining: () => true,
      readinessChecks: [{
        name: "transport",
        async check() {
          return { ready: false, reason: "not configured" };
        },
      }],
    });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe("not-ready");
  });
});
