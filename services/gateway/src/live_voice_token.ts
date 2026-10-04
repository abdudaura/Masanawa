import type { AgentConversationAuthorizer } from "./agent_conversation_contract.js";
import type { LiveVoiceTokenService } from "./agent_shell_contract.js";
import { parseCanonicalId } from "@masanawa/contracts";

export function createGeminiLiveTokenService(input: {
  readonly apiKey: string;
  readonly authorizer: AgentConversationAuthorizer;
  readonly model?: string;
  readonly voiceName?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}): LiveVoiceTokenService {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new TypeError("Gemini API key is required");
  const model = input.model?.trim() || "gemini-3.8-live";
  const voiceName = input.voiceName?.trim() || "Kore";
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async mint(request) {
      const characterId = parseCanonicalId("character", request.characterId);
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        characterId,
      });

      const issued = now();
      const expiresAt = new Date(issued.getTime() + 30 * 60 * 1000);
      const newSessionExpireTime = new Date(issued.getTime() + 60 * 1000);
      const response = await fetchImpl(
        "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
        {
          method: "POST",
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
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("Gemini Live token provisioning failed");
      }
      const payload = await response.json() as { name?: unknown };
      if (typeof payload.name !== "string" || payload.name.length < 16) {
        throw new Error("Gemini Live token provisioning returned no token");
      }
      return Object.freeze({
        token: payload.name,
        websocketUrl:
          "wss://generativelanguage.googleapis.com/ws/" +
          "google.ai.generativelanguage.v1beta.GenerativeService." +
          "BidiGenerateContentConstrained?access_token=" +
          encodeURIComponent(payload.name),
        model,
        voiceName,
        expiresAt: expiresAt.toISOString(),
      });
    },
  });
}
