import { describe, expect, it, vi } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignment,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import type {
  SkillDistributionProfile,
  SkillDistributionRepository,
} from "@masanawa/skills";

import {
  ensureDefaultPlatformAgents,
  type PlatformAgentIdentityProvisioner,
} from "./platform_agent_bootstrap.js";

function fixture() {
  const presentations: AgentPresentation[] = [];
  const profiles: PlatformAgentProfile[] = [];
  const assignments = new Map<string, CharacterSkillAssignment>();
  const supportSkill: SkillDistributionProfile = {
    schemaVersion: 1,
    skillVersionId: createCanonicalId("skill-version"),
    audiences: ["platform-support"],
    installMode: "automatic",
    category: "masanawa-support",
    sortOrder: 0,
  };

  const identity = {
    provision: vi.fn(async () => undefined),
  } satisfies PlatformAgentIdentityProvisioner;

  const presentationRepository = {
    async readForCharacter(input: { characterId: string }) {
      return (
        presentations.find((item) => item.characterId === input.characterId) ??
        null
      );
    },
    async listAll() {
      return presentations;
    },
    async listVisible() {
      return presentations.filter((item) => item.visibleInUserApp);
    },
    async put(input: { presentation: AgentPresentation }) {
      presentations.push(input.presentation);
      return input.presentation;
    },
  } as unknown as AgentPresentationRepository;

  const profileRepository = {
    async readForCharacter(input: { characterId: string }) {
      return (
        profiles.find((item) => item.characterId === input.characterId) ?? null
      );
    },
    async listSupportAgents() {
      return profiles.filter((item) => item.supportAgent);
    },
    async put(input: { profile: PlatformAgentProfile }) {
      profiles.push(input.profile);
      return input.profile;
    },
  } as unknown as PlatformAgentProfileRepository;

  const assignmentRepository = {
    async readForCharacter(input: { characterId: string }) {
      return assignments.get(input.characterId) ?? null;
    },
    async put(input: { assignment: CharacterSkillAssignment }) {
      assignments.set(input.assignment.characterId, input.assignment);
      return input.assignment;
    },
  } as unknown as CharacterSkillAssignmentRepository;

  const distributionRepository = {
    async listForAudience() {
      return [supportSkill];
    },
  } as unknown as SkillDistributionRepository;

  return {
    identity,
    presentations,
    profiles,
    assignments,
    supportSkill,
    presentationRepository,
    profileRepository,
    assignmentRepository,
    distributionRepository,
  };
}

describe("production platform Agent bootstrap", () => {
  it("creates Gwani and Gwana once for an empty platform tenant", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();

    const first = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
      now: () => nowInstant(),
    });

    expect(first).toMatchObject({
      changed: true,
      supportAgentCount: 2,
    });
    expect(f.presentations.map((item) => item.displayName)).toEqual([
      "Gwani",
      "Gwana",
    ]);
    expect(
      f.profiles.map((item) => ({
        voice: item.voiceName,
        defaultAgent: item.defaultForNewUsers,
      })),
    ).toEqual([
      { voice: "Bodi", defaultAgent: true },
      { voice: "Sulafat", defaultAgent: false },
    ]);
    expect([...f.assignments.values()]).toHaveLength(2);
    for (const assignment of f.assignments.values()) {
      expect(assignment.skillVersionIds).toEqual([
        f.supportSkill.skillVersionId,
      ]);
    }

    const second = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
      now: () => nowInstant(),
    });

    expect(second).toMatchObject({
      changed: false,
      supportAgentCount: 2,
    });
    expect(f.presentations).toHaveLength(2);
    expect(f.profiles).toHaveLength(2);
    expect(f.identity.provision).toHaveBeenCalledTimes(2);
  });

  it("does not modify an existing admin-managed support roster", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    f.profiles.push({
      schemaVersion: 1,
      tenantId,
      characterId: createCanonicalId("character"),
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "AdminVoice",
      revision: 1,
    });

    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
      now: () => nowInstant(),
    });

    expect(result.changed).toBe(false);
    expect(result.supportAgentCount).toBe(1);
    expect(f.identity.provision).not.toHaveBeenCalled();
    expect(f.presentations).toHaveLength(0);
  });
  it("recovers a missing Gwana after an interrupted Gwani support seed", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    const gwaniId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwaniId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwani",
      roleLabel: "Masanawa Support",
      about: "Admin customized biography",
      greeting: "Welcome back",
      visibleInUserApp: true,
      sortOrder: 0,
      revision: 4,
    });
    f.profiles.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwaniId,
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "AdminQualifiedVoice",
      revision: 3,
    });
    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(result.changed).toBe(true);
    expect(result.supportAgentCount).toBe(2);
    expect(f.identity.provision).toHaveBeenCalledTimes(1);
    expect(f.presentations.map((profile) => profile.displayName)).toEqual(["Gwani", "Gwana"]);
    expect(f.presentations[0]?.about).toBe("Admin customized biography");
    expect(f.profiles[0]?.voiceName).toBe("AdminQualifiedVoice");
    expect(f.profiles[0]?.revision).toBe(3);
    expect(f.profiles[1]?.voiceName).toBe("Sulafat");
    expect(f.profiles[1]?.defaultForNewUsers).toBe(false);

    const again = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(again.changed).toBe(false);
    expect(f.identity.provision).toHaveBeenCalledTimes(1);
    expect(f.presentations).toHaveLength(2);
  });

  it("preserves an existing Gwana default and does not silently replace the voice", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    const gwanaId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwanaId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwana",
      roleLabel: "Masanawa Support",
      about: "A human-edited support profile",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 1,
      revision: 2,
    });
    f.profiles.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwanaId,
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "SelectedFemaleVoice",
      revision: 2,
    });
    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(result.changed).toBe(true);
    expect(result.supportAgentCount).toBe(2);
    expect(f.identity.provision).toHaveBeenCalledTimes(1);
    expect(f.profiles.filter((profile) => profile.defaultForNewUsers)).toHaveLength(1);
    expect(f.profiles[0]?.voiceName).toBe("SelectedFemaleVoice");
    const gwani = f.presentations.find((profile) => profile.displayName === "Gwani");
    expect(gwani).toBeDefined();
    expect(f.profiles.find((profile) => profile.characterId === gwani?.characterId)?.defaultForNewUsers).toBe(false);
  });

  it("never recreates a deliberately hidden or admin-owned missing support persona", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    const gwaniId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwaniId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwani",
      roleLabel: "Masanawa Support",
      about: "Support",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 0,
      revision: 1,
    });
    f.profiles.push({
      schemaVersion: 1, tenantId, characterId: gwaniId, supportAgent: true,
      defaultForNewUsers: true, voiceProvider: "gemini", voiceName: "Bodi", revision: 1,
    });
    const gwanaId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwanaId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwana",
      roleLabel: "Masanawa Support",
      about: "Hidden at administrator request",
      greeting: null,
      visibleInUserApp: false,
      sortOrder: 1,
      revision: 3,
    });
    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(result.changed).toBe(false);
    expect(result.supportAgentCount).toBe(1);
    expect(f.identity.provision).not.toHaveBeenCalled();
    expect(f.presentations).toHaveLength(2);
    expect(f.profiles).toHaveLength(1);
  });

  it("reuses a canonical presentation left before profile creation", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    const existingId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: existingId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwani",
      roleLabel: "Masanawa Support",
      about: "Recovered after failure",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 0,
      revision: 1,
    });
    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(result.changed).toBe(true);
    expect(result.supportAgentCount).toBe(2);
    expect(f.identity.provision).toHaveBeenCalledTimes(1);
    expect(f.presentations).toHaveLength(2);
    expect(f.profiles.find((p) => p.characterId === existingId)).toMatchObject({
      voiceName: "Bodi", defaultForNewUsers: true,
    });
    expect(f.assignments.has(existingId)).toBe(true);
  });

  it("never upgrades a similarly named admin specialist into a support profile", async () => {
    const tenantId = createCanonicalId("tenant");
    const f = fixture();
    const gwaniId = createCanonicalId("character");
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwaniId,
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwani",
      roleLabel: "Masanawa Support",
      about: "Support",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 0,
      revision: 1,
    });
    f.profiles.push({
      schemaVersion: 1,
      tenantId,
      characterId: gwaniId,
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "Bodi",
      revision: 1,
    });
    f.presentations.push({
      schemaVersion: 1,
      tenantId,
      characterId: createCanonicalId("character"),
      characterVersionId: createCanonicalId("character-version"),
      displayName: "Gwana",
      roleLabel: "Custom Admin Specialist",
      about: "Independent specialist",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 1,
      revision: 2,
    });
    const result = await ensureDefaultPlatformAgents({
      tenantId,
      identity: f.identity,
      presentations: f.presentationRepository,
      profiles: f.profileRepository,
      skillAssignments: f.assignmentRepository,
      skillDistribution: f.distributionRepository,
    });
    expect(result.changed).toBe(false);
    expect(result.supportAgentCount).toBe(1);
    expect(f.profiles).toHaveLength(1);
    expect(f.identity.provision).not.toHaveBeenCalled();
  });

});

