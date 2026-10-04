import type {
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type {
  PersonalCloneProvisioningRepository,
} from "@masanawa/identity";
import {
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillDistributionRepository,
  type SkillGuideRepository,
  type SkillRepository,
} from "@masanawa/skills";
import { parseCanonicalId } from "@masanawa/contracts";
import type { CreatorAuthorizer } from "./creator_clone.js";

export interface CreatorSkillCatalogEntry {
  readonly skillVersionId: string;
  readonly key: string;
  readonly displayName: string;
  readonly description: string;
  readonly triggerDescription: string;
  readonly category: string;
  readonly enabled: boolean;
}

export interface CreatorSkillService {
  list(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly CreatorSkillCatalogEntry[]>;

  setEnabled(input: {
    readonly authorizationHeader: string | undefined;
    readonly skillVersionId: string;
    readonly enabled: boolean;
  }): Promise<readonly CreatorSkillCatalogEntry[]>;
}

export function createCreatorSkillService(input: {
  readonly authorizer: CreatorAuthorizer;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly assignments: CharacterSkillAssignmentRepository;
  readonly skills: SkillRepository;
  readonly guides: SkillGuideRepository;
  readonly distribution: SkillDistributionRepository;
}): CreatorSkillService {
  async function context(authorizationHeader: string | undefined) {
    const authority = await input.authorizer.authorize({
      authorizationHeader,
      capability: "creator.skills.write",
    });
    const clone = await input.personalClones.readPersonalClone({
      tenantId: authority.tenantId,
      userId: authority.userId,
    });
    if (!clone) {
      throw new Error("Create a personal clone before configuring Skills");
    }
    return { authority, clone };
  }

  async function catalog(
    authority: Awaited<ReturnType<CreatorAuthorizer["authorize"]>>,
    clone: NonNullable<
      Awaited<ReturnType<PersonalCloneProvisioningRepository["readPersonalClone"]>>
    >,
  ): Promise<readonly CreatorSkillCatalogEntry[]> {
    const [snapshot, profiles, assignment] = await Promise.all([
      input.skills.readSnapshot(),
      input.distribution.listForAudience("personal-clone"),
      input.assignments.readForCharacter({
        tenantId: authority.tenantId,
        characterId: clone.characterId,
      }),
    ]);
    const registry = restoreSkillRegistry(snapshot);
    const enabled = new Set(assignment?.skillVersionIds ?? []);
    const optionalProfiles = profiles.filter(
      (profile) => profile.installMode === "optional",
    );
    const guides = await input.guides.readGuides(
      optionalProfiles.map((profile) => profile.skillVersionId),
    );
    const guideById = new Map(
      guides.map((guide) => [guide.skillVersionId, guide]),
    );

    return Object.freeze(
      optionalProfiles.flatMap((profile) => {
        const skill = registry.getVersion(profile.skillVersionId);
        const guide = guideById.get(profile.skillVersionId);
        if (!skill || !guide) return [];
        const eligibility = evaluateSkillEligibility(
          registry,
          profile.skillVersionId,
        );
        if (!eligibility.eligible || !eligibility.advertisable) return [];
        return [
          Object.freeze({
            skillVersionId: profile.skillVersionId,
            key: skill.key,
            displayName: skill.displayName,
            description: skill.description,
            triggerDescription: guide.triggerDescription,
            category: profile.category,
            enabled: enabled.has(profile.skillVersionId),
          }),
        ];
      }),
    );
  }

  return Object.freeze({
    async list(request) {
      const { authority, clone } = await context(
        request.authorizationHeader,
      );
      return catalog(authority, clone);
    },

    async setEnabled(request) {
      const { authority, clone } = await context(
        request.authorizationHeader,
      );
      const skillVersionId = parseCanonicalId(
        "skill-version",
        request.skillVersionId,
      );
      const profile = await input.distribution.read(skillVersionId);
      if (
        !profile ||
        !profile.audiences.includes("personal-clone") ||
        profile.installMode !== "optional"
      ) {
        throw new Error("Skill is not available for personal-clone enrollment");
      }

      const snapshot = await input.skills.readSnapshot();
      const registry = restoreSkillRegistry(snapshot);
      const eligibility = evaluateSkillEligibility(registry, skillVersionId);
      if (!eligibility.eligible || !eligibility.advertisable) {
        throw new Error("Skill is not currently ready for enrollment");
      }

      const existing = await input.assignments.readForCharacter({
        tenantId: authority.tenantId,
        characterId: clone.characterId,
      });
      const selected = new Set(existing?.skillVersionIds ?? []);
      if (request.enabled) {
        selected.add(skillVersionId);
      } else {
        selected.delete(skillVersionId);
      }
      const skillVersionIds = [...selected].sort();
      if (skillVersionIds.length > 64) {
        throw new RangeError("Personal clone has too many selected Skills");
      }

      await input.assignments.put({
        expectedRevision: existing?.revision ?? null,
        assignment: {
          schemaVersion: 1,
          tenantId: authority.tenantId,
          characterId: clone.characterId,
          skillVersionIds,
          revision: existing?.revision ?? 1,
        },
      });

      return catalog(authority, clone);
    },
  });
}
