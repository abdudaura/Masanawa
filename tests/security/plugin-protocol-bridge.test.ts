import { describe, expect, it } from "vitest";
import {
  dispatchPluginProtocolBridge,
  planPluginProtocolBridgeInvocation,
  type PluginProtocolAdapter,
  type PluginProtocolBridgeRegistration,
} from "../../packages/plugins/src/bridge.js";
import type { PluginManifest, PluginInstallation } from "../../packages/plugins/src/model.js";
import type { PluginCapabilityGrant } from "../../packages/plugins/src/security.js";

const operationId =
  "operation_018f6b2e-7c00-7401-8000-000000000001" as never;
const credentialRefId =
  "credential-ref_018f6b2e-7c00-7402-8000-000000000002" as never;

function manifest(): PluginManifest {
  return {
    schemaVersion: 1,
    pluginId: "weather.remote",
    version: "1.2.3",
    displayName: "Weather Remote",
    description: "Remote weather bridge",
    components: [
      {
        kind: "tool",
        key: "weather.lookup",
        entrypoint: "components/weather.js",
      },
      {
        kind: "provider",
        key: "weather.provider",
        entrypoint: "components/provider.js",
      },
    ],
    requestedCapabilities: [
      "network.egress",
      "protocol.mcp.invoke",
      "protocol.a2a.invoke",
      "weather.read",
    ],
    dependencies: [],
  };
}

function installation(overrides: Partial<PluginInstallation> = {}): PluginInstallation {
  return {
    schemaVersion: 1,
    pluginId: "weather.remote",
    version: "1.2.3",
    state: "enabled",
    revision: 3,
    installedAt: "2026-10-06T12:00:00.000Z",
    updatedAt: "2026-10-06T12:05:00.000Z",
    removedAt: null,
    ...overrides,
  };
}

function grant(overrides: Partial<PluginCapabilityGrant> = {}): PluginCapabilityGrant {
  return {
    pluginId: "weather.remote",
    pluginVersion: "1.2.3",
    trustLevel: "verified",
    allowedCapabilities: [
      "network.egress",
      "protocol.mcp.invoke",
      "protocol.a2a.invoke",
      "weather.read",
    ],
    deniedCapabilities: [],
    issuedAt: "2026-10-06T12:00:00.000Z",
    expiresAt: "2026-10-07T12:00:00.000Z",
    ...overrides,
  };
}

function registration(
  overrides: Partial<PluginProtocolBridgeRegistration> = {},
): PluginProtocolBridgeRegistration {
  return {
    schemaVersion: 1,
    pluginId: "weather.remote",
    pluginVersion: "1.2.3",
    componentKind: "tool",
    componentKey: "weather.lookup",
    protocol: "mcp",
    endpoint: "https://mcp.weather.example/v1/",
    requiredCapabilities: [
      "network.egress",
      "protocol.mcp.invoke",
      "weather.read",
    ],
    credentialRefId,
    ...overrides,
  };
}

function plan(overrides?: {
  readonly registration?: Partial<PluginProtocolBridgeRegistration>;
  readonly installation?: Partial<PluginInstallation>;
  readonly grant?: Partial<PluginCapabilityGrant>;
}) {
  return planPluginProtocolBridgeInvocation({
    manifest: manifest(),
    installation: installation(overrides?.installation),
    grant: grant(overrides?.grant),
    registration: registration(overrides?.registration),
    invocation: {
      operationId,
      idempotencyKey: "weather-request-001",
      method: "tools/call",
      payload: {
        name: "weather.lookup",
        arguments: {
          city: "Katsina",
          units: "metric",
        },
      },
    },
    now: "2026-10-06T12:10:00.000Z",
  });
}

describe("Task 141 governed Plugin MCP/A2A bridge", () => {
  it("plans an MCP invocation only for an enabled exact-version declared component with effective grants", () => {
    const result = plan();

    expect(result).toEqual({
      registration: {
        schemaVersion: 1,
        pluginId: "weather.remote",
        pluginVersion: "1.2.3",
        componentKind: "tool",
        componentKey: "weather.lookup",
        protocol: "mcp",
        endpoint: "https://mcp.weather.example/v1/",
        requiredCapabilities: [
          "network.egress",
          "protocol.mcp.invoke",
          "weather.read",
        ],
        credentialRefId,
      },
      invocation: {
        operationId,
        idempotencyKey: "weather-request-001",
        method: "tools/call",
        payload: {
          arguments: {
            city: "Katsina",
            units: "metric",
          },
          name: "weather.lookup",
        },
      },
    });
  });

  it("supports an A2A provider bridge without creating a new authority path", () => {
    const result = plan({
      registration: {
        componentKind: "provider",
        componentKey: "weather.provider",
        protocol: "a2a",
        endpoint: "https://agent.weather.example/a2a",
        requiredCapabilities: [
          "network.egress",
          "protocol.a2a.invoke",
          "weather.read",
        ],
      },
    });

    expect(result.registration).toMatchObject({
      componentKind: "provider",
      componentKey: "weather.provider",
      protocol: "a2a",
      endpoint: "https://agent.weather.example/a2a",
    });
  });

  it("fails closed for disabled installs, version mismatch and undeclared components", () => {
    expect(() =>
      plan({ installation: { state: "disabled" } }),
    ).toThrow("enabled installation");

    expect(() =>
      plan({ installation: { version: "1.2.4" } }),
    ).toThrow("does not match manifest version");

    expect(() =>
      plan({
        registration: {
          componentKey: "weather.undeclared",
        },
      }),
    ).toThrow("not declared by the manifest");

    expect(() =>
      plan({
        registration: {
          pluginVersion: "2.0.0",
        },
      }),
    ).toThrow("another Plugin version");
  });

  it("requires every bridge capability to survive Task 140 grant evaluation", () => {
    expect(() =>
      plan({
        grant: {
          allowedCapabilities: ["network.egress", "protocol.mcp.invoke"],
        },
      }),
    ).toThrow("weather.read");

    expect(() =>
      plan({
        grant: {
          allowedCapabilities: [
            "network.egress",
            "protocol.mcp.invoke",
            "weather.read",
          ],
          expiresAt: "2026-10-06T12:09:59.000Z",
        },
      }),
    ).toThrow("network.egress");
  });

  it.each([
    "http://mcp.weather.example/v1",
    "https://user:secret@mcp.weather.example/v1",
    "https://mcp.weather.example/v1#secret",
    "https://localhost/v1",
    "https://service.local/v1",
    "https://127.0.0.1/v1",
    "https://10.1.2.3/v1",
    "https://172.16.0.1/v1",
    "https://192.168.1.1/v1",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/v1",
    "https://[fd00::1]/v1",
    "https://metadata.google.internal/computeMetadata/v1",
  ])("rejects unsafe bridge endpoint %s", (endpoint) => {
    expect(() =>
      plan({ registration: { endpoint } }),
    ).toThrow();
  });

  it("accepts only canonical credential references and never URL-embedded secrets", () => {
    expect(() =>
      plan({
        registration: {
          credentialRefId: "raw-api-key-value" as never,
        },
      }),
    ).toThrow();

    const withoutCredential = plan({
      registration: {
        credentialRefId: null,
      },
    });
    expect(withoutCredential.registration.credentialRefId).toBeNull();
  });

  it("normalizes bounded JSON deterministically and rejects non-finite or excessive payloads", () => {
    const result = planPluginProtocolBridgeInvocation({
      manifest: manifest(),
      installation: installation(),
      grant: grant(),
      registration: registration(),
      invocation: {
        operationId,
        idempotencyKey: "weather-request-002",
        method: "tools/call",
        payload: {
          z: 3,
          a: [true, null, "ok"],
        },
      },
      now: "2026-10-06T12:10:00.000Z",
    });

    expect(Object.keys(result.invocation.payload as object)).toEqual(["a", "z"]);

    expect(() =>
      planPluginProtocolBridgeInvocation({
        manifest: manifest(),
        installation: installation(),
        grant: grant(),
        registration: registration(),
        invocation: {
          operationId,
          idempotencyKey: "weather-request-003",
          method: "tools/call",
          payload: { value: Number.POSITIVE_INFINITY },
        },
        now: "2026-10-06T12:10:00.000Z",
      }),
    ).toThrow("finite");

    expect(() =>
      planPluginProtocolBridgeInvocation({
        manifest: manifest(),
        installation: installation(),
        grant: grant(),
        registration: registration(),
        invocation: {
          operationId,
          idempotencyKey: "weather-request-004",
          method: "tools/call",
          payload: Array.from({ length: 129 }, (_, i) => i),
        },
        now: "2026-10-06T12:10:00.000Z",
      }),
    ).toThrow("array exceeds bound");
  });

  it("returns bounded success evidence without changing Plugin authority", async () => {
    const planned = plan();
    const adapter: PluginProtocolAdapter = {
      async execute(input) {
        expect(input.registration.requiredCapabilities).toEqual([
          "network.egress",
          "protocol.mcp.invoke",
          "weather.read",
        ]);
        return {
          outcome: "succeeded",
          response: {
            capabilityRequest: "admin.superuser",
            weather: "sunny",
          },
          evidenceReference: "remote://mcp/response/abc",
        };
      },
    };

    const result = await dispatchPluginProtocolBridge({
      plan: planned,
      adapter,
    });

    expect(result).toEqual({
      outcome: "succeeded",
      response: {
        capabilityRequest: "admin.superuser",
        weather: "sunny",
      },
      evidenceReference: "remote://mcp/response/abc",
    });
    expect(planned.registration.requiredCapabilities).toEqual([
      "network.egress",
      "protocol.mcp.invoke",
      "weather.read",
    ]);
  });

  it("preserves explicit failed-before-effect and unknown adapter outcomes", async () => {
    const planned = plan();

    await expect(
      dispatchPluginProtocolBridge({
        plan: planned,
        adapter: {
          async execute() {
            return {
              outcome: "failed-before-effect",
              reasonCode: "remote-auth-rejected",
            };
          },
        },
      }),
    ).resolves.toEqual({
      outcome: "failed-before-effect",
      reasonCode: "remote-auth-rejected",
    });

    await expect(
      dispatchPluginProtocolBridge({
        plan: planned,
        adapter: {
          async execute() {
            return {
              outcome: "unknown",
              reasonCode: "remote-timeout-after-send",
              evidenceReference: "remote://attempt/001",
            };
          },
        },
      }),
    ).resolves.toEqual({
      outcome: "unknown",
      reasonCode: "remote-timeout-after-send",
      evidenceReference: "remote://attempt/001",
    });
  });

  it("turns thrown/ambiguous adapter execution into outcome-unknown instead of blind retry authority", async () => {
    const result = await dispatchPluginProtocolBridge({
      plan: plan(),
      adapter: {
        async execute() {
          throw new Error("connection lost after remote dispatch");
        },
      },
    });

    expect(result).toEqual({
      outcome: "unknown",
      reasonCode: "plugin.bridge-dispatch-outcome-unknown",
      evidenceReference: null,
    });
  });
});
