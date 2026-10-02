import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "./registry.js";
import type { ProviderDefinition } from "./model.js";

function provider(
  input: Partial<ProviderDefinition> & {
    key: string;
    capability: string;
    priority: number;
  },
): ProviderDefinition {
  return {
    providerId: input.providerId ?? createCanonicalId("provider"),
    key: input.key,
    version: input.version ?? "v1",
    displayName: input.displayName ?? input.key,
    capabilities: [
      normalizeCapabilityKey(input.capability),
      ...(input.capabilities ?? []),
    ],
    selectionPriority: input.priority,
    credentialSlots: input.credentialSlots ?? [],
  };
}

describe("provider registry", () => {
  it("selects only ready providers and orders defaults deterministically", () => {
    const registry = createProviderRegistry();
    const capability = normalizeCapabilityKey("llm.generate");
    const slower = provider({
      key: "provider-z",
      capability,
      priority: 20,
    });
    const preferred = provider({
      key: "provider-a",
      capability,
      priority: 10,
    });

    registry.register(slower);
    registry.register(preferred);
    registry.setReadiness({
      providerId: slower.providerId,
      state: "ready",
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T09:00:00Z"),
    });
    registry.setReadiness({
      providerId: preferred.providerId,
      state: "ready",
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T09:00:00Z"),
    });

    expect(registry.select({ capability }).provider.providerId).toBe(
      preferred.providerId,
    );
  });

  it("never falls back when an explicitly selected provider is not ready", () => {
    const registry = createProviderRegistry();
    const capability = normalizeCapabilityKey("llm.generate");
    const explicit = provider({
      key: "explicit-provider",
      capability,
      priority: 1,
    });
    const fallback = provider({
      key: "healthy-fallback",
      capability,
      priority: 2,
    });

    registry.register(explicit);
    registry.register(fallback);
    registry.setReadiness({
      providerId: explicit.providerId,
      state: "degraded",
      reasonCode: "provider.rate-limited",
      checkedAt: toInstant("2026-10-02T09:00:00Z"),
    });
    registry.setReadiness({
      providerId: fallback.providerId,
      state: "ready",
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T09:00:00Z"),
    });

    expect(() =>
      registry.select({
        capability,
        providerId: explicit.providerId,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.explicit_not_ready",
      }),
    );

    expect(() =>
      registry.select({
        capability,
        providerKey: explicit.key,
        providerVersion: explicit.version,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.explicit_not_ready",
      }),
    );
  });

  it("makes exact registration replay idempotent and rejects identity overwrite", () => {
    const registry = createProviderRegistry();
    const first = provider({
      key: "fixture-provider",
      capability: "search.web",
      priority: 5,
    });

    expect(registry.register(first).reused).toBe(false);
    expect(registry.register(first).reused).toBe(true);

    expect(() =>
      registry.register({
        ...first,
        displayName: "Rewritten provider identity",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.registration_id_conflict",
      }),
    );

    expect(() =>
      registry.register({
        ...first,
        providerId: createCanonicalId("provider"),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.registration_key_version_conflict",
      }),
    );
  });

  it("rejects stale readiness observations and unavailable capability selection", () => {
    const registry = createProviderRegistry();
    const definition = provider({
      key: "fixture-provider",
      capability: "search.web",
      priority: 5,
    });
    registry.register(definition);
    registry.setReadiness({
      providerId: definition.providerId,
      state: "ready",
      reasonCode: null,
      checkedAt: toInstant("2026-10-02T09:10:00Z"),
    });

    expect(() =>
      registry.setReadiness({
        providerId: definition.providerId,
        state: "unavailable",
        reasonCode: "provider.network",
        checkedAt: toInstant("2026-10-02T09:09:00Z"),
      }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.readiness_stale",
      }),
    );

    expect(() =>
      registry.select({ capability: "payments.charge" }),
    ).toThrow(
      expect.objectContaining({
        code: "provider.capability_unavailable",
      }),
    );
  });
});
