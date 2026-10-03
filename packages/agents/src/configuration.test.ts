import { describe, expect, it } from "vitest";
import { normalizeAgentConfiguration } from "./configuration.js";

const id = (kind: string, suffix: string) =>
  `${kind}_0199a1b2-c3d4-7e5f-8a9b-${suffix.padStart(12, "0")}`;

describe("AgentConfiguration", () => {
  it("keeps identity presentation separate from exact SkillVersion assignment", () => {
    const value = normalizeAgentConfiguration({
      schemaVersion: 1,
      tenantId: id("tenant", "1") as never,
      characterId: id("character", "2") as never,
      characterVersionId: id("character-version", "3") as never,
      roleLabel: "Sales & Outreach",
      about: "Handles prospecting",
      greeting: "What should we work on?",
      visibleInUserApp: true,
      sortOrder: 10,
      skillVersionIds: [
        id("skill-version", "5") as never,
        id("skill-version", "4") as never,
      ],
      revision: 1,
    });

    expect(value.roleLabel).toBe("Sales & Outreach");
    expect(value.skillVersionIds).toHaveLength(2);
    expect(value).not.toHaveProperty("displayName");
  });

  it("rejects duplicate SkillVersion assignments", () => {
    const skill = id("skill-version", "4") as never;
    expect(() =>
      normalizeAgentConfiguration({
        schemaVersion: 1,
        tenantId: id("tenant", "1") as never,
        characterId: id("character", "2") as never,
        characterVersionId: id("character-version", "3") as never,
        roleLabel: "Research",
        about: "",
        greeting: null,
        visibleInUserApp: true,
        sortOrder: 1,
        skillVersionIds: [skill, skill],
        revision: 1,
      }),
    ).toThrow(/unique/u);
  });
});
