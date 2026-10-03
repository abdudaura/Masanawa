import {
  createCanonicalId,
  parseCanonicalId,
} from "@masanawa/contracts";
import type {
  AgentRunRepository,
  CharacterSessionRepository,
} from "@masanawa/agents";
import type {
  AgentConversationAuthorizer,
  AgentConversationService,
  AlphaConversationExecutor,
} from "./agent_conversation_contract.js";

export function createAgentConversationService(input: {
  readonly sessions: CharacterSessionRepository;
  readonly runs: AgentRunRepository;
  readonly authorizer: AgentConversationAuthorizer;
  readonly executor: AlphaConversationExecutor;
  readonly sessionDurationMs: number;
}): AgentConversationService {
  if (
    !Number.isSafeInteger(input.sessionDurationMs) ||
    input.sessionDurationMs < 60_000
  ) {
    throw new RangeError("Alpha session duration must be at least one minute");
  }

  return Object.freeze({
    async open(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });
      if (admission.scope.characterId !== characterId) {
        throw new TypeError("Agent conversation admission Character mismatch");
      }

      const characterSessionId = createCanonicalId("character-session");
      await input.sessions.create({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
        characterVersionId: admission.characterVersionId,
        durationMs: input.sessionDurationMs,
        bindings: admission.bindings,
      });
      return Object.freeze({ characterSessionId });
    },

    async turn(request) {
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      const text = request.text.trim();
      if (text.length < 1 || text.length > 32_000) {
        throw new RangeError("Agent turn text is invalid");
      }

      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId: parseCanonicalId("character", request.characterId),
      });
      const session = await input.sessions.read({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
      });

      const agentRunId = createCanonicalId("agent-run");
      await input.runs.create({
        authority: admission.authority,
        scope: admission.scope,
        agentRunId,
        characterSessionId,
        characterVersionId: session.characterVersionId,
        lineage: {
          parentAgentRunId: null,
          rootAgentRunId: agentRunId,
          depth: 0,
        },
        trace: {
          requestId: request.requestId,
          correlationId: request.correlationId,
          taskId: null,
          workflowRunId: null,
          operationIds: [],
        },
      });

      try {
        const reply = (
          await input.executor.reply({
            characterId: admission.scope.characterId,
            characterVersionId: session.characterVersionId,
            displayName: admission.presentation.displayName,
            roleLabel: admission.presentation.roleLabel,
            about: admission.presentation.about,
            text,
          })
        ).trim();
        if (!reply) throw new Error("empty model reply");

        await input.runs.finish({
          authority: admission.authority,
          scope: admission.scope,
          agentRunId,
          outcome: { state: "completed" },
        });

        return Object.freeze({
          reply,
          agentRunId,
          parts: Object.freeze([]),
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: "alpha.executor_failed",
            },
          })
          .catch(() => undefined);
        throw error;
      }
    },

    async close(request) {
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId: parseCanonicalId("character", request.characterId),
      });
      const session = await input.sessions.read({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
      });
      if (session.state === "closed") return;

      await input.sessions.close({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
        expectedRevision: session.revision,
      });
    },
  });
}
