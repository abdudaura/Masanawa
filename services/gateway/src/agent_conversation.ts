import { observeSessionOpen } from "./agent_session_diagnostics.js";
import { createHash } from "node:crypto";
import {
  PlatformError,
  createCanonicalId,
  parseCanonicalId,
} from "@masanawa/contracts";
import type {
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
import type { AgentBillingAssistant } from "./agent_billing_assistant.js";
import type { AgentTeachingAssistant } from "./agent_teaching_assistant.js";
import type { AgentCryptoAssistant } from "./agent_crypto_assistant.js";

function hashTurnPayload(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}


function assertConversationSessionOpen(session: {
  readonly state: "active" | "closed";
  readonly expiresAt: string;
}): void {
  if (
    session.state !== "active" ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    Date.parse(session.expiresAt) <= Date.now()
  ) {
    throw new PlatformError({
      code: "agents.session_closed",
      category: "conflict",
      message: "The conversation session is closed or expired.",
      retryable: true,
    });
  }
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

export interface TwinConversationObserver {
  opened(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly characterId: string;
    readonly characterSessionId: string;
  }): Promise<void>;
  completed(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly characterId: string;
    readonly referenceId: string;
  }): Promise<void>;
}

export function createAgentConversationService(input: {
  readonly sessions: CharacterSessionRepository;
  readonly runs: AgentRunRepository;
  readonly authorizer: AgentConversationAuthorizer;
  readonly strategy: AgentStrategy;
  readonly nativeAudio?: NativeAudioRenderer;
  readonly mobileShell?: MobileShellRepository;
  readonly twinObserver?: TwinConversationObserver;
  readonly billingAssistant?: AgentBillingAssistant;
  readonly teachingAssistant?: AgentTeachingAssistant;
  readonly cryptoAssistant?: AgentCryptoAssistant;
  readonly sessionDurationMs: number;
}): AgentConversationService {
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

  const service: AgentConversationService = {
    async open(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      const admission = await observeSessionOpen("admission", () => input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      }));
      if (admission.scope.characterId !== characterId) {
        throw new TypeError("Agent conversation admission Character mismatch");
      }

      const characterSessionId = createCanonicalId("character-session");
      await observeSessionOpen("session-create", () => input.sessions.create({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
        characterVersionId: admission.characterVersionId,
        durationMs: input.sessionDurationMs,
        bindings: admission.bindings,
      }));
      await input.twinObserver?.opened({
        tenantId: admission.scope.tenantId,
        userId: admission.scope.userId,
        characterId: admission.scope.characterId,
        characterSessionId,
      }).catch(() => undefined);
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
      assertConversationSessionOpen(session);

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
        const teachingPreparation = await input.teachingAssistant?.prepare({
          scope: admission.scope,
          text,
        });
        const billingDirect = teachingPreparation
          ? null
          : await input.billingAssistant?.beforeInference({
              authorizationHeader: request.authorizationHeader,
              characterId: admission.scope.characterId,
              text,
            });
        const cryptoDirect = teachingPreparation || billingDirect
          ? null
          : await input.cryptoAssistant?.beforeInference({
              authorizationHeader: request.authorizationHeader,
              characterId: admission.scope.characterId,
              scope: admission.scope,
              text,
            });
        const direct = billingDirect ?? cryptoDirect;
        const inferenceText = teachingPreparation?.text ?? text;
        // Raw model deltas may include machine directives. Stream them only
        // when no billing/crypto/teaching post-processing can change the reply.
        const rawTextDelta =
          !input.billingAssistant && !input.cryptoAssistant &&
          !teachingPreparation && !direct ? request.onTextDelta : undefined;
        const generated = direct ?? await input.strategy.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          presentation: admission.presentation,
          surface: request.surface ?? "mobile",
          representation: request.representation ?? "platform-agent",
          ...(request.signal ? { signal: request.signal } : {}),
          // Machine directives are stripped after inference. Do not stream
          // them into the user-visible chat before server consumption.
          ...(rawTextDelta ? { onTextDelta: rawTextDelta } : {}),
          input: Object.freeze({ kind: "text" as const, text: inferenceText }),
        });
        const cryptoResult = direct || teachingPreparation
          ? null
          : await input.cryptoAssistant?.afterInference({
              authorizationHeader: request.authorizationHeader,
              characterId: admission.scope.characterId,
              scope: admission.scope,
              modelReply: generated.reply,
            });
        const result = direct
          ? direct
          : teachingPreparation && input.teachingAssistant
            ? await input.teachingAssistant.finish({
                preparation: teachingPreparation,
                modelReply: generated.reply,
              })
            : cryptoResult ??
              (await input.billingAssistant?.afterInference({
                authorizationHeader: request.authorizationHeader,
                characterId: admission.scope.characterId,
                modelReply: generated.reply,
              })) ??
              generated;
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

        // The existing NDJSON route delivers these deltas immediately.
        // Billing/crypto/teaching turns cannot stream untrusted raw model
        // directives; instead emit only server-settled presentation text.
        // If a processor did not recognize a malformed directive and handed
        // raw markup through, suppress early display rather than exposing it.
        // A disconnected stream must not retroactively fail a durable turn.
        const hasMachineMarkup = /<\\s*\\/?\\s*masanawa_[a-z_]+\\b/iu.test(reply);
        if (request.onTextDelta && !rawTextDelta &&
            !hasMachineMarkup && !request.signal?.aborted) {
          try {
            await request.onTextDelta(reply);
          } catch {
            // Delivery is recoverable from canonical turn history.
          }
        }

        await input.twinObserver?.completed({
          tenantId: admission.scope.tenantId,
          userId: admission.scope.userId,
          characterId: admission.scope.characterId,
          referenceId: request.requestId,
        }).catch(() => undefined);

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
      assertConversationSessionOpen(session);

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
        const generated = await input.strategy.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          presentation: admission.presentation,
          surface: request.surface ?? "mobile",
          representation: request.representation ?? "platform-agent",
          ...(request.signal ? { signal: request.signal } : {}),
          input: Object.freeze({
            kind: "media" as const,
            caption,
            mimeType,
            dataBase64: request.dataBase64,
          }),
        });
        const result =
          (await input.billingAssistant?.afterInference({
            authorizationHeader: request.authorizationHeader,
            characterId: admission.scope.characterId,
            modelReply: generated.reply,
          })) ?? generated;
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

        await input.twinObserver?.completed({
          tenantId: admission.scope.tenantId,
          userId: admission.scope.userId,
          characterId: admission.scope.characterId,
          referenceId: request.requestId,
        }).catch(() => undefined);

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
      assertConversationSessionOpen(session);

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
        const generated = await input.strategy.execute({
          agentRunId,
          characterSessionId,
          characterVersionId: session.characterVersionId,
          skillVersionIds: session.bindings.skillVersionIds,
          presentation: admission.presentation,
          surface: request.surface ?? "mobile",
          representation: request.representation ?? "platform-agent",
          ...(request.signal ? { signal: request.signal } : {}),
          input: Object.freeze({
            kind: "media-set" as const,
            caption,
            media: Object.freeze(media),
          }),
        });
        const result =
          (await input.billingAssistant?.afterInference({
            authorizationHeader: request.authorizationHeader,
            characterId: admission.scope.characterId,
            modelReply: generated.reply,
          })) ?? generated;
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
      assertConversationSessionOpen(session);
      if (session.state === "closed") return;

      await input.sessions.close({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
        expectedRevision: session.revision,
      });
    },
  };
  return Object.freeze(service);
}
