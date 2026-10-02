import { describe, expect, it } from "vitest";
import {
  importSkillBundle,
  importSkillMarkdown,
  normalizeSkillResourcePath,
  parseSkillManifestV1,
} from "./manifest.js";

const source = {
  sourceSystem: "openclaw",
  sourceReference: "skills/research/SKILL.md",
  sourceRevision: "abc123",
  trustTier: "external-unreviewed" as const,
};

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    key: "research.web",
    version: "1.0.0",
    name: "Web Research",
    description: "Research public sources.",
    entrypoint: "SKILL.md",
    resources: [
      { path: "references/guide.md", kind: "reference" },
      { path: "scripts/run.ts", kind: "script" },
    ],
    ...overrides,
  };
}

describe("Skill manifest v1", () => {
  it("validates, normalizes and freezes the native import manifest", () => {
    const parsed = parseSkillManifestV1(
      manifest({
        key: " Research.Web ",
        activationExamples: ["Research this"],
        negativeActivationExamples: ["Do not browse"],
      }),
    );

    expect(parsed.key).toBe("research.web");
    expect(parsed.visibility).toBe("model-visible");
    expect(parsed.activationExamples).toEqual(["Research this"]);
    expect(parsed.resources).toHaveLength(2);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.resources)).toBe(true);
  });

  it("rejects unknown schema versions and extra manifest properties", () => {
    expect(() => parseSkillManifestV1(manifest({ schemaVersion: 2 }))).toThrow(
      "schemaVersion 1",
    );
    expect(() => parseSkillManifestV1(manifest({ surprise: true }))).toThrow(
      "schemaVersion 1",
    );
  });

  it("rejects traversal, absolute, Windows and ambiguous resource paths", () => {
    for (const unsafe of [
      "../secret.txt",
      "references/../secret.txt",
      "/etc/passwd",
      "C:/secret.txt",
      "scripts\\run.ts",
      "references//guide.md",
      "./guide.md",
    ]) {
      expect(() => normalizeSkillResourcePath(unsafe), unsafe).toThrow();
    }
  });

  it("rejects duplicate normalized resource paths", () => {
    expect(() =>
      parseSkillManifestV1(
        manifest({
          resources: [
            { path: "references/guide.md", kind: "reference" },
            { path: "references/guide.md", kind: "asset" },
          ],
        }),
      ),
    ).toThrow("resource paths must be unique");
  });
});

describe("Skill imports", () => {
  it("quarantines imported content, records provenance and skips scripts by default", () => {
    const candidate = importSkillBundle({
      manifest: manifest(),
      instructions: "Use public sources and cite evidence.",
      source,
    });

    expect(candidate.state).toBe("quarantined");
    expect(candidate.importedResources.map((item) => item.path)).toEqual([
      "references/guide.md",
    ]);
    expect(candidate.skippedScripts).toEqual(["scripts/run.ts"]);
    expect(candidate.provenance).toMatchObject({
      sourceKind: "imported",
      sourceSystem: "openclaw",
      sourceReference: "skills/research/SKILL.md",
      sourceRevision: "abc123",
      trustTier: "external-unreviewed",
    });
    expect(candidate.provenance.sourceContentHash).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(candidate).not.toHaveProperty("skillId");
    expect(candidate).not.toHaveProperty("skillVersionId");
    expect(candidate).not.toHaveProperty("certification");
  });

  it("imports scripts only when the importer explicitly opts in", () => {
    const candidate = importSkillBundle(
      {
        manifest: manifest(),
        instructions: "Use public sources.",
        source,
      },
      { allowScripts: true },
    );

    expect(candidate.skippedScripts).toEqual([]);
    expect(candidate.importedResources.map((item) => item.kind)).toEqual([
      "reference",
      "script",
    ]);
  });

  it("produces stable content-derived evidence for equivalent normalized bundles", () => {
    const first = importSkillBundle({
      manifest: manifest({ key: " Research.Web " }),
      instructions: "Line one.\r\nLine two.",
      source,
    });
    const second = importSkillBundle({
      manifest: manifest({ key: "research.web" }),
      instructions: "Line one.\nLine two.",
      source,
    });

    expect(first.provenance.sourceContentHash).toBe(
      second.provenance.sourceContentHash,
    );
  });

  it("imports bounded SKILL.md frontmatter without treating Markdown as production truth", () => {
    const candidate = importSkillMarkdown(
      [
        "---",
        "name: Research Assistant",
        "description: Researches public information",
        "---",
        "Follow the user's request and preserve evidence.",
      ].join("\n"),
      {
        key: "research.assistant",
        version: "1.0.0",
        source,
      },
    );

    expect(candidate.manifest).toMatchObject({
      schemaVersion: 1,
      key: "research.assistant",
      version: "1.0.0",
      name: "Research Assistant",
      description: "Researches public information",
      entrypoint: "SKILL.md",
    });
    expect(candidate.instructions).toContain("preserve evidence");
    expect(candidate.state).toBe("quarantined");
  });

  it("requires SKILL.md name and description and refuses unsupported frontmatter", () => {
    expect(() =>
      importSkillMarkdown("---\nname: Only Name\n---\nInstructions", {
        key: "broken.skill",
        version: "1",
        source,
      }),
    ).toThrow("requires name and description");

    expect(() =>
      importSkillMarkdown(
        "---\nname: Skill\ndescription: Fine\ncommand: rm -rf /\n---\nInstructions",
        { key: "broken.skill", version: "1", source },
      ),
    ).toThrow("Unsupported SKILL.md frontmatter field");
  });
});
