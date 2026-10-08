import { describe, expect, it, vi } from "vitest";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
  UserAgentPreference,
  UserAgentPreferenceRepository,
} from "@masanawa/agents";
import { createCanonicalId } from "@masanawa/contracts";
import {
  AgentDirectoryPreferenceError,
  createAgentDirectoryService,
  type AgentDirectoryAuthority,
} from "./agent_directory.js";

function fixture() {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const gwaniId = createCanonicalId("character");
  const gwanaId = createCanonicalId("character");
  const authority: AgentDirectoryAuthority = { tenantId, userId };
  const presentations: AgentPresentation[] = [gwaniId, gwanaId].map((characterId, index) => ({
    schemaVersion: 1, tenantId, characterId,
    characterVersionId: createCanonicalId("character-version"),
    displayName: index === 0 ? "Gwani" : "Gwana", roleLabel: "Masanawa Support",
    about: "Support", greeting: null, visibleInUserApp: true, sortOrder: index, revision: 1,
  }));
  const profiles: PlatformAgentProfile[] = [gwaniId, gwanaId].map((characterId, index) => ({
    schemaVersion: 1, tenantId, characterId, supportAgent: true,
    defaultForNewUsers: index === 0, voiceProvider: "gemini",
    voiceName: index === 0 ? "Bodi" : "Sulafat", revision: 1,
  }));
  let saved: UserAgentPreference | null = {
    schemaVersion: 1, tenantId, userId, defaultPlatformCharacterId: gwanaId, revision: 1,
  };
  const read = vi.fn(async () => saved);
  const put = vi.fn(async (input: {
    expectedRevision: number | null; preference: UserAgentPreference;
  }) => {
    saved = { ...input.preference, revision: (saved?.revision ?? 0) + 1 };
    return saved;
  });
  const presentationRepository = {
    listVisible: vi.fn(async () => presentations),
  } as unknown as AgentPresentationRepository;
  const profileRepository = {
    readForCharacter: vi.fn(async (input: { characterId: string }) =>
      profiles.find((item) => item.characterId === input.characterId) ?? null),
  } as unknown as PlatformAgentProfileRepository;
  const preferenceRepository = { readForUser: read, put } as UserAgentPreferenceRepository;
  const service = createAgentDirectoryService({
    authorizer: { async authorize() { return authority; } },
    presentations: presentationRepository,
    platformProfiles: profileRepository,
    userPreferences: preferenceRepository,
  });
  return {
    service, authority, presentations, profiles, read, put, gwaniId, gwanaId,
    setSaved(value: UserAgentPreference | null) { saved = value; },
    getSaved() { return saved; },
  };
}

const list = (f: ReturnType<typeof fixture>) =>
  f.service.list({ authorizationHeader: "Bearer user" });
const defaults = (entries: Awaited<ReturnType<typeof list>>) =>
  entries.filter((item) => item.defaultPlatformAgent).map((item) => item.characterId);
const save = (f: ReturnType<typeof fixture>) =>
  f.service.setDefaultPlatformAgent({ authorizationHeader: "Bearer user", characterId: f.gwanaId });

describe("F03 current authorized support default recovery", () => {
  it("keeps an eligible saved Gwana choice over the configured Gwani default", async () => {
    const f = fixture();
    expect(defaults(await list(f))).toEqual([f.gwanaId]);
    expect(f.put).not.toHaveBeenCalled();
  });

  it("uses the unique configured support default for a new account", async () => {
    const f = fixture(); f.setSaved(null);
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
    expect(f.put).not.toHaveBeenCalled();
  });

  it("recovers hidden saved support without returning it or rewriting the saved choice", async () => {
    const f = fixture();
    f.presentations[1] = { ...f.presentations[1]!, visibleInUserApp: false };
    const entries = await list(f);
    expect(entries.map((item) => item.characterId)).toEqual([f.gwaniId]);
    expect(defaults(entries)).toEqual([f.gwaniId]);
    expect(f.getSaved()?.defaultPlatformCharacterId).toBe(f.gwanaId);
    expect(f.put).not.toHaveBeenCalled();
  });

  it("recovers an unknown saved identity using only the configured default", async () => {
    const f = fixture();
    f.setSaved({ ...f.getSaved()!, defaultPlatformCharacterId: createCanonicalId("character") });
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
  });

  it("does not mark a now non-support saved persona as default", async () => {
    const f = fixture(); f.profiles[1] = { ...f.profiles[1]!, supportAgent: false };
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
  });

  it("honors the current character allowlist before choosing fallback", async () => {
    const f = fixture(); Object.assign(f.authority, { characterIds: [f.gwaniId] });
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
    Object.assign(f.authority, { characterIds: [f.gwanaId] });
    f.profiles[1] = { ...f.profiles[1]!, supportAgent: false };
    expect(defaults(await list(f))).toEqual([]);
  });

  it("never chooses an arbitrary visible support agent without a configured default", async () => {
    const f = fixture(); f.setSaved(null);
    f.profiles[0] = { ...f.profiles[0]!, defaultForNewUsers: false };
    expect(defaults(await list(f))).toEqual([]);
  });

  it("fails closed on two configured defaults when the saved choice is absent", async () => {
    const f = fixture(); f.setSaved(null);
    f.profiles[1] = { ...f.profiles[1]!, defaultForNewUsers: true };
    expect(defaults(await list(f))).toEqual([]);
  });

  it("preserves a valid user choice even when platform defaults are ambiguous", async () => {
    const f = fixture(); f.profiles[1] = { ...f.profiles[1]!, defaultForNewUsers: true };
    expect(defaults(await list(f))).toEqual([f.gwanaId]);
  });

  it("does not treat presence or configured voice as runtime readiness", async () => {
    const f = fixture();
    const entries = await list(f);
    expect(entries.every((item) => item.presence === "unknown")).toBe(true);
    expect(entries.find((item) => item.characterId === f.gwanaId)?.voiceName).toBe("Sulafat");
  });

  it("ignores a cross-tenant presentation even from a faulty repository", async () => {
    const f = fixture();
    f.presentations[1] = { ...f.presentations[1]!, tenantId: createCanonicalId("tenant") };
    expect((await list(f)).map((item) => item.characterId)).toEqual([f.gwaniId]);
    await expect(save(f)).rejects.toMatchObject({ statusCode: 404 });
    expect(f.put).not.toHaveBeenCalled();
  });

  it("rejects a hidden presentation on writes even if listVisible returns it", async () => {
    const f = fixture(); f.presentations[1] = { ...f.presentations[1]!, visibleInUserApp: false };
    await expect(save(f)).rejects.toMatchObject({ statusCode: 404 });
    expect(f.put).not.toHaveBeenCalled();
  });

  it.each(["tenant", "character"] as const)("ignores a profile with mismatched %s authority on reads and writes", async (kind) => {
    const f = fixture();
    f.profiles[1] = kind === "tenant"
      ? { ...f.profiles[1]!, tenantId: createCanonicalId("tenant") }
      : { ...f.profiles[1]!, characterId: createCanonicalId("character") };
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
    await expect(save(f)).rejects.toMatchObject({ statusCode: 409 });
    expect(f.put).not.toHaveBeenCalled();
  });

  it.each(["tenant", "user"] as const)("fails closed on a saved preference for another %s", async (kind) => {
    const f = fixture();
    f.setSaved(kind === "tenant"
      ? { ...f.getSaved()!, tenantId: createCanonicalId("tenant") }
      : { ...f.getSaved()!, userId: createCanonicalId("user") });
    await expect(list(f)).rejects.toMatchObject({ statusCode: 503 });
    await expect(save(f)).rejects.toMatchObject({ statusCode: 503 });
    expect(f.put).not.toHaveBeenCalled();
  });

  it("redacts preference read failures and does not substitute a default during outage", async () => {
    const f = fixture();
    f.read.mockRejectedValue(new Error("SELECT secret FROM postgres_private_connection"));
    for (const request of [() => list(f), () => save(f)]) {
      await expect(request()).rejects.toBeInstanceOf(AgentDirectoryPreferenceError);
      await expect(request()).rejects.toMatchObject({
        statusCode: 503, message: "Preference outcome unknown; refresh and retry",
      });
    }
    expect(f.put).not.toHaveBeenCalled();
  });

  it("redacts post-write readback failure without claiming persistence success", async () => {
    const f = fixture(); f.setSaved(null);
    f.read.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("private SQL password"));
    await expect(save(f)).rejects.toMatchObject({
      statusCode: 503, message: "Preference outcome unknown; refresh and retry",
    });
    expect(f.put).toHaveBeenCalledTimes(1);
    expect(f.getSaved()?.defaultPlatformCharacterId).toBe(f.gwanaId);
    // An unknown response did not undo a real write; next authorized GET reconciles.
    f.read.mockImplementation(async () => f.getSaved());
    expect(defaults(await list(f))).toEqual([f.gwanaId]);
  });

  it("does not accept a cross-account post-write readback as success", async () => {
    const f = fixture(); f.setSaved(null);
    f.read.mockResolvedValueOnce(null).mockResolvedValueOnce({
      schemaVersion: 1, tenantId: f.authority.tenantId, userId: createCanonicalId("user"),
      defaultPlatformCharacterId: f.gwanaId, revision: 1,
    });
    await expect(save(f)).rejects.toMatchObject({ statusCode: 503 });
    expect(f.put).toHaveBeenCalledTimes(1);
  });

  it("restores the saved preference when its support eligibility returns", async () => {
    const f = fixture(); const profile = f.profiles[1]!;
    f.profiles[1] = { ...profile, supportAgent: false };
    expect(defaults(await list(f))).toEqual([f.gwaniId]);
    f.profiles[1] = profile;
    expect(defaults(await list(f))).toEqual([f.gwanaId]);
    expect(f.put).not.toHaveBeenCalled();
  });

  it("handles an empty authorized roster without inventing a support agent", async () => {
    const f = fixture(); Object.assign(f.authority, { characterIds: [] });
    expect(await list(f)).toEqual([]);
    expect(f.put).not.toHaveBeenCalled();
  });
});
