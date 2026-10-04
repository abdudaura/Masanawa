import {
  createCanonicalId,
  nowInstant,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type {
  PersonalCloneProvisioningRepository,
} from "@masanawa/identity";

export interface CreatorCloneAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export type CreatorCapability =
  | "creator.clone.write"
  | "creator.economy.read"
  | "creator.float.write"
  | "creator.skills.write";

export interface CreatorAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability: CreatorCapability;
  }): Promise<CreatorCloneAuthority>;
}

export type CreatorCloneAuthorizer = CreatorAuthorizer;

export interface CreatorCloneService {
  create(input: {
    readonly authorizationHeader: string | undefined;
    readonly displayName: string;
    readonly biography: string;
    readonly languages: readonly string[];
    readonly personality: readonly string[];
    readonly expertise: readonly string[];
  }): Promise<{
    readonly created: boolean;
    readonly characterId: string;
    readonly characterVersionId: string;
    readonly relationshipId: string;
    readonly displayName: string;
  }>;
}

function text(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function list(values: readonly string[], name: string, maxItems: number): readonly string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > maxItems) {
    throw new RangeError(`${name} is invalid`);
  }
  const normalized = values.map((value) => text(value, name, 120));
  if (new Set(normalized.map((value) => value.toLowerCase())).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze(normalized);
}

export function createCreatorCloneService(input: {
  readonly authorizer: CreatorAuthorizer;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly presentations: AgentPresentationRepository;
  readonly skillAssignments: CharacterSkillAssignmentRepository;
}): CreatorCloneService {
  return Object.freeze<CreatorCloneService>({
    async create(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "creator.clone.write",
      });
      const displayName = text(request.displayName, "displayName", 120);
      const biography = text(request.biography, "biography", 1000);
      const languages = list(request.languages, "languages", 16);
      const personality = list(request.personality, "personality", 24);
      const expertise = list(request.expertise, "expertise", 32);
      const at = nowInstant();

      const provision = await input.personalClones.getOrCreatePersonalClone({
        tenantId: authority.tenantId,
        userId: authority.userId,
        characterId: createCanonicalId("character"),
        characterVersionId: createCanonicalId("character-version"),
        relationshipId: createCanonicalId("relationship"),
        constitution: {
          schemaVersion: 1,
          displayName,
          biography,
          personality,
          boundaries: [
            "Do not claim capabilities or completed actions without runtime evidence.",
            "Do not invent prices, balances, earnings, availability, or fulfillment status.",
            "Protect the owner's private information and follow explicit disclosure settings.",
          ],
          disclosurePolicy: {},
          languages,
          voiceReferences: [],
          appearanceReferences: [],
          expertise,
        },
        createdAt: at,
      });

      const effectiveName = provision.version.constitution.displayName;
      const existingPresentation = await input.presentations.readForCharacter({
        tenantId: authority.tenantId,
        characterId: provision.character.characterId,
      });
      if (!existingPresentation) {
        await input.presentations.put({
          expectedRevision: null,
          presentation: {
            schemaVersion: 1,
            tenantId: authority.tenantId,
            characterId: provision.character.characterId,
            characterVersionId: provision.version.characterVersionId,
            displayName: effectiveName,
            roleLabel: "Personal Clone",
            about: provision.version.constitution.biography.slice(0, 500),
            greeting: `Hi, I’m ${effectiveName}’s Masanawa clone. How can I help?`,
            visibleInUserApp: true,
            sortOrder: 100,
            revision: 1,
          },
        });
      }

      const existingSkills = await input.skillAssignments.readForCharacter({
        tenantId: authority.tenantId,
        characterId: provision.character.characterId,
      });
      if (!existingSkills) {
        await input.skillAssignments.put({
          expectedRevision: null,
          assignment: {
            schemaVersion: 1,
            tenantId: authority.tenantId,
            characterId: provision.character.characterId,
            skillVersionIds: [],
            revision: 1,
          },
        });
      }

      return Object.freeze({
        created: provision.created,
        characterId: provision.character.characterId,
        characterVersionId: provision.version.characterVersionId,
        relationshipId: provision.relationship.relationshipId,
        displayName: effectiveName,
      });
    },
  });
}
