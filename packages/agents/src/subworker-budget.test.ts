import { describe, expect, it, vi } from "vitest";
import type { AuthorityContext } from "@masanawa/security";
import type { AgentRun } from "./run.js";
import {
  normalizeAgentExecutionBudget,
  createInitialAgentExecutionUsage,
} from "./execution-budget.js";
import { createBudgetedSubworkerAdmissionService } from "./subworker-budget.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const userId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;
const relationshipId = "relationship_00000000-0000-4000-8000-000000000004" as never;
const parentAgentRunId = "agent-run_00000000-0000-4000-8000-000000000005" as never;
const childAgentRunId = "agent-run_00000000-0000-4000-8000-000000000006" as never;
const rootAgentRunId = "agent-run_00000000-0000-4000-8000-000000000007" as never;
const skillVersionId = "skill-version_00000000-0000-4000-8000-000000000008" as never;
const startedAt = "2026-10-05T12:00:00.000Z" as never;
const at = "2026-10-05T12:00:30.000Z" as never;

const budget = normalizeAgentExecutionBudget({
  schemaVersion: 1,
  agentRunId: parentAgentRunId,
  maxWallClockMs: 120_000,
  maxInputTokens: 1_000,
  maxOutputTokens: 800,
  maxTotalTokens: 1_500,
  maxToolCalls: 10,
  maxChildRuns: 2,
  maxProviderCostMicros: 20_000,
  providerCostCurrency: "USD",
});

function usage() {
  return createInitialAgentExecutionUsage({
    agentRunId: parentAgentRunId,
    startedAt,
    providerCostCurrency: "USD",
  });
}

function admittedRun(): AgentRun {
  return {
    agentRunId: childAgentRunId,
    lineage: {
      parentAgentRunId,
      rootAgentRunId,
      depth: 2,
    },
  } as AgentRun;
}

const common = {
  parentAuthority: {} as AuthorityContext,
  scope: { tenantId, userId, characterId, relationshipId },
  parentAgentRunId,
  childAgentRunId,
  parentSkillVersionIds: [skillVersionId],
  requestedSkillVersionIds: [skillVersionId],
  requestedCapabilities: ["research.read"],
  parentBudget: budget,
  childBudget: {
    at,
    maxWallClockMs: 30_000,
    maxInputTokens: 300,
    maxOutputTokens: 200,
    maxTotalTokens: 450,
    maxToolCalls: 2,
    maxChildRuns: 0,
    maxProviderCostMicros: 4_000,
  },
};

describe("budgeted subworker admission", () => {
  it("returns bounded child budget and advances parent child-run usage", async () => {
    const admit = vi.fn(async () => ({
      run: admittedRun(),
      authority: {} as AuthorityContext,
      skillVersionIds: [skillVersionId],
    }));
    const reserveChildAdmission = vi.fn(async (input) => input.nextUsage);
    const service = createBudgetedSubworkerAdmissionService({
      subworkers: { admit },
      reservations: { reserveChildAdmission },
    });

    const result = await service.admit({
      ...common,
      parentUsage: usage(),
    });

    expect(result.childBudget.agentRunId).toBe(childAgentRunId);
    expect(result.childBudget.maxTotalTokens).toBe(450);
    expect(result.parentUsageAfterAdmission.childRuns).toBe(1);
    expect(reserveChildAdmission).toHaveBeenCalledTimes(1);
    expect(admit).toHaveBeenCalledTimes(1);
    expect(reserveChildAdmission.mock.invocationCallOrder[0]).toBeLessThan(
      admit.mock.invocationCallOrder[0]!,
    );
  });

  it("rejects a child budget that exceeds parent remaining capacity before child creation", async () => {
    const admit = vi.fn();
    const reserveChildAdmission = vi.fn(async (input) => input.nextUsage);
    const service = createBudgetedSubworkerAdmissionService({
      subworkers: { admit: admit as never },
      reservations: { reserveChildAdmission },
    });

    await expect(service.admit({
      ...common,
      parentUsage: usage(),
      childBudget: {
        ...common.childBudget,
        maxInputTokens: 1_001,
      },
    })).rejects.toThrow("maxInputTokens exceeds");

    expect(reserveChildAdmission).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });

  it("rejects parent budget or usage bound to another AgentRun", async () => {
    const admit = vi.fn();
    const reserveChildAdmission = vi.fn(async (input) => input.nextUsage);
    const service = createBudgetedSubworkerAdmissionService({
      subworkers: { admit: admit as never },
      reservations: { reserveChildAdmission },
    });

    await expect(service.admit({
      ...common,
      parentUsage: usage(),
      parentBudget: {
        ...budget,
        agentRunId: "agent-run_00000000-0000-4000-8000-000000000999" as never,
      },
    })).rejects.toThrow("not bound to parentAgentRunId");

    expect(reserveChildAdmission).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });

  it("rejects mismatched child custody returned by subworker admission", async () => {
    const service = createBudgetedSubworkerAdmissionService({
      reservations: {
        async reserveChildAdmission(input) {
          return input.nextUsage;
        },
      },
      subworkers: {
        async admit() {
          return {
            run: {
              ...admittedRun(),
              agentRunId:
                "agent-run_00000000-0000-4000-8000-000000000998" as never,
            },
            authority: {} as AuthorityContext,
            skillVersionIds: [skillVersionId],
          };
        },
      },
    });

    await expect(service.admit({
      ...common,
      parentUsage: usage(),
    })).rejects.toThrow("mismatched child custody");
  });

  it("never creates a child when durable budget reservation fails", async () => {
    const admit = vi.fn();
    const service = createBudgetedSubworkerAdmissionService({
      subworkers: { admit: admit as never },
      reservations: {
        async reserveChildAdmission() {
          throw new Error("usage revision conflict");
        },
      },
    });

    await expect(service.admit({
      ...common,
      parentUsage: usage(),
    })).rejects.toThrow("usage revision conflict");

    expect(admit).not.toHaveBeenCalled();
  });

  it("rejects a reservation response that does not match the expected usage advance", async () => {
    const admit = vi.fn();
    const service = createBudgetedSubworkerAdmissionService({
      subworkers: { admit: admit as never },
      reservations: {
        async reserveChildAdmission(input) {
          return {
            ...input.nextUsage,
            childRuns: input.nextUsage.childRuns + 1,
          };
        },
      },
    });

    await expect(service.admit({
      ...common,
      parentUsage: usage(),
    })).rejects.toThrow("did not persist the expected parent usage");

    expect(admit).not.toHaveBeenCalled();
  });
});
