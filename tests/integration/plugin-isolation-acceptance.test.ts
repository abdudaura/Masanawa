import { describe, expect, it } from "vitest";
import {
  normalizePluginInstallation,
  normalizePluginManifest,
  transitionPluginInstallation,
  type PluginInstallation,
  type PluginManifest,
} from "../../packages/plugins/src/model.js";
import {
  decidePluginVersionUpdate,
  evaluatePluginPermissions,
  planPluginUninstall,
  type PluginCapabilityGrant,
} from "../../packages/plugins/src/security.js";
import {
  normalizeExternalProtocolBridge,
} from "../../packages/plugins/src/protocol-bridge.js";

const manifest: PluginManifest = {
  schemaVersion: 1,
  pluginId: "acme.isolated",
  version: "1.0.0",
  displayName: "Acme Isolated",
  description: "Isolation acceptance fixture.",
  components: [
    {
      kind: "tool",
      key: "acme.lookup",
      entrypoint: "dist/tool.js",
    },
  ],
  requestedCapabilities: ["network.http", "tools.register"],
  dependencies: [],
};

const installation: PluginInstallation = {
  schemaVersion: 1,
  pluginId: manifest.pluginId,
  version: manifest.version,
  state: "enabled",
  revision: 3,
  installedAt: "2026-10-06T10:00:00Z",
  updatedAt: "2026-10-06T10:05:00Z",
  removedAt: null,
};

const grant: PluginCapabilityGrant = {
  pluginId: manifest.pluginId,
  pluginVersion: manifest.version,
  trustLevel: "untrusted",
  allowedCapabilities: ["tools.register"],
  deniedCapabilities: ["network.http"],
  issuedAt: "2026-10-06T10:00:00Z",
  expiresAt: "2026-10-07T10:00:00Z",
};

describe("Task 144 Plugin isolation and no-silent-self-mutation acceptance", () => {
  it("proves manifest capability requests do not become grants", () => {
    const normalized = normalizePluginManifest(manifest);
    expect(normalized.requestedCapabilities).toEqual([
      "network.http",
      "tools.register",
    ]);

    expect(
      evaluatePluginPermissions({
        manifest: normalized,
        grant,
        now: "2026-10-06T11:00:00Z",
      }),
    ).toEqual({
      grantedCapabilities: ["tools.register"],
      deniedCapabilities: ["network.http"],
    });
  });

  it("prevents a bridge from widening the Plugin component or capability boundary", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          schemaVersion: 1,
          bridgeId: "acme.bridge",
          pluginId: manifest.pluginId,
          pluginVersion: manifest.version,
          protocol: "mcp",
          transport: "http",
          endpoint: "https://mcp.example.com/",
          commandRef: null,
          authMode: "none",
          credentialRef: null,
          exposedComponentIdentities: [
            "acme.isolated/tool/acme.hidden",
          ],
          requiredCapabilities: ["network.http"],
        },
      }),
    ).toThrow("undeclared Plugin component");

    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          schemaVersion: 1,
          bridgeId: "acme.bridge",
          pluginId: manifest.pluginId,
          pluginVersion: manifest.version,
          protocol: "mcp",
          transport: "http",
          endpoint: "https://mcp.example.com/",
          commandRef: null,
          authMode: "none",
          credentialRef: null,
          exposedComponentIdentities: [
            "acme.isolated/tool/acme.lookup",
          ],
          requiredCapabilities: ["filesystem.write"],
        },
      }),
    ).toThrow("not requested by Plugin manifest");
  });

  it("rejects a self-requested major upgrade when trust policy requires verification", () => {
    const current = normalizePluginInstallation(installation);
    const before = JSON.stringify(current);

    const decision = decidePluginVersionUpdate({
      current,
      nextManifest: {
        ...manifest,
        version: "2.0.0",
      },
      currentGrant: grant,
      requireVerifiedForMajorUpgrade: true,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: "trust-required",
    });
    expect(JSON.stringify(current)).toBe(before);
    expect(current.version).toBe("1.0.0");
    expect(current.revision).toBe(3);
  });

  it("binds permission grants to the exact installed version", () => {
    expect(() =>
      evaluatePluginPermissions({
        manifest: { ...manifest, version: "1.0.1" },
        grant,
        now: "2026-10-06T11:00:00Z",
      }),
    ).toThrow("different version");
  });

  it("produces uninstall revocation instructions without silently removing the Plugin", () => {
    const current = normalizePluginInstallation(installation);
    const before = JSON.stringify(current);

    const plan = planPluginUninstall({
      manifest,
      installation: current,
      grant,
    });

    expect(plan).toEqual({
      pluginId: "acme.isolated",
      pluginVersion: "1.0.0",
      disableComponentIdentities: [
        "acme.isolated/tool/acme.lookup",
      ],
      revokeCapabilities: ["tools.register"],
      canRemoveAfterRevocation: true,
    });
    expect(JSON.stringify(current)).toBe(before);
    expect(current.state).toBe("enabled");
  });

  it("requires an explicit lifecycle transition after revocation and makes removal terminal", () => {
    const removed = transitionPluginInstallation({
      current: installation,
      nextState: "removed",
      occurredAt: "2026-10-06T11:00:00Z",
    });

    expect(removed).toMatchObject({
      state: "removed",
      revision: 4,
      removedAt: "2026-10-06T11:00:00.000Z",
    });
    expect(installation.state).toBe("enabled");

    expect(() =>
      transitionPluginInstallation({
        current: removed,
        nextState: "enabled",
        occurredAt: "2026-10-06T12:00:00Z",
      }),
    ).toThrow("Invalid Plugin lifecycle transition");
  });

  it("does not let expired authority survive through a previously normalized manifest", () => {
    const normalized = normalizePluginManifest(manifest);
    expect(
      evaluatePluginPermissions({
        manifest: normalized,
        grant,
        now: "2026-10-08T10:00:00Z",
      }),
    ).toEqual({
      grantedCapabilities: [],
      deniedCapabilities: ["network.http", "tools.register"],
    });
  });
});
