import { describe, expect, it, vi } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  PlatformAgentProfileRepository,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import type { TenantId, UserId, CharacterId } from "@masanawa/contracts";
import {
  createAgentDirectoryService,
  type AgentDirectoryAuthorizer,
} from "./agent_directory.js";

const tenantId = "tenant_00000000-0000-7000-8000-000000000001" as TenantId;
const otherTenant = "tenant_00000000-0000-7000-8000-000000000009" as TenantId;
const userId = "user_00000000-0000-7000-8000-000000000002" as UserId;
const characterId = "character_00000000-0000-7000-8000-000000000003" as CharacterId;

function fixture(options: {
  visible?: boolean;
  support?: boolean;
  allowed?: boolean;
  staleReadback?: boolean;
  tenant?: TenantId;
} = {}) {
  const presentation = {
    schemaVersion: 1,
    tenantId,
    characterId,
    characterVersionId: "character-version_00000000-0000-7000-8000-000000000004",
    displayName: "Gwana",
    roleLabel: "Masanawa Support",
    about: "Platform support",
    greeting: "Hello",
    visibleInUserApp: true,
    sortOrder: 0,
    revision: 1,
  } as AgentPresentation;
  const presentations = {
    listVisible: vi.fn(async (input: { tenantId: TenantId }) =>
      input.tenantId === tenantId && options.visible !== false
        ? [presentation] : []),
    listAll: vi.fn(async () => [presentation]),
    readForCharacter: vi.fn(async () => presentation),
    put: vi.fn(async () => presentation),
  } as unknown as AgentPresentationRepository;
  const profile = {
    schemaVersion: 1,
    tenantId,
    characterId,
    supportAgent: options.support !== false,
    defaultForNewUsers: false,
    voiceProvider: "gemini",
    voiceName: "Sulafat",
    revision: 1,
  };
  const profiles = {
    readForCharacter: vi.fn(async (input: { tenantId: TenantId; characterId: CharacterId }) =>
      input.tenantId === tenantId && input.characterId === characterId ? profile : null),
  } as unknown as PlatformAgentProfileRepository;
  let persisted: CharacterId | null = null;
  let revision = 0;
  const preferences = {
    readForUser: vi.fn(async (input: { tenantId: TenantId; userId: UserId }) => {
      if (input.tenantId !== tenantId || input.userId !== userId || persisted === null) return null;
      return {
        schemaVersion: 1 as const, tenantId, userId,
        defaultPlatformCharacterId: persisted, revision,
      };
    }),
    put: vi.fn(async (input: {
      expectedRevision: number | null;
      preference: { defaultPlatformCharacterId: CharacterId };
    }) => {
      if (input.expectedRevision !== (revision || null)) throw new Error("revision conflict");
      if (!options.staleReadback) {
        persisted = input.preference.defaultPlatformCharacterId;
        revision += 1;
      }
      return undefined;
    }),
  } as unknown as UserAgentPreferenceRepository;
  const authorizer = {
    authorize: vi.fn(async (input: {
      authorizationHeader: string | undefined;
      capability: string;
    }) => {
      if (input.authorizationHeader !== "Bearer user" ||
          input.capability !== "agents.preferences.write") {
        throw new Error("unauthorized");
      }
      return {
        tenantId: options.tenant ?? tenantId, userId,
        ...(options.allowed === false ? { characterIds: [] } : {}),
      };
    }),
  } as AgentDirectoryAuthorizer;
  const service = createAgentDirectoryService({
    presentations, platformProfiles: profiles, userPreferences: preferences, authorizer,
  });
  return { service, presentations, profiles, preferences, authorizer };
}

describe("R03 — authorized durable default support agent preference", () => {
  const save = (service: ReturnType<typeof fixture>["service"], id: string = characterId) =>
    service.setDefaultPlatformAgent({
      authorizationHeader: "Bearer user", characterId: id,
    });

  it("saves only an authorized visible support profile and reads back the current user's value", async () => {
    const f = fixture();
    expect(await save(f.service)).toEqual({ characterId });
    expect(f.presentations.listVisible).toHaveBeenCalledWith({ tenantId });
    expect(f.profiles.readForCharacter).toHaveBeenCalledWith({ tenantId, characterId });
    expect(f.preferences.put).toHaveBeenCalledTimes(1);
    expect(f.preferences.readForUser).toHaveBeenCalledTimes(2);
    // Same choice twice is a no-op, including after a client request replay.
    expect(await save(f.service)).toEqual({ characterId });
    expect(f.preferences.put).toHaveBeenCalledTimes(1);
  });

  it("rejects hidden and revoked presentations before reading or writing preference", async () => {
    const f = fixture({ visible: false });
    await expect(save(f.service)).rejects.toThrow("not available");
    expect(f.profiles.readForCharacter).not.toHaveBeenCalled();
    expect(f.preferences.put).not.toHaveBeenCalled();
  });

  it("rejects identities not granted by the current user authorization scope", async () => {
    const f = fixture({ allowed: false });
    await expect(save(f.service)).rejects.toThrow("not available");
    expect(f.presentations.listVisible).not.toHaveBeenCalled();
  });

  it("cannot select a Character from another tenant even with the same public ID", async () => {
    const f = fixture({ tenant: otherTenant });
    await expect(save(f.service)).rejects.toThrow("not available");
    expect(f.presentations.listVisible).toHaveBeenCalledWith({ tenantId: otherTenant });
    expect(f.preferences.put).not.toHaveBeenCalled();
  });

  it("rejects non-support and unknown profiles even if public", async () => {
    const f = fixture({ support: false });
    await expect(save(f.service)).rejects.toThrow("not a platform support agent");
    expect(f.preferences.put).not.toHaveBeenCalled();
  });

  it("does not report success if authoritative readback differs from write", async () => {
    const f = fixture({ staleReadback: true });
    await expect(save(f.service)).rejects.toThrow("could not be verified");
    expect(f.preferences.put).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed Character ID before touching the database", async () => {
    const f = fixture();
    await expect(save(f.service, "../unauthorized")).rejects.toThrow();
    expect(f.presentations.listVisible).not.toHaveBeenCalled();
  });

  it("rejects absent credentials before reading the visible roster", async () => {
    const f = fixture();
    await expect(f.service.setDefaultPlatformAgent({
      authorizationHeader: undefined, characterId,
    })).rejects.toThrow("unauthorized");
    expect(f.presentations.listVisible).not.toHaveBeenCalled();
  });
});
