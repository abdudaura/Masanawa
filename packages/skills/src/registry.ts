import {
  PlatformError,
  type CapabilityKey,
  type SkillId,
  type SkillVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeSkillVersionDefinition,
  normalizeSkill,
  normalizeSkillKey,
  normalizeSkillReadiness,
  normalizeSkillVersion,
  type SkillVersion,
  type SkillReadiness,
} from "./model.js";
import type { SkillCatalogSnapshot } from "./repository.js";

export interface SkillRegistration {
  readonly skill: SkillVersion;
  readonly reused: boolean;
}

export interface SkillRegistryOptions {
  readonly maxDependencyDepth?: number;
}

export interface SkillRegistry {
  register(definition: SkillVersion): SkillRegistration;
  registerBatch(
    definitions: readonly SkillVersion[],
  ): readonly SkillRegistration[];
  setReadiness(readiness: SkillReadiness): SkillReadiness;
  getVersion(skillVersionId: SkillVersionId): SkillVersion | null;
  getByKeyVersion(key: string, version: string): SkillVersion | null;
  getReadiness(skillVersionId: SkillVersionId): SkillReadiness | null;
  listVersions(): readonly SkillVersion[];
  listAdvertised(): readonly SkillVersion[];
  resolveExecutionPlan(
    skillVersionId: SkillVersionId,
  ): readonly SkillVersion[];
  requiredToolCapabilities(
    skillVersionId: SkillVersionId,
  ): readonly CapabilityKey[];
}

interface RegisteredSkill {
  readonly definition: SkillVersion;
  readonly fingerprint: string;
}

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

function keyVersion(key: string, version: string): string {
  return `${key}@${version}`;
}

function definitionFingerprint(definition: SkillVersion): string {
  return fingerprintCanonicalJson(definition);
}

function validateGraph(
  definitions: ReadonlyMap<SkillVersionId, SkillVersion>,
  roots: readonly SkillVersionId[],
  maxDependencyDepth: number,
): void {
  const visiting = new Set<SkillVersionId>();
  const visited = new Set<SkillVersionId>();
  const depthMemo = new Map<SkillVersionId, number>();

  function depth(skillVersionId: SkillVersionId): number {
    const memoized = depthMemo.get(skillVersionId);
    if (memoized !== undefined) {
      return memoized;
    }
    const definition = definitions.get(skillVersionId);
    if (!definition) {
      throw skillError(
        "skill.dependency_missing",
        "not-found",
        "SkillVersion dependency is not registered in the candidate graph",
      );
    }
    if (visiting.has(skillVersionId)) {
      throw skillError(
        "skill.dependency_cycle",
        "validation",
        "SkillVersion dependency graph contains a cycle",
      );
    }
    if (visited.has(skillVersionId)) {
      return depthMemo.get(skillVersionId) ?? 1;
    }

    visiting.add(skillVersionId);
    if (visiting.size > maxDependencyDepth) {
      throw skillError("skill.dependency_depth_exceeded", "validation",
        "SkillVersion dependency graph exceeds the configured depth bound");
    }
    let maxChildDepth = 0;
    for (const dependency of definition.dependencies) {
      maxChildDepth = Math.max(maxChildDepth, depth(dependency));
    }
    visiting.delete(skillVersionId);
    visited.add(skillVersionId);

    const result = maxChildDepth + 1;
    if (result > maxDependencyDepth) {
      throw skillError(
        "skill.dependency_depth_exceeded",
        "validation",
        "SkillVersion dependency graph exceeds the configured depth bound",
      );
    }
    depthMemo.set(skillVersionId, result);
    return result;
  }

  for (const root of roots) {
    depth(root);
  }
}

/** Reconstruct a disposable projection from canonical storage, failing closed. */
export function restoreSkillRegistry(
  snapshot: SkillCatalogSnapshot,
  options: SkillRegistryOptions = {},
): SkillRegistry {
  const registry = createSkillRegistry(options);
  const identities = new Map<SkillId, string>();
  const keys = new Set<string>();
  for (const input of snapshot.skills) {
    const skill = normalizeSkill(input);
    if (identities.has(skill.skillId) || keys.has(skill.key)) {
      throw skillError("skill.snapshot_identity_conflict", "validation", "Catalog identities are duplicated");
    }
    identities.set(skill.skillId, skill.key);
    keys.add(skill.key);
  }
  const definitions = new Map<SkillVersionId, SkillVersion>();
  for (const input of snapshot.versions) {
    const version = normalizeSkillVersionDefinition(input);
    if (definitions.has(version.skillVersionId) || identities.get(version.skillId) !== version.key) {
      throw skillError("skill.snapshot_identity_conflict", "validation", "Catalog version identity is inconsistent");
    }
    definitions.set(version.skillVersionId, version);
  }
  validateGraph(definitions, [...definitions.keys()], options.maxDependencyDepth ?? 16);
  const ordered: SkillVersion[] = [];
  const visited = new Set<SkillVersionId>();
  function visit(id: SkillVersionId): void {
    if (visited.has(id)) return;
    visited.add(id);
    const version = definitions.get(id)!;
    for (const dependency of version.dependencies) visit(dependency);
    ordered.push(version);
  }
  for (const id of definitions.keys()) visit(id);
  // Admission limits each write batch, rather than limiting total catalog size.
  for (let offset = 0; offset < ordered.length; offset += 512) {
    registry.registerBatch(ordered.slice(offset, offset + 512));
  }
  const observed = new Set<SkillVersionId>();
  for (const record of snapshot.readiness) {
    if (!Number.isSafeInteger(record.revision) || record.revision < 1 ||
        observed.has(record.readiness.skillVersionId)) {
      throw skillError("skill.snapshot_readiness_invalid", "validation", "Catalog readiness revision is invalid or duplicated");
    }
    observed.add(record.readiness.skillVersionId);
    registry.setReadiness(record.readiness);
  }
  return registry;
}

export function createSkillRegistry(
  options: SkillRegistryOptions = {},
): SkillRegistry {
  const maxDependencyDepth = options.maxDependencyDepth ?? 16;
  if (
    !Number.isSafeInteger(maxDependencyDepth) ||
    maxDependencyDepth < 1 ||
    maxDependencyDepth > 64
  ) {
    throw new RangeError("maxDependencyDepth must be between 1 and 64");
  }

  const byVersionId = new Map<SkillVersionId, RegisteredSkill>();
  const byKeyVersion = new Map<string, SkillVersionId>();
  const skillKeyById = new Map<SkillId, string>();
  const skillIdByKey = new Map<string, SkillId>();
  const readiness = new Map<SkillVersionId, SkillReadiness>();

  function executionPlan(
    skillVersionId: SkillVersionId,
    requireReady: boolean,
  ): readonly SkillVersion[] {
    const target = byVersionId.get(skillVersionId)?.definition;
    if (!target) {
      throw skillError(
        "skill.version_not_found",
        "not-found",
        "SkillVersion is not registered",
      );
    }

    const visited = new Set<SkillVersionId>();
    const plan: SkillVersion[] = [];

    function visit(versionId: SkillVersionId): void {
      if (visited.has(versionId)) {
        return;
      }
      const definition = byVersionId.get(versionId)?.definition;
      if (!definition) {
        throw skillError(
          "skill.dependency_missing",
          "not-found",
          "Registered SkillVersion has a missing dependency",
        );
      }
      if (requireReady) {
        const current = readiness.get(versionId);
        if (!current || current.state !== "ready") {
          throw skillError(
            "skill.version_not_ready",
            "conflict",
            "SkillVersion or one of its dependencies is not ready",
          );
        }
      }
      visited.add(versionId);
      for (const dependency of definition.dependencies) {
        visit(dependency);
      }
      plan.push(definition);
    }

    visit(skillVersionId);
    return Object.freeze(plan);
  }

  return Object.freeze({
    register(input: SkillVersion): SkillRegistration {
      return this.registerBatch([input])[0]!;
    },

    registerBatch(
      inputs: readonly SkillVersion[],
    ): readonly SkillRegistration[] {
      if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 512) {
        throw new RangeError("skill registration batch is invalid");
      }

      const definitions = inputs.map(normalizeSkillVersionDefinition);
      const seenVersionIds = new Set<SkillVersionId>();
      const seenKeyVersions = new Set<string>();

      for (const definition of definitions) {
        if (seenVersionIds.has(definition.skillVersionId)) {
          throw skillError(
            "skill.batch_duplicate_version",
            "validation",
            "Skill registration batch contains duplicate SkillVersionId",
          );
        }
        seenVersionIds.add(definition.skillVersionId);

        const kv = keyVersion(definition.key, definition.version);
        if (seenKeyVersions.has(kv)) {
          throw skillError(
            "skill.batch_duplicate_key_version",
            "validation",
            "Skill registration batch contains duplicate key/version",
          );
        }
        seenKeyVersions.add(kv);
      }

      const candidate = new Map<SkillVersionId, SkillVersion>();
      for (const [versionId, registered] of byVersionId) {
        candidate.set(versionId, registered.definition);
      }

      const newDefinitions: SkillVersion[] = [];
      for (const definition of definitions) {
        const fingerprint = definitionFingerprint(definition);
        const existingByVersion = byVersionId.get(definition.skillVersionId);
        if (existingByVersion) {
          if (existingByVersion.fingerprint !== fingerprint) {
            throw skillError(
              "skill.registration_version_conflict",
              "conflict",
              "SkillVersionId is already bound to a different definition",
            );
          }
          continue;
        }

        const kv = keyVersion(definition.key, definition.version);
        const existingKeyVersion = byKeyVersion.get(kv);
        if (existingKeyVersion) {
          throw skillError(
            "skill.registration_key_version_conflict",
            "conflict",
            "Skill key/version is already bound to another SkillVersionId",
          );
        }

        const existingSkillKey = skillKeyById.get(definition.skillId);
        if (
          existingSkillKey !== undefined &&
          existingSkillKey !== definition.key
        ) {
          throw skillError(
            "skill.registration_skill_id_conflict",
            "conflict",
            "SkillId is already bound to a different skill key",
          );
        }

        const existingSkillId = skillIdByKey.get(definition.key);
        if (
          existingSkillId !== undefined &&
          existingSkillId !== definition.skillId
        ) {
          throw skillError(
            "skill.registration_skill_key_conflict",
            "conflict",
            "Skill key is already bound to a different SkillId",
          );
        }

        for (const other of newDefinitions) {
          if (
            other.skillId === definition.skillId &&
            other.key !== definition.key
          ) {
            throw skillError(
              "skill.registration_skill_id_conflict",
              "conflict",
              "SkillId cannot bind multiple skill keys in one batch",
            );
          }
          if (
            other.key === definition.key &&
            other.skillId !== definition.skillId
          ) {
            throw skillError(
              "skill.registration_skill_key_conflict",
              "conflict",
              "Skill key cannot bind multiple SkillIds in one batch",
            );
          }
        }

        candidate.set(definition.skillVersionId, definition);
        newDefinitions.push(definition);
      }

      validateGraph(
        candidate,
        definitions.map((definition) => definition.skillVersionId),
        maxDependencyDepth,
      );

      for (const definition of newDefinitions) {
        const registered = Object.freeze({
          definition,
          fingerprint: definitionFingerprint(definition),
        });
        byVersionId.set(definition.skillVersionId, registered);
        byKeyVersion.set(
          keyVersion(definition.key, definition.version),
          definition.skillVersionId,
        );
        skillKeyById.set(definition.skillId, definition.key);
        skillIdByKey.set(definition.key, definition.skillId);
      }

      return Object.freeze(
        definitions.map((definition) => {
          const registered = byVersionId.get(definition.skillVersionId)!;
          return Object.freeze({
            skill: registered.definition,
            reused: !newDefinitions.some(
              (item) => item.skillVersionId === definition.skillVersionId,
            ),
          });
        }),
      );
    },

    setReadiness(input: SkillReadiness): SkillReadiness {
      const normalized = normalizeSkillReadiness(input);
      const definition = byVersionId.get(normalized.skillVersionId)?.definition;
      if (!definition) {
        throw skillError(
          "skill.readiness_not_registered",
          "not-found",
          "SkillVersion must be registered before readiness can be published",
        );
      }
      if (
        normalized.advertised &&
        definition.visibility !== "model-visible"
      ) {
        throw skillError(
          "skill.hidden_cannot_advertise",
          "validation",
          "Model-hidden SkillVersion cannot be advertised",
        );
      }

      const prior = readiness.get(normalized.skillVersionId);
      if (
        prior &&
        Date.parse(normalized.checkedAt) < Date.parse(prior.checkedAt)
      ) {
        throw skillError(
          "skill.readiness_stale",
          "conflict",
          "Skill readiness observation is older than the current observation",
        );
      }
      readiness.set(normalized.skillVersionId, normalized);
      return normalized;
    },

    getVersion(skillVersionId: SkillVersionId): SkillVersion | null {
      return byVersionId.get(skillVersionId)?.definition ?? null;
    },

    getByKeyVersion(key: string, version: string): SkillVersion | null {
      const id = byKeyVersion.get(
        keyVersion(normalizeSkillKey(key), normalizeSkillVersion(version)),
      );
      return id ? byVersionId.get(id)?.definition ?? null : null;
    },

    getReadiness(skillVersionId: SkillVersionId): SkillReadiness | null {
      return readiness.get(skillVersionId) ?? null;
    },

    listVersions(): readonly SkillVersion[] {
      return Object.freeze(
        [...byVersionId.values()]
          .map((entry) => entry.definition)
          .sort(
            (left, right) =>
              left.key.localeCompare(right.key) ||
              left.version.localeCompare(right.version) ||
              left.skillVersionId.localeCompare(right.skillVersionId),
          ),
      );
    },

    listAdvertised(): readonly SkillVersion[] {
      return Object.freeze(
        [...byVersionId.values()]
          .map((entry) => entry.definition)
          .filter((definition) => {
            const current = readiness.get(definition.skillVersionId);
            if (
              definition.visibility !== "model-visible" ||
              !current ||
              current.state !== "ready" ||
              !current.advertised
            ) {
              return false;
            }
            try {
              executionPlan(definition.skillVersionId, true);
              return true;
            } catch {
              return false;
            }
          })
          .sort(
            (left, right) =>
              left.key.localeCompare(right.key) ||
              left.version.localeCompare(right.version) ||
              left.skillVersionId.localeCompare(right.skillVersionId),
          ),
      );
    },

    resolveExecutionPlan(
      skillVersionId: SkillVersionId,
    ): readonly SkillVersion[] {
      return executionPlan(skillVersionId, true);
    },

    requiredToolCapabilities(
      skillVersionId: SkillVersionId,
    ): readonly CapabilityKey[] {
      const plan = executionPlan(skillVersionId, true);
      const capabilities = new Set<CapabilityKey>();
      for (const definition of plan) {
        for (const capability of definition.requiredToolCapabilities) {
          capabilities.add(capability);
        }
      }
      return Object.freeze([...capabilities].sort());
    },
  });
}
