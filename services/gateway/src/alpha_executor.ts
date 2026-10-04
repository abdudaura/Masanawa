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

/** Alpha credential selection stays at the inference edge. One request uses one key. */
export function createGeminiAlphaInferencePool(input: {
  readonly apiKeys: readonly string[];
  readonly model: string;
  readonly fetchImpl?: typeof fetch;
}): AgentInferenceProvider {
  if (!Array.isArray(input.apiKeys) || input.apiKeys.length < 1 || input.apiKeys.length > 32) {
    throw new TypeError("Alpha Gemini credential pool must contain 1-32 keys");
  }
  const keys = input.apiKeys.map(key => {
    if (typeof key !== "string" || !key.trim() || key.length > 256 || /\s/u.test(key.trim())) {
      throw new TypeError("Invalid Alpha Gemini credential");
    }
    return key.trim();
  });
  if (new Set(keys).size !== keys.length) throw new TypeError("Duplicate Alpha Gemini credential");
  const providers = keys.map(apiKey => createGeminiAlphaInferenceProvider({ ...input, apiKey }));
  let next = 0;
  return Object.freeze({
    async generate(request: Parameters<AgentInferenceProvider["generate"]>[0], controls?: Parameters<AgentInferenceProvider["generate"]>[1]) {
      const provider = providers[next]!;
      next = (next + 1) % providers.length;
      // No automatic retries across keys: shared-project quotas remain shared.
      return provider.generate(request, controls);
    },
  });
}

export function parseAlphaGeminiKeys(input: { readonly apiKey?: string | undefined; readonly apiKeysJson?: string | undefined }): readonly string[] {
  if (input.apiKey?.trim() && input.apiKeysJson?.trim()) throw new TypeError("Configure one Alpha Gemini credential source");
  if (input.apiKeysJson?.trim()) {
    if (input.apiKeysJson.length > 16_384) throw new TypeError("Alpha Gemini credential configuration too large");
    try {
      const keys: unknown = JSON.parse(input.apiKeysJson);
      if (!Array.isArray(keys) || keys.length < 1 || keys.length > 32 || keys.some(key => typeof key !== "string" || !key.trim() || key.length > 256 || /\s/u.test(key.trim()))) throw new Error();
      return Object.freeze(keys.map((key: string) => key.trim()));
    } catch { throw new TypeError("Invalid Alpha Gemini credential configuration"); }
  }
  if (!input.apiKey?.trim()) throw new TypeError("Alpha Gemini credential is required");
  return Object.freeze([input.apiKey.trim()]);
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
      controls?: Parameters<AgentInferenceProvider["generate"]>[1],
    ) {
      const request = snapshotAgentInferenceRequest(incoming);
      const maxOutputTokens = controls?.maxOutputTokens ?? 2048;
      if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 128 || maxOutputTokens > 8192) throw new RangeError("Invalid inference token limit");
      let documentText: string | undefined;
      if (request.input.kind === "media" && request.input.mimeType === "text/plain") {
        try {
          documentText = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(request.input.dataBase64, "base64"));
          if (!documentText.trim() || documentText.length > 128_000) throw new Error();
        } catch { throw new AgentInferenceError("inference.rejected"); }
      }
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
              ...(documentText !== undefined ? [{ text: documentText }] : [{
                inline_data: {
                  mime_type: request.input.mimeType,
                  data: request.input.dataBase64,
                },
              }]),
            ];

      let response: Response;
      try {
        response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          ...(controls ? { signal: controls.signal } : {}),
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
              maxOutputTokens,
            },
          }),
        },
        );
      } catch {
        throw new AgentInferenceError("inference.unavailable");
      }

      if (!response.ok) {
        // Log only bounded protocol metadata; never vendor messages, requests or keys.
        let providerStatus = "unknown";
        try {
          const payload = await response.json() as { error?: { status?: unknown } };
          const allowed = ["INVALID_ARGUMENT", "PERMISSION_DENIED", "NOT_FOUND", "RESOURCE_EXHAUSTED", "UNAUTHENTICATED", "UNAVAILABLE", "INTERNAL"];
          if (typeof payload.error?.status === "string" && allowed.includes(payload.error.status)) providerStatus = payload.error.status;
        } catch { /* Private body intentionally discarded. */ }
        console.warn(`Alpha inference failure metadata: ${JSON.stringify({ httpStatus: response.status, providerStatus })}`);
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
