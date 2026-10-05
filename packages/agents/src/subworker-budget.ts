import type {
  AgentRunId,
  SkillVersionId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type { AgentRunScope } from "./run.js";
import {
  createAgentExecutionControl,
  type AgentExecutionControl,
} from "./execution-control.js";
import type { SubworkerAdmission } from "./subworker.js";
import {
  deriveChildExecutionBudget,
  type ChildExecutionBudgetRequest,
} from "./execution-budget-partition.js";
import {
  recordChildRunAdmission,
  type AgentExecutionBudget,
  type AgentExecutionUsage,
} from "./execution-budget.js";

export interface BudgetedSubworkerAdmissionService {
  admit(input: {
    readonly parentAuthority: AuthorityContext;
    readonly scope: AgentRunScope;
    readonly parentAgentRunId: AgentRunId;
    readonly childAgentRunId: AgentRunId;
    readonly parentSkillVersionIds: readonly SkillVersionId[];
    readonly requestedSkillVersionIds: readonly SkillVersionId[];
    readonly requestedCapabilities: readonly string[];
  }): Promise<SubworkerAdmission>;
}

export interface BudgetedSubworkerAdmissionResult extends SubworkerAdmission {
  readonly childBudget: AgentExecutionBudget;
  readonly parentUsageAfterAdmission: AgentExecutionUsage;
  readonly executionControl: AgentExecutionControl;
}

export interface AgentExecutionBudgetReservationPort {
  reserveChildAdmission(input: {
    readonly parentAgentRunId: AgentRunId;
    readonly childAgentRunId: AgentRunId;
    readonly budget: AgentExecutionBudget;
    readonly expectedUsage: AgentExecutionUsage;
    readonly nextUsage: AgentExecutionUsage;
  }): Promise<AgentExecutionUsage>;
}

/**
 * Budget-aware wrapper around the canonical bounded subworker admission.
 *
 * Parent usage is reserved durably before child AgentRun creation. A failed child
 * creation may conservatively consume one child slot, but an unbudgeted child can never
 * exist. The child budget is a local ceiling only; all real child activity must also
 * charge the shared parent/root meter.
 */
export function createBudgetedSubworkerAdmissionService(input: {
  readonly subworkers: BudgetedSubworkerAdmissionService;
  readonly reservations: AgentExecutionBudgetReservationPort;
}) {
  return Object.freeze({
    async admit(request: {
      readonly parentAuthority: AuthorityContext;
      readonly scope: AgentRunScope;
      readonly parentAgentRunId: AgentRunId;
      readonly childAgentRunId: AgentRunId;
      readonly parentSkillVersionIds: readonly SkillVersionId[];
      readonly requestedSkillVersionIds: readonly SkillVersionId[];
      readonly requestedCapabilities: readonly string[];
      readonly parentExecutionControl: AgentExecutionControl;
      readonly parentBudget: AgentExecutionBudget;
      readonly parentUsage: AgentExecutionUsage;
      readonly childBudget: Omit<
        ChildExecutionBudgetRequest,
        "childAgentRunId"
      >;
    }): Promise<BudgetedSubworkerAdmissionResult> {
      request.parentExecutionControl.throwIfStopped();

      if (request.parentBudget.agentRunId !== request.parentAgentRunId) {
        throw new TypeError(
          "Parent execution budget is not bound to parentAgentRunId",
        );
      }
      if (request.parentUsage.agentRunId !== request.parentAgentRunId) {
        throw new TypeError(
          "Parent execution usage is not bound to parentAgentRunId",
        );
      }

      const grant = deriveChildExecutionBudget({
        parentBudget: request.parentBudget,
        parentUsage: request.parentUsage,
        request: {
          ...request.childBudget,
          childAgentRunId: request.childAgentRunId,
        },
      });

      const parentUsageAfterAdmission = recordChildRunAdmission({
        budget: request.parentBudget,
        usage: request.parentUsage,
        observedAt: request.childBudget.at,
      });

      request.parentExecutionControl.throwIfStopped();

      const reservedUsage = await input.reservations.reserveChildAdmission({
        parentAgentRunId: request.parentAgentRunId,
        childAgentRunId: request.childAgentRunId,
        budget: request.parentBudget,
        expectedUsage: request.parentUsage,
        nextUsage: parentUsageAfterAdmission,
      });

      if (
        reservedUsage.schemaVersion !== parentUsageAfterAdmission.schemaVersion ||
        reservedUsage.agentRunId !== request.parentAgentRunId ||
        reservedUsage.startedAt !== parentUsageAfterAdmission.startedAt ||
        reservedUsage.observedAt !== parentUsageAfterAdmission.observedAt ||
        reservedUsage.inputTokens !== parentUsageAfterAdmission.inputTokens ||
        reservedUsage.outputTokens !== parentUsageAfterAdmission.outputTokens ||
        reservedUsage.toolCalls !== parentUsageAfterAdmission.toolCalls ||
        reservedUsage.childRuns !== parentUsageAfterAdmission.childRuns ||
        reservedUsage.providerCostMicros !==
          parentUsageAfterAdmission.providerCostMicros ||
        reservedUsage.providerCostCurrency !==
          parentUsageAfterAdmission.providerCostCurrency
      ) {
        throw new TypeError(
          "Budget reservation did not persist the expected parent usage",
        );
      }

      request.parentExecutionControl.throwIfStopped();
      const executionControl = createAgentExecutionControl({
        parent: request.parentExecutionControl,
      });

      let admitted: SubworkerAdmission;
      try {
        admitted = await input.subworkers.admit({
          parentAuthority: request.parentAuthority,
          scope: request.scope,
          parentAgentRunId: request.parentAgentRunId,
          childAgentRunId: request.childAgentRunId,
          parentSkillVersionIds: request.parentSkillVersionIds,
          requestedSkillVersionIds: request.requestedSkillVersionIds,
          requestedCapabilities: request.requestedCapabilities,
        });
      } catch (error) {
        executionControl.stop({
          reason: "shutdown",
          detail: "Subworker admission failed before execution",
        });
        throw error;
      }

      executionControl.throwIfStopped();

      if (
        admitted.run.agentRunId !== request.childAgentRunId ||
        admitted.run.lineage.parentAgentRunId !== request.parentAgentRunId ||
        grant.childBudget.agentRunId !== admitted.run.agentRunId
      ) {
        executionControl.stop({
          reason: "shutdown",
          detail: "Subworker custody validation failed before execution",
        });
        throw new TypeError(
          "Budgeted subworker admission returned mismatched child custody",
        );
      }

      return Object.freeze({
        ...admitted,
        childBudget: grant.childBudget,
        parentUsageAfterAdmission: reservedUsage,
        executionControl,
      });
    },
  });
}
