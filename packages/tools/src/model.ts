import {
  isCanonicalId,
  normalizeCapabilityKey,
  type CapabilityKey,
  type ToolId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  canonicalJson,
  type CanonicalJson,
} from "@masanawa/security";

export const toolRiskClasses = [
  "read-only",
  "low",
  "consequential",
  "restricted",
] as const;

export type ToolRiskClass = (typeof toolRiskClasses)[number];

export const toolSideEffectClasses = [
  "none",
  "reversible",
  "external",
  "external-consequential",
] as const;

export type ToolSideEffectClass =
  (typeof toolSideEffectClasses)[number];

export const toolIdempotencyModes = [
  "not-required",
  "caller-key",
  "operation-bound",
] as const;

export type ToolIdempotencyMode =
  (typeof toolIdempotencyModes)[number];

export const toolReconciliationModes = [
  "none",
  "on-unknown",
  "always",
] as const;

export type ToolReconciliationMode =
  (typeof toolReconciliationModes)[number];

export const toolSensitivityClasses = [
  "public",
  "internal",
  "private",
  "sensitive",
  "restricted",
] as const;

export type ToolSensitivityClass =
  (typeof toolSensitivityClasses)[number];

export const toolCostClasses = [
  "free",
  "metered",
  "external",
] as const;

export type ToolCostClass = (typeof toolCostClasses)[number];

export type ToolJsonSchema = Readonly<Record<string, CanonicalJson>>;

export interface ToolRateLimit {
  readonly maxCalls: number;
  readonly windowMs: number;
}

export interface ToolProviderRequirement {
  readonly capability: CapabilityKey;
}

export interface ToolDefinition {
  readonly toolId: ToolId;
  readonly toolVersionId: ToolVersionId;
  readonly key: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;
  readonly capabilities: readonly CapabilityKey[];
  readonly inputSchema: ToolJsonSchema;
  readonly outputSchema: ToolJsonSchema;
  readonly requiredAuthorityCapabilities: readonly CapabilityKey[];
  readonly riskClass: ToolRiskClass;
  readonly sideEffectClass: ToolSideEffectClass;
  readonly sensitivity: ToolSensitivityClass;
  readonly timeoutMs: number;
  readonly rateLimit: ToolRateLimit | null;
  readonly costClass: ToolCostClass;
  readonly idempotencyMode: ToolIdempotencyMode;
  readonly reconciliationMode: ToolReconciliationMode;
  readonly providerRequirement: ToolProviderRequirement | null;
}

export interface CapabilityDefinition {
  readonly key: CapabilityKey;
  readonly description: string;
}

const toolKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const toolVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function bounded(
  value: string,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeToolKey(value: string): string {
  const normalized = bounded(value, "tool.key", 128).toLowerCase();
  if (!toolKeyPattern.test(normalized)) {
    throw new TypeError("tool.key is invalid");
  }
  return normalized;
}

export function normalizeToolVersion(value: string): string {
  const normalized = bounded(value, "tool.version", 128);
  if (!toolVersionPattern.test(normalized)) {
    throw new TypeError("tool.version is invalid");
  }
  return normalized;
}

function freezeCanonical(value: CanonicalJson): CanonicalJson {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeCanonical));
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, CanonicalJson> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = freezeCanonical(item);
    }
    return Object.freeze(output);
  }
  return value;
}

function normalizeSchema(
  value: ToolJsonSchema,
  name: string,
): ToolJsonSchema {
  const parsed = JSON.parse(canonicalJson(value)) as unknown;
  if (
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed !== "object"
  ) {
    throw new TypeError(`${name} must be a JSON Schema object`);
  }
  return freezeCanonical(parsed as CanonicalJson) as ToolJsonSchema;
}

function normalizeCapabilities(
  values: readonly (CapabilityKey | string)[],
  name: string,
  allowEmpty: boolean,
): readonly CapabilityKey[] {
  if (!Array.isArray(values) || (!allowEmpty && values.length < 1)) {
    throw new RangeError(`${name} is invalid`);
  }
  if (values.length > 256) {
    throw new RangeError(`${name} has too many entries`);
  }
  const normalized = values.map(normalizeCapabilityKey);
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  normalized.sort();
  return Object.freeze(normalized);
}

export function normalizeCapabilityDefinition(
  input: CapabilityDefinition,
): CapabilityDefinition {
  return Object.freeze({
    key: normalizeCapabilityKey(input.key),
    description: bounded(
      input.description,
      "capability.description",
      1000,
    ),
  });
}

export function normalizeToolDefinition(
  input: ToolDefinition,
): ToolDefinition {
  if (!isCanonicalId("tool", input.toolId)) {
    throw new TypeError("toolId is invalid");
  }
  if (!isCanonicalId("tool-version", input.toolVersionId)) {
    throw new TypeError("toolVersionId is invalid");
  }
  if (
    !Number.isSafeInteger(input.timeoutMs) ||
    input.timeoutMs < 1 ||
    input.timeoutMs > 3_600_000
  ) {
    throw new RangeError("timeoutMs must be between 1 and 3600000");
  }

  const riskClass = input.riskClass;
  if (!(toolRiskClasses as readonly string[]).includes(riskClass)) {
    throw new TypeError("tool riskClass is invalid");
  }
  const sideEffectClass = input.sideEffectClass;
  if (!(toolSideEffectClasses as readonly string[]).includes(sideEffectClass)) {
    throw new TypeError("tool sideEffectClass is invalid");
  }
  const sensitivity = input.sensitivity;
  if (!(toolSensitivityClasses as readonly string[]).includes(sensitivity)) {
    throw new TypeError("tool sensitivity is invalid");
  }
  const costClass = input.costClass;
  if (!(toolCostClasses as readonly string[]).includes(costClass)) {
    throw new TypeError("tool costClass is invalid");
  }
  const idempotencyMode = input.idempotencyMode;
  if (!(toolIdempotencyModes as readonly string[]).includes(idempotencyMode)) {
    throw new TypeError("tool idempotencyMode is invalid");
  }
  const reconciliationMode = input.reconciliationMode;
  if (
    !(toolReconciliationModes as readonly string[]).includes(
      reconciliationMode,
    )
  ) {
    throw new TypeError("tool reconciliationMode is invalid");
  }

  const consequential =
    riskClass === "consequential" ||
    riskClass === "restricted" ||
    sideEffectClass === "external-consequential";
  if (consequential && idempotencyMode !== "operation-bound") {
    throw new TypeError(
      "Consequential tools require operation-bound idempotency",
    );
  }
  if (consequential && reconciliationMode === "none") {
    throw new TypeError(
      "Consequential tools require reconciliation semantics",
    );
  }

  let rateLimit: ToolRateLimit | null = null;
  if (input.rateLimit !== null) {
    if (
      !Number.isSafeInteger(input.rateLimit.maxCalls) ||
      input.rateLimit.maxCalls < 1 ||
      input.rateLimit.maxCalls > 1_000_000 ||
      !Number.isSafeInteger(input.rateLimit.windowMs) ||
      input.rateLimit.windowMs < 1 ||
      input.rateLimit.windowMs > 86_400_000
    ) {
      throw new RangeError("tool rateLimit is invalid");
    }
    rateLimit = Object.freeze({
      maxCalls: input.rateLimit.maxCalls,
      windowMs: input.rateLimit.windowMs,
    });
  }

  return Object.freeze({
    toolId: input.toolId,
    toolVersionId: input.toolVersionId,
    key: normalizeToolKey(input.key),
    version: normalizeToolVersion(input.version),
    displayName: bounded(input.displayName, "tool.displayName", 200),
    description: bounded(input.description, "tool.description", 2000),
    capabilities: normalizeCapabilities(
      input.capabilities,
      "tool.capabilities",
      false,
    ),
    inputSchema: normalizeSchema(input.inputSchema, "tool.inputSchema"),
    outputSchema: normalizeSchema(
      input.outputSchema,
      "tool.outputSchema",
    ),
    requiredAuthorityCapabilities: normalizeCapabilities(
      input.requiredAuthorityCapabilities,
      "tool.requiredAuthorityCapabilities",
      true,
    ),
    riskClass,
    sideEffectClass,
    sensitivity,
    timeoutMs: input.timeoutMs,
    rateLimit,
    costClass,
    idempotencyMode,
    reconciliationMode,
    providerRequirement:
      input.providerRequirement === null
        ? null
        : Object.freeze({
            capability: normalizeCapabilityKey(
              input.providerRequirement.capability,
            ),
          }),
  });
}
