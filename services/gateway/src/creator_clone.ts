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
  TwinProfileRepository,
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
    readonly gender: string;
    readonly age: number;
    readonly personality: readonly string[];
    readonly expertise: readonly string[];
  }): Promise<{
    readonly created: boolean;
    readonly characterId: string;
    readonly characterVersionId: string;
    readonly relationshipId: string;
    readonly displayName: string;
    readonly publicUrl: string | null;
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
  readonly twinProfiles?: TwinProfileRepository;
  readonly publicBaseUrl?: string;
}): CreatorCloneService {
  return Object.freeze<CreatorCloneService>({
    async create(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "creator.clone.write",
      });
      const displayName = text(request.displayName, "displayName", 120);
      const biography = text(request.biography, "biography", 1000);
      const gender = text(request.gender, "gender", 32);
      if (!Number.isSafeInteger(request.age) || request.age < 1 || request.age > 120) {
        throw new RangeError("age is invalid");
      }
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
          biography: `${biography}\n\nPhysical profile: ${gender}, age ${request.age}.`,
          personality,
          boundaries: [
            "Do not claim capabilities or completed actions without runtime evidence.",
            "Do not invent prices, balances, earnings, availability, or fulfillment status.",
            "Protect the owner's private information and follow explicit disclosure settings.",
          ],
          disclosurePolicy: {},
          // "mul" means unrestricted multilingual behavior. Runtime responses
          // mirror the language the user is currently using; it is not a preference.
          languages: ["mul"],
          voiceReferences: [],
          appearanceReferences: [],
          expertise,
        },
        createdAt: at,
      });

      const effectiveName = provision.version.constitution.displayName;
      let publicUrl: string | null = null;
      if (input.twinProfiles) {
        const existingProfile = await input.twinProfiles.readForOwner({
          tenantId: authority.tenantId,
          ownerUserId: authority.userId,
        });
        const profile = existingProfile ?? await input.twinProfiles.create({
          tenantId: authority.tenantId,
          characterId: provision.character.characterId,
          ownerUserId: authority.userId,
          publicId: `twin_${String(provision.character.characterId)
            .replace(/^character_/u, "")
            .replace(/-/gu, "")
            .toLowerCase()
            .slice(0, 48)}`,
          displayName: effectiveName.slice(0, 80),
          bio: provision.version.constitution.biography.slice(0, 500),
          interests: Object.freeze([...expertise].slice(0, 20)),
          languages: Object.freeze(["mul"]),
          avatarUrl: null,
          discoverable: true,
          revision: 1,
          createdAt: at,
          updatedAt: at,
        });
        const base = (input.publicBaseUrl ?? "https://masanawa.com").replace(/\/+$/u, "");
        publicUrl = `${base}/${profile.publicId}`;
      }
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
        publicUrl,
      });
    },
  });
}
