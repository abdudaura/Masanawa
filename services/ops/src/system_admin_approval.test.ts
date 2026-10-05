import { describe, expect, it, vi } from "vitest";
import { createSystemAdminService } from "./system_admin.js";

const tenantId = "tenant_0199cabc-1234-7abc-8def-1234567890ab";
const userId = "user_0199cabc-1234-7abc-8def-1234567890ae";

describe("System admin approval decisions", () => {
  it("binds approval decisions to the canonical operator User", async () => {
    const decide = vi.fn(async () => ({
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
      approverKey: `operator:${userId}`,
    }));
    const service = createSystemAdminService({
      database: { query: vi.fn() } as never,
      authorizer: {
        authorize: vi.fn(async () => ({
          tenantId,
          operatorUserId: userId,
        })),
      } as never,
      approvalCommands: { decide },
    });

    await service.decideApproval({
      authorizationHeader: "Bearer operator",
      approvalId: "approval_00000000-0000-4000-8000-000000000001",
      decision: "approved",
    });

    expect(decide).toHaveBeenCalledWith({
      tenantId,
      approvalId: "approval_00000000-0000-4000-8000-000000000001",
      decision: "approved",
      approverUserId: userId,
    });
  });

  it("rejects anonymous bootstrap authority for approval decisions", async () => {
    const decide = vi.fn();
    const service = createSystemAdminService({
      database: { query: vi.fn() } as never,
      authorizer: {
        authorize: vi.fn(async () => ({
          tenantId,
          operatorUserId: null,
        })),
      } as never,
      approvalCommands: { decide },
    });

    await expect(service.decideApproval({
      authorizationHeader: "Bearer bootstrap",
      approvalId: "approval_00000000-0000-4000-8000-000000000001",
      decision: "denied",
    })).rejects.toMatchObject({ statusCode: 403 });
    expect(decide).not.toHaveBeenCalled();
  });
});
