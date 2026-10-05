import { createHash } from "node:crypto";
import {
  PlatformError,
  parseCanonicalId,
} from "@masanawa/contracts";
import type {
  CharacterSessionRepository,
  MobileShellRepository,
  MobileAgentActivityRepository,
} from "@masanawa/agents";
import type {
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import type {
  AgentShellActionExecutor,
  AgentShellService,
} from "./agent_shell_contract.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableValues(values: Readonly<Record<string, string>>): string {
  const entries = Object.entries(values).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function unsupportedAction(): PlatformError {
  return new PlatformError({
    code: "agents.shell_action_unavailable",
    category: "not-found",
    message: "This action is not available in the current runtime.",
    retryable: false,
  });
}

export function createAgentShellService(input: {
  readonly authorizer: AgentConversationAuthorizer;
  readonly sessions: CharacterSessionRepository;
  readonly repository: MobileShellRepository;
  readonly actionExecutor?: AgentShellActionExecutor;
  readonly activity?: MobileAgentActivityRepository;
  readonly minimumAppVersion?: string;
  readonly recommendedAppVersion?: string;
}): AgentShellService {
  const minimumAppVersion = input.minimumAppVersion ?? "1.0.0";
  const recommendedAppVersion = input.recommendedAppVersion ?? minimumAppVersion;

  async function admission(authorizationHeader: string | undefined, characterIdRaw: string) {
    const characterId = parseCanonicalId("character", characterIdRaw);
    const admitted = await input.authorizer.authorize({
      authorizationHeader,
      characterId,
    });
    if (admitted.scope.characterId !== characterId) {
      throw new TypeError("Agent shell admission Character mismatch");
    }
    return admitted;
  }

  const service: AgentShellService = {
    async config(request) {
      await admission(request.authorizationHeader, request.characterId);
      const capabilities = request.capabilities;
      const shellVersion = capabilities?.version;
      const primitives = capabilities?.primitives;
      const shellDocuments =
        shellVersion === 1 &&
        Array.isArray(primitives) &&
        ["text","heading","column","options","card","input","button","divider","metric","detail","progress","notice"]
          .every((item) => primitives.includes(item));
      return Object.freeze({
        shellVersion: 1,
        minimumAppVersion,
        recommendedAppVersion,
        features: Object.freeze({
          shellDocuments,
          shellActions: shellDocuments,
          liveRevisions: shellDocuments,
          history: true,
          durableTurnRecovery: true,
          eventStream: true,
          notifications: true,
          deepLinks: true,
          liveVoice: true,
          remoteFlags: true,
        }),
      });
    },

    async history(request) {
      const admitted = await admission(request.authorizationHeader, request.characterId);
      return input.repository.listHistory({
        scope: admitted.scope,
        limit: request.limit,
        ...(request.before ? { before: request.before } : {}),
      });
    },

    async turnStatus(request) {
      const admitted = await admission(request.authorizationHeader, request.characterId);
      const turn = await input.repository.readTurn({
        scope: admitted.scope,
        requestId: request.requestId,
      });
      if (!turn) return Object.freeze({ state: "missing" as const });
      if (turn.state === "pending") return Object.freeze({ state: "pending" as const });
      if (turn.state === "failed") {
        return Object.freeze({
          state: "failed" as const,
          ...(turn.failureCode ? { failureCode: turn.failureCode } : {}),
          ...(turn.agentRunId ? { agentRunId: turn.agentRunId } : {}),
        });
      }
      return Object.freeze({
        state: "completed" as const,
        reply: turn.reply ?? "",
        parts: turn.parts,
        ...(turn.agentRunId ? { agentRunId: turn.agentRunId } : {}),
      });
    },

    async events(request) {
      const admitted = await admission(request.authorizationHeader, request.characterId);
      return input.repository.listEvents({
        scope: admitted.scope,
        ...(request.after ? { after: request.after } : {}),
        limit: request.limit,
      });
    },

    async dispatchAction(request) {
      const admitted = await admission(request.authorizationHeader, request.characterId);
      const session = await input.sessions.read({
        authority: admitted.authority,
        scope: admitted.scope,
        characterSessionId: request.characterSessionId,
      });
      if (session.state !== "active") {
        throw new PlatformError({
          code: "agents.session_closed",
          category: "conflict",
          message: "The conversation session is closed.",
          retryable: false,
        });
      }

      if (!input.actionExecutor) throw unsupportedAction();

      const valuesHash = sha256(stableValues(request.action.values));
      const tokenHash = sha256(request.action.token);
      const claimed = await input.repository.claimAction({
        scope: admitted.scope,
        characterSessionId: request.characterSessionId,
        documentId: request.action.documentId,
        revision: request.action.revision,
        tokenHash,
        actionId: request.action.actionId,
        nodeId: request.action.nodeId,
        valuesHash,
      });

      if (!claimed.created) {
        if (claimed.record.state === "accepted") {
          return Object.freeze({ record: claimed.record });
        }
        if (claimed.record.state === "failed") {
          return Object.freeze({ record: claimed.record });
        }
        throw new PlatformError({
          code: "agents.shell_action_pending",
          category: "conflict",
          message: "The original action outcome is still being reconciled.",
          retryable: false,
        });
      }

      let execution;
      try {
        execution = await input.actionExecutor.execute({
          admission: admitted,
          session,
          action: request.action,
        });
      } catch {
        // Leave pending. A side effect may have happened; callers must reconcile.
        throw new PlatformError({
          code: "agents.shell_action_outcome_unknown",
          category: "unavailable",
          message: "The action outcome is not yet known.",
          retryable: true,
        });
      }

      const settled = await input.repository.settleAction({
        scope: admitted.scope,
        documentId: request.action.documentId,
        revision: request.action.revision,
        state: execution.accepted ? "accepted" : "failed",
        result: {
          accepted: execution.accepted,
          phase: execution.phase,
          ...(execution.document !== undefined ? { document: execution.document } : {}),
          ...(execution.parts ? { parts: [...execution.parts] } : {}),
          ...(execution.message ? { message: execution.message } : {}),
        },
      });

      await input.repository.appendEvent({
        scope: admitted.scope,
        characterSessionId: request.characterSessionId,
        type: "shell.action.updated",
        payload: {
          documentId: request.action.documentId,
          revision: request.action.revision,
          state: settled.state,
          result: settled.result,
        },
      });

      return Object.freeze({ record: settled, execution });
    },

    async setPresence(request) {
      const admitted = await admission(
        request.authorizationHeader,
        request.characterId,
      );
      if (!input.activity) {
        return Object.freeze({ updated: true as const });
      }
      await input.activity.setPresence({
        scope: admitted.scope,
        state: request.state,
        durationMs: request.durationMs,
      });
      await input.repository.appendEvent({
        scope: admitted.scope,
        characterSessionId: null,
        type: "presence.updated",
        payload: {
          state: request.state,
          active: request.state !== "available",
        },
      });
      return Object.freeze({ updated: true as const });
    },

    async actionStatus(request) {
      const admitted = await admission(request.authorizationHeader, request.characterId);
      return input.repository.readAction({
        scope: admitted.scope,
        documentId: request.documentId,
        revision: request.revision,
      });
    },
  };
  return Object.freeze(service);
}
