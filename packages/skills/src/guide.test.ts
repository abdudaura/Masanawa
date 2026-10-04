import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { evaluateSkillDiscovery, normalizeSkillGuide } from "./guide.js";

describe("SkillGuide progressive disclosure", () => {
  const guide = normalizeSkillGuide({
    schemaVersion: 1,
    skillVersionId: createCanonicalId("skill-version"),
    triggerDescription:
      "Use when the user asks to research current information on the web.",
    instructions:
      "# Web Research\nVerify fresh claims and return concise sourced findings.",
    resources: [
      { path: "references/research-policy.md", kind: "reference", description: "Research policy" },
    ],
    discovery: {
      priority: 60,
      phrases: ["research this", "look this up"],
      allOf: [["find", "current"]],
      anyOf: ["latest", "today"],
      noneOf: ["do not browse"],
      minScore: 20,
    },
  });

  it("selects on positive trigger signals without loading resources", () => {
    const result = evaluateSkillDiscovery(guide, "Please research this for me");
    expect(result.eligible).toBe(true);
    expect(result.blockedByNegativeSignal).toBe(false);
  });

  it("fails closed on an explicit negative signal", () => {
    const result = evaluateSkillDiscovery(
      guide,
      "Research this, but do not browse the web",
    );
    expect(result).toEqual({
      eligible: false,
      score: 0,
      blockedByNegativeSignal: true,
    });
  });
});
