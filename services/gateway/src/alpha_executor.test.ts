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
  it("translates provider-neutral text inference without leaking provider shapes upstream", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit | undefined) => {
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
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit | undefined) => {
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

