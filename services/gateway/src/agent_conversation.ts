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

const UNCERTAIN_AGENT_RESULT =
  "I couldn't verify that result. Check your recent activity before trying again.";

/**
 * Fail closed for unresolved model directives at every reply/readback surface.
 * This is presentation filtering, not payment execution or retry authority.
 */
function authorizedPresentation(reply: string, parts: readonly unknown[]) {
  const normalized = reply.trim();
  if (!normalized) throw new Error("empty strategy reply");
  const unresolvedDirective = /<\s*\/?\s*masanawa_/iu.test(normalized);
  return Object.freeze({
    reply: unresolvedDirective ? UNCERTAIN_AGENT_RESULT : normalized,
    parts: unresolvedDirective ? ([] as readonly unknown[]) : parts,
    unresolvedDirective,
  });
}

// A stalled streaming client must not hold a canonical agent turn indefinitely.
// Delivery is best-effort; authoritative readback uses the durable turn receipt.
const TEXT_DELTA_ACK_TIMEOUT_MS = 1_500;
async function deliverTextDelta(
  callback: (delta: string) => void | Promise<void>,
  delta: string,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<boolean>([
      Promise.resolve().then(() => callback(delta)).then(() => true, () => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), TEXT_DELTA_ACK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function uncertainSettlement(): PlatformError {
  return new PlatformError({
    code: "agents.turn_settlement_uncertain",
    category: "conflict",
    message: "The operation's final status is uncertain. Check your recent activity before taking any new action.",
    retryable: false,
  });
}

function replayTurn(command: MobileTurnCommand) {
  if (
    command.state === "completed" &&
    command.reply !== null &&
    command.agentRunId !== null
  ) {
    const safe = authorizedPresentation(command.reply, command.parts);
    return Object.freeze({
      reply: safe.reply,
      agentRunId: command.agentRunId,
      parts: safe.parts,
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

/** Request-scoped, content-free stage timings used to calculate real p50/p95. */
export interface AgentTurnTimingRecord {
  readonly event: "agent.turn.latency";
  readonly requestId: string;
  readonly correlationId: string;
  readonly outcome: "completed" | "failed" | "uncertain";
  readonly totalMs: number;
  readonly firstTextMs?: number;
  readonly stagesMs: Readonly<Record<string, number>>;
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
  /** Audio is optional: never hold a completed text turn indefinitely for TTS. */
  readonly audioTimeoutMs?: number;
  /** Optional safe observer; when omitted, emit one structured log per turn. */
  readonly onTurnTiming?: (record: AgentTurnTimingRecord) => void;
}): AgentConversationService {
  if (
    !Number.isSafeInteger(input.sessionDurationMs) ||
    input.sessionDurationMs < 60_000
  ) {
    throw new RangeError("Alpha session duration must be at least one minute");
  }

  const audioTimeoutMs = input.audioTimeoutMs ?? 15_000;
  if (!Number.isSafeInteger(audioTimeoutMs) ||
      audioTimeoutMs < 100 || audioTimeoutMs > 60_000) {
    throw new RangeError("Agent audio deadline must be 100..60000 ms");
  }

  async function renderAudio(
    reply: string,
    signal?: AbortSignal,
    onAudioPcmChunk?: (dataBase64: string) => void | Promise<void>,
  ) {
    if (!input.nativeAudio || signal?.aborted) return undefined;
    // TTS is a best-effort enhancement AFTER durable text completion. A
    // provider that ignores AbortSignal must not hold up NDJSON 'done'.
    const controller = new AbortController();
    let inactive = false;
    let cancel!: () => void;
    const cancellation = new Promise<undefined>((resolve) => {
      cancel = () => resolve(undefined);
    });
    const forwardAbort = () => {
      inactive = true;
      controller.abort();
      cancel();
    };
    signal?.addEventListener("abort", forwardAbort, { once: true });
    if (signal?.aborted) forwardAbort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        inactive = true;
        controller.abort();
        resolve(undefined);
      }, audioTimeoutMs);
    });
    const renderer = input.nativeAudio;
    const task = Promise.resolve().then(() => {
      if (controller.signal.aborted) return undefined;
      return renderer.render(
        reply,
        controller.signal,
        onAudioPcmChunk
          ? async (chunk) => {
              // An abandoned provider must not stream late PCM into the
              // next turn after timeout/disconnect.
              if (!inactive && !controller.signal.aborted) {
                await onAudioPcmChunk(chunk.toString("base64"));
              }
            }
          : undefined,
      );
    }).catch(() => undefined);
    try {
      return await Promise.race([task, deadline, cancellation]);
    } finally {
      inactive = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", forwardAbort);
    }
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
      const turnStarted = performance.now();
      const stagesMs: Record<string, number> = {};
      let firstTextMs: number | undefined;
      const elapsed = (start: number) =>
        Math.max(0, Math.round(performance.now() - start));
      const emitTiming = (outcome: "completed" | "failed" | "uncertain") => {
        const record: AgentTurnTimingRecord = Object.freeze({
          event: "agent.turn.latency",
          requestId: request.requestId,
          correlationId: request.correlationId,
          outcome,
          totalMs: elapsed(turnStarted),
          ...(firstTextMs === undefined ? {} : { firstTextMs }),
          stagesMs: Object.freeze({ ...stagesMs }),
        });
        // No text, tokens, account, tenant, recipient or payment metadata.
        // Metrics failures must not alter operation status.
        try {
          if (input.onTurnTiming) input.onTurnTiming(record);
          else console.info(JSON.stringify(record));
        } catch { /* Diagnostics are best effort. */ }
      };
      const characterSessionId = parseCanonicalId(
        "character-session",
        request.characterSessionId,
      );
      const text = request.text.trim();
      if (text.length < 1 || text.length > 32_000) {
        throw new RangeError("Agent turn text is invalid");
      }

      const authorizationStart = performance.now();
      const admission = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId: parseCanonicalId("character", request.characterId),
      });
      stagesMs.authorization = elapsed(authorizationStart);
      const sessionStart = performance.now();
      const session = await input.sessions.read({
        authority: admission.authority,
        scope: admission.scope,
        characterSessionId,
      });
      stagesMs.sessionRead = elapsed(sessionStart);
      assertConversationSessionOpen(session);

      if (input.mobileShell) {
        const claimStart = performance.now();
        const claim = await input.mobileShell.claimTurn({
          scope: admission.scope,
          characterSessionId,
          requestId: request.requestId,
          kind: "text",
          userText: text,
          payloadHash: hashTurnPayload(text),
        });
        stagesMs.commandClaim = elapsed(claimStart);
        // The command is already in canonical custody. Notify the transport
        // before model/tool execution, without making it part of settlement.
        if (request.onAccepted && !request.signal?.aborted) {
          try {
            void Promise.resolve(request.onAccepted(Object.freeze({
              requestId: request.requestId,
              state: claim.state === "created" ? "pending" : claim.command.state,
            }))).catch(() => undefined);
          } catch { /* A disconnected observer cannot change durable custody. */ }
        }
        if (claim.state === "existing") {
          const replay = replayTurn(claim.command);
          emitTiming("completed");
          return replay;
        }
        await input.mobileShell.appendEvent({
          scope: admission.scope,
          characterSessionId,
          type: "turn.started",
          payload: { requestId: request.requestId, kind: "text" },
        }).catch(() => undefined);
      }

      const agentRunId = createCanonicalId("agent-run");
      const createStart = performance.now();
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
      stagesMs.runCreate = elapsed(createStart);

      let terminalSettlementAttempted = false;
      try {
        const prepStart = performance.now();
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
        stagesMs.preInference = elapsed(prepStart);
        const inferenceText = teachingPreparation?.text ?? text;
        // Raw model deltas may include machine directives. Stream them only
        // when no billing/crypto/teaching post-processing can change the reply.
        // Withhold any possible opening tag and its following bytes until
        // the settled response is vetted; model tokens may split a directive.
        let heldRawSuffix = "";
        let holdingRawSuffix = false;
        let rawCallbackDisconnected = false;
        const rawTextDelta =
          !input.billingAssistant && !input.cryptoAssistant &&
          !teachingPreparation && !direct && request.onTextDelta
            ? async (delta: string) => {
                if (holdingRawSuffix) {
                  heldRawSuffix += delta;
                  return;
                }
                const boundary = delta.indexOf("<");
                if (boundary >= 0) {
                  holdingRawSuffix = true;
                  heldRawSuffix += delta.slice(boundary);
                  delta = delta.slice(0, boundary);
                }
                if (!delta || rawCallbackDisconnected || request.signal?.aborted) return;
                const delivered = await deliverTextDelta(request.onTextDelta!, delta);
                if (delivered) {
                  if (firstTextMs === undefined) firstTextMs = elapsed(turnStarted);
                } else {
                  rawCallbackDisconnected = true;
                }
              }
            : undefined;
        const modelStart = performance.now();
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
        if (!direct) stagesMs.model = elapsed(modelStart);
        const postStart = performance.now();
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
        stagesMs.postInference = elapsed(postStart);
        // Same boundary for durable text, model replay and media replies.
        const { reply, parts, unresolvedDirective } =
          authorizedPresentation(result.reply, result.parts);

        const persistStart = performance.now();
        // A transport/db error during terminal settlement may have committed.
        // Never write a second, contradictory failed terminal state.
        terminalSettlementAttempted = true;
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
            parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...parts],
            },
          }).catch(() => undefined);
        }

        stagesMs.settlement = elapsed(persistStart);
        // The existing NDJSON route delivers these deltas immediately.
        // Billing/crypto/teaching turns cannot stream untrusted raw model
        // directives; instead emit only server-settled presentation text.
        // An interrupted socket cannot retroactively fail a settled run.
        // Release withheld text only after checking the authoritative reply.
        if (request.onTextDelta && !request.signal?.aborted &&
            !rawCallbackDisconnected) {
          const settledDelta = rawTextDelta
            ? (unresolvedDirective ? reply : heldRawSuffix)
            : reply;
          if (settledDelta) {
            const delivered = await deliverTextDelta(request.onTextDelta, settledDelta);
            if (delivered) {
              if (firstTextMs === undefined) firstTextMs = elapsed(turnStarted);
            } else {
              // A slow/disconnected client must recover from canonical history.
              rawCallbackDisconnected = true;
            }
          }
        }

        await input.twinObserver?.completed({
          tenantId: admission.scope.tenantId,
          userId: admission.scope.userId,
          characterId: admission.scope.characterId,
          referenceId: request.requestId,
        }).catch(() => undefined);

        const audioStart = performance.now();
        const audio = await renderAudio(
          reply,
          request.signal,
          request.onAudioPcmChunk,
        );
        stagesMs.audio = elapsed(audioStart);
        emitTiming("completed");
        return Object.freeze({
          reply,
          agentRunId,
          parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        if (terminalSettlementAttempted) {
          emitTiming("uncertain");
          throw uncertainSettlement();
        }
        emitTiming("failed");
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
        }).catch(() => undefined);
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

      let terminalSettlementAttempted = false;
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
        const { reply, parts } =
          authorizedPresentation(result.reply, result.parts);

        // A transport/db error during terminal settlement may have committed.
        // Never write a second, contradictory failed terminal state.
        terminalSettlementAttempted = true;
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
            parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...parts],
            },
          }).catch(() => undefined);
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
          parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        if (terminalSettlementAttempted) throw uncertainSettlement();
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
        }).catch(() => undefined);
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

      let terminalSettlementAttempted = false;
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
        const { reply, parts } =
          authorizedPresentation(result.reply, result.parts);

        // A transport/db error during terminal settlement may have committed.
        // Never write a second, contradictory failed terminal state.
        terminalSettlementAttempted = true;
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
            parts,
          });
          await input.mobileShell.appendEvent({
            scope: admission.scope,
            characterSessionId,
            type: "turn.completed",
            payload: {
              requestId: request.requestId,
              agentRunId,
              reply,
              parts: [...parts],
            },
          }).catch(() => undefined);
        }

        const audio = await renderAudio(reply, request.signal);
        return Object.freeze({
          reply,
          agentRunId,
          parts,
          ...(audio
            ? {
                audioBase64: audio.dataBase64,
                audioMimeType: audio.mimeType,
                audioDurationMs: audio.durationMs,
              }
            : {}),
        });
      } catch (error) {
        if (terminalSettlementAttempted) throw uncertainSettlement();
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
