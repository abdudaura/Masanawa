import {
  normalizePluginManifest,
  pluginComponentIdentity,
  type PluginManifest,
} from "./model.js";

export type ExternalBridgeProtocol = "mcp" | "a2a" | "custom";
export type ExternalBridgeTransport = "http" | "websocket" | "stdio";
export type ExternalBridgeAuthMode = "none" | "credential-ref";

export interface ExternalProtocolBridge {
  readonly schemaVersion: 1;
  readonly bridgeId: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly protocol: ExternalBridgeProtocol;
  readonly transport: ExternalBridgeTransport;
  readonly endpoint: string | null;
  readonly commandRef: string | null;
  readonly authMode: ExternalBridgeAuthMode;
  readonly credentialRef: string | null;
  readonly exposedComponentIdentities: readonly string[];
  readonly requiredCapabilities: readonly string[];
}

export interface ExternalBridgeInvocation {
  readonly schemaVersion: 1;
  readonly bridgeId: string;
  readonly componentIdentity: string;
  readonly requestId: string;
  readonly payloadRef: string;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function capability(value: string): string {
  const normalized = bounded(value, "capability", 3, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("capability is invalid");
  }
  return normalized;
}

function bridgeId(value: string): string {
  const normalized = bounded(value, "bridgeId", 3, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("bridgeId is invalid");
  }
  return normalized;
}

function endpoint(value: string): string {
  const normalized = bounded(value, "endpoint", 1, 2048);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError("endpoint is invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "wss:") {
    throw new TypeError("endpoint must use https or wss");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError("endpoint must not contain inline credentials");
  }
  return parsed.toString();
}

function credentialRef(value: string): string {
  const normalized = bounded(value, "credentialRef", 8, 220);
  if (
    normalized.includes("://") ||
    normalized.includes("@") ||
    normalized.includes("=")
  ) {
    throw new TypeError("credentialRef must be an opaque reference");
  }
  return normalized;
}

function commandRef(value: string): string {
  const normalized = bounded(value, "commandRef", 8, 220);
  if (
    normalized.includes(" ") ||
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes(";") ||
    normalized.includes("&") ||
    normalized.includes("|")
  ) {
    throw new TypeError("commandRef must be an opaque registered command reference");
  }
  return normalized;
}

function normalizedList(
  values: readonly string[],
  name: string,
  normalizer: (value: string) => string,
  max: number,
): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > max) {
    throw new RangeError(`${name} must contain 1 to ${max} items`);
  }
  const normalized = values.map(normalizer).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${name} contains duplicates`);
  }
  return Object.freeze(normalized);
}

export function normalizeExternalProtocolBridge(input: {
  readonly manifest: PluginManifest;
  readonly bridge: ExternalProtocolBridge;
}): ExternalProtocolBridge {
  const manifest = normalizePluginManifest(input.manifest);
  const bridge = input.bridge;

  if (bridge.schemaVersion !== 1) {
    throw new TypeError("Unsupported external bridge schemaVersion");
  }
  if (
    bridge.protocol !== "mcp" &&
    bridge.protocol !== "a2a" &&
    bridge.protocol !== "custom"
  ) {
    throw new TypeError("protocol is invalid");
  }
  if (
    bridge.transport !== "http" &&
    bridge.transport !== "websocket" &&
    bridge.transport !== "stdio"
  ) {
    throw new TypeError("transport is invalid");
  }
  if (
    bridge.authMode !== "none" &&
    bridge.authMode !== "credential-ref"
  ) {
    throw new TypeError("authMode is invalid");
  }
  if (
    bridge.pluginId !== manifest.pluginId ||
    bridge.pluginVersion !== manifest.version
  ) {
    throw new Error("External bridge does not match Plugin manifest identity");
  }

  const networkTransport =
    bridge.transport === "http" || bridge.transport === "websocket";

  const normalizedEndpoint =
    bridge.endpoint === null ? null : endpoint(bridge.endpoint);
  const normalizedCommandRef =
    bridge.commandRef === null ? null : commandRef(bridge.commandRef);

  if (networkTransport && normalizedEndpoint === null) {
    throw new Error("Network bridge requires endpoint");
  }
  if (networkTransport && normalizedCommandRef !== null) {
    throw new Error("Network bridge must not carry commandRef");
  }
  if (bridge.transport === "stdio" && normalizedCommandRef === null) {
    throw new Error("stdio bridge requires commandRef");
  }
  if (bridge.transport === "stdio" && normalizedEndpoint !== null) {
    throw new Error("stdio bridge must not carry endpoint");
  }
  if (bridge.protocol === "a2a" && bridge.transport === "stdio") {
    throw new Error("A2A bridge must use a network transport");
  }

  const normalizedCredentialRef =
    bridge.credentialRef === null ? null : credentialRef(bridge.credentialRef);
  if (
    bridge.authMode === "credential-ref" &&
    normalizedCredentialRef === null
  ) {
    throw new Error("credential-ref auth requires credentialRef");
  }
  if (bridge.authMode === "none" && normalizedCredentialRef !== null) {
    throw new Error("authMode none must not carry credentialRef");
  }

  const declaredComponents = new Set(
    manifest.components.map((component) =>
      pluginComponentIdentity({
        pluginId: manifest.pluginId,
        component,
      }),
    ),
  );

  const exposedComponentIdentities = normalizedList(
    bridge.exposedComponentIdentities,
    "exposedComponentIdentities",
    (value) => bounded(value, "componentIdentity", 5, 360),
    128,
  );
  for (const identity of exposedComponentIdentities) {
    if (!declaredComponents.has(identity)) {
      throw new Error("External bridge exposes undeclared Plugin component");
    }
  }

  const requiredCapabilities = normalizedList(
    bridge.requiredCapabilities,
    "requiredCapabilities",
    capability,
    128,
  );
  for (const required of requiredCapabilities) {
    if (!manifest.requestedCapabilities.includes(required)) {
      throw new Error(
        "External bridge requires capability not requested by Plugin manifest",
      );
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    bridgeId: bridgeId(bridge.bridgeId),
    pluginId: manifest.pluginId,
    pluginVersion: manifest.version,
    protocol: bridge.protocol,
    transport: bridge.transport,
    endpoint: normalizedEndpoint,
    commandRef: normalizedCommandRef,
    authMode: bridge.authMode,
    credentialRef: normalizedCredentialRef,
    exposedComponentIdentities,
    requiredCapabilities,
  });
}

export function normalizeExternalBridgeInvocation(input: {
  readonly bridge: ExternalProtocolBridge;
  readonly invocation: ExternalBridgeInvocation;
}): ExternalBridgeInvocation {
  if (input.invocation.schemaVersion !== 1) {
    throw new TypeError("Unsupported bridge invocation schemaVersion");
  }
  if (input.invocation.bridgeId !== input.bridge.bridgeId) {
    throw new Error("Invocation targets a different external bridge");
  }
  if (
    !input.bridge.exposedComponentIdentities.includes(
      input.invocation.componentIdentity,
    )
  ) {
    throw new Error("Invocation targets component not exposed by bridge");
  }

  return Object.freeze({
    schemaVersion: 1,
    bridgeId: bridgeId(input.invocation.bridgeId),
    componentIdentity: bounded(
      input.invocation.componentIdentity,
      "componentIdentity",
      5,
      360,
    ),
    requestId: bounded(input.invocation.requestId, "requestId", 8, 220),
    payloadRef: bounded(input.invocation.payloadRef, "payloadRef", 8, 2048),
  });
}
