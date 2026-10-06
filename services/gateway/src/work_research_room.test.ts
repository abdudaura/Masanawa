import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import type { AgentRun } from "@masanawa/agents";
import { describe, expect, it } from "vitest";

import { projectWorkResearchRoom } from "./work_research_room.js";

function run(state: AgentRun["state"]): AgentRun {
  const agentRunId = createCanonicalId("agent-run");
  const now = toInstant(new Date("2026-10-06T10:00:00.000Z"));
  return {
    schemaVersion: 1,
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
    agentRunId,
    characterSessionId: createCanonicalId("character-session"),
    characterVersionId: createCanonicalId("character-version"),
    lineage: {
      parentAgentRunId: null,
      rootAgentRunId: agentRunId,
      depth: 0,
    },
    trace: {
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      taskId: null,
      workflowRunId: null,
      operationIds: [],
    },
    state,
    startedAt: now,
    updatedAt: now,
    completedAt: state === "running" ? null : now,
    failureCode: state === "failed" ? "work.failed" : null,
  };
}

describe("Work/Research room projection", () => {
  it("projects Work quick starts and canonical AgentRun completion", () => {
    const view = projectWorkResearchRoom({
      kind: "work-business",
      items: [
        {
          itemId: "item-1",
          title: "Business proposal",
          summary: "Proposal ready",
          execution: { kind: "agent-run", run: run("completed") },
          progress: 1,
          artifacts: [
            {
              artifactId: "artifact-1",
              label: "Proposal PDF",
              kind: "document",
              uri: "https://files.example.com/proposal.pdf",
            },
          ],
        },
      ],
    });

    expect(view.title).toBe("Work & Business");
    expect(view.quickStarts.some((item) => item.intentId === "work.proposal"))
      .toBe(true);
    expect(view.items[0]?.status).toBe("completed");
    expect(view.items[0]?.artifacts[0]?.uri).toBe(
      "https://files.example.com/proposal.pdf",
    );
  });

  it("maps canonical running AgentRun to working", () => {
    const view = projectWorkResearchRoom({
      kind: "research-answers",
      items: [
        {
          itemId: "research-1",
          title: "Investigate",
          summary: "Searching",
          execution: { kind: "agent-run", run: run("running") },
          progress: 0.4,
          requiresEvidence: false,
        },
      ],
    });

    expect(view.items[0]?.status).toBe("working");
  });

  it("supports queued/waiting only as pending runtime state", () => {
    const queued = projectWorkResearchRoom({
      kind: "work-business",
      items: [
        {
          itemId: "pending-1",
          title: "Queued project",
          summary: "",
          execution: { kind: "pending", status: "queued" },
          progress: 0,
        },
      ],
    });
    const waiting = projectWorkResearchRoom({
      kind: "work-business",
      items: [
        {
          itemId: "pending-2",
          title: "Waiting project",
          summary: "Needs user input",
          execution: { kind: "pending", status: "waiting" },
          progress: 0.2,
        },
      ],
    });

    expect(queued.items[0]?.status).toBe("queued");
    expect(waiting.items[0]?.status).toBe("waiting");
  });

  it("fails closed when evidence-required research has no sources", () => {
    expect(() =>
      projectWorkResearchRoom({
        kind: "research-answers",
        items: [
          {
            itemId: "research-2",
            title: "Latest information",
            summary: "Current answer",
            execution: { kind: "agent-run", run: run("completed") },
            progress: 1,
            requiresEvidence: true,
          },
        ],
      }),
    ).toThrow(
      "Evidence-required Work/Research item cannot be projected without sources",
    );
  });

  it("accepts sourced research and normalizes observedAt", () => {
    const view = projectWorkResearchRoom({
      kind: "research-answers",
      items: [
        {
          itemId: "research-3",
          title: "Compare options",
          summary: "Evidence-backed comparison",
          execution: { kind: "agent-run", run: run("completed") },
          progress: 1,
          requiresEvidence: true,
          evidence: [
            {
              evidenceId: "source-1",
              title: "Primary source",
              sourceUri: "https://example.com/source",
              publisher: "Example",
              observedAt: toInstant(
                new Date("2026-10-06T09:00:00.000Z"),
              ),
            },
          ],
        },
      ],
    });

    expect(view.items[0]?.evidence).toHaveLength(1);
    expect(view.items[0]?.evidence[0]?.sourceUri).toBe(
      "https://example.com/source",
    );
  });

  it("rejects insecure artifact and evidence URLs", () => {
    expect(() =>
      projectWorkResearchRoom({
        kind: "work-business",
        items: [
          {
            itemId: "item-2",
            title: "Report",
            summary: "",
            execution: { kind: "pending", status: "queued" },
            progress: 0,
            artifacts: [
              {
                artifactId: "artifact-2",
                label: "Unsafe",
                kind: "document",
                uri: "http://example.com/file",
              },
            ],
          },
        ],
      }),
    ).toThrow("artifact.uri must be HTTPS");
  });

  it("rejects inconsistent terminal progress", () => {
    expect(() =>
      projectWorkResearchRoom({
        kind: "work-business",
        items: [
          {
            itemId: "item-3",
            title: "Done",
            summary: "",
            execution: { kind: "agent-run", run: run("completed") },
            progress: 0.9,
          },
        ],
      }),
    ).toThrow("Completed Work/Research AgentRun must project progress 1");
  });
});
