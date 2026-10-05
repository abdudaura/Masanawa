import { createDecipheriv, createHash } from "node:crypto";
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
  if (
    !normalized ||
    normalized.length > 256 ||
    /\s/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function credentialValues(value: unknown, depth = 0): string[] {
  if (depth > 8 || value == null) return [];

  const direct = normalizeSecret(value);
  if (direct) return [direct];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.length > 1 &&
      trimmed.length < 1_000_000 &&
      (trimmed.startsWith("[") || trimmed.startsWith("{"))
    ) {
      try {
        return credentialValues(JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        return [];
      }
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => credentialValues(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      credentialValues(item, depth + 1),
    );
  }

  return [];
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


interface SupabaseGeminiCredentialRow {
  readonly encrypted_secret?: unknown;
  readonly fingerprint?: unknown;
  readonly cooldown_until?: unknown;
  readonly last_used_at?: unknown;
  readonly gemini_credential_health?:
    | readonly {
        readonly health_score?: unknown;
        readonly ema_latency_ms?: unknown;
      }[]
    | {
        readonly health_score?: unknown;
        readonly ema_latency_ms?: unknown;
      }
    | null;
}

function credentialKeyMaterial(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function decryptNurainCredential(
  encrypted: string,
  secrets: readonly string[],
): string {
  const parts = encrypted.split(".");
  if (parts.length !== 4) throw new Error("Unsupported encrypted Gemini credential");
  const [version, ivB64, tagB64, cipherB64] = parts;
  if (version !== "v1" || !ivB64 || !tagB64 || !cipherB64) {
    throw new Error("Unsupported encrypted Gemini credential");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(cipherB64, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Unsupported encrypted Gemini credential");
  }

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        credentialKeyMaterial(secret),
        iv,
      );
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to decrypt Gemini credential");
}

export function parseNurainImportedGeminiCredentialPool(input: {
  readonly importedCredentialsJson: string;
  readonly encryptionKey: string;
  readonly encryptionKeyPrevious?: string;
  readonly models?: string;
  readonly fallbackModel?: string;
}): GeminiCredentialPool {
  if (
    !input.importedCredentialsJson.trim() ||
    input.importedCredentialsJson.length > 65_536
  ) {
    throw new TypeError("Imported Gemini configuration size is invalid");
  }

  let rows: unknown;
  try {
    rows = JSON.parse(input.importedCredentialsJson);
  } catch {
    throw new TypeError("Imported Gemini configuration is not valid JSON");
  }
  if (!Array.isArray(rows)) {
    throw new TypeError("Imported Gemini configuration must be an array");
  }
  if (rows.length < 1 || rows.length > 32) {
    throw new TypeError("Imported Gemini configuration has invalid row count");
  }

  const encryptionSecrets = [
    input.encryptionKey,
    ...(input.encryptionKeyPrevious?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length >= 32);
  if (encryptionSecrets.length < 1 || encryptionSecrets.length > 8) {
    throw new TypeError("Imported Gemini encryption key configuration is invalid");
  }

  const apiKeys = rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof (row as { encrypted_secret?: unknown }).encrypted_secret !== "string" ||
      typeof (row as { fingerprint?: unknown }).fingerprint !== "string"
    ) {
      throw new TypeError("Imported Gemini row shape is invalid");
    }
    const encrypted = (row as { encrypted_secret: string }).encrypted_secret;
    const fingerprint = (row as { fingerprint: string }).fingerprint;
    if (encrypted.length > 2048 || !/^[0-9a-f]{20}$/u.test(fingerprint)) {
      throw new TypeError("Imported Gemini envelope metadata is invalid");
    }
    const plain = decryptNurainCredential(encrypted, encryptionSecrets).trim();
    const normalized = normalizeSecret(plain);
    if (!normalized) {
      throw new TypeError("Imported Gemini decrypted key is invalid");
    }
    const actualFingerprint = createHash("sha256")
      .update(normalized)
      .digest("hex")
      .slice(0, 20);
    if (actualFingerprint !== fingerprint) {
      throw new TypeError("Imported Gemini credential fingerprint mismatch");
    }
    return normalized;
  });

  return parseGeminiCredentialPool({
    credentialsJson: JSON.stringify(apiKeys),
    ...(input.models ? { models: input.models } : {}),
    ...(input.fallbackModel ? { fallbackModel: input.fallbackModel } : {}),
  });
}

function supabaseOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new TypeError("Supabase URL must be an HTTPS origin");
  }
  return url.origin;
}

function healthMetric(row: SupabaseGeminiCredentialRow) {
  const relation = row.gemini_credential_health;
  return Array.isArray(relation) ? relation[0] : relation;
}

export async function loadSupabaseGeminiCredentialPool(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly encryptionKey: string;
  readonly encryptionKeyPrevious?: string;
  readonly models?: string;
  readonly fallbackModel?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}): Promise<GeminiCredentialPool> {
  const baseUrl = supabaseOrigin(input.supabaseUrl);
  const serviceRoleKey = input.serviceRoleKey.trim();
  const encryptionKeys = [
    input.encryptionKey,
    ...(input.encryptionKeyPrevious?.split(",") ?? []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length >= 32);
  if (serviceRoleKey.length < 20) {
    throw new TypeError("Supabase service role key is invalid");
  }
  if (encryptionKeys.length === 0) {
    throw new TypeError("Credential encryption key is invalid");
  }

  const params = new URLSearchParams({
    select:
      "encrypted_secret,fingerprint,cooldown_until,last_used_at,gemini_credential_health(health_score,ema_latency_ms)",
    enabled: "eq.true",
    limit: "5000",
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${baseUrl}/rest/v1/gemini_credentials?${params.toString()}`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini credential pool lookup failed with ${response.status}`);
  }

  const now = (input.now ?? (() => new Date()))().getTime();
  const rows = (await response.json()) as SupabaseGeminiCredentialRow[];
  const candidates = rows
    .filter((row) => {
      const cooldown = row.cooldown_until;
      return (
        typeof cooldown !== "string" ||
        !cooldown ||
        !Number.isFinite(Date.parse(cooldown)) ||
        Date.parse(cooldown) <= now
      );
    })
    .map((row) => {
      const metric = healthMetric(row);
      return {
        row,
        healthScore:
          metric && typeof metric.health_score === "number"
            ? metric.health_score
            : Number(metric?.health_score ?? 0.85),
        latency:
          metric?.ema_latency_ms == null
            ? Number.POSITIVE_INFINITY
            : Number(metric.ema_latency_ms),
        lastUsed:
          typeof row.last_used_at === "string"
            ? Date.parse(row.last_used_at)
            : 0,
      };
    })
    .sort((left, right) => {
      if (right.healthScore !== left.healthScore) {
        return right.healthScore - left.healthScore;
      }
      if (left.latency !== right.latency) return left.latency - right.latency;
      return left.lastUsed - right.lastUsed;
    });

  const apiKeys: string[] = [];
  for (const candidate of candidates) {
    const encrypted = candidate.row.encrypted_secret;
    if (typeof encrypted !== "string" || !encrypted) continue;
    try {
      const key = decryptNurainCredential(encrypted, encryptionKeys).trim();
      if (normalizeSecret(key)) apiKeys.push(key);
    } catch {
      // One stale envelope must not disable the rest of the pool.
    }
  }

  return parseGeminiCredentialPool({
    credentialsJson: JSON.stringify(apiKeys),
    ...(input.models ? { models: input.models } : {}),
    ...(input.fallbackModel ? { fallbackModel: input.fallbackModel } : {}),
  });
}

export function createSupabaseGeminiPoolInferenceProvider(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
  readonly encryptionKey: string;
  readonly encryptionKeyPrevious?: string;
  readonly models?: string;
  readonly fallbackModel?: string;
  readonly fetchImpl?: typeof fetch;
  readonly cacheTtlMs?: number;
}): AgentInferenceProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const cacheTtlMs = Math.max(5_000, Math.min(60_000, input.cacheTtlMs ?? 15_000));
  let cached:
    | {
        readonly expiresAt: number;
        readonly pool: GeminiCredentialPool;
      }
    | undefined;

  async function pool(): Promise<GeminiCredentialPool> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.pool;
    const next = await loadSupabaseGeminiCredentialPool({
      supabaseUrl: input.supabaseUrl,
      serviceRoleKey: input.serviceRoleKey,
      encryptionKey: input.encryptionKey,
      ...(input.encryptionKeyPrevious
        ? { encryptionKeyPrevious: input.encryptionKeyPrevious }
        : {}),
      ...(input.models ? { models: input.models } : {}),
      ...(input.fallbackModel ? { fallbackModel: input.fallbackModel } : {}),
      fetchImpl,
    });
    cached = Object.freeze({
      expiresAt: now + cacheTtlMs,
      pool: next,
    });
    return next;
  }

  const provider: AgentInferenceProvider = {
    async generate(request, controls) {
      const resolved = await pool();
      return createGeminiCredentialPoolInferenceProvider({
        pool: resolved,
        fetchImpl,
      }).generate(request, controls);
    },
  };
  return Object.freeze(provider);
}
