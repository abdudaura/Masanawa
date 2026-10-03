import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { AgentInferenceProvider } from "@masanawa/agents";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";

function request() {
  return {
    agentRunId: createCanonicalId("agent-run"),
    characterSessionId: createCanonicalId("character-session"),
    characterVersionId: createCanonicalId("character-version"),
    presentation: {
      displayName: "Amina",
      roleLabel: "Research Assistant",
      about: "Helps with practical research.",
    },
    input: {
      kind: "text" as const,
      text: "Hello",
    },
  };
}

describe("Alpha inference strategy", () => {
  it("keeps Character presentation in strategy instructions while inference remains provider-neutral", async () => {
    let captured: Parameters<AgentInferenceProvider["generate"]>[0] | undefined;
    const inference: AgentInferenceProvider = {
      async generate(input) {
        captured = input;
        return { text: "  Hello back  " };
      },
    };
    const strategy = createAlphaInferenceStrategy({ inference });

    const result = await strategy.execute(request());

    expect(result).toEqual({ reply: "Hello back", parts: [] });
    expect(captured?.systemInstructions.join(" ")).toContain("Amina");
    expect(captured?.systemInstructions.join(" ")).toContain("Research Assistant");
    expect(captured?.input).toEqual({ kind: "text", text: "Hello" });
  });

  it("rejects empty provider text instead of completing an empty AgentRun response", async () => {
    const strategy = createAlphaInferenceStrategy({
      inference: {
        async generate() {
          return { text: "   " };
        },
      },
    });

    await expect(strategy.execute(request())).rejects.toThrow(
      "Inference returned an invalid response.",
    );
  });
});

 it("uses compiled authored identity instead of presentation aliases and denies stale context", async () => {
   const input = request();
   let calls = 0;
   const strategy = createAlphaInferenceStrategy({ inference: { async generate(value) {
     calls++;
     expect(value.systemInstructions.join(" ")).toContain("Canonical Constitution");
     expect(value.systemInstructions.join(" ")).not.toContain("Research Assistant");
     return { text: "Hello" };
   } } });
   const context = { agentRunId: input.agentRunId, characterSessionId: input.characterSessionId,
     characterVersionId: input.characterVersionId, systemInstructions: ["Canonical Constitution"],
     evidence: [], usedCharacters: 22, omittedEvidenceItems: 0 };
   await strategy.execute({ ...input, context });
   await expect(strategy.execute({ ...input, context: { ...context, agentRunId: createCanonicalId("agent-run") } })).rejects.toThrow();
   expect(calls).toBe(1);
 });
