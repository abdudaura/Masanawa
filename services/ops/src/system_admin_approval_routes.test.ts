import { afterEach, describe, expect, it } from "vitest";
import type { SystemAdminService } from "./system_admin.js";
import { createOpsApp } from "./app.js";

const apps: Array<ReturnType<typeof createOpsApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Ops approval decision route", () => {
  it("forwards only an explicit approve/deny decision", async () => {
    const calls: unknown[] = [];
    const systemAdmin = {
      async decideApproval(input: unknown) {
        calls.push(input);
        return {
          approvalId: "approval_00000000-0000-4000-8000-000000000001",
          operationId: "operation_00000000-0000-4000-8000-000000000002",
          kind: "once",
          state: "approved",
          action: "offer.set-enabled",
          actionVersion: "v1",
          resourceKey: "admin-delegate:character_test",
          riskClass: "consequential",
          requestedAt: "2026-10-05T00:00:00.000Z",
          expiresAt: "2026-10-05T00:15:00.000Z",
          decidedAt: "2026-10-05T00:01:00.000Z",
          approverKey: "operator:user_test",
        };
      },
    } as unknown as SystemAdminService;
    const app = createOpsApp({ systemAdmin });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/approvals/"
        + "approval_00000000-0000-4000-8000-000000000001/decision",
      headers: { authorization: "Bearer operator" },
      payload: { decision: "approved" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual([{
      authorizationHeader: "Bearer operator",
      approvalId: "approval_00000000-0000-4000-8000-000000000001",
      decision: "approved",
    }]);
  });

  it("rejects arbitrary approval state payloads before service execution", async () => {
    let calls = 0;
    const systemAdmin = {
      async decideApproval() {
        calls += 1;
        return {};
      },
    } as unknown as SystemAdminService;
    const app = createOpsApp({ systemAdmin });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/approvals/"
        + "approval_00000000-0000-4000-8000-000000000001/decision",
      headers: { authorization: "Bearer operator" },
      payload: { decision: "consumed" },
    });

    expect(response.statusCode).toBe(400);
    expect(calls).toBe(0);
  });
});
