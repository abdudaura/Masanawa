export type PluginComponentKind =
  | "tool"
  | "skill"
  | "provider"
  | "event-handler"
  | "ops-ui-extension";

export interface PluginComponentRegistration {
  readonly kind: PluginComponentKind;
  readonly key: string;
  readonly entrypoint: string;
}

export interface PluginDependency {
  readonly pluginId: string;
  readonly versionRange: string;
}

export interface PluginManifest {
  readonly schemaVersion: 1;
  readonly pluginId: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string | null;
  readonly components: readonly PluginComponentRegistration[];
  readonly requestedCapabilities: readonly string[];
  readonly dependencies: readonly PluginDependency[];
}

export type PluginLifecycleState =
  | "discovered"
  | "installed"
  | "enabled"
  | "disabled"
  | "removed";

export interface PluginInstallation {
  readonly schemaVersion: 1;
  readonly pluginId: string;
  readonly version: string;
  readonly state: PluginLifecycleState;
  readonly revision: number;
  readonly installedAt: string | null;
  readonly updatedAt: string;
  readonly removedAt: string | null;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
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

function version(value: string): string {
  const normalized = bounded(value, "version", 5, 64);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(normalized)) {
    throw new TypeError("version must be semantic version syntax");
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

function entrypoint(value: string): string {
  const normalized = bounded(value, "entrypoint", 1, 240);
  if (
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new TypeError("entrypoint must be plugin-relative");
  }
  return normalized;
}

function componentKey(value: string): string {
  const normalized = bounded(value, "component.key", 3, 160).toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(normalized)) {
    throw new TypeError("component.key is invalid");
  }
  return normalized;
}

function normalizeComponent(
  input: PluginComponentRegistration,
): PluginComponentRegistration {
  if (
    input.kind !== "tool" &&
    input.kind !== "skill" &&
    input.kind !== "provider" &&
    input.kind !== "event-handler" &&
    input.kind !== "ops-ui-extension"
  ) {
    throw new TypeError("component.kind is invalid");
  }
  return Object.freeze({
    kind: input.kind,
    key: componentKey(input.key),
    entrypoint: entrypoint(input.entrypoint),
  });
}

function normalizeDependency(input: PluginDependency): PluginDependency {
  const range = bounded(input.versionRange, "dependency.versionRange", 1, 80);
  if (!/^[0-9A-Za-z.*<>=~^|\s-]+$/u.test(range)) {
    throw new TypeError("dependency.versionRange is invalid");
  }
  return Object.freeze({
    pluginId: pluginId(input.pluginId),
    versionRange: range,
  });
}

function instant(value: string, name: string): string {
  const normalized = bounded(value, name, 1, 64);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new TypeError(`${name} is invalid`);
  }
  return parsed.toISOString();
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError("revision is invalid");
  }
  return value;
}

export function normalizePluginManifest(
  input: PluginManifest,
): PluginManifest {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Plugin manifest schemaVersion");
  }
  if (!Array.isArray(input.components) || input.components.length > 128) {
    throw new RangeError("components exceeds its bound");
  }
  if (
    !Array.isArray(input.requestedCapabilities) ||
    input.requestedCapabilities.length > 128
  ) {
    throw new RangeError("requestedCapabilities exceeds its bound");
  }
  if (!Array.isArray(input.dependencies) || input.dependencies.length > 64) {
    throw new RangeError("dependencies exceeds its bound");
  }

  const id = pluginId(input.pluginId);
  const components = input.components.map(normalizeComponent);
  const componentIdentities = components.map(
    (component) => `${component.kind}:${component.key}`,
  );
  if (new Set(componentIdentities).size !== componentIdentities.length) {
    throw new Error("Plugin manifest contains duplicate component registration");
  }

  const requestedCapabilities = input.requestedCapabilities
    .map(capability)
    .sort();
  if (
    new Set(requestedCapabilities).size !== requestedCapabilities.length
  ) {
    throw new Error("Plugin manifest contains duplicate requested capability");
  }

  const dependencies = input.dependencies.map(normalizeDependency);
  if (dependencies.some((dependency) => dependency.pluginId === id)) {
    throw new Error("Plugin cannot depend on itself");
  }
  if (
    new Set(dependencies.map((dependency) => dependency.pluginId)).size !==
    dependencies.length
  ) {
    throw new Error("Plugin manifest contains duplicate dependency");
  }

  return Object.freeze({
    schemaVersion: 1,
    pluginId: id,
    version: version(input.version),
    displayName: bounded(input.displayName, "displayName", 1, 120),
    description:
      input.description === null
        ? null
        : bounded(input.description, "description", 1, 500),
    components: Object.freeze(
      [...components].sort((a, b) =>
        `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`),
      ),
    ),
    requestedCapabilities: Object.freeze(requestedCapabilities),
    dependencies: Object.freeze(
      [...dependencies].sort((a, b) => a.pluginId.localeCompare(b.pluginId)),
    ),
  });
}

export function pluginComponentIdentity(input: {
  readonly pluginId: string;
  readonly component: PluginComponentRegistration;
}): string {
  const id = pluginId(input.pluginId);
  const component = normalizeComponent(input.component);
  return `${id}/${component.kind}/${component.key}`;
}

export function normalizePluginInstallation(
  input: PluginInstallation,
): PluginInstallation {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Unsupported Plugin installation schemaVersion");
  }
  if (
    input.state !== "discovered" &&
    input.state !== "installed" &&
    input.state !== "enabled" &&
    input.state !== "disabled" &&
    input.state !== "removed"
  ) {
    throw new TypeError("Plugin installation state is invalid");
  }

  const updatedAt = instant(input.updatedAt, "updatedAt");
  const installedAt =
    input.installedAt === null ? null : instant(input.installedAt, "installedAt");
  const removedAt =
    input.removedAt === null ? null : instant(input.removedAt, "removedAt");

  if (input.state === "discovered") {
    if (installedAt !== null || removedAt !== null) {
      throw new Error("discovered Plugin cannot carry install/remove timestamps");
    }
  } else if (input.state === "removed") {
    if (installedAt === null || removedAt === null || removedAt !== updatedAt) {
      throw new Error("removed Plugin requires install and removal timestamps");
    }
  } else if (installedAt === null || removedAt !== null) {
    throw new Error("installed Plugin lifecycle is inconsistent");
  }

  if (installedAt !== null && updatedAt < installedAt) {
    throw new Error("updatedAt cannot predate installedAt");
  }

  return Object.freeze({
    schemaVersion: 1,
    pluginId: pluginId(input.pluginId),
    version: version(input.version),
    state: input.state,
    revision: revision(input.revision),
    installedAt,
    updatedAt,
    removedAt,
  });
}

const lifecycleTransitions: Readonly<
  Record<PluginLifecycleState, readonly PluginLifecycleState[]>
> = Object.freeze({
  discovered: Object.freeze(["installed"]),
  installed: Object.freeze(["enabled", "disabled", "removed"]),
  enabled: Object.freeze(["disabled", "removed"]),
  disabled: Object.freeze(["enabled", "removed"]),
  removed: Object.freeze([]),
});

export function transitionPluginInstallation(input: {
  readonly current: PluginInstallation;
  readonly nextState: PluginLifecycleState;
  readonly occurredAt: string;
}): PluginInstallation {
  const current = normalizePluginInstallation(input.current);
  if (!lifecycleTransitions[current.state].includes(input.nextState)) {
    throw new Error(
      `Invalid Plugin lifecycle transition: ${current.state} -> ${input.nextState}`,
    );
  }

  const occurredAt = instant(input.occurredAt, "occurredAt");
  if (occurredAt < current.updatedAt) {
    throw new Error("Plugin lifecycle cannot move backward in time");
  }

  return normalizePluginInstallation({
    ...current,
    state: input.nextState,
    revision: current.revision + 1,
    installedAt:
      current.installedAt ??
      (input.nextState === "installed" ? occurredAt : null),
    updatedAt: occurredAt,
    removedAt: input.nextState === "removed" ? occurredAt : null,
  });
}
