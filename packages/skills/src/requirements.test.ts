import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import {
  createToolRegistry,
  type ToolDefinition,
} from "@masanawa/tools";
import type { SkillVersion } from "./model.js";
import { resolveSkillToolReferences } from "./requirements.js";

function tool(
  capability: string,
  overrides: Partial<ToolDefinition> = {},
): ToolDefinition {
  const normalizedCapability = normalizeCapabilityKey(capability);
  return {
    toolId: overrides.toolId ?? createCanonicalId("tool"),
    toolVersionId:
      overrides.toolVersionId ?? createCanonicalId("tool-version"),
    key: overrides.key ?? "web-search",
    version: overrides.version ?? "1.0.0",
    displayName: overrides.displayName ?? "Web Search",
    description: overrides.description ?? "Searches public information.",
    capabilities: overrides.capabilities ?? [normalizedCapability],
    inputSchema: overrides.inputSchema ?? { type: "object" },
    outputSchema: overrides.outputSchema ?? { type: "object" },
    requiredAuthorityCapabilities:
      overrides.requiredAuthorityCapabilities ?? [],
    riskClass: overrides.riskClass ?? "read-only",
    sideEffectClass: overrides.sideEffectClass ?? "none",
    sensitivity: overrides.sensitivity ?? "public",
    timeoutMs: overrides.timeoutMs ?? 30_000,
    rateLimit: overrides.rateLimit ?? null,
    costClass: overrides.costClass ?? "free",
    idempotencyMode: overrides.idempotencyMode ?? "not-required",
    reconciliationMode: overrides.reconciliationMode ?? "none",
    providerRequirement:
      overrides.providerRequirement === undefined
        ? { capability: normalizedCapability }
        : overrides.providerRequirement,
  };
}

function skill(
  capability: string,
  toolVersionId: SkillVersion["toolReferences"][number]["toolVersionId"] = null,
): SkillVersion {
  const normalizedCapability = normalizeCapabilityKey(capability);
  const skillVersionId = createCanonicalId("skill-version");
  return {
    skillId: createCanonicalId("skill"),
    skillVersionId,
    key: "research.web",
    version: "1.0.0",
    displayName: "Web research",
    description: "Researches through a provider-neutral Tool capability.",
    activationExamples: ["Research this"],
    negativeActivationExamples: ["Do not browse"],
    capabilities: [normalizeCapabilityKey("research.web")],
    requiredToolCapabilities: [normalizedCapability],
    toolReferences: [
      {
        referenceKey: "search",
        capability: normalizedCapability,
        toolVersionId,
      },
    ],
    requiredAuthorityCapabilities: [],
    dependencies: [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: "model-visible",
    riskClass: "read-only",
    sideEffectClass: "none",
    sensitivity: "public",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode: "not-required",
    reconciliationMode: "none",
    timeoutMs: 30_000,
    provenance: {
      sourceKind: "authored",
      sourceSystem: "masanawa",
      sourceReference: "skills/research.web",
      sourceRevision: "1",
      sourceContentHash: `sha256:${"b".repeat(64)}`,
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
      suiteContentHash: `sha256:${"7".repeat(64)}`,
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

describe("Skill Tool requirement resolution", () => {
  it("keeps an unpinned reference provider-neutral and returns exact ToolVersion candidates", () => {
    const tools = createToolRegistry();
    const capability = normalizeCapabilityKey("web.search");
    tools.registerCapability({
      key: capability,
      description: "Search the public web.",
    });
    const v1 = tool(capability, { version: "1.0.0" });
    const v2 = tool(capability, {
      toolId: v1.toolId,
      toolVersionId: createCanonicalId("tool-version"),
      version: "2.0.0",
    });
    tools.registerTool(v2);
    tools.registerTool(v1);

    const [resolved] = resolveSkillToolReferences(skill(capability), tools);

    expect(resolved?.reference.toolVersionId).toBeNull();
    expect(resolved?.candidates.map((item) => item.toolVersionId)).toEqual([
      v1.toolVersionId,
      v2.toolVersionId,
    ]);
    expect(resolved).not.toHaveProperty("provider");
    expect(resolved?.candidates[0]).not.toHaveProperty("providerId");
  });

  it("supports an exact ToolVersion pin without pinning a Provider", () => {
    const tools = createToolRegistry();
    const capability = normalizeCapabilityKey("web.search");
    tools.registerCapability({
      key: capability,
      description: "Search the public web.",
    });
    const exact = tool(capability);
    tools.registerTool(exact);

    const [resolved] = resolveSkillToolReferences(
      skill(capability, exact.toolVersionId),
      tools,
    );

    expect(resolved?.candidates.map((item) => item.toolVersionId)).toEqual([
      exact.toolVersionId,
    ]);
  });

  it("fails closed when a pinned ToolVersion does not provide the declared capability", () => {
    const tools = createToolRegistry();
    const search = normalizeCapabilityKey("web.search");
    const messaging = normalizeCapabilityKey("messages.send");
    tools.registerCapability({ key: search, description: "Search." });
    tools.registerCapability({ key: messaging, description: "Send." });
    const sendTool = tool(messaging, { key: "send-message" });
    tools.registerTool(sendTool);

    expect(() =>
      resolveSkillToolReferences(
        skill(search, sendTool.toolVersionId),
        tools,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "skill.tool_reference_capability_mismatch",
      }),
    );
  });

  it("fails closed when required capability or Tool candidates are absent", () => {
    const missingCapabilityTools = createToolRegistry();
    expect(() =>
      resolveSkillToolReferences(skill("web.search"), missingCapabilityTools),
    ).toThrow(
      expect.objectContaining({
        code: "skill.required_tool_capability_not_registered",
      }),
    );

    const registeredCapabilityOnly = createToolRegistry();
    registeredCapabilityOnly.registerCapability({
      key: normalizeCapabilityKey("web.search"),
      description: "Search.",
    });
    expect(() =>
      resolveSkillToolReferences(
        skill("web.search"),
        registeredCapabilityOnly,
      ),
    ).toThrow(
      expect.objectContaining({
        code: "skill.tool_reference_unresolved",
      }),
    );
  });
});
