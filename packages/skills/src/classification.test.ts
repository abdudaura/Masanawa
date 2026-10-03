import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type CapabilityKey,
} from "@masanawa/contracts";
import {
  createToolRegistry,
  type ToolDefinition,
  type ToolRiskClass,
  type ToolSensitivityClass,
  type ToolSideEffectClass,
} from "@masanawa/tools";
import type { SkillVersion } from "./model.js";
import { classifySkillVersion } from "./classification.js";

function tool(
  capability: CapabilityKey,
  options: {
    readonly riskClass?: ToolRiskClass;
    readonly sideEffectClass?: ToolSideEffectClass;
    readonly sensitivity?: ToolSensitivityClass;
    readonly authority?: readonly CapabilityKey[];
  } = {},
): ToolDefinition {
  return {
    toolId: createCanonicalId("tool"),
    toolVersionId: createCanonicalId("tool-version"),
    key: "classified-tool",
    version: "1.0.0",
    displayName: "Classified Tool",
    description: "Tool used to exercise Skill classification.",
    capabilities: [capability],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    requiredAuthorityCapabilities: options.authority ?? [],
    riskClass: options.riskClass ?? "read-only",
    sideEffectClass: options.sideEffectClass ?? "none",
    sensitivity: options.sensitivity ?? "public",
    timeoutMs: 30_000,
    rateLimit: null,
    costClass: "free",
    idempotencyMode:
      options.riskClass === "consequential" ||
      options.riskClass === "restricted" ||
      options.sideEffectClass === "external-consequential"
        ? "operation-bound"
        : "not-required",
    reconciliationMode:
      options.riskClass === "consequential" ||
      options.riskClass === "restricted" ||
      options.sideEffectClass === "external-consequential"
        ? "on-unknown"
        : "none",
    providerRequirement: null,
  };
}

function skill(
  capability: CapabilityKey,
  options: {
    readonly riskClass?: ToolRiskClass;
    readonly sideEffectClass?: ToolSideEffectClass;
    readonly sensitivity?: ToolSensitivityClass;
    readonly authority?: readonly CapabilityKey[];
  } = {},
): SkillVersion {
  const skillVersionId = createCanonicalId("skill-version");
  return {
    skillId: createCanonicalId("skill"),
    skillVersionId,
    key: "classified.skill",
    version: "1.0.0",
    displayName: "Classified Skill",
    description: "Skill used to exercise canonical classification.",
    activationExamples: ["Use classified skill"],
    negativeActivationExamples: ["Do not use classified skill"],
    capabilities: [normalizeCapabilityKey("classified.skill")],
    requiredToolCapabilities: [capability],
    toolReferences: [
      {
        referenceKey: "tool",
        capability,
        toolVersionId: null,
      },
    ],
    requiredAuthorityCapabilities: options.authority ?? [],
    dependencies: [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: "model-visible",
    riskClass: options.riskClass ?? "read-only",
    sideEffectClass: options.sideEffectClass ?? "none",
    sensitivity: options.sensitivity ?? "public",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode:
      options.riskClass === "consequential" ||
      options.riskClass === "restricted" ||
      options.sideEffectClass === "external-consequential"
        ? "operation-bound"
        : "not-required",
    reconciliationMode:
      options.riskClass === "consequential" ||
      options.riskClass === "restricted" ||
      options.sideEffectClass === "external-consequential"
        ? "on-unknown"
        : "none",
    timeoutMs: 30_000,
    provenance: {
      sourceKind: "authored",
      sourceSystem: "masanawa",
      sourceReference: "skills/classified.skill",
      sourceRevision: "1.0.0",
      sourceContentHash: `sha256:${"f".repeat(64)}`,
      publisher: {
        publisherKey: "masanawa",
        displayName: "Masanawa",
        kind: "first-party",
        reference: null,
      },
      trust: {
        tier: "first-party",
        evaluatorKey: "masanawa.skill-admission",
        evaluatedAt: toInstant("2026-10-02T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"4".repeat(64)}`,
      certifiedAt: toInstant("2026-10-02T00:00:00.000Z"),
      certifierKey: "masanawa.foundation",
      cases: [
        {
          caseKey: "activation.basic",
          kind: "activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/activation.basic",
          evidenceHash: `sha256:${"1".repeat(64)}`,
        },
        {
          caseKey: "negative.basic",
          kind: "negative-activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/negative.basic",
          evidenceHash: `sha256:${"2".repeat(64)}`,
        },
      ],
      testCaseCount: 2,
      passedTestCaseCount: 2,
    },
  };
}

function registryWith(definition: ToolDefinition) {
  const tools = createToolRegistry();
  for (const capability of definition.capabilities) {
    tools.registerCapability({
      key: capability,
      description: "Registered capability.",
    });
  }
  tools.registerTool(definition);
  return tools;
}

describe("Skill risk/capability classification", () => {
  it("publishes an immutable normalized classification envelope", () => {
    const capability = normalizeCapabilityKey("web.search");
    const authority = normalizeCapabilityKey("web.read");
    const definition = tool(capability, { authority: [authority] });
    const classification = classifySkillVersion(
      skill(capability, { authority: [authority] }),
      registryWith(definition),
    );

    expect(classification).toMatchObject({
      riskClass: "read-only",
      sideEffectClass: "none",
      sensitivity: "public",
      consequential: false,
    });
    expect(classification.capability).toEqual({
      provided: [normalizeCapabilityKey("classified.skill")],
      requiredTools: [capability],
      requiredAuthority: [authority],
    });
    expect(classification.resolvedToolVersionIds).toEqual([
      definition.toolVersionId,
    ]);
    expect(Object.isFrozen(classification)).toBe(true);
    expect(Object.isFrozen(classification.capability)).toBe(true);
    expect(Object.isFrozen(classification.resolvedToolVersionIds)).toBe(true);
  });

  it("rejects Tool risk that exceeds the Skill risk envelope", () => {
    const capability = normalizeCapabilityKey("payments.charge");
    const definition = tool(capability, {
      riskClass: "consequential",
      sideEffectClass: "external-consequential",
    });

    expect(() =>
      classifySkillVersion(
        skill(capability, {
          riskClass: "low",
          sideEffectClass: "external-consequential",
        }),
        registryWith(definition),
      ),
    ).toThrow(expect.objectContaining({ code: "skill.risk_underclassified" }));
  });

  it("rejects side effects and sensitivity hidden behind weaker Skill classifications", () => {
    const capability = normalizeCapabilityKey("messages.send");
    const sideEffecting = tool(capability, { sideEffectClass: "external" });
    expect(() =>
      classifySkillVersion(
        skill(capability, { sideEffectClass: "reversible" }),
        registryWith(sideEffecting),
      ),
    ).toThrow(
      expect.objectContaining({ code: "skill.side_effect_underclassified" }),
    );

    const sensitive = tool(capability, { sensitivity: "sensitive" });
    expect(() =>
      classifySkillVersion(
        skill(capability, { sensitivity: "private" }),
        registryWith(sensitive),
      ),
    ).toThrow(
      expect.objectContaining({ code: "skill.sensitivity_underclassified" }),
    );
  });

  it("requires the Skill authority classification to expose Tool authority requirements", () => {
    const capability = normalizeCapabilityKey("messages.send");
    const required = normalizeCapabilityKey("messages.write");
    const definition = tool(capability, { authority: [required] });

    expect(() =>
      classifySkillVersion(skill(capability), registryWith(definition)),
    ).toThrow(
      expect.objectContaining({ code: "skill.authority_requirement_hidden" }),
    );
  });

  it("classifies a sufficient consequential envelope without selecting Providers", () => {
    const capability = normalizeCapabilityKey("payments.charge");
    const required = normalizeCapabilityKey("payments.write");
    const definition = tool(capability, {
      riskClass: "consequential",
      sideEffectClass: "external-consequential",
      sensitivity: "sensitive",
      authority: [required],
    });
    const classification = classifySkillVersion(
      skill(capability, {
        riskClass: "restricted",
        sideEffectClass: "external-consequential",
        sensitivity: "restricted",
        authority: [required],
      }),
      registryWith(definition),
    );

    expect(classification.consequential).toBe(true);
    expect(classification.riskClass).toBe("restricted");
    expect(classification.resolvedToolVersionIds).toEqual([
      definition.toolVersionId,
    ]);
    expect(classification).not.toHaveProperty("providerId");
  });
});
