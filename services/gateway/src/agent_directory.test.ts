import { describe, expect, it } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  MobileAgentActivityRepository,
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import type { TenantId, UserId } from "@masanawa/contracts";
import {
  createAgentDirectoryService,
  type AgentDirectoryAuthorizer,
} from "./agent_directory.js";

const tenantId =
  "tenant_00000000-0000-4000-8000-000000000001" as TenantId;
const userId =
  "user_00000000-0000-4000-8000-000000000004" as UserId;

const presentation: AgentPresentation = {
  schemaVersion: 1,
  tenantId,
  characterId:
    "character_00000000-0000-4000-8000-000000000002" as never,
  characterVersionId:
    "character-version_00000000-0000-4000-8000-000000000003" as never,
  displayName: "Amina",
  roleLabel: "Sales & Outreach",
  about: "Handles prospecting",
  greeting: "What should we work on?",
  visibleInUserApp: true,
  sortOrder: 10,
  revision: 1,
};

describe("mobile agent directory", () => {
  it("projects presentation without leaking Skill assignments", async () => {
    const presentations: AgentPresentationRepository = {
      async readForCharacter() {
        return presentation;
      },
      async listAll() {
        return [presentation];
      },
      async listVisible() {
        return [presentation];
      },
      async put() {
        return presentation;
      },
    };
    const authorizer: AgentDirectoryAuthorizer = {
      async authorize(input) {
        expect(input.capability).toBe("agents.directory.read");
        expect(input.authorizationHeader).toBe("Bearer user");
        return { tenantId, userId };
      },
    };

    const service = createAgentDirectoryService({
      presentations,
      authorizer,
    });
    const entries = await service.list({
      authorizationHeader: "Bearer user",
    });

    expect(entries).toEqual([
      {
        characterId: presentation.characterId,
        characterVersionId: presentation.characterVersionId,
        displayName: "Amina",
        roleLabel: "Sales & Outreach",
        about: "Handles prospecting",
        greeting: "What should we work on?",
        presence: "available",
        activeWorkCount: 0,
        supportAgent: false,
        defaultPlatformAgent: false,
        voiceProvider: null,
        voiceName: null,
      },
    ]);
    expect(entries[0]).not.toHaveProperty("skillVersionIds");
  });

  it("starts independent directory enrichment reads concurrently", async () => {
    const started: string[] = [];
    let resolvePreference!: (value: null) => void;
    let resolveProfile!: (value: null) => void;
    let resolveActivity!: (value: readonly []) => void;

    const preference = new Promise<null>((resolve) => {
      resolvePreference = resolve;
    });
    const profile = new Promise<null>((resolve) => {
      resolveProfile = resolve;
    });
    const activity = new Promise<readonly []>((resolve) => {
      resolveActivity = resolve;
    });

    const presentations: AgentPresentationRepository = {
      async readForCharacter() {
        return presentation;
      },
      async listAll() {
        return [presentation];
      },
      async listVisible() {
        return [presentation];
      },
      async put() {
        return presentation;
      },
    };
    const authorizer: AgentDirectoryAuthorizer = {
      async authorize() {
        return { tenantId, userId };
      },
    };
    const userPreferences = {
      readForUser() {
        started.push("preference");
        return preference;
      },
    } as unknown as UserAgentPreferenceRepository;
    const platformProfiles = {
      readForCharacter() {
        started.push("profile");
        return profile;
      },
    } as unknown as PlatformAgentProfileRepository;
    const activityRepository = {
      list() {
        started.push("activity");
        return activity;
      },
    } as unknown as MobileAgentActivityRepository;

    const service = createAgentDirectoryService({
      presentations,
      authorizer,
      userPreferences,
      platformProfiles,
      activity: activityRepository,
    });

    const pending = service.list({ authorizationHeader: "Bearer user" });
    await Promise.resolve();
    await Promise.resolve();

    expect(new Set(started)).toEqual(
      new Set(["preference", "profile", "activity"]),
    );

    resolvePreference(null);
    resolveProfile(null);
    resolveActivity(Object.freeze([]));
    const entries = await pending;

    expect(entries).toHaveLength(1);
    expect(entries[0]?.displayName).toBe("Amina");
    expect(entries[0]?.presence).toBe("available");
  });

  it("does not read presentation data when authorization fails", async () => {
    let reads = 0;
    const presentations: AgentPresentationRepository = {
      async readForCharacter() {
        return null;
      },
      async listAll() {
        return [];
      },
      async listVisible() {
        reads += 1;
        return [presentation];
      },
      async put() {
        return presentation;
      },
    };
    const authorizer: AgentDirectoryAuthorizer = {
      async authorize() {
        throw new Error("denied");
      },
    };

    const service = createAgentDirectoryService({
      presentations,
      authorizer,
    });

    await expect(
      service.list({ authorizationHeader: "Bearer bad" }),
    ).rejects.toThrow("denied");
    expect(reads).toBe(0);
  });
});
