import type {
  AgentRunId,
  SkillVersionId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type { AgentRunScope } from "./run.js";
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
}

/**
 * Budget-aware wrapper around the canonical bounded subworker admission.
 *
 * This is intentionally persistence-neutral. The caller must durably compare-and-set
 * parentUsageAfterAdmission before allowing the returned child to execute. The child
 * budget is a local ceiling only; all real child activity must also charge the shared
 * parent/root meter.
 */
export function createBudgetedSubworkerAdmissionService(input: {
  readonly subworkers: BudgetedSubworkerAdmissionService;
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
      readonly parentBudget: AgentExecutionBudget;
      readonly parentUsage: AgentExecutionUsage;
      readonly childBudget: Omit<
        ChildExecutionBudgetRequest,
        "childAgentRunId"
      >;
    }): Promise<BudgetedSubworkerAdmissionResult> {
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

      const admitted = await input.subworkers.admit({
        parentAuthority: request.parentAuthority,
        scope: request.scope,
        parentAgentRunId: request.parentAgentRunId,
        childAgentRunId: request.childAgentRunId,
        parentSkillVersionIds: request.parentSkillVersionIds,
        requestedSkillVersionIds: request.requestedSkillVersionIds,
        requestedCapabilities: request.requestedCapabilities,
      });

      if (
        admitted.run.agentRunId !== request.childAgentRunId ||
        admitted.run.lineage.parentAgentRunId !== request.parentAgentRunId ||
        grant.childBudget.agentRunId !== admitted.run.agentRunId
      ) {
        throw new TypeError(
          "Budgeted subworker admission returned mismatched child custody",
        );
      }

      return Object.freeze({
        ...admitted,
        childBudget: grant.childBudget,
        parentUsageAfterAdmission,
      });
    },
  });
}
