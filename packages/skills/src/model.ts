import {
  isCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type CapabilityKey,
  type Instant,
  type SkillId,
  type SkillVersionId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  canonicalJson,
  type CanonicalJson,
} from "@masanawa/security";
import {
  normalizeSkillCertification,
  type SkillCertification,
} from "./certification.js";
import {
  toolCostClasses,
  toolIdempotencyModes,
  toolReconciliationModes,
  toolRiskClasses,
  toolSensitivityClasses,
  toolSideEffectClasses,
  type ToolCostClass,
  type ToolIdempotencyMode,
  type ToolReconciliationMode,
  type ToolRiskClass,
  type ToolSensitivityClass,
  type ToolSideEffectClass,
} from "@masanawa/tools";

export const skillVisibilityStates = [
  "model-visible",
  "model-hidden",
] as const;

export type SkillVisibility =
  (typeof skillVisibilityStates)[number];

export const skillTrustTiers = [
  "first-party",
  "reviewed",
  "external-unreviewed",
] as const;

export type SkillTrustTier = (typeof skillTrustTiers)[number];

export const skillPublisherKinds = [
  "first-party",
  "organization",
  "individual",
  "registry",
  "repository",
] as const;

export type SkillPublisherKind =
  (typeof skillPublisherKinds)[number];

export const skillSourceKinds = ["authored", "imported"] as const;

export type SkillSourceKind = (typeof skillSourceKinds)[number];

export const skillBillingModes = [
  "none",
  "quoted",
  "metered",
] as const;

export type SkillBillingMode = (typeof skillBillingModes)[number];

export const skillConfirmationPolicies = [
  "not-required",
  "required",
] as const;

export type SkillConfirmationPolicy =
  (typeof skillConfirmationPolicies)[number];

export const skillReadinessStates = [
  "ready",
  "degraded",
  "blocked",
  "disabled",
] as const;

export type SkillReadinessState =
  (typeof skillReadinessStates)[number];

export type SkillJsonSchema = Readonly<
  Record<string, CanonicalJson>
>;

export interface SkillPublisherMetadata {
  readonly publisherKey: string;
  readonly displayName: string;
  readonly kind: SkillPublisherKind;
  readonly reference: string | null;
}

export interface SkillTrustVerdict {
  readonly tier: SkillTrustTier;
  readonly evaluatorKey: string;
  readonly evaluatedAt: Instant;
  readonly reasonCodes: readonly string[];
}

export interface SkillProvenance {
  readonly sourceKind: SkillSourceKind;
  readonly sourceSystem: string;
  readonly sourceReference: string;
  readonly sourceRevision: string | null;
  readonly sourceContentHash: string;
  readonly publisher: SkillPublisherMetadata;
  readonly trust: SkillTrustVerdict;
}

export interface Skill {
  readonly skillId: SkillId;
  readonly key: string;
  readonly createdAt: Instant;
}

export interface SkillToolReference {
  readonly referenceKey: string;
  readonly capability: CapabilityKey;
  readonly toolVersionId: ToolVersionId | null;
}

export interface SkillVersion {
  readonly skillId: SkillId;
  readonly skillVersionId: SkillVersionId;
  readonly key: string;
  readonly version: string;
  readonly displayName: string;
  readonly description: string;
  readonly activationExamples: readonly string[];
  readonly negativeActivationExamples: readonly string[];
  readonly capabilities: readonly CapabilityKey[];
  readonly requiredToolCapabilities: readonly CapabilityKey[];
  readonly toolReferences: readonly SkillToolReference[];
  readonly requiredAuthorityCapabilities: readonly CapabilityKey[];
  readonly dependencies: readonly SkillVersionId[];
  readonly inputSchema: SkillJsonSchema;
  readonly outputSchema: SkillJsonSchema;
  readonly visibility: SkillVisibility;
  readonly riskClass: ToolRiskClass;
  readonly sideEffectClass: ToolSideEffectClass;
  readonly sensitivity: ToolSensitivityClass;
  readonly costClass: ToolCostClass;
  readonly billingMode: SkillBillingMode;
  readonly confirmationPolicy: SkillConfirmationPolicy;
  readonly idempotencyMode: ToolIdempotencyMode;
  readonly reconciliationMode: ToolReconciliationMode;
  readonly timeoutMs: number;
  readonly provenance: SkillProvenance;
  readonly certification: SkillCertification;
}

export interface SkillReadiness {
  readonly skillVersionId: SkillVersionId;
  readonly state: SkillReadinessState;
  readonly advertised: boolean;
  readonly reasonCode: string | null;
  readonly checkedAt: Instant;
}

const skillKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const skillVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const sourceSystemPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const reasonCodePattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

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

export function normalizeSkillKey(value: string): string {
  const normalized = bounded(value, "skill.key", 128).toLowerCase();
  if (!skillKeyPattern.test(normalized)) {
    throw new TypeError("skill.key is invalid");
  }
  return normalized;
}

export function normalizeSkill(input: Skill): Skill {
  if (!isCanonicalId("skill", input.skillId)) {
    throw new TypeError("skillId is invalid");
  }
  return Object.freeze({
    skillId: input.skillId,
    key: normalizeSkillKey(input.key),
    createdAt: toInstant(input.createdAt),
  });
}

export function normalizeSkillVersion(value: string): string {
  const normalized = bounded(value, "skill.version", 128);
  if (!skillVersionPattern.test(normalized)) {
    throw new TypeError("skill.version is invalid");
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
  value: SkillJsonSchema,
  name: string,
): SkillJsonSchema {
  const parsed = JSON.parse(canonicalJson(value)) as unknown;
  if (
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed !== "object"
  ) {
    throw new TypeError(`${name} must be a JSON Schema object`);
  }
  return freezeCanonical(parsed as CanonicalJson) as SkillJsonSchema;
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

function normalizeExamples(
  values: readonly string[],
  name: string,
): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 128) {
    throw new RangeError(`${name} is invalid`);
  }
  const normalized = values.map((value) => bounded(value, name, 1000));
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze(normalized);
}

const skillToolReferenceKeyPattern =
  /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

export function normalizeSkillToolReferences(
  values: readonly SkillToolReference[],
): readonly SkillToolReference[] {
  if (!Array.isArray(values) || values.length > 256) {
    throw new RangeError("skill.toolReferences is invalid");
  }

  const normalized = values.map((value) => {
    const referenceKey = bounded(
      value.referenceKey,
      "skill.toolReferences.referenceKey",
      128,
    ).toLowerCase();
    if (!skillToolReferenceKeyPattern.test(referenceKey)) {
      throw new TypeError("skill Tool reference key is invalid");
    }
    const capability = normalizeCapabilityKey(value.capability);
    if (
      value.toolVersionId !== null &&
      !isCanonicalId("tool-version", value.toolVersionId)
    ) {
      throw new TypeError("skill Tool reference ToolVersionId is invalid");
    }
    return Object.freeze({
      referenceKey,
      capability,
      toolVersionId: value.toolVersionId,
    });
  });

  const keys = normalized.map((value) => value.referenceKey);
  if (new Set(keys).size !== keys.length) {
    throw new TypeError("skill Tool reference keys must be unique");
  }

  return Object.freeze(
    normalized.sort((left, right) =>
      left.referenceKey.localeCompare(right.referenceKey),
    ),
  );
}

function normalizeDependencies(
  values: readonly SkillVersionId[],
): readonly SkillVersionId[] {
  if (!Array.isArray(values) || values.length > 64) {
    throw new RangeError("skill.dependencies is invalid");
  }
  for (const value of values) {
    if (!isCanonicalId("skill-version", value)) {
      throw new TypeError("skill dependency SkillVersionId is invalid");
    }
  }
  if (new Set(values).size !== values.length) {
    throw new TypeError("skill dependencies must be unique");
  }
  return Object.freeze([...values].sort());
}

export function normalizeSkillProvenance(
  input: SkillProvenance,
): SkillProvenance {
  if (!(skillSourceKinds as readonly string[]).includes(input.sourceKind)) {
    throw new TypeError("skill provenance sourceKind is invalid");
  }
  if (!(skillPublisherKinds as readonly string[]).includes(input.publisher.kind)) {
    throw new TypeError("skill provenance publisher kind is invalid");
  }
  if (!(skillTrustTiers as readonly string[]).includes(input.trust.tier)) {
    throw new TypeError("skill provenance trust tier is invalid");
  }
  const sourceSystem = bounded(
    input.sourceSystem,
    "skill.provenance.sourceSystem",
    128,
  ).toLowerCase();
  if (!sourceSystemPattern.test(sourceSystem)) {
    throw new TypeError("skill provenance sourceSystem is invalid");
  }
  const sourceContentHash = bounded(
    input.sourceContentHash,
    "skill.provenance.sourceContentHash",
    71,
  ).toLowerCase();
  if (!sha256Pattern.test(sourceContentHash)) {
    throw new TypeError(
      "skill provenance sourceContentHash must be sha256:<64 lowercase hex>",
    );
  }

  const publisherKey = bounded(
    input.publisher.publisherKey,
    "skill.provenance.publisher.publisherKey",
    128,
  ).toLowerCase();
  if (!sourceSystemPattern.test(publisherKey)) {
    throw new TypeError("skill provenance publisherKey is invalid");
  }

  if (
    input.sourceKind === "imported" &&
    input.sourceRevision === null
  ) {
    throw new TypeError(
      "imported Skill provenance requires an exact sourceRevision",
    );
  }

  if (
    !Array.isArray(input.trust.reasonCodes) ||
    input.trust.reasonCodes.length < 1 ||
    input.trust.reasonCodes.length > 32
  ) {
    throw new TypeError(
      "skill provenance trust reasonCodes are invalid",
    );
  }

  const evaluatorKey = bounded(
    input.trust.evaluatorKey,
    "skill.provenance.trust.evaluatorKey",
    128,
  ).toLowerCase();
  if (!sourceSystemPattern.test(evaluatorKey)) {
    throw new TypeError("skill provenance trust evaluatorKey is invalid");
  }

  const reasonCodes = input.trust.reasonCodes.map((value) => {
    const normalized = bounded(
      value,
      "skill.provenance.trust.reasonCode",
      200,
    ).toLowerCase();
    if (!reasonCodePattern.test(normalized)) {
      throw new TypeError("skill provenance trust reasonCode is invalid");
    }
    return normalized;
  });
  if (new Set(reasonCodes).size !== reasonCodes.length) {
    throw new TypeError("skill provenance trust reasonCodes must be unique");
  }

  return Object.freeze({
    sourceKind: input.sourceKind,
    sourceSystem,
    sourceReference: bounded(
      input.sourceReference,
      "skill.provenance.sourceReference",
      2000,
    ),
    sourceRevision:
      input.sourceRevision === null
        ? null
        : bounded(
            input.sourceRevision,
            "skill.provenance.sourceRevision",
            256,
          ),
    sourceContentHash,
    publisher: Object.freeze({
      publisherKey,
      displayName: bounded(
        input.publisher.displayName,
        "skill.provenance.publisher.displayName",
        200,
      ),
      kind: input.publisher.kind,
      reference:
        input.publisher.reference === null
          ? null
          : bounded(
              input.publisher.reference,
              "skill.provenance.publisher.reference",
              2000,
            ),
    }),
    trust: Object.freeze({
      tier: input.trust.tier,
      evaluatorKey,
      evaluatedAt: toInstant(input.trust.evaluatedAt),
      reasonCodes: Object.freeze([...reasonCodes].sort()),
    }),
  });
}

export function normalizeSkillVersionDefinition(
  input: SkillVersion,
): SkillVersion {
  if (!isCanonicalId("skill", input.skillId)) {
    throw new TypeError("skillId is invalid");
  }
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("skillVersionId is invalid");
  }
  if (
    !Number.isSafeInteger(input.timeoutMs) ||
    input.timeoutMs < 1 ||
    input.timeoutMs > 3_600_000
  ) {
    throw new RangeError("skill timeoutMs must be between 1 and 3600000");
  }
  if (!(skillVisibilityStates as readonly string[]).includes(input.visibility)) {
    throw new TypeError("skill visibility is invalid");
  }
  if (!(toolRiskClasses as readonly string[]).includes(input.riskClass)) {
    throw new TypeError("skill riskClass is invalid");
  }
  if (
    !(toolSideEffectClasses as readonly string[]).includes(
      input.sideEffectClass,
    )
  ) {
    throw new TypeError("skill sideEffectClass is invalid");
  }
  if (
    !(toolSensitivityClasses as readonly string[]).includes(
      input.sensitivity,
    )
  ) {
    throw new TypeError("skill sensitivity is invalid");
  }
  if (!(toolCostClasses as readonly string[]).includes(input.costClass)) {
    throw new TypeError("skill costClass is invalid");
  }
  if (!(skillBillingModes as readonly string[]).includes(input.billingMode)) {
    throw new TypeError("skill billingMode is invalid");
  }
  if (
    !(skillConfirmationPolicies as readonly string[]).includes(
      input.confirmationPolicy,
    )
  ) {
    throw new TypeError("skill confirmationPolicy is invalid");
  }
  if (
    !(toolIdempotencyModes as readonly string[]).includes(
      input.idempotencyMode,
    )
  ) {
    throw new TypeError("skill idempotencyMode is invalid");
  }
  if (
    !(toolReconciliationModes as readonly string[]).includes(
      input.reconciliationMode,
    )
  ) {
    throw new TypeError("skill reconciliationMode is invalid");
  }

  const consequential =
    input.riskClass === "consequential" ||
    input.riskClass === "restricted" ||
    input.sideEffectClass === "external-consequential";
  if (consequential && input.idempotencyMode !== "operation-bound") {
    throw new TypeError(
      "Consequential skills require operation-bound idempotency",
    );
  }
  if (consequential && input.reconciliationMode === "none") {
    throw new TypeError(
      "Consequential skills require reconciliation semantics",
    );
  }
  if (
    input.billingMode !== "none" &&
    input.confirmationPolicy !== "required"
  ) {
    throw new TypeError(
      "Billed skills require explicit confirmation policy",
    );
  }

  const requiredToolCapabilities = normalizeCapabilities(
    input.requiredToolCapabilities,
    "skill.requiredToolCapabilities",
    true,
  );
  const toolReferences = normalizeSkillToolReferences(input.toolReferences);
  const requiredToolCapabilitySet = new Set(requiredToolCapabilities);
  for (const reference of toolReferences) {
    if (!requiredToolCapabilitySet.has(reference.capability)) {
      throw new TypeError(
        "skill Tool reference capability must be declared as required",
      );
    }
  }
  for (const capability of requiredToolCapabilities) {
    if (!toolReferences.some((reference) => reference.capability === capability)) {
      throw new TypeError(
        "each required Tool capability must have a Skill Tool reference",
      );
    }
  }

  return Object.freeze({
    skillId: input.skillId,
    skillVersionId: input.skillVersionId,
    key: normalizeSkillKey(input.key),
    version: normalizeSkillVersion(input.version),
    displayName: bounded(input.displayName, "skill.displayName", 200),
    description: bounded(input.description, "skill.description", 4000),
    activationExamples: normalizeExamples(
      input.activationExamples,
      "skill.activationExamples",
    ),
    negativeActivationExamples: normalizeExamples(
      input.negativeActivationExamples,
      "skill.negativeActivationExamples",
    ),
    capabilities: normalizeCapabilities(
      input.capabilities,
      "skill.capabilities",
      false,
    ),
    requiredToolCapabilities,
    toolReferences,
    requiredAuthorityCapabilities: normalizeCapabilities(
      input.requiredAuthorityCapabilities,
      "skill.requiredAuthorityCapabilities",
      true,
    ),
    dependencies: normalizeDependencies(input.dependencies),
    inputSchema: normalizeSchema(input.inputSchema, "skill.inputSchema"),
    outputSchema: normalizeSchema(input.outputSchema, "skill.outputSchema"),
    visibility: input.visibility,
    riskClass: input.riskClass,
    sideEffectClass: input.sideEffectClass,
    sensitivity: input.sensitivity,
    costClass: input.costClass,
    billingMode: input.billingMode,
    confirmationPolicy: input.confirmationPolicy,
    idempotencyMode: input.idempotencyMode,
    reconciliationMode: input.reconciliationMode,
    timeoutMs: input.timeoutMs,
    provenance: normalizeSkillProvenance(input.provenance),
    certification: normalizeSkillCertification(
      input.certification,
      input.skillVersionId,
    ),
  });
}

export function normalizeSkillReadiness(
  input: SkillReadiness,
): SkillReadiness {
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("skill readiness SkillVersionId is invalid");
  }
  if (!(skillReadinessStates as readonly string[]).includes(input.state)) {
    throw new TypeError("skill readiness state is invalid");
  }
  if (input.advertised && input.state !== "ready") {
    throw new TypeError("only ready SkillVersions may be advertised");
  }

  let reasonCode: string | null = null;
  if (input.reasonCode !== null) {
    reasonCode = bounded(
      input.reasonCode,
      "skill.readiness.reasonCode",
      200,
    ).toLowerCase();
    if (!reasonCodePattern.test(reasonCode)) {
      throw new TypeError("skill readiness reasonCode is invalid");
    }
  }

  return Object.freeze({
    skillVersionId: input.skillVersionId,
    state: input.state,
    advertised: input.advertised === true,
    reasonCode,
    checkedAt: toInstant(input.checkedAt),
  });
}
