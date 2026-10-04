import type {
  AgentInferenceProvider,
} from "@masanawa/agents";

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
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
      request: Parameters<AgentInferenceProvider["generate"]>[0],
    ) {
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

      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
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
      return Object.freeze({ text });
    },
  });
}
