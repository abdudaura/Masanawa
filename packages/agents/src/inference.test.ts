import { describe, expect, it, vi } from "vitest";
import {
  AgentInferenceError,
  generateAgentInference,
  snapshotAgentInferenceRequest,
} from "./inference.js";
import type { AgentInferenceProvider, AgentInferenceRequest } from "./strategy.js";

const request = (): AgentInferenceRequest => ({
  systemInstructions: ["You are Amina."],
  input: { kind: "text", text: "Hello" },
});

describe("provider-neutral inference admission", () => {
  it("copies and freezes input before a provider wait and discards non-envelope fields", async () => {
    const original = {
      systemInstructions: ["Be helpful."],
      input: { kind: "text" as const, text: "Hello", privateField: "secret" },
      authority: "must not cross",
    };
    let captured: AgentInferenceRequest | undefined;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const pending = generateAgentInference({
      async generate(input) {
        captured = input;
        await waiting;
        return { text: " Hello back ", providerThread: "discard" };
      },
    }, original);
    original.systemInstructions[0] = "changed";
    original.input.text = "changed";
    release();
    expect(await pending).toEqual({ text: "Hello back" });
    expect(captured).toEqual({ systemInstructions: ["Be helpful."], input: { kind: "text", text: "Hello" } });
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured?.input)).toBe(true);
    expect(Object.isFrozen(captured?.systemInstructions)).toBe(true);
  });

  it.each([
    { systemInstructions: [], input: { kind: "text", text: "Hello" } },
    { systemInstructions: ["ok"], input: { kind: "text", text: " " } },
    { systemInstructions: ["ok"], input: { kind: "text", text: "x".repeat(32_001) } },
    { systemInstructions: ["ok"], input: { kind: "unknown" } },
    { systemInstructions: ["ok"], input: { kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "broken!" } },
    { systemInstructions: ["ok"], input: { kind: "media", caption: "", mimeType: "audio/mp4\nsecret", dataBase64: "YWJj" } },
  ])("rejects malformed input before invoking a provider (%#)", async (input) => {
    const generate = vi.fn();
    await expect(generateAgentInference({ generate }, input as AgentInferenceRequest)).rejects.toThrow(TypeError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("preserves bounded media bytes without carrying runtime custody", () => {
    const snapshot = snapshotAgentInferenceRequest({
      systemInstructions: ["Listen."],
      input: { kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "YQ==" },
    });
    expect(snapshot.input).toEqual({ kind: "media", caption: "", mimeType: "audio/mp4", dataBase64: "YQ==" });
  });

  it.each([null, {}, { text: 7 }, { text: " " }, { text: "x".repeat(128_001) }])(
    "rejects malformed provider output (%#)",
    async (output) => {
      const provider = { async generate() { return output; } } as AgentInferenceProvider;
      await expect(generateAgentInference(provider, request())).rejects.toMatchObject({
        code: "inference.invalid_response", retryable: false,
      });
    },
  );

  it("redacts arbitrary vendor exceptions", async () => {
    const error = await generateAgentInference({
      async generate() { throw new Error("key=secret private user text"); },
    }, request()).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(AgentInferenceError);
    expect(JSON.stringify(error)).not.toContain("secret");
    expect(String(error)).not.toContain("private");
    expect(error).toMatchObject({ code: "inference.unavailable", retryable: true });
  });

  it("reconstructs typed failure metadata instead of forwarding arbitrary attached data", async () => {
    const failure = new AgentInferenceError("inference.rate_limited");
    Object.assign(failure, { details: { apiKey: "secret" }, message: "secret" });
    const error = await generateAgentInference({
      async generate() { throw failure; },
    }, request()).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "inference.rate_limited", retryable: true });
    expect(JSON.stringify(error)).not.toContain("secret");
  });
});
