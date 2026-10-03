import type { AlphaConversationExecutor } from "./agent_conversation_contract.js";

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
    };
  }[];
}

export function createGeminiAlphaExecutor(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly fetchImpl?: typeof fetch;
}): AlphaConversationExecutor {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!apiKey) throw new TypeError("Alpha Gemini API key is required");
  if (!model) throw new TypeError("Alpha Gemini model is required");
  const fetchImpl = input.fetchImpl ?? fetch;

  const systemText = (request: {
    readonly displayName: string;
    readonly roleLabel: string;
    readonly about: string;
  }) =>
    `You are ${request.displayName}, a Masanawa development Character. ` +
    `Your current user-facing role is "${request.roleLabel}". ` +
    (request.about ? `About you: ${request.about}. ` : "") +
    "Be concise, helpful, and transparent. This Alpha executor is temporary; " +
    "do not claim tools, files, calls, memory, or live data unless the user message itself provides them.";

  return Object.freeze({
    async reply(request) {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: systemText(request),
                },
              ],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: request.text }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Alpha model request failed with ${response.status}`);
      }
      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Alpha model returned no text");
      return text;
    },

    async replyMedia(request) {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemText(request) }],
            },
            contents: [
              {
                role: "user",
                parts: [
                  ...(request.caption
                    ? [{ text: request.caption }]
                    : [{
                        text:
                          request.mimeType.startsWith("audio/")
                            ? "Listen to this voice note and respond to what the user said."
                            : "Review this attachment and respond helpfully.",
                      }]),
                  {
                    inline_data: {
                      mime_type: request.mimeType,
                      data: request.dataBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Alpha media model request failed with ${response.status}`);
      }
      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Alpha media model returned no text");
      return text;
    },
  });
}
