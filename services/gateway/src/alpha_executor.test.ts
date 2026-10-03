import { describe, expect, it, vi } from "vitest";
import { createGeminiAlphaInferenceProvider } from "./alpha_executor.js";

function response(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("Gemini Alpha inference provider", () => {
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
