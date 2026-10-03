import {
  PlatformError,
  isCanonicalId,
  type SkillVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  type SkillReadinessState,
  type SkillVersion,
} from "./model.js";
import { composeSkillExecutionPlan, type SkillExecutionPlan } from "./planning.js";
import type { SkillRegistry } from "./registry.js";

export type SkillEligibilityBlockerState =
  | "missing-version"
  | "missing-readiness"
  | SkillReadinessState;

export interface SkillEligibilityBlocker {
  readonly skillVersionId: SkillVersionId;
  readonly state: SkillEligibilityBlockerState;
  readonly reasonCode: string;
}

export interface SkillEligibilitySnapshot {
  readonly rootSkillVersionId: SkillVersionId;
  readonly eligible: boolean;
  readonly advertisable: boolean;
  readonly advertised: boolean;
  readonly orderedSkillVersionIds: readonly SkillVersionId[];
  readonly blockers: readonly SkillEligibilityBlocker[];
}

export interface SkillRevisionPinEntry {
  readonly ordinal: number;
  readonly skillVersionId: SkillVersionId;
  readonly key: string;
  readonly version: string;
  readonly definitionHash: string;
}

export interface SkillRevisionPin {
  readonly schemaVersion: 1;
  readonly rootSkillVersionId: SkillVersionId;
  readonly orderedVersions: readonly SkillRevisionPinEntry[];
  readonly contentHash: string;
}

const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

function skillError(
  code: string,
  category: "validation" | "conflict" | "not-found",
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category,
    message,
    retryable: false,
  });
}

function definitionHash(skill: SkillVersion): string {
  return `sha256:${fingerprintCanonicalJson(skill)}`;
}

function freezeBlocker(
  blocker: SkillEligibilityBlocker,
): SkillEligibilityBlocker {
  return Object.freeze(blocker);
}

export function evaluateSkillEligibility(
  registry: SkillRegistry,
  rootSkillVersionId: SkillVersionId,
): SkillEligibilitySnapshot {
  if (!isCanonicalId("skill-version", rootSkillVersionId)) {
    throw new TypeError("eligibility root SkillVersionId is invalid");
  }

  const ordered: SkillVersionId[] = [];
  const blockers: SkillEligibilityBlocker[] = [];
  const visited = new Set<SkillVersionId>();

  function visit(skillVersionId: SkillVersionId): void {
    if (visited.has(skillVersionId)) return;
    visited.add(skillVersionId);

    const skill = registry.getVersion(skillVersionId);
    if (skill === null) {
      blockers.push(
        freezeBlocker({
          skillVersionId,
          state: "missing-version",
          reasonCode: "skill.version.missing",
        }),
      );
      return;
    }

    for (const dependency of skill.dependencies) {
      visit(dependency);
    }

    const readiness = registry.getReadiness(skillVersionId);
    if (readiness === null) {
      blockers.push(
        freezeBlocker({
          skillVersionId,
          state: "missing-readiness",
          reasonCode: "skill.readiness.missing",
        }),
      );
    } else if (readiness.state !== "ready") {
      blockers.push(
        freezeBlocker({
          skillVersionId,
          state: readiness.state,
          reasonCode:
            readiness.reasonCode ?? `skill.readiness.${readiness.state}`,
        }),
      );
    }

    ordered.push(skillVersionId);
  }

  visit(rootSkillVersionId);

  const root = registry.getVersion(rootSkillVersionId);
  const rootReadiness = registry.getReadiness(rootSkillVersionId);
  const eligible = blockers.length === 0 && root !== null;
  const advertisable =
    eligible && root?.visibility === "model-visible";
  const advertised =
    advertisable &&
    rootReadiness?.state === "ready" &&
    rootReadiness.advertised;

  return Object.freeze({
    rootSkillVersionId,
    eligible,
    advertisable,
    advertised,
    orderedSkillVersionIds: Object.freeze(ordered),
    blockers: Object.freeze(blockers),
  });
}

function pinPayload(
  rootSkillVersionId: SkillVersionId,
  orderedVersions: readonly SkillRevisionPinEntry[],
): {
  readonly schemaVersion: 1;
  readonly rootSkillVersionId: SkillVersionId;
  readonly orderedVersions: readonly SkillRevisionPinEntry[];
} {
  return Object.freeze({
    schemaVersion: 1 as const,
    rootSkillVersionId,
    orderedVersions,
  });
}

function pinContentHash(
  rootSkillVersionId: SkillVersionId,
  orderedVersions: readonly SkillRevisionPinEntry[],
): string {
  return `sha256:${fingerprintCanonicalJson(
    pinPayload(rootSkillVersionId, orderedVersions),
  )}`;
}

export function createSkillRevisionPin(
  registry: SkillRegistry,
  rootSkillVersionId: SkillVersionId,
): SkillRevisionPin {
  const eligibility = evaluateSkillEligibility(
    registry,
    rootSkillVersionId,
  );
  if (!eligibility.eligible) {
    throw skillError(
      "skill.pin_not_eligible",
      "conflict",
      "Skill revision pin requires a currently eligible exact SkillVersion graph",
    );
  }

  const plan = composeSkillExecutionPlan(registry, rootSkillVersionId);
  const orderedVersions = Object.freeze(
    plan.steps.map((step) =>
      Object.freeze({
        ordinal: step.ordinal,
        skillVersionId: step.skillVersionId,
        key: step.skill.key,
        version: step.skill.version,
        definitionHash: definitionHash(step.skill),
      }),
    ),
  );

  return Object.freeze({
    schemaVersion: 1 as const,
    rootSkillVersionId,
    orderedVersions,
    contentHash: pinContentHash(rootSkillVersionId, orderedVersions),
  });
}

function validatePinShape(pin: SkillRevisionPin): void {
  if (
    pin.schemaVersion !== 1 ||
    !isCanonicalId("skill-version", pin.rootSkillVersionId) ||
    !Array.isArray(pin.orderedVersions) ||
    pin.orderedVersions.length < 1 ||
    pin.orderedVersions.length > 65_536 ||
    typeof pin.contentHash !== "string" ||
    !sha256Pattern.test(pin.contentHash)
  ) {
    throw skillError(
      "skill.pin_invalid",
      "validation",
      "Skill revision pin is malformed",
    );
  }

  const seen = new Set<SkillVersionId>();
  pin.orderedVersions.forEach((entry, ordinal) => {
    if (
      entry.ordinal !== ordinal ||
      !isCanonicalId("skill-version", entry.skillVersionId) ||
      typeof entry.key !== "string" ||
      entry.key.length < 1 ||
      typeof entry.version !== "string" ||
      entry.version.length < 1 ||
      typeof entry.definitionHash !== "string" ||
      !sha256Pattern.test(entry.definitionHash) ||
      seen.has(entry.skillVersionId)
    ) {
      throw skillError(
        "skill.pin_invalid",
        "validation",
        "Skill revision pin entries are malformed",
      );
    }
    seen.add(entry.skillVersionId);
  });

  if (
    pin.orderedVersions.at(-1)?.skillVersionId !==
    pin.rootSkillVersionId
  ) {
    throw skillError(
      "skill.pin_invalid",
      "validation",
      "Skill revision pin root ordering is invalid",
    );
  }

  const expectedHash = pinContentHash(
    pin.rootSkillVersionId,
    pin.orderedVersions,
  );
  if (pin.contentHash !== expectedHash) {
    throw skillError(
      "skill.pin_hash_mismatch",
      "validation",
      "Skill revision pin content hash does not match its contents",
    );
  }
}

export function resolveSkillRevisionPin(
  registry: SkillRegistry,
  pin: SkillRevisionPin,
): SkillExecutionPlan {
  validatePinShape(pin);

  for (const entry of pin.orderedVersions) {
    const skill = registry.getVersion(entry.skillVersionId);
    if (skill === null) {
      throw skillError(
        "skill.pin_version_missing",
        "not-found",
        "Pinned SkillVersion is not registered",
      );
    }
    if (
      skill.key !== entry.key ||
      skill.version !== entry.version ||
      definitionHash(skill) !== entry.definitionHash
    ) {
      throw skillError(
        "skill.pin_definition_mismatch",
        "conflict",
        "Pinned SkillVersion no longer matches its exact definition evidence",
      );
    }
  }

  const eligibility = evaluateSkillEligibility(
    registry,
    pin.rootSkillVersionId,
  );
  if (!eligibility.eligible) {
    throw skillError(
      "skill.pin_not_eligible",
      "conflict",
      "Pinned SkillVersion graph is not currently eligible",
    );
  }

  const plan = composeSkillExecutionPlan(
    registry,
    pin.rootSkillVersionId,
  );
  const currentOrder = plan.orderedSkillVersionIds;
  if (
    currentOrder.length !== pin.orderedVersions.length ||
    currentOrder.some(
      (skillVersionId, ordinal) =>
        pin.orderedVersions[ordinal]?.skillVersionId !==
        skillVersionId,
    )
  ) {
    throw skillError(
      "skill.pin_graph_mismatch",
      "conflict",
      "Pinned SkillVersion dependency graph no longer matches the exact plan",
    );
  }

  return plan;
}
