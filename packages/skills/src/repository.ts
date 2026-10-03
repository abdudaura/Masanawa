import type { Skill, SkillReadiness, SkillVersion } from "./model.js";
import type { SkillRegistration } from "./registry.js";

/** Canonical catalog observation, with a compare-and-swap token for readiness. */
export interface SkillReadinessRecord {
  readonly readiness: SkillReadiness;
  readonly revision: number;
}

export interface SkillCatalogSnapshot {
  readonly skills: readonly Skill[];
  readonly versions: readonly SkillVersion[];
  readonly readiness: readonly SkillReadinessRecord[];
}

/** Internal catalog port. Catalog membership never conveys execution authority. */
export interface SkillRepository {
  registerBatch(versions: readonly SkillVersion[]): Promise<readonly SkillRegistration[]>;
  readSnapshot(): Promise<SkillCatalogSnapshot>;
  putReadiness(input: {
    readonly readiness: SkillReadiness;
    /** null creates the first observation; updates require the observed revision. */
    readonly expectedRevision: number | null;
  }): Promise<SkillReadinessRecord>;
}
