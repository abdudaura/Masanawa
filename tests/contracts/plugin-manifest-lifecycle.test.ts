import { describe, expect, it } from "vitest";
import {
  normalizePluginInstallation,
  normalizePluginManifest,
  pluginComponentIdentity,
  transitionPluginInstallation,
  type PluginInstallation,
  type PluginManifest,
} from "../../packages/plugins/src/index.js";

const manifest: PluginManifest = {
  schemaVersion: 1,
  pluginId: "acme.research",
  version: "1.2.3",
  displayName: "Acme Research",
  description: "Registers research components without owning platform state.",
  components: [
    {
      kind: "provider",
      key: "acme.search",
      entrypoint: "dist/provider.js",
    },
    {
      kind: "tool",
      key: "acme.lookup",
      entrypoint: "dist/tool.js",
    },
  ],
  requestedCapabilities: [
    "network.http",
    "tools.register",
  ],
  dependencies: [
    { pluginId: "masanawa.base", versionRange: "^1.0.0" },
  ],
};

describe("Plugin manifest and lifecycle model", () => {
  it("normalizes manifest registrations, capability declarations and dependencies", () => {
    const normalized = normalizePluginManifest(manifest);
    expect(normalized).toMatchObject({
      pluginId: "acme.research",
      version: "1.2.3",
      requestedCapabilities: ["network.http", "tools.register"],
    });
    expect(normalized.components).toHaveLength(2);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it("produces globally collision-resistant component registration identity", () => {
    expect(
      pluginComponentIdentity({
        pluginId: manifest.pluginId,
        component: manifest.components[1]!,
      }),
    ).toBe("acme.research/tool/acme.lookup");
  });

  it("rejects duplicate registrations and duplicate requested capabilities", () => {
    expect(() =>
      normalizePluginManifest({
        ...manifest,
        components: [
          manifest.components[0]!,
          manifest.components[0]!,
        ],
      }),
    ).toThrow("duplicate component");

    expect(() =>
      normalizePluginManifest({
        ...manifest,
        requestedCapabilities: ["network.http", "NETWORK.HTTP"],
      }),
    ).toThrow("duplicate requested capability");
  });

  it("rejects self-dependency and unsafe component entrypoints", () => {
    expect(() =>
      normalizePluginManifest({
        ...manifest,
        dependencies: [
          { pluginId: "acme.research", versionRange: "^1.0.0" },
        ],
      }),
    ).toThrow("cannot depend on itself");

    expect(() =>
      normalizePluginManifest({
        ...manifest,
        components: [
          {
            kind: "tool",
            key: "bad.tool",
            entrypoint: "../outside.js",
          },
        ],
      }),
    ).toThrow("plugin-relative");
  });

  it("keeps requested capabilities declarative rather than treating them as grants", () => {
    const normalized = normalizePluginManifest(manifest);
    expect(normalized.requestedCapabilities).toContain("network.http");
    expect("grantedCapabilities" in normalized).toBe(false);
  });

  it("supports discovered -> installed -> enabled -> disabled -> removed lifecycle", () => {
    const discovered: PluginInstallation = {
      schemaVersion: 1,
      pluginId: manifest.pluginId,
      version: manifest.version,
      state: "discovered",
      revision: 1,
      installedAt: null,
      updatedAt: "2026-10-06T12:00:00Z",
      removedAt: null,
    };

    const installed = transitionPluginInstallation({
      current: discovered,
      nextState: "installed",
      occurredAt: "2026-10-06T12:01:00Z",
    });
    const enabled = transitionPluginInstallation({
      current: installed,
      nextState: "enabled",
      occurredAt: "2026-10-06T12:02:00Z",
    });
    const disabled = transitionPluginInstallation({
      current: enabled,
      nextState: "disabled",
      occurredAt: "2026-10-06T12:03:00Z",
    });
    const removed = transitionPluginInstallation({
      current: disabled,
      nextState: "removed",
      occurredAt: "2026-10-06T12:04:00Z",
    });

    expect(removed).toMatchObject({
      state: "removed",
      revision: 5,
      installedAt: "2026-10-06T12:01:00.000Z",
      removedAt: "2026-10-06T12:04:00.000Z",
    });
  });

  it("makes removal terminal and rejects inconsistent lifecycle snapshots", () => {
    const removed = normalizePluginInstallation({
      schemaVersion: 1,
      pluginId: manifest.pluginId,
      version: manifest.version,
      state: "removed",
      revision: 3,
      installedAt: "2026-10-06T12:00:00Z",
      updatedAt: "2026-10-06T13:00:00Z",
      removedAt: "2026-10-06T13:00:00Z",
    });

    expect(() =>
      transitionPluginInstallation({
        current: removed,
        nextState: "enabled",
        occurredAt: "2026-10-06T14:00:00Z",
      }),
    ).toThrow("Invalid Plugin lifecycle transition");

    expect(() =>
      normalizePluginInstallation({
        ...removed,
        state: "enabled",
      }),
    ).toThrow("lifecycle is inconsistent");
  });
});
