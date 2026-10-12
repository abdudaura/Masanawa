import type { AgentConversationAuthorizer } from "./agent_conversation_contract.js";
import type { PlatformAgentProfileRepository } from "@masanawa/agents";
import type { LiveVoiceTokenService } from "./agent_shell_contract.js";
import { parseCanonicalId } from "@masanawa/contracts";
import {
  CallHistoryError,
  type CallHistoryRecorder,
} from "./call_history/service.js";

export function createGeminiLiveTokenService(input: {
  readonly apiKey: string;
  readonly authorizer: AgentConversationAuthorizer;
  readonly platformProfiles?: PlatformAgentProfileRepository;
  readonly model?: string;
  readonly voiceName?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly callHistory?: CallHistoryRecorder;
  readonly paidVoiceAdmission?: {
    validate(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly userId: import("@masanawa/contracts").UserId;
      readonly characterId: import("@masanawa/contracts").CharacterId;
      readonly admissionId: string | null;
    }): Promise<void>;
    tokenIssued(input: {
      readonly tenantId: import("@masanawa/contracts").TenantId;
      readonly userId: import("@masanawa/contracts").UserId;
      readonly characterId: import("@masanawa/contracts").CharacterId;
      readonly admissionId: string | null;
    }): Promise<void>;
  };
}): LiveVoiceTokenService {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new TypeError("Gemini API key is required");
  const model = input.model?.trim() || "gemini-3.8-live";
  const voiceName = input.voiceName?.trim() || "Kore";
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  async function observe<T>(
    stage: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string" &&
        [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "AUTH_UNAVAILABLE",
          "authority.policy_unavailable",
          "authority.stale_policy",
          "authority.revoked",
        ].includes(error.code)
          ? error.code
          : "unknown";
      console.error(
        JSON.stringify({ event: "agent.live_token_failed", stage, code }),
      );
      throw error;
    }
  }
  const service: LiveVoiceTokenService = {
    async mint(request) {
      // Incoming calls may never fall back to a token service without canonical
      // per-Masana paid/trial admission, including alpha/partial configuration.
      if (request.historyCallId && !input.paidVoiceAdmission) {
        throw new CallHistoryError("calls.paid_admission_unavailable", 403);
      }
      const characterId = parseCanonicalId("character", request.characterId);
      const admission = await observe("admission", () =>
        input.authorizer.authorize({
          authorizationHeader: request.authorizationHeader,
          characterId,
        }),
      );
      await observe("paid-voice-admission", async () =>
        input.paidVoiceAdmission?.validate({
          tenantId: admission.scope.tenantId,
          userId: admission.scope.userId,
          characterId,
          admissionId: request.admissionId ?? null,
        }),
      );
      const profile = input.platformProfiles
        ? await input.platformProfiles.readForCharacter({
            tenantId: admission.scope.tenantId,
            characterId,
          })
        : null;
      const selectedVoiceName =
        profile?.voiceProvider.toLowerCase() === "gemini" &&
        profile.voiceName.trim()
          ? profile.voiceName.trim()
          : voiceName;
      if (input.callHistory && !profile) {
        throw new CallHistoryError("calls.masana_unavailable", 403);
      }
      const twinSetup = request.purpose === "twin-setup";
      if (twinSetup && profile && !profile.supportAgent) {
        throw new TypeError("Twin setup live voice requires a support agent");
      }

      const issued = now();
      const expiresAt = new Date(issued.getTime() + 30 * 60 * 1000);
      const newSessionExpireTime = new Date(issued.getTime() + 60 * 1000);
      let issuanceStarted = false;
      let awaitingProviderResponse = true;
      try {
        const response = await fetchImpl(
          "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
          {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
            headers: {
              "x-goog-api-key": apiKey,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              uses: 1,
              expireTime: expiresAt.toISOString(),
              newSessionExpireTime: newSessionExpireTime.toISOString(),
              liveConnectConstraints: {
                model: "models/" + model,
                config: {
                  sessionResumption: {},
                  responseModalities: ["AUDIO"],
                  outputAudioTranscription: {},
                  ...(twinSetup ? { inputAudioTranscription: {} } : {}),
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: selectedVoiceName },
                    },
                  },
                },
              },
            }),
          },
        );
        awaitingProviderResponse = false;
        issuanceStarted = response.ok;
        if (!response.ok) {
          console.error(
            JSON.stringify({
              event: "agent.live_token_failed",
              stage: "provider",
              status: response.status,
            }),
          );
          throw new Error("Gemini Live token provisioning failed");
        }
        const payload = (await response.json()) as { name?: unknown };
        if (typeof payload.name !== "string" || payload.name.length < 16) {
          console.error(
            JSON.stringify({
              event: "agent.live_token_failed",
              stage: "provider-response",
              status: response.status,
            }),
          );
          throw new Error("Gemini Live token provisioning returned no token");
        }
        await observe("token-issued", async () =>
          input.paidVoiceAdmission?.tokenIssued({
            tenantId: admission.scope.tenantId,
            userId: admission.scope.userId,
            characterId,
            admissionId: request.admissionId ?? null,
          }),
        );
        if (request.historyCallId && !input.callHistory?.attachIssued)
          throw new CallHistoryError("calls.incoming_unavailable", 409);
        const callId = input.callHistory
          ? request.historyCallId
            ? await input.callHistory.attachIssued!({
                tenantId: admission.scope.tenantId,
                userId: admission.scope.userId,
                characterId,
                callId: request.historyCallId,
                expiresAt: expiresAt.toISOString(),
              })
            : await input.callHistory.recordIssued({
                tenantId: admission.scope.tenantId,
                userId: admission.scope.userId,
                characterId,
                expiresAt: expiresAt.toISOString(),
              })
          : undefined;
        return Object.freeze({
          ...(callId ? { callId } : {}),
          token: payload.name,
          websocketUrl:
            "wss://generativelanguage.googleapis.com/ws/" +
            "google.ai.generativelanguage.v1beta.GenerativeService." +
            "BidiGenerateContentConstrained?access_token=" +
            encodeURIComponent(payload.name),
          model,
          voiceName: selectedVoiceName,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error) {
        if (
          request.historyCallId &&
          (issuanceStarted || awaitingProviderResponse)
        ) {
          const unknown = new Error(
            "Incoming media issuance outcome is unknown",
            { cause: error },
          );
          Object.assign(unknown, { issuanceUnknown: true });
          throw unknown;
        }
        throw error;
      }
    },
  };
  return Object.freeze(service);
}
