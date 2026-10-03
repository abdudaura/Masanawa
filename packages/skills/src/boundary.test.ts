import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type CapabilityKey,
  type SkillVersionId,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
  type AuthorityContext,
} from "@masanawa/security";
import {
  createToolRegistry,
  type ToolDefinition,
} from "@masanawa/tools";
import type { SkillVersion } from "./model.js";
import { composeSkillExecutionPlan } from "./planning.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";
import {
  bindSkillSubskillInvocation,
  bindSkillToolInvocation,
} from "./boundary.js";

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

function readyPlan(
  versions: readonly SkillVersion[],
  root: SkillVersion,
): ReturnType<typeof composeSkillExecutionPlan> {
  const registry: SkillRegistry = createSkillRegistry();
  registry.registerBatch(versions);
  for (const skill of versions) {
    registry.setReadiness({
      skillVersionId: skill.skillVersionId,
      state: "ready",
      advertised: skill.skillVersionId === root.skillVersionId,
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T00:01:00.000Z"),
    });
  }
  return composeSkillExecutionPlan(registry, root.skillVersionId);
}

describe("SkillTool execution boundary", () => {
  it("binds only a declared Tool reference to an exact ToolVersion and never selects a Provider", () => {
    const capability = normalizeCapabilityKey("web.search");
    const tools = createToolRegistry();
    tools.registerCapability({ key: capability, description: "Search." });
    const search = tool(capability);
    tools.registerTool(search);

    const root = skillVersion("boundary.root", {
      toolCapability: capability,
    });
    const plan = readyPlan([root], root);
    const auth = authority();

    const invocation = bindSkillToolInvocation(plan, tools, {
      stepOrdinal: 0,
      referenceKey: "search",
      toolVersionId: search.toolVersionId,
      authority: auth,
      input: { query: "Kano" },
      idempotencyKey: null,
    });

    expect(invocation.toolVersionId).toBe(search.toolVersionId);
    expect(invocation.authority).toBe(auth);
    expect(invocation.providerSelection).toBeNull();
    expect(invocation.input).toEqual({ query: "Kano" });
    expect(Object.isFrozen(invocation.input)).toBe(true);
  });

  it("does not allow a Skill to override an exact ToolVersion pin", () => {
    const capability = normalizeCapabilityKey("web.search");
    const tools = createToolRegistry();
    tools.registerCapability({ key: capability, description: "Search." });
    const pinned = tool(capability);
    const other = tool(capability, { key: "web-search-alt" });
    tools.registerTool(pinned);
    tools.registerTool(other);

    const root = skillVersion("boundary.pinned", {
      toolCapability: capability,
      toolVersionId: pinned.toolVersionId,
    });
    const plan = readyPlan([root], root);

    expect(() =>
      bindSkillToolInvocation(plan, tools, {
        stepOrdinal: 0,
        referenceKey: "search",
        toolVersionId: other.toolVersionId,
        authority: authority(),
        input: {},
        idempotencyKey: null,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "skill.tool_reference_pin_mismatch",
      }),
    );
  });

  it("rejects undeclared Tool references and capability-mismatched ToolVersions", () => {
    const search = normalizeCapabilityKey("web.search");
    const send = normalizeCapabilityKey("messages.send");
    const tools = createToolRegistry();
    tools.registerCapability({ key: search, description: "Search." });
    tools.registerCapability({ key: send, description: "Send." });
    const sendTool = tool(send, { key: "send-message" });
    tools.registerTool(sendTool);
    const root = skillVersion("boundary.closed", { toolCapability: search });
    const plan = readyPlan([root], root);

    expect(() =>
      bindSkillToolInvocation(plan, tools, {
        stepOrdinal: 0,
        referenceKey: "missing",
        toolVersionId: sendTool.toolVersionId,
        authority: authority(),
        input: {},
        idempotencyKey: null,
      }),
    ).toThrow(
      expect.objectContaining({ code: "skill.tool_reference_not_declared" }),
    );

    expect(() =>
      bindSkillToolInvocation(plan, tools, {
        stepOrdinal: 0,
        referenceKey: "search",
        toolVersionId: sendTool.toolVersionId,
        authority: authority(),
        input: {},
        idempotencyKey: null,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "skill.tool_reference_capability_mismatch",
      }),
    );
  });
});

describe("subskill execution boundary", () => {
  it("binds an exact declared direct dependency to its earlier plan step", () => {
    const child = skillVersion("boundary.child");
    const root = skillVersion("boundary.parent", {
      dependencies: [child.skillVersionId],
    });
    const plan = readyPlan([root, child], root);
    const auth = authority();

    const invocation = bindSkillSubskillInvocation(plan, {
      stepOrdinal: 1,
      dependencySkillVersionId: child.skillVersionId,
      authority: auth,
      input: { topic: "weather" },
    });

    expect(invocation.callerSkillVersionId).toBe(root.skillVersionId);
    expect(invocation.targetSkillVersionId).toBe(child.skillVersionId);
    expect(invocation.targetStepOrdinal).toBe(0);
    expect(invocation.authority).toBe(auth);
    expect(invocation.input).toEqual({ topic: "weather" });
    expect(Object.isFrozen(invocation.input)).toBe(true);
  });

  it("rejects arbitrary transitive or unrelated SkillVersion dispatch", () => {
    const leaf = skillVersion("boundary.leaf");
    const child = skillVersion("boundary.child", {
      dependencies: [leaf.skillVersionId],
    });
    const unrelated = skillVersion("boundary.unrelated");
    const root = skillVersion("boundary.parent", {
      dependencies: [child.skillVersionId],
    });
    const plan = readyPlan([root, child, leaf, unrelated], root);

    expect(() =>
      bindSkillSubskillInvocation(plan, {
        stepOrdinal: plan.steps.length - 1,
        dependencySkillVersionId: leaf.skillVersionId,
        authority: authority(),
        input: {},
      }),
    ).toThrow(
      expect.objectContaining({ code: "skill.subskill_not_declared" }),
    );

    expect(() =>
      bindSkillSubskillInvocation(plan, {
        stepOrdinal: plan.steps.length - 1,
        dependencySkillVersionId: unrelated.skillVersionId,
        authority: authority(),
        input: {},
      }),
    ).toThrow(
      expect.objectContaining({ code: "skill.subskill_not_declared" }),
    );
  });
});
