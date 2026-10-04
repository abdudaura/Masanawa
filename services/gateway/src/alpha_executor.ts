import type {
  AgentInferenceProvider,
} from "@masanawa/agents";

interface GeminiResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly {
        readonly text?: string;
        readonly thought?: boolean;
      }[];
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
    async generate(request, controls) {
      const mediaPart = (
        mimeType: string,
        dataBase64: string,
        name?: string,
      ) => {
        if (mimeType === "text/plain") {
          const decoded = Buffer.from(dataBase64, "base64").toString("utf8");
          if (!decoded.trim() || decoded.length > 128_000) {
            throw new TypeError("Invalid text attachment");
          }
          return { text: name ? `${name}:\n${decoded}` : decoded };
        }
        return {
          inline_data: {
            mime_type: mimeType,
            data: dataBase64,
          },
        };
      };

      const userParts =
        request.input.kind === "text"
          ? [{ text: request.input.text }]
          : request.input.kind === "media-set"
          ? [
              {
                text:
                  request.input.caption ||
                  `Review these ${request.input.media.length} attachments together and respond helpfully.`,
              },
              ...request.input.media.map((item) =>
                mediaPart(item.mimeType, item.dataBase64, item.name),
              ),
            ]
          : [
              ...(request.input.caption
                ? [{ text: request.input.caption }]
                : [{
                    text:
                      request.input.mimeType.startsWith("audio/")
                        ? "Listen to this voice note and respond to what the user said."
                        : "Review this attachment and respond helpfully.",
                  }]),
              mediaPart(request.input.mimeType, request.input.dataBase64),
            ];

      const streaming = controls?.onTextDelta != null;
      const endpoint = streaming
        ? "streamGenerateContent?alt=sse"
        : "generateContent";
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${endpoint}?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          ...(controls?.signal ? { signal: controls.signal } : {}),
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: request.systemInstructions.map((text) => ({ text })),
            },
            contents: [{ role: "user", parts: userParts }],
            generationConfig: {
              maxOutputTokens: controls?.maxOutputTokens ?? 2048,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Alpha model request failed with ${response.status}`);
      }

      if (!streaming) {
        const payload = (await response.json()) as GeminiResponse;
        const text = payload.candidates?.[0]?.content?.parts
          ?.filter((part) => part.thought !== true)
          .map((part) => part.text ?? "")
          .join("")
          .trim();
        if (!text) throw new Error("Alpha model returned no text");
        return Object.freeze({ text });
      }

      if (!response.body) throw new Error("Alpha model stream returned no body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let assembled = "";

      const acceptLine = async (line: string) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        const json = trimmed.slice(5).trim();
        if (!json || json === "[DONE]") return;
        const payload = JSON.parse(json) as GeminiResponse;
        const delta = payload.candidates?.[0]?.content?.parts
          ?.filter((part) => part.thought !== true)
          .map((part) => part.text ?? "")
          .join("") ?? "";
        if (!delta) return;
        assembled += delta;
        if (assembled.length > 128_000) {
          throw new Error("Alpha model stream too large");
        }
        await controls!.onTextDelta!(delta);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline = pending.indexOf("\n");
        while (newline >= 0) {
          await acceptLine(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
          newline = pending.indexOf("\n");
        }
      }
      pending += decoder.decode();
      if (pending.trim()) await acceptLine(pending);
      const text = assembled.trim();
      if (!text) throw new Error("Alpha model returned no text");
      return Object.freeze({ text });
    },
  });
}
