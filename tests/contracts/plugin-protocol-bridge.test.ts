import { describe, expect, it } from "vitest";
import {
  normalizeExternalBridgeInvocation,
  normalizeExternalProtocolBridge,
  type ExternalProtocolBridge,
} from "../../packages/plugins/src/protocol-bridge.js";
import type { PluginManifest } from "../../packages/plugins/src/model.js";

const manifest: PluginManifest = {
  schemaVersion: 1,
  pluginId: "acme.bridge",
  version: "1.0.0",
  displayName: "Acme Bridge",
  description: null,
  components: [
    {
      kind: "tool",
      key: "acme.lookup",
      entrypoint: "dist/tool.js",
    },
    {
      kind: "provider",
      key: "acme.remote-model",
      entrypoint: "dist/provider.js",
    },
  ],
  requestedCapabilities: [
    "network.http",
    "tools.register",
    "providers.register",
  ],
  dependencies: [],
};

const bridge: ExternalProtocolBridge = {
  schemaVersion: 1,
  bridgeId: "acme.mcp",
  pluginId: "acme.bridge",
  pluginVersion: "1.0.0",
  protocol: "mcp",
  transport: "http",
  endpoint: "https://mcp.example.com/v1",
  commandRef: null,
  authMode: "credential-ref",
  credentialRef: "credential-ref_mcp-prod",
  exposedComponentIdentities: [
    "acme.bridge/tool/acme.lookup",
  ],
  requiredCapabilities: [
    "network.http",
    "tools.register",
  ],
};

describe("Plugin external protocol bridge boundary", () => {
  it("normalizes an MCP network bridge without granting new capabilities", () => {
    const normalized = normalizeExternalProtocolBridge({
      manifest,
      bridge,
    });
    expect(normalized).toMatchObject({
      protocol: "mcp",
      transport: "http",
      endpoint: "https://mcp.example.com/v1",
      credentialRef: "credential-ref_mcp-prod",
      exposedComponentIdentities: [
        "acme.bridge/tool/acme.lookup",
      ],
      requiredCapabilities: [
        "network.http",
        "tools.register",
      ],
    });
    expect("grantedCapabilities" in normalized).toBe(false);
  });

  it("rejects undeclared component exposure", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          exposedComponentIdentities: [
            "acme.bridge/tool/hidden.tool",
          ],
        },
      }),
    ).toThrow("undeclared Plugin component");
  });

  it("rejects bridge capabilities that the Plugin did not request", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          requiredCapabilities: [
            "network.http",
            "filesystem.write",
          ],
        },
      }),
    ).toThrow("not requested by Plugin manifest");
  });

  it("rejects inline endpoint credentials and raw stdio command strings", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          endpoint: "https://user:secret@mcp.example.com/v1",
        },
      }),
    ).toThrow("inline credentials");

    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          transport: "stdio",
          endpoint: null,
          commandRef: "node ./server.js --token secret",
        },
      }),
    ).toThrow("opaque registered command reference");
  });

  it("requires A2A bridges to use network transport", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          protocol: "a2a",
          transport: "stdio",
          endpoint: null,
          commandRef: "registered-a2a-command",
        },
      }),
    ).toThrow("A2A bridge must use a network transport");
  });

  it("requires credential references when auth mode requests them", () => {
    expect(() =>
      normalizeExternalProtocolBridge({
        manifest,
        bridge: {
          ...bridge,
          credentialRef: null,
        },
      }),
    ).toThrow("requires credentialRef");
  });

  it("allows invocations only for components explicitly exposed by the bridge", () => {
    const normalized = normalizeExternalProtocolBridge({
      manifest,
      bridge,
    });

    expect(
      normalizeExternalBridgeInvocation({
        bridge: normalized,
        invocation: {
          schemaVersion: 1,
          bridgeId: "acme.mcp",
          componentIdentity: "acme.bridge/tool/acme.lookup",
          requestId: "request-000001",
          payloadRef: "payload-ref_000001",
        },
      }),
    ).toMatchObject({
      bridgeId: "acme.mcp",
      componentIdentity: "acme.bridge/tool/acme.lookup",
    });

    expect(() =>
      normalizeExternalBridgeInvocation({
        bridge: normalized,
        invocation: {
          schemaVersion: 1,
          bridgeId: "acme.mcp",
          componentIdentity:
            "acme.bridge/provider/acme.remote-model",
          requestId: "request-000002",
          payloadRef: "payload-ref_000002",
        },
      }),
    ).toThrow("not exposed by bridge");
  });
});
