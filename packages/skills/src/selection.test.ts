import { describe, expect, it } from "vitest";
import { createCanonicalId, normalizeCapabilityKey, toInstant, type CapabilityKey, type SkillVersionId } from "@masanawa/contracts";
import { createAuthorityContext, type AuthorityContext } from "@masanawa/security";
import { createToolRegistry, type ToolDefinition } from "@masanawa/tools";
import type { SkillVersion } from "./model.js";
import { createSkillRegistry } from "./registry.js";
import { createSkillSelectionSource } from "./selection.js";
function authority(): AuthorityContext {
  return createAuthorityContext({
    tenantId: createCanonicalId("tenant"),
    principal: { kind: "user", userId: createCanonicalId("user") },
    scopes: ["skill:execute"],
    capabilities: ["web.search"],
    resourceScope: {},
    policyRevision: "policy-1",
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
  });
}

function tool(
  capability: CapabilityKey,
  overrides: Partial<ToolDefinition> = {},
): ToolDefinition {
  return {
    toolId: overrides.toolId ?? createCanonicalId("tool"),
    toolVersionId:
      overrides.toolVersionId ?? createCanonicalId("tool-version"),
    key: overrides.key ?? "web-search",
    version: overrides.version ?? "1.0.0",
    displayName: overrides.displayName ?? "Web Search",
    description: overrides.description ?? "Searches public information.",
    capabilities: overrides.capabilities ?? [capability],
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
    providerRequirement: overrides.providerRequirement ?? null,
  };
}

function skillVersion(
  key: string,
  options: {
    readonly dependencies?: readonly SkillVersionId[];
    readonly toolCapability?: CapabilityKey;
    readonly toolVersionId?: SkillVersion["toolReferences"][number]["toolVersionId"];
  } = {},
): SkillVersion {
  const capability = options.toolCapability;
  const skillVersionId = createCanonicalId("skill-version");
  return {
    skillId: createCanonicalId("skill"),
    skillVersionId,
    key,
    version: "1.0.0",
    displayName: key,
    description: `Canonical skill ${key}`,
    activationExamples: [`Use ${key}`],
    negativeActivationExamples: [`Do not use ${key}`],
    capabilities: [normalizeCapabilityKey(key)],
    requiredToolCapabilities: capability === undefined ? [] : [capability],
    toolReferences:
      capability === undefined
        ? []
        : [
            {
              referenceKey: "search",
              capability,
              toolVersionId: options.toolVersionId ?? null,
            },
          ],
    requiredAuthorityCapabilities: [],
    dependencies: options.dependencies ?? [],
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
      sourceReference: `skills/${key}`,
      sourceRevision: "1.0.0",
      sourceContentHash: `sha256:${"e".repeat(64)}`,
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
      suiteContentHash: `sha256:${"3".repeat(64)}`,
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


function fixture(options: { pinned?: boolean; dependency?: boolean; rootOverrides?: Partial<SkillVersion> } = {}) {
  const capability = normalizeCapabilityKey("web.search"), tools = createToolRegistry();
  tools.registerCapability({ key: capability, description: "Public search" });
  const search = tool(capability); tools.registerTool(search);
  const dependency = skillVersion("selection.dependency");
  const root = { ...skillVersion("selection.root", { toolCapability: capability,
    ...(options.pinned ? { toolVersionId: search.toolVersionId } : {}),
    ...(options.dependency ? { dependencies: [dependency.skillVersionId] } : {}) }), ...options.rootOverrides };
  const skills = createSkillRegistry();
  skills.registerBatch(options.dependency ? [dependency, root] : [root]);
  for (const version of skills.listVersions()) skills.setReadiness({
    skillVersionId: version.skillVersionId, state: "ready", advertised: version === root || version.skillVersionId === root.skillVersionId,
    reasonCode: null, checkedAt: toInstant("2026-10-03T00:00:00Z") });
  const source = createSkillSelectionSource(skills, tools);
  const input = { authority: authority(), skillVersionId: root.skillVersionId,
    tools: [{ skillVersionId: root.skillVersionId, referenceKey: "search", toolVersionId: search.toolVersionId }] };
  return { source, input, root, dependency, search, skills, tools, capability };
}
describe("Skill selection preparation", () => {
  it("pins the eligible dependency graph and exact declared Tool versions", () => {
    const f = fixture({ dependency: true }), result = f.source.prepare(f.input);
    expect(result.revisionPin.orderedVersions.map(item => item.skillVersionId)).toEqual([f.dependency.skillVersionId, f.root.skillVersionId]);
    expect(result.tools).toEqual(f.input.tools);
    expect(Object.isFrozen(result.tools[0])).toBe(true);
    expect(result.requiresConfirmation).toBe(false);
  });
  it("uses a declared exact pin without implicit vendor selection", () => {
    const f = fixture({ pinned: true });
    expect(f.source.prepare({ ...f.input, tools: [] }).tools[0]?.toolVersionId).toBe(f.search.toolVersionId);
    const neutral = fixture();
    expect(() => neutral.source.prepare({ ...neutral.input, tools: [] })).toThrowError(expect.objectContaining({ code: "skill.selection_exact_tool_required" }));
  });
  it.each(["disabled", "degraded", "blocked"] as const)("blocks an unhealthy dependency: %s", state => {
    const f = fixture({ dependency: true });
    f.skills.setReadiness({ skillVersionId: f.dependency.skillVersionId, state,
      advertised: false, reasonCode: "acceptance.blocked", checkedAt: toInstant("2026-10-03T01:00:00Z") });
    expect(() => f.source.prepare(f.input)).toThrow();
  });
  it("rejects a root removed from model advertisement", () => {
    const f = fixture();f.skills.setReadiness({ skillVersionId: f.root.skillVersionId,
      state: "ready", advertised: false, reasonCode: null, checkedAt: toInstant("2026-10-03T01:00:00Z") });
    expect(() => f.source.prepare(f.input)).toThrow();
  });
  it("rejects arbitrary extra references and duplicate selections", () => {
    const f = fixture();
    expect(() => f.source.prepare({ ...f.input, tools: [...f.input.tools, { ...f.input.tools[0]!, referenceKey: "undeclared" }] })).toThrow();
    expect(() => f.source.prepare({ ...f.input, tools: [...f.input.tools, ...f.input.tools] })).toThrow();
  });
  it("rejects overriding a declared exact Tool pin", () => {
    const f = fixture({ pinned: true });const other = tool(f.capability, { key: "other-search" });f.tools.registerTool(other);
    expect(() => f.source.prepare({ ...f.input, tools: [{ ...f.input.tools[0]!, toolVersionId: other.toolVersionId }] })).toThrow();
  });
  it("requires the Tool's explicit authority capabilities", () => {
    const f = fixture();const restricted = tool(f.capability, { key: "restricted-search", requiredAuthorityCapabilities: [normalizeCapabilityKey("search.private")] });f.tools.registerTool(restricted);
    expect(() => f.source.prepare({ ...f.input, tools: [{ ...f.input.tools[0]!, toolVersionId: restricted.toolVersionId }] })).toThrowError(expect.objectContaining({ code: "skill.selection_tool_capability_missing" }));
  });
  it("propagates confirmation requirements without inventing approvals", () => {
    const f=fixture({ rootOverrides: { confirmationPolicy: "required" } });
    const result=f.source.prepare(f.input);expect(result.requiresConfirmation).toBe(true);
    expect(result).not.toHaveProperty("approved");expect(result).not.toHaveProperty("receipt");
  });
  it("requires Skill authority independently of presentation labels", () => {
    const f=fixture({ rootOverrides: { displayName: "Administrator",
      requiredAuthorityCapabilities: [normalizeCapabilityKey("skill.restricted")] } });
    expect(() => f.source.prepare(f.input)).toThrowError(expect.objectContaining({ code: "skill.selection_capability_missing" }));
  });
  it("bounds selection inputs before resolving registry data", () => {
    const f=fixture();expect(() => f.source.prepare({ ...f.input, tools: Array(65).fill(f.input.tools[0]) })).toThrow("Too many");
  });
});
