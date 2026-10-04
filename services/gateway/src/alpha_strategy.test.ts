import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { AgentInferenceProvider } from "@masanawa/agents";
import type { SkillGuideRepository, SkillRepository } from "@masanawa/skills";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";

function request() {
  return {
    agentRunId: createCanonicalId("agent-run"),
    characterSessionId: createCanonicalId("character-session"),
    characterVersionId: createCanonicalId("character-version"),
    skillVersionIds: [],
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

const skills: SkillRepository = {
  async registerBatch() {
    return [];
  },
  async readSnapshot() {
    return { skills: [], versions: [], readiness: [] };
  },
  async putReadiness() {
    throw new Error("not used");
  },
};

const guides: SkillGuideRepository = {
  async putGuide() {
    throw new Error("not used");
  },
  async readGuide() {
    return null;
  },
  async readGuides() {
    return [];
  },
};

describe("Alpha inference strategy", () => {
  it("keeps Character presentation in strategy instructions while inference remains provider-neutral", async () => {
    let captured: Parameters<AgentInferenceProvider["generate"]>[0] | undefined;
    const inference: AgentInferenceProvider = {
      async generate(input) {
        captured = input;
        return { text: "  Hello back  " };
      },
    };
    const strategy = createAlphaInferenceStrategy({ inference, skills, guides });

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
      skills,
      guides,
    });

    await expect(strategy.execute(request())).rejects.toThrow(
      "Alpha inference returned no text",
    );
  });
});
