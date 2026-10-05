import { describe, expect, it, vi } from "vitest";
import { createAdminAgentActionBroker } from "./admin_agent_actions.js";
import type { AdminAgentDelegationConfig } from "./admin_delegation.js";
import type { PlatformAdminService } from "./platform_admin.js";

const tenantId = "tenant_0199cabc-1234-7abc-8def-1234567890ab";
const gwaniId = "character_0199cabc-1234-7abc-8def-1234567890aa";

const config: AdminAgentDelegationConfig = Object.freeze({
  tenantId,
  delegates: Object.freeze([
    Object.freeze({
      characterId: gwaniId,
      label: "Gwani",
      displayName: "Gwani",
      roleLabel: "Masanawa support",
      ready: true,
      purpose: "Primary conversational administrator",
      autonomy: "confirm-writes" as const,
      capabilities: Object.freeze([
        "platform.summary.read",
        "identity.users.read",
        "commerce.write",
      ] as const),
      enabled: true,
      approvalRequiredForWrites: true,
    }),
  ]),
});

const authorizer = {
  authorize: vi.fn(async () => ({
    tenantId,
    operatorUserId: "user_0199cabc-1234-7abc-8def-1234567890ae",
  })),
} as never;

describe("admin Agent action broker", () => {
  it("executes delegated read actions through canonical admin services", async () => {
    const summary = vi.fn(async () => ({ users: 2 }));
    const platformAdmin = {
      summary,
    } as unknown as PlatformAdminService;
    const broker = createAdminAgentActionBroker({ config, authorizer, platformAdmin });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "platform.summary",
    })).resolves.toEqual({
      status: "completed",
      action: "platform.summary",
      data: { users: 2 },
    });

    expect(summary).toHaveBeenCalledWith({
      authorizationHeader: "Bearer operator",
    });
  });

  it("requires approval instead of executing delegated writes", async () => {
    const setOfferEnabled = vi.fn();
    const platformAdmin = {
      setOfferEnabled,
    } as unknown as PlatformAdminService;
    const approvalCommands = {
      admit: vi.fn(async () => ({
        approvalId: "approval_00000000-0000-4000-8000-000000000003",
        operationId: "operation_00000000-0000-4000-8000-000000000004",
        reused: false,
        execution: "awaiting-approval" as const,
      })),
      beginExecution: vi.fn(),
      completeExecution: vi.fn(),
      markExecutionUnknown: vi.fn(),
    };
    const broker = createAdminAgentActionBroker({
      config,
      authorizer,
      platformAdmin,
      approvalCommands,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
      agentRunId: "agent-run_00000000-0000-4000-8000-000000000002",
      idempotencyKey: "gwani-write-1",
      arguments: {
        offerId: "offer_00000000-0000-4000-8000-000000000001",
        expectedRevision: 1,
        enabled: false,
      },
    })).resolves.toEqual({
      status: "approval-required",
      action: "offer.set-enabled",
      capability: "commerce.write",
      reason: "governed-write",
      approvalId: "approval_00000000-0000-4000-8000-000000000003",
      operationId: "operation_00000000-0000-4000-8000-000000000004",
      reused: false,
    });

    expect(setOfferEnabled).not.toHaveBeenCalled();
  });

  it("executes an approved exact replay through the canonical write service and Operation lifecycle", async () => {
    const setOfferEnabled = vi.fn(async () => ({
      offerId: "offer_00000000-0000-4000-8000-000000000001",
      revision: 2,
      enabled: false,
    }));
    const platformAdmin = {
      setOfferEnabled,
    } as unknown as PlatformAdminService;
    const approvalCommands = {
      admit: vi.fn(async () => ({
        approvalId: "approval_00000000-0000-4000-8000-000000000003",
        operationId: "operation_00000000-0000-4000-8000-000000000004",
        reused: true,
        execution: "authorized" as const,
      })),
      beginExecution: vi.fn(async () => undefined),
      completeExecution: vi.fn(async () => undefined),
      markExecutionUnknown: vi.fn(async () => undefined),
    };
    const broker = createAdminAgentActionBroker({
      config,
      authorizer,
      platformAdmin,
      approvalCommands,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
      agentRunId: "agent-run_00000000-0000-4000-8000-000000000002",
      idempotencyKey: "gwani-write-1",
      arguments: {
        offerId: "offer_00000000-0000-4000-8000-000000000001",
        expectedRevision: 1,
        enabled: false,
      },
    })).resolves.toEqual({
      status: "completed",
      action: "offer.set-enabled",
      operationId: "operation_00000000-0000-4000-8000-000000000004",
      replayed: false,
      data: {
        offerId: "offer_00000000-0000-4000-8000-000000000001",
        revision: 2,
        enabled: false,
      },
    });

    expect(approvalCommands.beginExecution).toHaveBeenCalledWith({
      tenantId,
      operationId: "operation_00000000-0000-4000-8000-000000000004",
    });
    expect(setOfferEnabled).toHaveBeenCalledWith({
      authorizationHeader: "Bearer operator",
      offerId: "offer_00000000-0000-4000-8000-000000000001",
      expectedRevision: 1,
      enabled: false,
    });
    expect(approvalCommands.completeExecution).toHaveBeenCalledWith({
      tenantId,
      operationId: "operation_00000000-0000-4000-8000-000000000004",
    });
    expect(approvalCommands.markExecutionUnknown).not.toHaveBeenCalled();
    expect(approvalCommands.beginExecution.mock.invocationCallOrder[0])
      .toBeLessThan(setOfferEnabled.mock.invocationCallOrder[0]!);
    expect(setOfferEnabled.mock.invocationCallOrder[0])
      .toBeLessThan(approvalCommands.completeExecution.mock.invocationCallOrder[0]!);
  });

  it("does not execute a canonical write again after the Operation already succeeded", async () => {
    const setOfferEnabled = vi.fn();
    const platformAdmin = {
      setOfferEnabled,
    } as unknown as PlatformAdminService;
    const approvalCommands = {
      admit: vi.fn(async () => ({
        approvalId: "approval_00000000-0000-4000-8000-000000000003",
        operationId: "operation_00000000-0000-4000-8000-000000000004",
        reused: true,
        execution: "succeeded" as const,
      })),
      beginExecution: vi.fn(),
      completeExecution: vi.fn(),
      markExecutionUnknown: vi.fn(),
    };
    const broker = createAdminAgentActionBroker({
      config,
      authorizer,
      platformAdmin,
      approvalCommands,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
      agentRunId: "agent-run_00000000-0000-4000-8000-000000000002",
      idempotencyKey: "gwani-write-1",
      arguments: {
        offerId: "offer_00000000-0000-4000-8000-000000000001",
        expectedRevision: 1,
        enabled: false,
      },
    })).resolves.toEqual({
      status: "completed",
      action: "offer.set-enabled",
      operationId: "operation_00000000-0000-4000-8000-000000000004",
      replayed: true,
      data: {
        operationId: "operation_00000000-0000-4000-8000-000000000004",
        replayed: true,
      },
    });

    expect(setOfferEnabled).not.toHaveBeenCalled();
    expect(approvalCommands.beginExecution).not.toHaveBeenCalled();
  });

  it("marks the Operation unknown instead of blindly retrying an ambiguous write failure", async () => {
    const setOfferEnabled = vi.fn(async () => {
      throw new Error("connection lost after dispatch");
    });
    const platformAdmin = {
      setOfferEnabled,
    } as unknown as PlatformAdminService;
    const approvalCommands = {
      admit: vi.fn(async () => ({
        approvalId: "approval_00000000-0000-4000-8000-000000000003",
        operationId: "operation_00000000-0000-4000-8000-000000000004",
        reused: true,
        execution: "authorized" as const,
      })),
      beginExecution: vi.fn(async () => undefined),
      completeExecution: vi.fn(async () => undefined),
      markExecutionUnknown: vi.fn(async () => undefined),
    };
    const broker = createAdminAgentActionBroker({
      config,
      authorizer,
      platformAdmin,
      approvalCommands,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
      agentRunId: "agent-run_00000000-0000-4000-8000-000000000002",
      idempotencyKey: "gwani-write-1",
      arguments: {
        offerId: "offer_00000000-0000-4000-8000-000000000001",
        expectedRevision: 1,
        enabled: false,
      },
    })).rejects.toThrow("connection lost after dispatch");

    expect(approvalCommands.completeExecution).not.toHaveBeenCalled();
    expect(approvalCommands.markExecutionUnknown).toHaveBeenCalledWith({
      tenantId,
      operationId: "operation_00000000-0000-4000-8000-000000000004",
    });
  });

  it("requires AgentRun and idempotency identity for governed writes", async () => {
    const platformAdmin = {} as PlatformAdminService;
    const approvalCommands = {
      admit: vi.fn(),
      beginExecution: vi.fn(),
      completeExecution: vi.fn(),
      markExecutionUnknown: vi.fn(),
    };
    const broker = createAdminAgentActionBroker({
      config,
      authorizer,
      platformAdmin,
      approvalCommands,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
    })).rejects.toThrow(
      "Governed admin writes require agentRunId and idempotencyKey",
    );
    expect(approvalCommands.admit).not.toHaveBeenCalled();
  });

  it("intersects Gwani delegation with operator authority", async () => {
    const deniedAuthorizer = {
      authorize: vi.fn(async () => {
        const error = new Error("denied") as Error & { statusCode: number };
        error.statusCode = 403;
        throw error;
      }),
    } as never;
    const platformAdmin = {} as PlatformAdminService;
    const broker = createAdminAgentActionBroker({
      config,
      authorizer: deniedAuthorizer,
      platformAdmin,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "offer.set-enabled",
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("refuses governed writes from anonymous bootstrap authority", async () => {
    const bootstrapAuthorizer = {
      authorize: vi.fn(async () => ({
        tenantId,
        operatorUserId: null,
      })),
    } as never;
    const platformAdmin = {} as PlatformAdminService;
    const broker = createAdminAgentActionBroker({
      config,
      authorizer: bootstrapAuthorizer,
      platformAdmin,
    });

    await expect(broker.execute({
      authorizationHeader: "Bearer bootstrap",
      characterId: gwaniId,
      action: "offer.set-enabled",
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects capabilities not delegated to Gwani", async () => {
    const platformAdmin = {} as PlatformAdminService;
    const broker = createAdminAgentActionBroker({ config, authorizer, platformAdmin });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: gwaniId,
      action: "audit.list",
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects Characters that are not admin delegates", async () => {
    const platformAdmin = {} as PlatformAdminService;
    const broker = createAdminAgentActionBroker({ config, authorizer, platformAdmin });

    await expect(broker.execute({
      authorizationHeader: "Bearer operator",
      characterId: "character_0199cabc-1234-7abc-8def-1234567890ad",
      action: "platform.summary",
    })).rejects.toMatchObject({ statusCode: 403 });
  });
});
