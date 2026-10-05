import type {
  AgentInferenceControls,
  AgentInferenceProvider,
  AgentInferenceRequest,
  AgentInferenceResult,
} from "@masanawa/agents";

interface GeminiCredentialObject {
  readonly apiKey?: unknown;
  readonly key?: unknown;
  readonly value?: unknown;
}

export interface GeminiCredentialPool {
  readonly apiKeys: readonly string[];
  readonly models: readonly string[];
}

function normalizeSecret(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 16 || normalized.length > 512 || /[\r\n\0]/u.test(normalized)) {
    return null;
  }
  return normalized;
}

function credentialValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const direct = normalizeSecret(item);
      if (direct) return [direct];
      if (item && typeof item === "object") {
        const object = item as GeminiCredentialObject;
        return [object.apiKey, object.key, object.value]
          .map(normalizeSecret)
          .filter((candidate): candidate is string => candidate !== null);
      }
      return [];
    });
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const field of ["credentials", "keys", "apiKeys"]) {
      if (field in object) {
        const values = credentialValues(object[field]);
        if (values.length > 0) return values;
      }
    }
    const direct = [object.apiKey, object.key, object.value]
      .map(normalizeSecret)
      .filter((candidate): candidate is string => candidate !== null);
    if (direct.length > 0) return direct;
  }
  const direct = normalizeSecret(value);
  return direct ? [direct] : [];
}

function modelValues(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const raw = value.trim();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  } catch {
    // Comma-separated configuration remains supported.
  }
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export function parseGeminiCredentialPool(input: {
  readonly credentialsJson?: string;
  readonly apiKey?: string;
  readonly models?: string;
  readonly fallbackModel?: string;
}): GeminiCredentialPool {
  const keys: string[] = [];
  if (input.credentialsJson?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.credentialsJson);
    } catch {
      throw new TypeError("Gemini credential pool JSON is invalid");
    }
    keys.push(...credentialValues(parsed));
  }
  const single = normalizeSecret(input.apiKey);
  if (single) keys.push(single);

  const apiKeys = [...new Set(keys)];
  if (apiKeys.length === 0) {
    throw new TypeError("At least one Gemini API key is required");
  }

  const configuredModels = modelValues(input.models);
  const fallback = input.fallbackModel?.trim();
  const models = [...new Set([
    ...configuredModels,
    ...(fallback ? [fallback] : []),
  ])];
  if (models.length === 0) {
    throw new TypeError("At least one Gemini model is required");
  }

  return Object.freeze({
    apiKeys: Object.freeze(apiKeys),
    models: Object.freeze(models),
  });
}

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

function mediaPart(mimeType: string, dataBase64: string, name?: string) {
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
}

function userParts(request: AgentInferenceRequest) {
  if (request.input.kind === "text") return [{ text: request.input.text }];
  if (request.input.kind === "media-set") {
    return [
      {
        text:
          request.input.caption ||
          `Review these ${request.input.media.length} attachments together and respond helpfully.`,
      },
      ...request.input.media.map((item) =>
        mediaPart(item.mimeType, item.dataBase64, item.name),
      ),
    ];
  }
  return [
    ...(request.input.caption
      ? [{ text: request.input.caption }]
      : [{
          text: request.input.mimeType.startsWith("audio/")
            ? "Listen to this voice note and respond to what the user said."
            : "Review this attachment and respond helpfully.",
        }]),
    mediaPart(request.input.mimeType, request.input.dataBase64),
  ];
}

async function generateOnce(input: {
  readonly apiKey: string;
  readonly model: string;
  readonly request: AgentInferenceRequest;
  readonly controls?: AgentInferenceControls;
  readonly fetchImpl: typeof fetch;
}): Promise<AgentInferenceResult> {
  const streaming = input.controls?.onTextDelta != null;
  const endpoint = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
  const response = await input.fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:${endpoint}?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      ...(input.controls?.signal ? { signal: input.controls.signal } : {}),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: input.request.systemInstructions.map((text) => ({ text })),
        },
        contents: [{ role: "user", parts: userParts(input.request) }],
        generationConfig: {
          maxOutputTokens: input.controls?.maxOutputTokens ?? 2048,
        },
      }),
    },
  );
  if (!response.ok) {
    const error = new Error(`Gemini request failed with ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  if (!streaming) {
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.filter((part) => part.thought !== true)
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Gemini returned no text");
    return Object.freeze({ text });
  }

  if (!response.body) throw new Error("Gemini stream returned no body");
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
    const delta =
      payload.candidates?.[0]?.content?.parts
        ?.filter((part) => part.thought !== true)
        .map((part) => part.text ?? "")
        .join("") ?? "";
    if (!delta) return;
    assembled += delta;
    if (assembled.length > 128_000) throw new Error("Gemini stream too large");
    await input.controls!.onTextDelta!(delta);
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
  if (!text) throw new Error("Gemini returned no text");
  return Object.freeze({ text });
}

export function createGeminiCredentialPoolInferenceProvider(input: {
  readonly pool: GeminiCredentialPool;
  readonly fetchImpl?: typeof fetch;
}): AgentInferenceProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const provider: AgentInferenceProvider = {
    async generate(request, controls) {
      let lastError: unknown;
      for (const model of input.pool.models) {
        for (const apiKey of input.pool.apiKeys) {
          try {
            return await generateOnce({
              apiKey,
              model,
              request,
              ...(controls ? { controls } : {}),
              fetchImpl,
            });
          } catch (error) {
            if (controls?.signal?.aborted) throw error;
            lastError = error;
            const status = (error as { status?: unknown }).status;
            if (status === 400 || status === 403 || status === 404) {
              // Try another model before burning all keys on an invalid model.
              break;
            }
          }
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("Gemini credential pool exhausted");
    },
  };
  return Object.freeze(provider);
}
