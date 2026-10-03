import type {
  AgentInferenceProvider,
} from "@masanawa/agents";
import {
  AgentInferenceError,
  snapshotAgentInferenceRequest,
} from "@masanawa/agents";

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string; readonly thought?: boolean }[];
    };
  }[];
}

export function createGeminiAlphaInferenceProvider(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl?: typeof fetch;
}): AgentInferenceProvider {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!apiKey) throw new TypeError("Alpha Gemini API key is required");
  if (!model) throw new TypeError("Alpha Gemini model is required");
  const fetchImpl = input.fetchImpl ?? fetch;

  return Object.freeze({
    async generate(
      incoming: Parameters<AgentInferenceProvider["generate"]>[0],
    ) {
      const request = snapshotAgentInferenceRequest(incoming);
      const userParts =
        request.input.kind === "text"
          ? [{ text: request.input.text }]
          : [
              ...(request.input.caption
                ? [{ text: request.input.caption }]
                : [{
                    text:
                      request.input.mimeType.startsWith("audio/")
                        ? "Listen to this voice note and respond to what the user said."
                        : "Review this attachment and respond helpfully.",
                  }]),
              {
                inline_data: {
                  mime_type: request.input.mimeType,
                  data: request.input.dataBase64,
                },
              },
            ];

      let response: Response;
      try {
        response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: {
              parts: request.systemInstructions.map((text) => ({ text })),
            },
            contents: [
              {
                role: "user",
                parts: userParts,
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          }),
        },
        );
      } catch {
        throw new AgentInferenceError("inference.unavailable");
      }

      if (!response.ok) {
        throw new AgentInferenceError(
          response.status === 429 ? "inference.rate_limited" :
          response.status >= 500 || response.status === 408 ? "inference.unavailable" :
          "inference.rejected",
        );
      }
      let text: string;
      try {
        const payload = (await response.json()) as GeminiResponse;
        const parts = payload.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) throw new TypeError("Invalid response");
        text = parts
          .filter((part) => part && part.thought !== true)
          .map((part) => {
            if (part.text !== undefined && typeof part.text !== "string") {
              throw new TypeError("Invalid response");
            }
            return part.text ?? "";
          })
          .join("")
          .trim();
        if (!text || text.length > 128_000) throw new TypeError("Invalid response");
      } catch {
        throw new AgentInferenceError("inference.invalid_response");
      }
      return Object.freeze({ text });
    },
  });
}
