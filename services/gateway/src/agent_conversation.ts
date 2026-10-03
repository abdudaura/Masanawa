import {
  createCanonicalId,
  parseCanonicalId,
} from "@masanawa/contracts";
import type {
  AgentRunRepository,
  CharacterContextCompiler,
  AgentStrategy,
  CharacterSessionRepository,
} from "@masanawa/agents";
import { AgentInferenceError } from "@masanawa/agents";
import type {
  AgentConversationAuthorizer,
  AgentConversationService,
} from "./agent_conversation_contract.js";

export function createAgentConversationService(input: {
  readonly sessions: CharacterSessionRepository;
  readonly runs: AgentRunRepository;
  readonly authorizer: AgentConversationAuthorizer;
  readonly strategy: AgentStrategy;
  readonly contextCompiler?: CharacterContextCompiler;
  readonly sessionDurationMs: number;
}): AgentConversationService {
  if (
    !Number.isSafeInteger(input.sessionDurationMs) ||
    input.sessionDurationMs < 60_000
  ) {
    throw new RangeError("Alpha session duration must be at least one minute");
  }

  return Object.freeze({
    async open(
      request: Parameters<AgentConversationService["open"]>[0],
    ) {
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

    async turn(
      request: Parameters<AgentConversationService["turn"]>[0],
    ) {
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
      const run = await input.runs.create({
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
        const context = await input.contextCompiler?.compile({ authority: admission.authority, session, run,
          recallQuery: text.slice(0, 2000) });
        const result = await input.strategy.execute({
          ...(context ? { context } : {}),
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          presentation: admission.presentation,
          input: Object.freeze({ kind: "text" as const, text }),
        });
        const reply = result.reply.trim();
        if (!reply) throw new Error("empty strategy reply");

        await input.runs.finish({
          authority: admission.authority,
          scope: admission.scope,
          agentRunId,
          outcome: { state: "completed" },
        });

        return Object.freeze({
          reply,
          agentRunId,
          parts: result.parts,
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: error instanceof AgentInferenceError
                ? error.code : "alpha.strategy_failed",
            },
          })
          .catch(() => undefined);
        throw error;
      }
    },

    async mediaTurn(
      request: Parameters<AgentConversationService["mediaTurn"]>[0],
    ) {
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      const characterId = parseCanonicalId("character", request.characterId);
      const caption = request.caption.trim();
      const mimeType = request.mimeType.trim().toLowerCase();
      if (
        !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(mimeType) ||
        request.dataBase64.length < 1 ||
        request.dataBase64.length > 12_000_000
      ) {
        throw new RangeError("Agent media turn is invalid");
      }

      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });
      const session = await input.sessions.read({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
      });

      const agentRunId = createCanonicalId("agent-run");
      const run = await input.runs.create({
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
        const context = await input.contextCompiler?.compile({ authority: admission.authority, session, run,
          ...(caption?.trim() ? { recallQuery: caption.slice(0, 2000) } : {}) });
        const result = await input.strategy.execute({
          ...(context ? { context } : {}),
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          presentation: admission.presentation,
          input: Object.freeze({
            kind: "media" as const,
            caption,
            mimeType,
            dataBase64: request.dataBase64,
          }),
        });
        const reply = result.reply.trim();
        if (!reply) throw new Error("empty strategy reply");

        await input.runs.finish({
          authority: admission.authority,
          scope: admission.scope,
          agentRunId,
          outcome: { state: "completed" },
        });

        return Object.freeze({
          reply,
          agentRunId,
          parts: result.parts,
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: error instanceof AgentInferenceError
                ? error.code : "alpha.media_strategy_failed",
            },
          })
          .catch(() => undefined);
        throw error;
      }
    },

    async close(
      request: Parameters<AgentConversationService["close"]>[0],
    ) {
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
