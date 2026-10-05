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
});
