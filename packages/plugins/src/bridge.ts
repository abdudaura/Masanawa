import {
  parseCanonicalId,
  type CredentialRefId,
  type OperationId,
} from "@masanawa/contracts";
import {
  normalizePluginInstallation,
  normalizePluginManifest,
  type PluginInstallation,
  type PluginManifest,
} from "./model.js";
import {
  evaluatePluginPermissions,
  type PluginCapabilityGrant,
} from "./security.js";

export type PluginBridgeProtocol = "mcp" | "a2a";
export type PluginBridgeJson =
  | null
  | boolean
  | number
  | string
  | readonly PluginBridgeJson[]
  | { readonly [key: string]: PluginBridgeJson };

export interface PluginProtocolBridgeRegistration {
  readonly schemaVersion: 1;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly componentKind: "tool" | "provider";
  readonly componentKey: string;
  readonly protocol: PluginBridgeProtocol;
  readonly endpoint: string;
  readonly requiredCapabilities: readonly string[];
  readonly credentialRefId: CredentialRefId | null;
}

export interface PluginProtocolInvocation {
  readonly operationId: OperationId;
  readonly idempotencyKey: string;
  readonly method: string;
  readonly payload: PluginBridgeJson;
}

export interface PluginProtocolBridgePlan {
  readonly registration: PluginProtocolBridgeRegistration;
  readonly invocation: PluginProtocolInvocation;
}

export type PluginProtocolAdapterResult =
  | {
      readonly outcome: "succeeded";
      readonly response: PluginBridgeJson;
      readonly evidenceReference: string;
    }
  | {
      readonly outcome: "failed-before-effect";
      readonly reasonCode: string;
    }
  | {
      readonly outcome: "unknown";
      readonly reasonCode: string;
      readonly evidenceReference: string | null;
    };

export interface PluginProtocolAdapter {
  execute(plan: PluginProtocolBridgePlan): Promise<PluginProtocolAdapterResult>;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
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

function componentKey(value: string): string {
  const normalized = bounded(value, "componentKey", 3, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("componentKey is invalid");
  }
  return normalized;
}

function method(value: string): string {
  const normalized = bounded(value, "method", 1, 240);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(normalized)) {
    throw new TypeError("bridge method is invalid");
  }
  return normalized;
}

function ipv4Octets(hostname: string): readonly number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) {
    return null;
  }
  const octets = parts.map(Number);
  return octets.every((value) => value >= 0 && value <= 255)
    ? octets
    : null;
}

function isForbiddenIpv4(hostname: string): boolean {
  const octets = ipv4Octets(hostname);
  if (octets === null) return false;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224
  );
}

function isForbiddenIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (!normalized.includes(":")) return false;
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function endpoint(value: string): string {
  const normalized = bounded(value, "endpoint", 8, 2048);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError("bridge endpoint must be an absolute HTTPS URL");
  }
  if (parsed.protocol !== "https:") {
    throw new TypeError("bridge endpoint must use HTTPS");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new TypeError("bridge endpoint cannot embed credentials");
  }
  if (parsed.hash !== "") {
    throw new TypeError("bridge endpoint cannot contain a fragment");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal" ||
    hostname === "instance-data.ec2.internal" ||
    isForbiddenIpv4(hostname) ||
    isForbiddenIpv6(hostname)
  ) {
    throw new TypeError("bridge endpoint targets a forbidden local/private host");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";
  return parsed.toString();
}

interface JsonBudget {
  nodes: number;
}

function normalizeJson(
  value: PluginBridgeJson,
  depth: number,
  budget: JsonBudget,
): PluginBridgeJson {
  budget.nodes += 1;
  if (budget.nodes > 1024) {
    throw new RangeError("bridge JSON payload exceeds node bound");
  }
  if (depth > 10) {
    throw new RangeError("bridge JSON payload exceeds depth bound");
  }

  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("bridge JSON numbers must be finite");
    }
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 32_000 || /\0/u.test(value)) {
      throw new RangeError("bridge JSON string exceeds bound");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 128) {
      throw new RangeError("bridge JSON array exceeds bound");
    }
    return Object.freeze(
      value.map((item) => normalizeJson(item, depth + 1, budget)),
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("bridge JSON objects must be plain");
    }
    const entries = Object.entries(value);
    if (entries.length > 256) {
      throw new RangeError("bridge JSON object exceeds key bound");
    }
    const normalizedEntries = entries
      .map(([key, child]) => [
        bounded(key, "bridge JSON key", 1, 256),
        normalizeJson(child, depth + 1, budget),
      ] as const)
      .sort(([left], [right]) => left.localeCompare(right));
    if (new Set(normalizedEntries.map(([key]) => key)).size !== normalizedEntries.length) {
      throw new Error("bridge JSON object contains duplicate normalized keys");
    }
    return Object.freeze(Object.fromEntries(normalizedEntries)) as PluginBridgeJson;
  }
  throw new TypeError("bridge payload is not JSON-compatible");
}

function normalizeCapabilities(
  values: readonly string[],
): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 64) {
    throw new RangeError("requiredCapabilities must contain 1..64 entries");
  }
  const normalized = values.map(capability).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("requiredCapabilities contains duplicates");
  }
  return Object.freeze(normalized);
}

function normalizeRegistration(
  input: PluginProtocolBridgeRegistration,
): PluginProtocolBridgeRegistration {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Plugin bridge schemaVersion");
  }
  if (input.protocol !== "mcp" && input.protocol !== "a2a") {
    throw new TypeError("bridge protocol is invalid");
  }
  if (input.componentKind !== "tool" && input.componentKind !== "provider") {
    throw new TypeError("bridge componentKind must be tool or provider");
  }

  return Object.freeze({
    schemaVersion: 1,
    pluginId: bounded(input.pluginId, "pluginId", 3, 120).toLowerCase(),
    pluginVersion: bounded(input.pluginVersion, "pluginVersion", 5, 64),
    componentKind: input.componentKind,
    componentKey: componentKey(input.componentKey),
    protocol: input.protocol,
    endpoint: endpoint(input.endpoint),
    requiredCapabilities: normalizeCapabilities(input.requiredCapabilities),
    credentialRefId:
      input.credentialRefId === null
        ? null
        : parseCanonicalId("credential-ref", input.credentialRefId),
  });
}

function normalizeInvocation(
  input: PluginProtocolInvocation,
): PluginProtocolInvocation {
  return Object.freeze({
    operationId: parseCanonicalId("operation", input.operationId),
    idempotencyKey: bounded(input.idempotencyKey, "idempotencyKey", 1, 256),
    method: method(input.method),
    payload: normalizeJson(input.payload, 0, { nodes: 0 }),
  });
}

function assertEnabledInstallation(input: {
  readonly manifest: PluginManifest;
  readonly installation: PluginInstallation;
}): void {
  const installation = normalizePluginInstallation(input.installation);
  if (
    installation.pluginId !== input.manifest.pluginId ||
    installation.version !== input.manifest.version
  ) {
    throw new Error("Plugin bridge installation does not match manifest version");
  }
  if (installation.state !== "enabled") {
    throw new Error("Plugin bridge requires an enabled installation");
  }
}

export function planPluginProtocolBridgeInvocation(input: {
  readonly manifest: PluginManifest;
  readonly installation: PluginInstallation;
  readonly grant: PluginCapabilityGrant;
  readonly registration: PluginProtocolBridgeRegistration;
  readonly invocation: PluginProtocolInvocation;
  readonly now: string;
}): PluginProtocolBridgePlan {
  const manifest = normalizePluginManifest(input.manifest);
  assertEnabledInstallation({
    manifest,
    installation: input.installation,
  });
  const registration = normalizeRegistration(input.registration);

  if (
    registration.pluginId !== manifest.pluginId ||
    registration.pluginVersion !== manifest.version
  ) {
    throw new Error("Plugin bridge registration is bound to another Plugin version");
  }

  const component = manifest.components.find(
    (candidate) =>
      candidate.kind === registration.componentKind &&
      candidate.key === registration.componentKey,
  );
  if (component === undefined) {
    throw new Error("Plugin bridge component is not declared by the manifest");
  }

  const permission = evaluatePluginPermissions({
    manifest,
    grant: input.grant,
    now: input.now,
  });
  const missingCapabilities = registration.requiredCapabilities.filter(
    (required) => !permission.grantedCapabilities.includes(required),
  );
  if (missingCapabilities.length > 0) {
    throw new Error(
      `Plugin bridge capability is not granted: ${missingCapabilities[0]}`,
    );
  }

  return Object.freeze({
    registration,
    invocation: normalizeInvocation(input.invocation),
  });
}

function normalizeAdapterResult(
  result: PluginProtocolAdapterResult,
): PluginProtocolAdapterResult {
  if (result.outcome === "succeeded") {
    return Object.freeze({
      outcome: "succeeded" as const,
      response: normalizeJson(result.response, 0, { nodes: 0 }),
      evidenceReference: bounded(
        result.evidenceReference,
        "evidenceReference",
        1,
        2048,
      ),
    });
  }
  if (result.outcome === "failed-before-effect") {
    return Object.freeze({
      outcome: "failed-before-effect" as const,
      reasonCode: bounded(result.reasonCode, "reasonCode", 1, 160),
    });
  }
  if (result.outcome === "unknown") {
    return Object.freeze({
      outcome: "unknown" as const,
      reasonCode: bounded(result.reasonCode, "reasonCode", 1, 160),
      evidenceReference:
        result.evidenceReference === null
          ? null
          : bounded(result.evidenceReference, "evidenceReference", 1, 2048),
    });
  }
  throw new TypeError("Plugin protocol adapter result is invalid");
}

export async function dispatchPluginProtocolBridge(input: {
  readonly plan: PluginProtocolBridgePlan;
  readonly adapter: PluginProtocolAdapter;
}): Promise<PluginProtocolAdapterResult> {
  try {
    return normalizeAdapterResult(await input.adapter.execute(input.plan));
  } catch {
    return Object.freeze({
      outcome: "unknown" as const,
      reasonCode: "plugin.bridge-dispatch-outcome-unknown",
      evidenceReference: null,
    });
  }
}
