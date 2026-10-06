import {
  normalizePluginManifest,
  type PluginComponentRegistration,
  type PluginInstallation,
  type PluginManifest,
} from "./model.js";

export type PluginTrustLevel = "untrusted" | "verified" | "platform";

export interface PluginCapabilityGrant {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly trustLevel: PluginTrustLevel;
  readonly allowedCapabilities: readonly string[];
  readonly deniedCapabilities: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt: string | null;
}

export interface PluginPermissionDecision {
  readonly grantedCapabilities: readonly string[];
  readonly deniedCapabilities: readonly string[];
}

export interface PluginVersionUpdateDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "downgrade-denied"
    | "grant-version-mismatch"
    | "trust-required";
}

export interface PluginUninstallPlan {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly disableComponentIdentities: readonly string[];
  readonly revokeCapabilities: readonly string[];
  readonly canRemoveAfterRevocation: boolean;
}

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function instant(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${name} is invalid`);
  return parsed.toISOString();
}

function capability(value: string): string {
  const normalized = bounded(value, "capability", 3, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("capability is invalid");
  }
  return normalized;
}

function pluginId(value: string): string {
  const normalized = bounded(value, "pluginId", 3, 120).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(normalized)) {
    throw new TypeError("pluginId is invalid");
  }
  return normalized;
}

function versionParts(value: string): readonly [number, number, number] {
  const normalized = bounded(value, "version", 5, 64);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u.exec(normalized);
  if (!match) throw new TypeError("version must be semantic version syntax");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return 0;
}

function trustLevel(value: PluginTrustLevel): PluginTrustLevel {
  if (value !== "untrusted" && value !== "verified" && value !== "platform") {
    throw new TypeError("trustLevel is invalid");
  }
  return value;
}

function normalizedCapabilities(
  values: readonly string[],
  name: string,
): readonly string[] {
  if (!Array.isArray(values) || values.length > 128) {
    throw new RangeError(`${name} exceeds its bound`);
  }
  const normalized = values.map(capability).sort();
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${name} contains duplicates`);
  }
  return Object.freeze(normalized);
}

function componentIdentity(
  plugin: PluginManifest,
  component: PluginComponentRegistration,
): string {
  return `${plugin.pluginId}/${component.kind}/${component.key}`;
}

export function normalizePluginCapabilityGrant(
  input: PluginCapabilityGrant,
): PluginCapabilityGrant {
  const allowedCapabilities = normalizedCapabilities(
    input.allowedCapabilities,
    "allowedCapabilities",
  );
  const deniedCapabilities = normalizedCapabilities(
    input.deniedCapabilities,
    "deniedCapabilities",
  );

  if (
    allowedCapabilities.some((cap) => deniedCapabilities.includes(cap))
  ) {
    throw new Error("Capability cannot be both allowed and denied");
  }

  const issuedAt = instant(input.issuedAt, "issuedAt");
  const expiresAt =
    input.expiresAt === null ? null : instant(input.expiresAt, "expiresAt");
  if (expiresAt !== null && expiresAt <= issuedAt) {
    throw new Error("expiresAt must be after issuedAt");
  }

  return Object.freeze({
    pluginId: pluginId(input.pluginId),
    pluginVersion: bounded(input.pluginVersion, "pluginVersion", 5, 64),
    trustLevel: trustLevel(input.trustLevel),
    allowedCapabilities,
    deniedCapabilities,
    issuedAt,
    expiresAt,
  });
}

export function evaluatePluginPermissions(input: {
  readonly manifest: PluginManifest;
  readonly grant: PluginCapabilityGrant;
  readonly now: string;
}): PluginPermissionDecision {
  const manifest = normalizePluginManifest(input.manifest);
  const grant = normalizePluginCapabilityGrant(input.grant);
  const now = instant(input.now, "now");

  if (
    grant.pluginId !== manifest.pluginId ||
    grant.pluginVersion !== manifest.version
  ) {
    throw new Error("Plugin capability grant is bound to a different version");
  }
  if (grant.expiresAt !== null && now >= grant.expiresAt) {
    return Object.freeze({
      grantedCapabilities: Object.freeze([]),
      deniedCapabilities: Object.freeze(
        [...manifest.requestedCapabilities].sort(),
      ),
    });
  }

  const grantedCapabilities = manifest.requestedCapabilities.filter(
    (requested) =>
      grant.allowedCapabilities.includes(requested) &&
      !grant.deniedCapabilities.includes(requested),
  );
  const deniedCapabilities = manifest.requestedCapabilities.filter(
    (requested) => !grantedCapabilities.includes(requested),
  );

  return Object.freeze({
    grantedCapabilities: Object.freeze(grantedCapabilities),
    deniedCapabilities: Object.freeze(deniedCapabilities),
  });
}

export function decidePluginVersionUpdate(input: {
  readonly current: PluginInstallation;
  readonly nextManifest: PluginManifest;
  readonly currentGrant: PluginCapabilityGrant;
  readonly requireVerifiedForMajorUpgrade: boolean;
}): PluginVersionUpdateDecision {
  const manifest = normalizePluginManifest(input.nextManifest);
  const grant = normalizePluginCapabilityGrant(input.currentGrant);

  if (
    manifest.pluginId !== input.current.pluginId ||
    grant.pluginId !== input.current.pluginId
  ) {
    throw new Error("Plugin update identity does not match installation");
  }

  const comparison = compareVersions(manifest.version, input.current.version);
  if (comparison < 0) {
    return { allowed: false, reason: "downgrade-denied" };
  }
  if (grant.pluginVersion !== input.current.version) {
    return { allowed: false, reason: "grant-version-mismatch" };
  }

  const [currentMajor] = versionParts(input.current.version);
  const [nextMajor] = versionParts(manifest.version);
  if (
    input.requireVerifiedForMajorUpgrade &&
    nextMajor! > currentMajor! &&
    grant.trustLevel === "untrusted"
  ) {
    return { allowed: false, reason: "trust-required" };
  }

  return { allowed: true, reason: "allowed" };
}

export function planPluginUninstall(input: {
  readonly manifest: PluginManifest;
  readonly installation: PluginInstallation;
  readonly grant: PluginCapabilityGrant | null;
}): PluginUninstallPlan {
  const manifest = normalizePluginManifest(input.manifest);
  if (
    manifest.pluginId !== input.installation.pluginId ||
    manifest.version !== input.installation.version
  ) {
    throw new Error("Plugin uninstall manifest does not match installation");
  }
  if (input.installation.state === "removed") {
    throw new Error("Plugin is already removed");
  }

  const grant =
    input.grant === null ? null : normalizePluginCapabilityGrant(input.grant);
  if (
    grant !== null &&
    (grant.pluginId !== manifest.pluginId ||
      grant.pluginVersion !== manifest.version)
  ) {
    throw new Error("Plugin uninstall grant does not match installation");
  }

  return Object.freeze({
    pluginId: manifest.pluginId,
    pluginVersion: manifest.version,
    disableComponentIdentities: Object.freeze(
      manifest.components.map((component) =>
        componentIdentity(manifest, component),
      ),
    ),
    revokeCapabilities: Object.freeze(
      grant === null ? [] : [...grant.allowedCapabilities],
    ),
    canRemoveAfterRevocation: true,
  });
}
