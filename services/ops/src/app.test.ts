import { afterEach, describe, expect, it } from "vitest";
import { toInstant } from "@masanawa/contracts";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("ops service bootstrap", () => {
  it("reports health without implying dependency readiness", async () => {
    const app = createOpsApp({
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
      service: "ops",
      status: "ok",
      time: "2026-10-01T16:00:00.000Z",
    });

    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(readiness.statusCode).toBe(503);
    expect(readiness.json().status).toBe("not-ready");
  });

  it("fails readiness closed when a probe throws", async () => {
    const app = createOpsApp({
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
