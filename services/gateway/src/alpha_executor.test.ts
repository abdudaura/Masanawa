import { describe, expect, it, vi } from "vitest";
import { createGeminiAlphaInferenceProvider, createGeminiAlphaInferencePool, parseAlphaGeminiKeys } from "./alpha_executor.js";

function response(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("Gemini Alpha credential pool", () => {
  it("copies credentials and distributes requests without extra inference attempts", async () => {
    const keys = ["first-key", "second-key"];
    const used: (string | null)[] = [];
    const pool = createGeminiAlphaInferencePool({ apiKeys: keys, model: "replaceable-model", fetchImpl: (async (_url, init) => {
      used.push(new Headers(init?.headers).get("x-goog-api-key"));
      return response("Hi");
    }) as typeof fetch });
    keys[0] = "changed";
    const request = { systemInstructions: ["Hello"], input: { kind: "text" as const, text: "Hi" } };
    await Promise.all([pool.generate(request), pool.generate(request), pool.generate(request)]);
    expect(used).toEqual(["first-key", "second-key", "first-key"]);
  });

  it("does not retry a rate-limited request across contributed credentials", async () => {
    const fetchImpl = vi.fn(async () => new Response("private vendor error", { status: 429 }));
    const pool = createGeminiAlphaInferencePool({ apiKeys: ["first", "second"], model: "test", fetchImpl: fetchImpl as typeof fetch });
    await expect(pool.generate({ systemInstructions: ["Hello"], input: { kind: "text", text: "Hi" } })).rejects.toMatchObject({ code: "inference.rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails closed on ambiguous, duplicate, malformed or unbounded configuration", () => {
    expect(() => parseAlphaGeminiKeys({ apiKey: "secret", apiKeysJson: '["other"]' })).toThrow("one Alpha");
    for (const apiKeysJson of ['{"secret":"private"}', '[null]', '[]', '["white space"]', 'not-json']) {
      expect(() => parseAlphaGeminiKeys({ apiKeysJson })).toThrow("Invalid Alpha");
    }
    for (const apiKeys of [[], ["same", "same"], Array.from({ length: 33 }, (_, i) => `key-${i}`)]) {
      expect(() => createGeminiAlphaInferencePool({ apiKeys, model: "test" })).toThrow();
    }
    expect(parseAlphaGeminiKeys({ apiKey: " legacy-key " })).toEqual(["legacy-key"]);
    expect(Object.isFrozen(parseAlphaGeminiKeys({ apiKeysJson: '["first","second"]' }))).toBe(true);
  });
});

describe("Gemini Alpha inference provider", () => {

  it("decodes a real UTF-8 text document as user content instead of unsupported binary inline data", async () => {
    const document = "Meeting: Monday at 10 AM. مرحبا";
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.contents[0].parts).toEqual([{ text: "Summarize this document." }, { text: document }]);
      return response("Monday at 10 AM.");
    });
    const provider = createGeminiAlphaInferenceProvider({ apiKey: "dev-key", model: "test", fetchImpl: fetchImpl as typeof fetch });
    await expect(provider.generate({ systemInstructions: ["Be helpful."], input: { kind: "media", caption: "Summarize this document.", mimeType: "text/plain", dataBase64: Buffer.from(document).toString("base64") } })).resolves.toEqual({ text: "Monday at 10 AM." });
  });
  it.each([Buffer.from([0xff]), Buffer.from("x".repeat(128_001)), Buffer.from(" ")])("rejects unreadable or oversized plain text without sending it to the provider (%#)", async bytes => {
    const fetchImpl = vi.fn();
    const provider = createGeminiAlphaInferenceProvider({ apiKey: "dev-key", model: "test", fetchImpl: fetchImpl as typeof fetch });
    await expect(provider.generate({ systemInstructions: ["Be helpful."], input: { kind: "media", caption: "", mimeType: "text/plain", dataBase64: bytes.toString("base64") } })).rejects.toMatchObject({ code: "inference.rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([["PERMISSION_DENIED", "PERMISSION_DENIED"], ["private-key", "unknown"]])("logs only allowlisted rejection metadata (%#)", async (status, expected) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const provider = createGeminiAlphaInferenceProvider({ apiKey: "private-key", model: "test",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: { status, message: "private vendor message" } }), { status: 403 })) as typeof fetch });
    await expect(provider.generate({ systemInstructions: ["Hello."], input: { kind: "text", text: "private user text" } })).rejects.toMatchObject({ code: "inference.rejected" });
    expect(warn).toHaveBeenCalledWith(`Alpha inference failure metadata: ${JSON.stringify({ httpStatus: 403, providerStatus: expected })}`);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private-key|private vendor|private user/);
  });

  it("keeps credentials out of request URLs", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).not.toContain("private-key");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("private-key");
      return response("Hi");
    });
    await createGeminiAlphaInferenceProvider({
      apiKey: "private-key", model: "replaceable-model", fetchImpl: fetchImpl as typeof fetch,
    }).generate({ systemInstructions: ["Hello."], input: { kind: "text", text: "Hi" } });
  });

  it.each([
    [429, "inference.rate_limited", true],
    [503, "inference.unavailable", true],
    [401, "inference.rejected", false],
    [400, "inference.rejected", false],
  ])("maps HTTP %s to a safe replaceable failure", async (status, code, retryable) => {
    const provider = createGeminiAlphaInferenceProvider({
      apiKey: "private-key", model: "test",
      fetchImpl: vi.fn(async () => new Response("secret provider payload", { status })) as typeof fetch,
    });
    await expect(provider.generate({
      systemInstructions: ["Hello."], input: { kind: "text", text: "Hi" },
    })).rejects.toMatchObject({ code, retryable });
  });

  it.each([null, {}, { candidates: [{ content: { parts: [{ text: 7 }] } }] }])(
    "rejects malformed wire output (%#)", async (payload) => {
      const provider = createGeminiAlphaInferenceProvider({
        apiKey: "private-key", model: "test",
        fetchImpl: vi.fn(async () => new Response(JSON.stringify(payload))) as typeof fetch,
      });
      await expect(provider.generate({
        systemInstructions: ["Hello."], input: { kind: "text", text: "Hi" },
      })).rejects.toMatchObject({ code: "inference.invalid_response" });
    },
  );

  it("excludes internal thought parts from user-visible replies", async () => {
    const provider = createGeminiAlphaInferenceProvider({
      apiKey: "private-key", model: "test",
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ thought: true, text: "private reasoning" }, { text: "Hi" }] } }],
      }))) as typeof fetch,
    });
    await expect(provider.generate({
      systemInstructions: ["Hello."], input: { kind: "text", text: "Hi" },
    })).resolves.toEqual({ text: "Hi" });
  });

  it("redacts transport and JSON errors", async () => {
    for (const fetchImpl of [
      vi.fn(async () => { throw new Error("private-key"); }),
      vi.fn(async () => new Response("{private-key")),
    ]) {
      const provider = createGeminiAlphaInferenceProvider({
        apiKey: "private-key", model: "test", fetchImpl: fetchImpl as typeof fetch,
      });
      const failure = await provider.generate({
        systemInstructions: ["Hello."], input: { kind: "text", text: "Hi" },
      }).catch((error: unknown) => error);
      expect(JSON.stringify(failure)).not.toContain("private-key");
      expect(String(failure)).not.toContain("private-key");
    }
  });
  it("translates provider-neutral text inference without leaking provider shapes upstream", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        system_instruction: { parts: { text: string }[] };
        contents: { parts: { text?: string }[] }[];
      };
      expect(body.system_instruction.parts).toEqual([
        { text: "You are Amina." },
      ]);
      expect(body.contents[0]?.parts).toEqual([{ text: "Hello" }]);
      return response("Hi");
    });
    const provider = createGeminiAlphaInferenceProvider({
      apiKey: "dev-key",
      model: "gemini-test",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(
      provider.generate({
        systemInstructions: ["You are Amina."],
        input: { kind: "text", text: "Hello" },
      }),
    ).resolves.toEqual({ text: "Hi" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("preserves media MIME/data only at the inference adapter boundary", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        contents: {
          parts: Array<{
            text?: string;
            inline_data?: { mime_type: string; data: string };
          }>;
        }[];
      };
      expect(body.contents[0]?.parts).toEqual([
        { text: "Listen to this voice note and respond to what the user said." },
        { inline_data: { mime_type: "audio/mp4", data: "YWJj" } },
      ]);
      return response("Heard");
    });
    const provider = createGeminiAlphaInferenceProvider({
      apiKey: "dev-key",
      model: "gemini-test",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(
      provider.generate({
        systemInstructions: ["Be helpful."],
        input: {
          kind: "media",
          caption: "",
          mimeType: "audio/mp4",
          dataBase64: "YWJj",
        },
      }),
    ).resolves.toEqual({ text: "Heard" });
  });
});

describe("Gemini inference controls",()=>{
  it("forwards abort and exact output-token ceiling through the credential pool",async()=>{
    const controller=new AbortController();
    const pool=createGeminiAlphaInferencePool({apiKeys:["first","second"],model:"replaceable-model",
      fetchImpl:(async(_url,init)=>{
        expect(init?.signal).toBe(controller.signal);
        expect(JSON.parse(String(init?.body)).generationConfig.maxOutputTokens).toBe(512);
        return response("Bounded");}) as typeof fetch});
    expect(await pool.generate({systemInstructions:["Hello"],input:{kind:"text",text:"Hi"}},
      {signal:controller.signal,maxOutputTokens:512})).toEqual({text:"Bounded"});
  });
});
