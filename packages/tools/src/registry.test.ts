import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import { createProviderRegistry } from "@masanawa/providers";
import { describe, expect, it } from "vitest";
import {
  createToolRegistry,
  selectProviderForTool,
} from "./registry.js";
import type { ToolDefinition } from "./model.js";

function definition(
  input: Partial<ToolDefinition> & {
    key: string;
    capability: string;
  },
): ToolDefinition {
  const capability = normalizeCapabilityKey(input.capability);
  return {
    toolId: input.toolId ?? createCanonicalId("tool"),
    toolVersionId:
      input.toolVersionId ?? createCanonicalId("tool-version"),
    key: input.key,
    version: input.version ?? "v1",
    displayName: input.displayName ?? input.key,
    description: input.description ?? "Fixture Tool",
    capabilities: input.capabilities ?? [capability],
    inputSchema: input.inputSchema ?? {
      type: "object",
      additionalProperties: false,
    },
    outputSchema: input.outputSchema ?? {
      type: "object",
      additionalProperties: false,
    },
    requiredAuthorityCapabilities:
      input.requiredAuthorityCapabilities ?? [],
    riskClass: input.riskClass ?? "read-only",
    sideEffectClass: input.sideEffectClass ?? "none",
    sensitivity: input.sensitivity ?? "internal",
    timeoutMs: input.timeoutMs ?? 30_000,
    rateLimit: input.rateLimit ?? null,
    costClass: input.costClass ?? "free",
    idempotencyMode: input.idempotencyMode ?? "not-required",
    reconciliationMode: input.reconciliationMode ?? "none",
    providerRequirement:
      input.providerRequirement === undefined
        ? { capability }
        : input.providerRequirement,
  };
}

describe("tool registry", () => {
  it("requires registered capabilities and pins lookup to an exact version", () => {
    const registry = createToolRegistry();
    const capability = {
      key: normalizeCapabilityKey("search.web"),
      description: "Search the public web.",
    };

    expect(registry.registerCapability(capability).reused).toBe(false);
    expect(registry.registerCapability(capability).reused).toBe(true);

    const v1 = definition({
      key: "web-search",
      capability: capability.key,
      version: "v1",
    });
    const v2 = definition({
      ...v1,
      toolVersionId: createCanonicalId("tool-version"),
      key: "web-search",
      capability: capability.key,
      version: "v2",
    });

    expect(registry.registerTool(v1).reused).toBe(false);
    expect(registry.registerTool(v1).reused).toBe(true);
    expect(registry.registerTool(v2).reused).toBe(false);
    expect(registry.getToolByKeyVersion("web-search", "v1")).toEqual(
      registry.getToolVersion(v1.toolVersionId),
    );
    expect(registry.getToolByKeyVersion("web-search", "v2")?.toolVersionId).toBe(
      v2.toolVersionId,
    );
  });

  it("rejects definition overwrite and unknown capability references", () => {
    const registry = createToolRegistry();
    const capability = normalizeCapabilityKey("payments.charge");

    expect(() =>
      registry.registerTool(
        definition({
          key: "charge",
          capability,
          riskClass: "consequential",
          sideEffectClass: "external-consequential",
          idempotencyMode: "operation-bound",
          reconciliationMode: "on-unknown",
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "tool.capability_not_registered",
      }),
    );

    registry.registerCapability({
      key: capability,
      description: "Create an external payment charge.",
    });
    const charge = definition({
      key: "charge",
      capability,
      riskClass: "consequential",
      sideEffectClass: "external-consequential",
      idempotencyMode: "operation-bound",
      reconciliationMode: "on-unknown",
    });
    registry.registerTool(charge);

    expect(() =>
      registry.registerTool({
        ...charge,
        description: "Silently rewritten definition",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "tool.version_registration_conflict",
      }),
    );
  });

  it("refuses unsafe consequential definitions before registration", () => {
    const registry = createToolRegistry();
    const capability = normalizeCapabilityKey("messages.send");
    registry.registerCapability({
      key: capability,
      description: "Send a message to an external recipient.",
    });

    expect(() =>
      registry.registerTool(
        definition({
          key: "send-message",
          capability,
          riskClass: "consequential",
          sideEffectClass: "external-consequential",
          idempotencyMode: "caller-key",
          reconciliationMode: "none",
        }),
      ),
    ).toThrow(/operation-bound idempotency/u);

    expect(() =>
      registry.registerTool(
        definition({
          key: "send-message",
          capability,
          riskClass: "consequential",
          sideEffectClass: "external-consequential",
          idempotencyMode: "operation-bound",
          reconciliationMode: "none",
        }),
      ),
    ).toThrow(/reconciliation semantics/u);
  });

  it("inherits fail-closed explicit provider selection without fallback", () => {
    const tools = createToolRegistry();
    const capability = normalizeCapabilityKey("llm.generate");
    tools.registerCapability({
      key: capability,
      description: "Generate model output.",
    });
    const tool = definition({
      key: "generate",
      capability,
    });
    tools.registerTool(tool);

    const providers = createProviderRegistry();
    const explicitId = createCanonicalId("provider");
    const fallbackId = createCanonicalId("provider");

    providers.register({
      providerId: explicitId,
      key: "explicit-model-provider",
      version: "v1",
      displayName: "Explicit",
      capabilities: [capability],
      selectionPriority: 1,
      credentialSlots: [],
    });
    providers.register({
      providerId: fallbackId,
      key: "fallback-model-provider",
      version: "v1",
      displayName: "Fallback",
      capabilities: [capability],
      selectionPriority: 2,
      credentialSlots: [],
    });
    providers.setReadiness({
      providerId: explicitId,
      state: "unavailable",
      reasonCode: "provider.outage",
      checkedAt: toInstant("2026-10-02T09:30:00Z"),
    });
    providers.setReadiness({
      providerId: fallbackId,
      state: "ready",
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T09:30:00Z"),
    });

    expect(() =>
      selectProviderForTool(tool, providers, {
        providerId: explicitId,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.explicit_not_ready",
      }),
    );

    expect(selectProviderForTool(tool, providers)?.provider.providerId).toBe(
      fallbackId,
    );
  });
});
