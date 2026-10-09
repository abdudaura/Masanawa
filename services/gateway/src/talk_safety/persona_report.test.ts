import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerTalkSafetyRoutes } from "../talk_safety_routes.js";
import { createTalkSafetyService } from "./service.js";
import type { TalkSafetyReport } from "./policy.js";
import type { TalkSafetyRepository } from "./repository.js";

function fixture() {
  const saved = new Map<string, TalkSafetyReport>();
  let sequence = 0;
  const repository = {
    async appendReport(report: TalkSafetyReport) {
      // This mirrors the existing PostgreSQL uniqueness constraint
      // (tenant_id, reporter_user_id, client_request_id).
      const key = [report.tenantId, report.reporterUserId, report.clientRequestId].join(":");
      const existing = saved.get(key);
      if (existing) return existing;
      saved.set(key, report);
      return report;
    },
  } as unknown as TalkSafetyRepository;
  const service = createTalkSafetyService({
    repository,
    customerAuthorizer: {
      async authorize({ authorizationHeader }) {
        const id = authorizationHeader === "Bearer user-a" ? "user-a"
          : authorizationHeader === "Bearer user-b" ? "user-b" : null;
        if (id === null) {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant-a" as never,
          userId: id as never,
          profile: {
            tenantId: "tenant-a" as never, userId: id as never,
            name: id, email: null, phone: null, locale: "en",
            createdAt: "2026-10-08T00:00:00Z",
          },
        };
      },
    },
    platformAuthority: {
      async authorize() { throw new Error("NOT_PLATFORM_AUTHORITY"); },
    },
    createReportId: () => "persona-report-" + (++sequence),
    now: () => "2026-10-08T10:00:00Z",
  });
  const app = Fastify();
  registerTalkSafetyRoutes(app, service);
  return { app, saved };
}

describe("authenticated Expert/Twin reports through existing safety authority", () => {
  it("persists persona ID, deduplicates lost-ack retries per user and does not coalesce different people", async () => {
    const { app, saved } = fixture();
    const payload = {
      targetKind: "persona", targetId: "expert-wazobia",
      reason: "harassment", detail: "Repeated interruptions",
      clientRequestId: "device-report-1",
    };
    const send = (token: string) => app.inject({
      method: "POST", url: "/safety/reports",
      headers: { authorization: "Bearer " + token }, payload,
    });
    const first = await send("user-a");
    const repeated = await send("user-a");
    const other = await send("user-b");
    expect(first.statusCode).toBe(202);
    expect(first.json().accepted).toBe(true);
    expect(repeated.json().reportId).toBe(first.json().reportId);
    expect(other.json().reportId).not.toBe(first.json().reportId);
    expect(saved.size).toBe(2);
    const firstReport = [...saved.values()][0]!;
    expect(firstReport.target).toEqual({ kind: "persona", id: "expert-wazobia" });
    expect(firstReport.reporterUserId).toBe("user-a");
    await app.close();
  });

  it("rejects unsigned reports and malformed persona inputs before persistence", async () => {
    const { app, saved } = fixture();
    const payload = {
      targetKind: "persona", targetId: "twin-1",
      reason: "fraud", clientRequestId: "key-1",
    };
    const unauthorized = await app.inject({
      method: "POST", url: "/safety/reports", payload,
    });
    expect(unauthorized.statusCode).toBe(401);
    const invalid = await app.inject({
      method: "POST", url: "/safety/reports",
      headers: { authorization: "Bearer user-a" },
      payload: { ...payload, targetId: "", reason: "not-a-reason" },
    });
    expect(invalid.statusCode).toBe(400);
    expect(saved.size).toBe(0);
    await app.close();
  });
});
