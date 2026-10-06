import {
  normalizeAgentRun,
  type AgentRun,
} from "@masanawa/agents";
import { toInstant, type Instant } from "@masanawa/contracts";

export const workResearchRoomKinds = [
  "work-business",
  "research-answers",
] as const;
export type WorkResearchRoomKind =
  (typeof workResearchRoomKinds)[number];

export type WorkResearchItemStatus =
  | "queued"
  | "working"
  | "waiting"
  | "completed"
  | "failed";

export interface WorkResearchQuickStartProjection {
  readonly intentId: string;
  readonly label: string;
  readonly description: string;
  readonly iconKey: string | null;
}

export interface WorkResearchArtifactProjection {
  readonly artifactId: string;
  readonly label: string;
  readonly kind: string;
  readonly uri: string | null;
}

export interface WorkResearchEvidenceProjection {
  readonly evidenceId: string;
  readonly title: string;
  readonly sourceUri: string;
  readonly publisher: string | null;
  readonly observedAt: Instant | null;
}

export interface WorkResearchItemProjection {
  readonly itemId: string;
  readonly title: string;
  readonly summary: string;
  readonly status: WorkResearchItemStatus;
  readonly progress: number;
  readonly artifacts: readonly WorkResearchArtifactProjection[];
  readonly evidence: readonly WorkResearchEvidenceProjection[];
}

export interface WorkResearchRoomProjection {
  readonly kind: WorkResearchRoomKind;
  readonly title: string;
  readonly subtitle: string;
  readonly quickStarts: readonly WorkResearchQuickStartProjection[];
  readonly items: readonly WorkResearchItemProjection[];
}

export type WorkResearchExecutionState =
  | Readonly<{
      kind: "pending";
      status: "queued" | "waiting";
    }>
  | Readonly<{
      kind: "agent-run";
      run: AgentRun;
    }>;

export interface WorkResearchArtifactInput {
  readonly artifactId: string;
  readonly label: string;
  readonly kind: string;
  readonly uri?: string | null;
}

export interface WorkResearchEvidenceInput {
  readonly evidenceId: string;
  readonly title: string;
  readonly sourceUri: string;
  readonly publisher?: string | null;
  readonly observedAt?: Instant | null;
}

export interface WorkResearchRuntimeItemInput {
  readonly itemId: string;
  readonly title: string;
  readonly summary: string;
  readonly execution: WorkResearchExecutionState;
  readonly progress: number;
  readonly artifacts?: readonly WorkResearchArtifactInput[];
  readonly evidence?: readonly WorkResearchEvidenceInput[];
  readonly requiresEvidence?: boolean;
}

const quickStarts: Readonly<
  Record<WorkResearchRoomKind, readonly WorkResearchQuickStartProjection[]>
> = Object.freeze({
  "work-business": Object.freeze([
    Object.freeze({
      intentId: "work.business-plan",
      label: "Business plan",
      description: "Build or improve a practical business plan.",
      iconKey: "business-plan",
    }),
    Object.freeze({
      intentId: "work.business-ideas",
      label: "Business ideas",
      description: "Explore realistic business opportunities.",
      iconKey: "ideas",
    }),
    Object.freeze({
      intentId: "work.proposal",
      label: "Proposal",
      description: "Draft a clear proposal for a client or project.",
      iconKey: "proposal",
    }),
    Object.freeze({
      intentId: "work.market-research",
      label: "Market research",
      description: "Research a market, competitors and customer needs.",
      iconKey: "research",
    }),
    Object.freeze({
      intentId: "work.sales-marketing",
      label: "Sales & marketing",
      description: "Plan sales, campaigns and customer outreach.",
      iconKey: "marketing",
    }),
    Object.freeze({
      intentId: "work.customer-messages",
      label: "Customer messages",
      description: "Prepare professional customer communication.",
      iconKey: "message",
    }),
    Object.freeze({
      intentId: "work.pricing",
      label: "Pricing help",
      description: "Compare costs, value and pricing options.",
      iconKey: "pricing",
    }),
    Object.freeze({
      intentId: "work.reports",
      label: "Reports",
      description: "Create or improve a business report.",
      iconKey: "report",
    }),
    Object.freeze({
      intentId: "work.documents",
      label: "Spreadsheet & documents",
      description: "Work on structured files and business documents.",
      iconKey: "document",
    }),
    Object.freeze({
      intentId: "work.project",
      label: "Start or continue a project",
      description: "Begin new work or continue an existing project.",
      iconKey: "project",
    }),
  ]),
  "research-answers": Object.freeze([
    Object.freeze({
      intentId: "research.topic",
      label: "Research a topic",
      description: "Investigate a topic and organize the findings.",
      iconKey: "research",
    }),
    Object.freeze({
      intentId: "research.compare",
      label: "Compare options",
      description: "Compare alternatives with clear evidence.",
      iconKey: "compare",
    }),
    Object.freeze({
      intentId: "research.latest",
      label: "Latest information",
      description: "Find current information with sources.",
      iconKey: "latest",
    }),
    Object.freeze({
      intentId: "research.investigate",
      label: "Investigate something",
      description: "Dig into a question and surface evidence.",
      iconKey: "investigate",
    }),
    Object.freeze({
      intentId: "research.summarize-documents",
      label: "Summarize documents",
      description: "Extract and summarize the important points.",
      iconKey: "document",
    }),
    Object.freeze({
      intentId: "research.my-files",
      label: "Ask from my files",
      description: "Answer questions using the user's files.",
      iconKey: "files",
    }),
  ]),
});

function boundedText(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function optionalHttps(
  value: string | null | undefined,
  name: string,
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = boundedText(value, name, 4096);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError(`${name} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new TypeError(`${name} must be HTTPS`);
  }
  return parsed.toString();
}

function requiredHttps(value: string, name: string): string {
  const normalized = optionalHttps(value, name);
  if (normalized === null) throw new TypeError(`${name} is required`);
  return normalized;
}

function projectArtifact(
  input: WorkResearchArtifactInput,
): WorkResearchArtifactProjection {
  return Object.freeze({
    artifactId: boundedText(input.artifactId, "artifactId", 256),
    label: boundedText(input.label, "artifact.label", 500),
    kind: boundedText(input.kind, "artifact.kind", 128),
    uri: optionalHttps(input.uri, "artifact.uri"),
  });
}

function projectEvidence(
  input: WorkResearchEvidenceInput,
): WorkResearchEvidenceProjection {
  return Object.freeze({
    evidenceId: boundedText(input.evidenceId, "evidenceId", 256),
    title: boundedText(input.title, "evidence.title", 1000),
    sourceUri: requiredHttps(input.sourceUri, "evidence.sourceUri"),
    publisher:
      input.publisher === null || input.publisher === undefined
        ? null
        : boundedText(input.publisher, "evidence.publisher", 500),
    observedAt:
      input.observedAt === null || input.observedAt === undefined
        ? null
        : toInstant(input.observedAt),
  });
}

function mapExecutionStatus(
  execution: WorkResearchExecutionState,
): WorkResearchItemStatus {
  if (execution.kind === "pending") return execution.status;
  const run = normalizeAgentRun(execution.run);
  switch (run.state) {
    case "running":
      return "working";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
  }
}

function projectItem(
  input: WorkResearchRuntimeItemInput,
): WorkResearchItemProjection {
  if (
    !Number.isFinite(input.progress) ||
    input.progress < 0 ||
    input.progress > 1
  ) {
    throw new RangeError("Work/Research progress must be between 0 and 1");
  }

  const status = mapExecutionStatus(input.execution);
  if (
    input.execution.kind === "agent-run" &&
    input.execution.run.state === "completed" &&
    input.progress !== 1
  ) {
    throw new TypeError(
      "Completed Work/Research AgentRun must project progress 1",
    );
  }
  if (
    input.execution.kind === "agent-run" &&
    input.execution.run.state === "failed" &&
    input.progress === 1
  ) {
    throw new TypeError(
      "Failed Work/Research AgentRun cannot project successful progress",
    );
  }

  const artifacts = Object.freeze(
    (input.artifacts ?? []).map(projectArtifact),
  );
  const evidence = Object.freeze(
    (input.evidence ?? []).map(projectEvidence),
  );

  if (input.requiresEvidence === true && evidence.length === 0) {
    throw new TypeError(
      "Evidence-required Work/Research item cannot be projected without sources",
    );
  }

  return Object.freeze({
    itemId: boundedText(input.itemId, "itemId", 256),
    title: boundedText(input.title, "item.title", 1000),
    summary: input.summary.trim().slice(0, 8000),
    status,
    progress: input.progress,
    artifacts,
    evidence,
  });
}

export function projectWorkResearchRoom(input: {
  readonly kind: WorkResearchRoomKind;
  readonly items?: readonly WorkResearchRuntimeItemInput[];
}): WorkResearchRoomProjection {
  if (!workResearchRoomKinds.includes(input.kind)) {
    throw new TypeError("Unsupported Work/Research room kind");
  }

  const isWork = input.kind === "work-business";
  return Object.freeze({
    kind: input.kind,
    title: isWork ? "Work & Business" : "Research & Answers",
    subtitle: isWork
      ? "Plan, write, analyze and continue practical work."
      : "Research questions, compare options and inspect sources.",
    quickStarts: quickStarts[input.kind],
    items: Object.freeze((input.items ?? []).map(projectItem)),
  });
}
