import { createHash } from "node:crypto";
import {
  PlatformError,
  createCanonicalId,
  parseCanonicalId,
} from "@masanawa/contracts";
import { createStrategyAgentHarness } from "@masanawa/agents";
import type {
  AgentHarness,
  AgentRunRepository,
  AgentStrategy,
  CharacterSessionRepository,
  MobileShellRepository,
  MobileTurnCommand,
} from "@masanawa/agents";
import type {
  AgentConversationAuthorizer,
  AgentConversationService,
} from "./agent_conversation_contract.js";
import type { NativeAudioRenderer } from "./native_audio.js";
import { createAgentHarnessProgressReporter } from "./agent_harness_progress.js";

function hashTurnPayload(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function replayTurn(command: MobileTurnCommand) {
  if (
    command.state === "completed" &&
    command.reply !== null &&
    command.agentRunId !== null
  ) {
    return Object.freeze({
      reply: command.reply,
      agentRunId: command.agentRunId,
      parts: command.parts,
    });
  }
  if (command.state === "failed") {
    throw new PlatformError({
      code: command.failureCode || "agents.turn_failed",
      category: "conflict",
      message: "The original agent turn failed. Send a new request to try again.",
      retryable: false,
    });
  }
  throw new PlatformError({
    code: "agents.turn_pending",
    category: "conflict",
    message: "The original agent turn is still running or requires reconciliation.",
    retryable: true,
  });
}

export function createAgentConversationService(input: {
  readonly sessions: CharacterSessionRepository;
  readonly runs: AgentRunRepository;
  readonly authorizer: AgentConversationAuthorizer;
  readonly strategy: AgentStrategy;
  readonly harness?: AgentHarness;
  readonly nativeAudio?: NativeAudioRenderer;
  readonly mobileShell?: MobileShellRepository;
  readonly sessionDurationMs: number;
}): AgentConversationService {
  const harness = input.harness ?? createStrategyAgentHarness(input.strategy);

  if (
    !Number.isSafeInteger(input.sessionDurationMs) ||
    input.sessionDurationMs < 60_000
  ) {
    throw new RangeError("Alpha session duration must be at least one minute");
  }

  async function renderAudio(
    reply: string,
    signal?: AbortSignal,
    onAudioPcmChunk?: (dataBase64: string) => void | Promise<void>,
  ) {
    if (!input.nativeAudio || signal?.aborted) return undefined;
    return input.nativeAudio
      .render(
        reply,
        signal,
        onAudioPcmChunk
          ? async (chunk) => onAudioPcmChunk(chunk.toString("base64"))
          : undefined,
      )
      .catch(() => undefined);
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

      if (input.mobileShell) {
        const claim = await input.mobileShell.claimTurn({
          scope: admission.scope,
          characterSessionId,
          requestId: request.requestId,
          kind: "text",
          userText: text,
          payloadHash: hashTurnPayload(text),
        });
        if (claim.state === "existing") return replayTurn(claim.command);
        await input.mobileShell.appendEvent({
          scope: admission.scope,
          characterSessionId,
          type: "turn.started",
          payload: { requestId: request.requestId, kind: "text" },
        });
      }

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
        const result = await harness.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          taskId: null,
          workflowRunId: null,
          ...(input.mobileShell
            ? {
                onProgress: createAgentHarnessProgressReporter({
                  repository: input.mobileShell,
                  scope: admission.scope,
                  characterSessionId,
                }),
              }
            : {}),
          presentation: admission.presentation,
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.onTextDelta
            ? { onTextDelta: request.onTextDelta }
            : {}),
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

        if (input.mobileShell) {
          await input.mobileShell.completeTurn({
            scope: admission.scope,
            requestId: request.requestId,
            agentRunId,
            reply,
            parts: result.parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...result.parts],
            },
          });
        }

        const audio = await renderAudio(
          reply,
          request.signal,
          request.onAudioPcmChunk,
        );
        return Object.freeze({
          reply,
          agentRunId,
          parts: result.parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: "alpha.strategy_failed",
            },
          })
          .catch(() => undefined);
        if (input.mobileShell) {
          await input.mobileShell
            .failTurn({
              scope: admission.scope,
              requestId: request.requestId,
              agentRunId,
              failureCode: "alpha.strategy_failed",
            })
            .catch(() => undefined);
          await input.mobileShell
            .appendEvent({
              scope: admission.scope,
              characterSessionId,
              type: "turn.failed",
              payload: {
                requestId: request.requestId,
                agentRunId,
                failureCode: "alpha.strategy_failed",
              },
            })
            .catch(() => undefined);
        }
        throw error;
      }
    },

    async mediaTurn(request) {
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

      if (input.mobileShell) {
        const claim = await input.mobileShell.claimTurn({
          scope: admission.scope,
          characterSessionId,
          requestId: request.requestId,
          kind: "media",
          userText: caption,
          payloadHash: hashTurnPayload(
            JSON.stringify([mimeType, caption, request.dataBase64]),
          ),
        });
        if (claim.state === "existing") return replayTurn(claim.command);
        await input.mobileShell.appendEvent({
          scope: admission.scope,
          characterSessionId,
          type: "turn.started",
          payload: { requestId: request.requestId, kind: "media" },
        });
      }

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
        const result = await harness.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          taskId: null,
          workflowRunId: null,
          ...(input.mobileShell
            ? {
                onProgress: createAgentHarnessProgressReporter({
                  repository: input.mobileShell,
                  scope: admission.scope,
                  characterSessionId,
                }),
              }
            : {}),
          presentation: admission.presentation,
          ...(request.signal ? { signal: request.signal } : {}),
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

        if (input.mobileShell) {
          await input.mobileShell.completeTurn({
            scope: admission.scope,
            requestId: request.requestId,
            agentRunId,
            reply,
            parts: result.parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...result.parts],
            },
          });
        }

        const audio = await renderAudio(reply, request.signal);
        return Object.freeze({
          reply,
          agentRunId,
          parts: result.parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: "alpha.media_strategy_failed",
            },
          })
          .catch(() => undefined);
        if (input.mobileShell) {
          await input.mobileShell
            .failTurn({
              scope: admission.scope,
              requestId: request.requestId,
              agentRunId,
              failureCode: "alpha.media_strategy_failed",
            })
            .catch(() => undefined);
        }
        throw error;
      }
    },

    async mediaSetTurn(request) {
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      const characterId = parseCanonicalId("character", request.characterId);
      const caption = request.caption.trim();
      if (
        !Array.isArray(request.media) ||
        request.media.length < 2 ||
        request.media.length > 8
      ) {
        throw new RangeError("Agent media set is invalid");
      }
      let aggregate = 0;
      const media = request.media.map((item) => {
        const mimeType = item.mimeType.trim().toLowerCase();
        aggregate += item.dataBase64.length;
        if (
          aggregate > 16_000_000 ||
          !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(mimeType) ||
          item.dataBase64.length < 1 ||
          item.dataBase64.length > 12_000_000 ||
          (item.name !== undefined && item.name.length > 240)
        ) {
          throw new RangeError("Agent media set is invalid");
        }
        return Object.freeze({
          mimeType,
          dataBase64: item.dataBase64,
          ...(item.name?.trim() ? { name: item.name.trim() } : {}),
        });
      });

      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });
      const session = await input.sessions.read({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
      });

      if (input.mobileShell) {
        const claim = await input.mobileShell.claimTurn({
          scope: admission.scope,
          characterSessionId,
          requestId: request.requestId,
          kind: "media-set",
          userText: caption,
          payloadHash: hashTurnPayload(
            JSON.stringify([
              caption,
              ...media.map((item) => [
                item.mimeType,
                item.name ?? "",
                item.dataBase64,
              ]),
            ]),
          ),
        });
        if (claim.state === "existing") return replayTurn(claim.command);
        await input.mobileShell.appendEvent({
          scope: admission.scope,
          characterSessionId,
          type: "turn.started",
          payload: { requestId: request.requestId, kind: "media-set" },
        });
      }

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
        const result = await harness.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          taskId: null,
          workflowRunId: null,
          ...(input.mobileShell
            ? {
                onProgress: createAgentHarnessProgressReporter({
                  repository: input.mobileShell,
                  scope: admission.scope,
                  characterSessionId,
                }),
              }
            : {}),
          presentation: admission.presentation,
          ...(request.signal ? { signal: request.signal } : {}),
          input: Object.freeze({
            kind: "media-set" as const,
            caption,
            media: Object.freeze(media),
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
        if (input.mobileShell) {
          await input.mobileShell.completeTurn({
            scope: admission.scope,
            requestId: request.requestId,
            agentRunId,
            reply,
            parts: result.parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...result.parts],
            },
          });
        }

        const audio = await renderAudio(reply, request.signal);
        return Object.freeze({
          reply,
          agentRunId,
          parts: result.parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        await input.runs
          .finish({
            authority: admission.authority,
            scope: admission.scope,
            agentRunId,
            outcome: {
              state: "failed",
              failureCode: "alpha.media_set_strategy_failed",
            },
          })
          .catch(() => undefined);
        if (input.mobileShell) {
          await input.mobileShell
            .failTurn({
              scope: admission.scope,
              requestId: request.requestId,
              agentRunId,
              failureCode: "alpha.media_set_strategy_failed",
            })
            .catch(() => undefined);
        }
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
