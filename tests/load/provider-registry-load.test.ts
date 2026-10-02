import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import {
  createProviderRegistry,
  type ProviderDefinition,
} from "@masanawa/providers";
import { describe, expect, it } from "vitest";

describe("bounded provider-registry load smoke", () => {
  it("preserves deterministic readiness and selection across 2000 providers", () => {
    const registry = createProviderRegistry();
    const capability = normalizeCapabilityKey("load.synthetic");
    const checkedAt = toInstant("2026-10-02T12:00:00Z");
    const providerCount = 2_000;
    let preferred: ProviderDefinition | null = null;

    for (let index = 0; index < providerCount; index += 1) {
      const definition: ProviderDefinition = {
        providerId: createCanonicalId("provider"),
        key: `load-provider-${index.toString().padStart(4, "0")}`,
        version: "v1",
        displayName: `Load Provider ${index}`,
        capabilities: [capability],
        selectionPriority: index,
        credentialSlots: [],
      };

      registry.register(definition);
      registry.setReadiness({
        providerId: definition.providerId,
        state: "ready",
        reasonCode: null,
        checkedAt,
      });

      if (index === 0) {
        preferred = definition;
      }
    }

    expect(registry.list()).toHaveLength(providerCount);
    expect(preferred).not.toBeNull();

    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(registry.select({ capability }).provider.providerId).toBe(
        preferred!.providerId,
      );
    }
  });
});
