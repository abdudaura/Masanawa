import {
  isCanonicalId,
  type SkillVersionId,
} from "@masanawa/contracts";
import { canonicalJson, fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeSkillResourcePath,
  type SkillManifestResourceKind,
} from "./manifest.js";

export interface SkillDiscoverySignals {
  readonly priority: number;
  readonly phrases: readonly string[];
  readonly allOf: readonly (readonly string[])[];
  readonly anyOf: readonly string[];
  readonly noneOf: readonly string[];
  readonly minScore: number;
}

export interface SkillGuideResource {
  readonly path: string;
  readonly kind: SkillManifestResourceKind;
  readonly description: string | null;
}

export interface SkillGuide {
  readonly schemaVersion: 1;
  readonly skillVersionId: SkillVersionId;
  /**
   * Trigger-only summary: when should the runtime consider loading this Skill?
   * Do not summarize the workflow here; the full instructions are loaded only
   * after selection.
   */
  readonly triggerDescription: string;
  /** Full procedural instructions, progressively disclosed after selection. */
  readonly instructions: string;
  /** Heavy references/scripts/templates/assets loaded only when required. */
  readonly resources: readonly SkillGuideResource[];
  readonly discovery: SkillDiscoverySignals;
  readonly contentHash: string;
}

const maxInstructionsLength = 262_144;

function bounded(
  value: string,
  name: string,
  max: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function terms(
  values: readonly string[],
  name: string,
  maxItems = 128,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maxItems) {
    throw new RangeError(`${name} is invalid`);
  }
  const normalized = values.map((value) =>
    bounded(value, name, 200).toLowerCase(),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze([...normalized].sort());
}

function groups(
  values: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  if (!Array.isArray(values) || values.length > 64) {
    throw new RangeError("skill.discovery.allOf is invalid");
  }
  return Object.freeze(
    values.map((group) => {
      const normalized = terms(group, "skill.discovery.allOf", 16);
      if (normalized.length < 2) {
        throw new RangeError("skill.discovery.allOf groups require at least two terms");
      }
      return normalized;
    }),
  );
}

function normalizeDiscovery(input: SkillDiscoverySignals): SkillDiscoverySignals {
  if (!Number.isSafeInteger(input.priority) || input.priority < 0 || input.priority > 100) {
    throw new RangeError("skill.discovery.priority must be between 0 and 100");
  }
  if (!Number.isSafeInteger(input.minScore) || input.minScore < 0 || input.minScore > 100) {
    throw new RangeError("skill.discovery.minScore must be between 0 and 100");
  }
  return Object.freeze({
    priority: input.priority,
    phrases: terms(input.phrases, "skill.discovery.phrases"),
    allOf: groups(input.allOf),
    anyOf: terms(input.anyOf, "skill.discovery.anyOf"),
    noneOf: terms(input.noneOf, "skill.discovery.noneOf"),
    minScore: input.minScore,
  });
}

function payload(input: Omit<SkillGuide, "contentHash">) {
  return Object.freeze({
    schemaVersion: 1 as const,
    skillVersionId: input.skillVersionId,
    triggerDescription: input.triggerDescription,
    instructions: input.instructions,
    resources: input.resources,
    discovery: input.discovery,
  });
}

export function normalizeSkillGuide(input: Omit<SkillGuide, "contentHash"> & {
  readonly contentHash?: string;
}): SkillGuide {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported SkillGuide schema");
  if (!isCanonicalId("skill-version", input.skillVersionId)) {
    throw new TypeError("SkillGuide skillVersionId is invalid");
  }

  const resources = Object.freeze(
    input.resources.map((resource) =>
      Object.freeze({
        path: normalizeSkillResourcePath(resource.path),
        kind: resource.kind,
        description:
          resource.description === null
            ? null
            : bounded(resource.description, "skill resource description", 500),
      }),
    ),
  );
  const resourcePaths = resources.map((resource) => resource.path);
  if (new Set(resourcePaths).size !== resourcePaths.length) {
    throw new TypeError("SkillGuide resource paths must be unique");
  }

  const normalizedWithoutHash = payload({
    schemaVersion: 1,
    skillVersionId: input.skillVersionId,
    triggerDescription: bounded(
      input.triggerDescription,
      "skill.triggerDescription",
      1024,
    ),
    instructions: bounded(
      input.instructions,
      "skill.instructions",
      maxInstructionsLength,
    ),
    resources,
    discovery: normalizeDiscovery(input.discovery),
  });
  const contentHash = `sha256:${fingerprintCanonicalJson(
    JSON.parse(canonicalJson(normalizedWithoutHash)),
  )}`;

  if (input.contentHash !== undefined && input.contentHash !== contentHash) {
    throw new TypeError("SkillGuide contentHash does not match normalized content");
  }

  return Object.freeze({
    ...normalizedWithoutHash,
    contentHash,
  });
}

function haystack(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, " ").trim();
}

export interface SkillDiscoveryResult {
  readonly eligible: boolean;
  readonly score: number;
  readonly blockedByNegativeSignal: boolean;
}

/**
 * Deterministic lexical discovery signal. AgentStrategy may additionally use
 * semantic reasoning, but it must never bypass exact assignment/readiness/
 * authority admission because of a high discovery score.
 */
export function evaluateSkillDiscovery(
  guide: SkillGuide,
  userText: string,
): SkillDiscoveryResult {
  const text = haystack(userText);
  const negative = guide.discovery.noneOf.some((term) => text.includes(term));
  if (negative) {
    return Object.freeze({ eligible: false, score: 0, blockedByNegativeSignal: true });
  }

  let score = 0;
  for (const phrase of guide.discovery.phrases) {
    if (text.includes(phrase)) score += 25;
  }
  for (const term of guide.discovery.anyOf) {
    if (text.includes(term)) score += 10;
  }
  for (const group of guide.discovery.allOf) {
    if (group.every((term) => text.includes(term))) score += 30;
  }
  score = Math.min(100, score + Math.floor(guide.discovery.priority / 10));

  return Object.freeze({
    eligible: score >= guide.discovery.minScore,
    score,
    blockedByNegativeSignal: false,
  });
}
