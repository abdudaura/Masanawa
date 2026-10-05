import { describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant, type CharacterSessionId } from "@masanawa/contracts";
import type {
  AgentHarnessProgress,
  MobileShellEvent,
  MobileShellRepository,
  MobileShellScope,
} from "@masanawa/agents";
import { createAgentHarnessProgressReporter } from "./agent_harness_progress.js";

describe("agent harness progress projection", () => {
  it("uses Task identity for durable Work and emits a renderable work part", async () => {
    const events: MobileShellEvent[] = [];
    const scope: MobileShellScope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const repository = {
      async appendEvent(input: {
        scope: MobileShellScope;
        characterSessionId: CharacterSessionId | null;
        type: string;
        payload: Readonly<Record<string, unknown>>;
      }) {
        const event: MobileShellEvent = {
          cursor: String(events.length + 1),
          type: input.type,
          payload: input.payload,
          createdAt: nowInstant(),
        };
        events.push(event);
        return event;
      },
    } as unknown as MobileShellRepository;

    const taskId = createCanonicalId("task");
    const progress: AgentHarnessProgress = {
      phase: "working",
      message: "Comparing available plans…",
      agentRunId: createCanonicalId("agent-run"),
      taskId,
      workflowRunId: createCanonicalId("workflow-run"),
    };

    const report = createAgentHarnessProgressReporter({
      repository,
      scope,
      characterSessionId: createCanonicalId("character-session"),
    });
    await report(progress);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("work.updated");
    expect(events[0]?.payload.referenceId).toBe(taskId);
    expect(events[0]?.payload.part).toEqual({
      kind: "work",
      title: "Work",
      body: "Comparing available plans…",
      status: "Working",
      referenceId: taskId,
    });
  });

  it("falls back to WorkflowRun then AgentRun identity", async () => {
    const references: string[] = [];
    const scope: MobileShellScope = {
      tenantId: createCanonicalId("tenant"),
      userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"),
      relationshipId: createCanonicalId("relationship"),
    };
    const repository = {
      async appendEvent(input: {
        payload: Readonly<Record<string, unknown>>;
      }) {
        references.push(String(input.payload.referenceId));
        return {
          cursor: String(references.length),
          type: "work.updated",
          payload: input.payload,
          createdAt: nowInstant(),
        };
      },
    } as unknown as MobileShellRepository;
    const report = createAgentHarnessProgressReporter({
      repository,
      scope,
      characterSessionId: createCanonicalId("character-session"),
    });

    const workflowRunId = createCanonicalId("workflow-run");
    await report({
      phase: "waiting_external",
      message: "Waiting for provider confirmation.",
      agentRunId: createCanonicalId("agent-run"),
      taskId: null,
      workflowRunId,
    });
    const agentRunId = createCanonicalId("agent-run");
    await report({
      phase: "completed",
      message: "Done.",
      agentRunId,
      taskId: null,
      workflowRunId: null,
    });

    expect(references).toEqual([workflowRunId, agentRunId]);
  });
});
