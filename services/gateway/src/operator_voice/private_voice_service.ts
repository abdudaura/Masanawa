import { parseCanonicalId, PlatformError } from "@masanawa/contracts";
import type { CharacterSessionRepository } from "@masanawa/agents";
import type { AgentConversationAuthorizer } from "../agent_conversation_contract.js";
import type { AgentShellService, LiveVoiceTokenService } from "../agent_shell_contract.js";

export interface PrivateOperatorVoiceService {
  start(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly characterSessionId: string;
    readonly admissionId: string;
  }): ReturnType<LiveVoiceTokenService["mint"]>;
  turnStatus(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly characterSessionId: string;
    readonly requestId: string;
  }): ReturnType<AgentShellService["turnStatus"]>;
}

/**
 * Compose the existing identity/session DB, paid Gemini grant and durable turn
 * readback. This service never creates its own character session or receipt.
 *
 * Gateway's current /agent/live-voice/token already has character-level auth;
 * this separate opt-in U09 route additionally checks the exact live session
 * before minting, preventing late device/persona replay. The caller MUST
 * supply the canonical LiveVoiceTokenService configured with paid admission.
 */
export function createPrivateOperatorVoiceService(input: {
  readonly authorizer: AgentConversationAuthorizer;
  readonly sessions: CharacterSessionRepository;
  readonly tokens: LiveVoiceTokenService;
  readonly shell: AgentShellService;
}): PrivateOperatorVoiceService {
  async function admittedSession(request: {
    authorizationHeader: string | undefined;
    characterId: string;
    characterSessionId: string;
  }) {
    const characterId = parseCanonicalId("character", request.characterId);
    const characterSessionId = parseCanonicalId(
      "character-session", request.characterSessionId,
    );
    const admission = await input.authorizer.authorize({
      authorizationHeader: request.authorizationHeader,
      characterId,
    });
    if (admission.scope.characterId !== characterId) {
      throw new PlatformError({
        code: "agents.voice_scope_mismatch",
        category: "authorization",
        message: "Private voice is not authorized for this agent.",
        retryable: false,
      });
    }
    const session = await input.sessions.read({
      authority: admission.authority,
      scope: admission.scope,
      characterSessionId,
    });
    if (session.state !== "active" ||
        session.tenantId !== admission.scope.tenantId ||
        session.userId !== admission.scope.userId ||
        session.characterId !== characterId ||
        session.relationshipId !== admission.scope.relationshipId ||
        session.characterSessionId !== characterSessionId ||
        !Number.isFinite(Date.parse(session.expiresAt)) ||
        Date.parse(session.expiresAt) <= Date.now()) {
      throw new PlatformError({
        code: "agents.voice_session_closed",
        category: "conflict",
        message: "Open the current private Assistant session before voice.",
        retryable: false,
      });
    }
    return { characterId, characterSessionId };
  }

  return Object.freeze({
    async start(request) {
      if (typeof request.admissionId !== "string" ||
          request.admissionId.trim().length < 8 ||
          request.admissionId.length > 160) {
        throw new TypeError("Current paid/trial voice admission is required");
      }
      const session = await admittedSession(request);
      // Second authority check in canonical token mint and paid-voice service.
      // Never return provider API credentials: only its short-lived grant.
      return input.tokens.mint({
        authorizationHeader: request.authorizationHeader,
        characterId: session.characterId,
        admissionId: request.admissionId,
        purpose: "conversation",
      });
    },

    async turnStatus(request) {
      const session = await admittedSession(request);
      const requestId = parseCanonicalId("request", request.requestId);
      // Authentic persisted readback, not an inference from audio or an LLM.
      return input.shell.turnStatus({
        authorizationHeader: request.authorizationHeader,
        characterId: session.characterId,
        requestId,
      });
    },
  });
}
