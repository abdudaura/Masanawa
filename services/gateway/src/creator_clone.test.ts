import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type {
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
} from "@masanawa/agents";
import type {
  PersonalCloneProvisioningRepository,
  ProvisionPersonalCloneInput,
} from "@masanawa/identity";
import { createCreatorCloneService } from "./creator_clone.js";

function cloneRepository(
  build: (
    input: ProvisionPersonalCloneInput,
  ) => Awaited<
    ReturnType<PersonalCloneProvisioningRepository["getOrCreatePersonalClone"]>
  >,
): PersonalCloneProvisioningRepository {
  return {
    async getOrCreatePersonalClone(input) {
      return build(input);
    },
    async readPersonalClone() {
      return null;
    },
  };
}

function validProvision(input: ProvisionPersonalCloneInput) {
  return {
    character: {
      tenantId: input.tenantId,
      characterId: input.characterId,
      state: "active" as const,
      activeCharacterVersionId: input.characterVersionId,
      revision: 1,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    version: {
      tenantId: input.tenantId,
      characterVersionId: input.characterVersionId,
      characterId: input.characterId,
      versionNumber: 1,
      state: "published" as const,
      constitution: input.constitution,
      createdAt: input.createdAt,
      publishedAt: input.createdAt,
    },
    ownership: {
      tenantId: input.tenantId,
      characterId: input.characterId,
      kind: "personal-clone" as const,
      ownerUserId: input.userId,
      createdAt: input.createdAt,
    },
    relationship: {
      tenantId: input.tenantId,
      relationshipId: input.relationshipId,
      userId: input.userId,
      characterId: input.characterId,
      state: "active" as const,
      stage: null,
      tone: null,
      preferences: {},
      disclosures: {},
      permissions: {},
      revision: 1,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    },
    created: true,
  };
}

function downstreamRepositories() {
  let presentationReads = 0;
  let presentationWrites = 0;
  let skillReads = 0;
  let skillWrites = 0;

  const presentations: AgentPresentationRepository = {
    async readForCharacter() {
      presentationReads++;
      return null;
    },
    async listAll() {
      return [];
    },
    async listVisible() {
      return [];
    },
    async put(input) {
      presentationWrites++;
      return input.presentation;
    },
  };

  const skillAssignments: CharacterSkillAssignmentRepository = {
    async readForCharacter() {
      skillReads++;
      return null;
    },
    async put(input) {
      skillWrites++;
      return input.assignment;
    },
  };

  return {
    presentations,
    skillAssignments,
    counts: () => ({
      presentationReads,
      presentationWrites,
      skillReads,
      skillWrites,
    }),
  };
}

function service(input: {
  personalClones: PersonalCloneProvisioningRepository;
  presentations: AgentPresentationRepository;
  skillAssignments: CharacterSkillAssignmentRepository;
}) {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");

  return {
    tenantId,
    userId,
    service: createCreatorCloneService({
      authorizer: {
        async authorize() {
          return { tenantId, userId };
        },
      },
      ...input,
    }),
  };
}

const request = {
  authorizationHeader: "Bearer fixture",
  displayName: "Nasir Twin",
  biography: "A bounded personal AI twin.",
  languages: ["Hausa", "English"],
  personality: ["Helpful"],
  expertise: ["Technology"],
} as const;

describe("creator clone provisioning scope", () => {
  it("accepts one exact provision graph and initializes downstream Agent state", async () => {
    const downstream = downstreamRepositories();
    const setup = service({
      personalClones: cloneRepository(validProvision),
      presentations: downstream.presentations,
      skillAssignments: downstream.skillAssignments,
    });

    const result = await setup.service.create(request);

    expect(result.created).toBe(true);
    expect(result.displayName).toBe("Nasir Twin");
    expect(downstream.counts()).toEqual({
      presentationReads: 1,
      presentationWrites: 1,
      skillReads: 1,
      skillWrites: 1,
    });
  });

  it("rejects cross-Tenant provision before any downstream Agent read or write", async () => {
    const downstream = downstreamRepositories();
    const setup = service({
      personalClones: cloneRepository((input) => ({
        ...validProvision(input),
        character: {
          ...validProvision(input).character,
          tenantId: createCanonicalId("tenant"),
        },
      })),
      presentations: downstream.presentations,
      skillAssignments: downstream.skillAssignments,
    });

    await expect(setup.service.create(request)).rejects.toThrow(
      "out-of-scope identity graph",
    );
    expect(downstream.counts()).toEqual({
      presentationReads: 0,
      presentationWrites: 0,
      skillReads: 0,
      skillWrites: 0,
    });
  });

  it("rejects CharacterVersion substitution before downstream Agent state is touched", async () => {
    const downstream = downstreamRepositories();
    const setup = service({
      personalClones: cloneRepository((input) => {
        const provision = validProvision(input);
        return {
          ...provision,
          version: {
            ...provision.version,
            characterId: createCanonicalId("character"),
          },
        };
      }),
      presentations: downstream.presentations,
      skillAssignments: downstream.skillAssignments,
    });

    await expect(setup.service.create(request)).rejects.toThrow(
      "out-of-scope identity graph",
    );
    expect(downstream.counts()).toEqual({
      presentationReads: 0,
      presentationWrites: 0,
      skillReads: 0,
      skillWrites: 0,
    });
  });

  it("rejects ownership User or Relationship User substitution", async () => {
    for (const target of ["ownership", "relationship"] as const) {
      const downstream = downstreamRepositories();
      const setup = service({
        personalClones: cloneRepository((input) => {
          const provision = validProvision(input);
          const foreignUser = createCanonicalId("user");
          return target === "ownership"
            ? {
                ...provision,
                ownership: {
                  ...provision.ownership,
                  ownerUserId: foreignUser,
                },
              }
            : {
                ...provision,
                relationship: {
                  ...provision.relationship,
                  userId: foreignUser,
                },
              };
        }),
        presentations: downstream.presentations,
        skillAssignments: downstream.skillAssignments,
      });

      await expect(setup.service.create(request)).rejects.toThrow(
        "out-of-scope identity graph",
      );
      expect(downstream.counts()).toEqual({
        presentationReads: 0,
        presentationWrites: 0,
        skillReads: 0,
        skillWrites: 0,
      });
    }
  });
});
