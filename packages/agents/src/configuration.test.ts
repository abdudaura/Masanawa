import { describe, expect, it } from "vitest";
import {
  normalizeAgentPresentation,
  normalizeCharacterSkillAssignment,
} from "./configuration.js";

const id = (kind: string, suffix: string) =>
  `${kind}_00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("agent presentation and Skill assignment", () => {
  it("keeps presentation independent from exact SkillVersion selection", () => {
    const presentation = normalizeAgentPresentation({
      schemaVersion: 1,
      tenantId: id("tenant", "1") as never,
      characterId: id("character", "2") as never,
      characterVersionId: id("character-version", "3") as never,
      roleLabel: "Sales & Outreach",
      about: "Handles prospecting",
      greeting: "What should we work on?",
      visibleInUserApp: true,
      sortOrder: 10,
      revision: 1,
    });

    const assignment = normalizeCharacterSkillAssignment({
      schemaVersion: 1,
      tenantId: id("tenant", "1") as never,
      characterId: id("character", "2") as never,
      skillVersionIds: [
        id("skill-version", "5") as never,
        id("skill-version", "4") as never,
      ],
      revision: 1,
    });

    expect(presentation.roleLabel).toBe("Sales & Outreach");
    expect(presentation).not.toHaveProperty("skillVersionIds");
    expect(assignment).not.toHaveProperty("roleLabel");
    expect(assignment.skillVersionIds).toHaveLength(2);
  });

  it("allows Skill selection changes without changing presentation", () => {
    const presentation = normalizeAgentPresentation({
      schemaVersion: 1,
      tenantId: id("tenant", "1") as never,
      characterId: id("character", "2") as never,
      characterVersionId: id("character-version", "3") as never,
      roleLabel: "Research",
      about: "",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 1,
      revision: 7,
    });

    const first = normalizeCharacterSkillAssignment({
      schemaVersion: 1,
      tenantId: presentation.tenantId,
      characterId: presentation.characterId,
      skillVersionIds: [id("skill-version", "4") as never],
      revision: 2,
    });
    const second = normalizeCharacterSkillAssignment({
      schemaVersion: 1,
      tenantId: presentation.tenantId,
      characterId: presentation.characterId,
      skillVersionIds: [id("skill-version", "9") as never],
      revision: 3,
    });

    expect(presentation.revision).toBe(7);
    expect(first.skillVersionIds).not.toEqual(second.skillVersionIds);
    expect(presentation.roleLabel).toBe("Research");
  });

  it("rejects duplicate SkillVersion assignments", () => {
    const skill = id("skill-version", "4") as never;
    expect(() =>
      normalizeCharacterSkillAssignment({
        schemaVersion: 1,
        tenantId: id("tenant", "1") as never,
        characterId: id("character", "2") as never,
        skillVersionIds: [skill, skill],
        revision: 1,
      }),
    ).toThrow(/unique/u);
  });
});
