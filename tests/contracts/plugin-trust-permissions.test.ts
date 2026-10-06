import { describe, expect, it } from "vitest";
import {
  decidePluginVersionUpdate,
  evaluatePluginPermissions,
  normalizePluginCapabilityGrant,
  planPluginUninstall,
  type PluginCapabilityGrant,
} from "../../packages/plugins/src/security.js";
import type {
  PluginInstallation,
  PluginManifest,
} from "../../packages/plugins/src/model.js";

const manifest: PluginManifest = {
  schemaVersion: 1,
  pluginId: "acme.research",
  version: "1.2.3",
  displayName: "Acme Research",
  description: null,
  components: [
    { kind: "tool", key: "acme.lookup", entrypoint: "dist/tool.js" },
    { kind: "provider", key: "acme.search", entrypoint: "dist/provider.js" },
  ],
  requestedCapabilities: [
    "network.http",
    "tools.register",
    "providers.register",
  ],
  dependencies: [],
};

const installation: PluginInstallation = {
  schemaVersion: 1,
  pluginId: manifest.pluginId,
  version: manifest.version,
  state: "enabled",
  revision: 3,
  installedAt: "2026-10-06T10:00:00Z",
  updatedAt: "2026-10-06T10:10:00Z",
  removedAt: null,
};

const grant: PluginCapabilityGrant = {
  pluginId: manifest.pluginId,
  pluginVersion: manifest.version,
  trustLevel: "verified",
  allowedCapabilities: ["network.http", "tools.register"],
  deniedCapabilities: ["providers.register"],
  issuedAt: "2026-10-06T10:00:00Z",
  expiresAt: "2026-10-07T10:00:00Z",
};

describe("Plugin trust permissions versioning and uninstall", () => {
  it("grants only the intersection of requested and explicitly allowed capabilities", () => {
    expect(
      evaluatePluginPermissions({
        manifest,
        grant,
        now: "2026-10-06T12:00:00Z",
      }),
    ).toEqual({
      grantedCapabilities: ["network.http", "tools.register"],
      deniedCapabilities: ["providers.register"],
    });
  });

  it("treats an expired grant as no authority", () => {
    expect(
      evaluatePluginPermissions({
        manifest,
        grant,
        now: "2026-10-08T12:00:00Z",
      }),
    ).toEqual({
      grantedCapabilities: [],
      deniedCapabilities: [
        "network.http",
        "providers.register",
        "tools.register",
      ],
    });
  });

  it("binds grants to an exact Plugin version", () => {
    expect(() =>
      evaluatePluginPermissions({
        manifest: { ...manifest, version: "1.2.4" },
        grant,
        now: "2026-10-06T12:00:00Z",
      }),
    ).toThrow("different version");
  });

  it("rejects capability grant contradictions and invalid expiry", () => {
    expect(() =>
      normalizePluginCapabilityGrant({
        ...grant,
        allowedCapabilities: ["network.http"],
        deniedCapabilities: ["NETWORK.HTTP"],
      }),
    ).toThrow("both allowed and denied");

    expect(() =>
      normalizePluginCapabilityGrant({
        ...grant,
        expiresAt: grant.issuedAt,
      }),
    ).toThrow("after issuedAt");
  });

  it("denies downgrades and can require verified trust for major upgrades", () => {
    expect(
      decidePluginVersionUpdate({
        current: installation,
        nextManifest: { ...manifest, version: "1.1.9" },
        currentGrant: grant,
        requireVerifiedForMajorUpgrade: true,
      }),
    ).toEqual({ allowed: false, reason: "downgrade-denied" });

    expect(
      decidePluginVersionUpdate({
        current: installation,
        nextManifest: { ...manifest, version: "2.0.0" },
        currentGrant: { ...grant, trustLevel: "untrusted" },
        requireVerifiedForMajorUpgrade: true,
      }),
    ).toEqual({ allowed: false, reason: "trust-required" });
  });

  it("produces explicit uninstall ordering inputs before removal", () => {
    expect(
      planPluginUninstall({ manifest, installation, grant }),
    ).toEqual({
      pluginId: "acme.research",
      pluginVersion: "1.2.3",
      disableComponentIdentities: [
        "acme.research/provider/acme.search",
        "acme.research/tool/acme.lookup",
      ],
      revokeCapabilities: ["network.http", "tools.register"],
      canRemoveAfterRevocation: true,
    });
  });

  it("refuses uninstall against a mismatched manifest/version", () => {
    expect(() =>
      planPluginUninstall({
        manifest: { ...manifest, version: "1.2.4" },
        installation,
        grant,
      }),
    ).toThrow("does not match installation");
  });
});
