import type {
  Instant,
  SkillVersionId,
  TenantId,
  ToolVersionId,
  WorkflowId,
  WorkflowVersionId,
} from "@masanawa/contracts";

export const workflowGraphLimits = Object.freeze({
  maxNameLength: 160,
  maxDescriptionLength: 2_000,
  maxNodeKeyLength: 96,
  maxLabelLength: 160,
  maxExecutorKeyLength: 160,
  maxExecutorVersionLength: 96,
  maxNodes: 256,
  maxEdges: 1_024,
  maxEntryNodes: 32,
} as const);

export interface Workflow {
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly name: string;
  readonly description: string;
  readonly createdAt: Instant;
}

export type WorkflowNodeKind =
  | "executor"
  | "decision"
  | "wait"
  | "join"
  | "terminal";

export type WorkflowExecutorRef =
  | {
      readonly kind: "skill";
      readonly skillVersionId: SkillVersionId;
    }
  | {
      readonly kind: "tool";
      readonly toolVersionId: ToolVersionId;
    }
  | {
      readonly kind: "subworkflow";
      readonly workflowVersionId: WorkflowVersionId;
    }
  | {
      readonly kind: "agent-strategy" | "system";
      readonly key: string;
      readonly version: string;
    };

export interface WorkflowNode {
  readonly key: string;
  readonly kind: WorkflowNodeKind;
  readonly label: string;
  readonly executor: WorkflowExecutorRef | null;
}

export type WorkflowEdgeCondition =
  | { readonly kind: "always" }
  | { readonly kind: "label"; readonly label: string };

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition: WorkflowEdgeCondition;
}

export interface WorkflowGraph {
  readonly entryNodeKeys: readonly string[];
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

export interface WorkflowVersion {
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly workflowVersionId: WorkflowVersionId;
  readonly versionNumber: number;
  readonly graph: WorkflowGraph;
  readonly graphSignature: string;
  readonly createdAt: Instant;
}
