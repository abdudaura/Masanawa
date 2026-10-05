import { CustomerAuthError } from "./customer_auth.js";
import { describe, expect, it, vi } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import type { CloneSetup, CloneSetupRepository, CloneSetupScope } from "@masanawa/identity";
import type { CharacterSkillAssignment, CharacterSkillAssignmentRepository } from "@masanawa/agents";
import { normalizeSkillGuide, type SkillReadinessState, type SkillInstallMode } from "@masanawa/skills";
import { skillVersion } from "../../../tests/support/skill-version.js";
import type { MobileAgentDirectoryEntry } from "./agent_directory.js";
import type { CreatorCloneService } from "./creator_clone.js";
import { createAutomaticCloneCoreProvisioner, createCloneOnboardingService, projectCloneOnboarding } from "./clone_onboarding.js";

function fixture() {
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
  const records = new Map<string, CloneSetup>();
  const key = (s: CloneSetupScope) => `${s.tenantId}/${s.userId}`;
  let queue: Promise<unknown> = Promise.resolve();
  const setups: CloneSetupRepository = {
    async read(s) { return records.get(key(s)) ?? null; },
    mutate(s, transition) {
      const operation = queue.then(() => { const next = transition(records.get(key(s)) ?? null); records.set(key(s), next); return next; });
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
  const agents: MobileAgentDirectoryEntry[] = ["Gwani", "Gwana"].map((name, index) => ({ characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version"), displayName: name, roleLabel: "Masanawa Support", about: "Support", greeting: null, presence: "available", activeWorkCount: 0, supportAgent: true, defaultPlatformAgent: index === 0, voiceProvider: "gemini", voiceName: index === 0 ? "Bodi" : "Sulafat" }));
  const directory = { list: vi.fn(async () => agents), setDefaultPlatformAgent: vi.fn(async (request: { characterId: string }) => {
    for (const agent of agents) Object.assign(agent, { defaultPlatformAgent: agent.characterId === request.characterId });
    return { characterId: agents.find(a => a.characterId === request.characterId)!.characterId as ReturnType<typeof createCanonicalId<"character">> };
  }) };
  const authorizer = { authorize: vi.fn(async () => scope) };
  const result = { created: true, characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version"), relationshipId: createCanonicalId("relationship"), displayName: "Nasir" };
  const clones = { create: vi.fn(async (_request: Parameters<CreatorCloneService["create"]>[0]) => result) };
  const core = { ensure: vi.fn(async (_request: { authorizationHeader: string | undefined; characterId: string }) => undefined) };
  const factory = () => createCloneOnboardingService({ authorizer, setups, clones, directory, core });
  const service = factory();
  const auth = { authorizationHeader: "Bearer private-test-token" };
  const requestId = createCanonicalId("request");
  const confirm = { ...auth, expectedPreviewRevision: 2, requestId };
  const prepare = async () => { await service.save({ ...auth, expectedRevision: null, profile: { displayName: "Nasir", languages: ["Hausa"] } }); await service.preview({ ...auth, expectedRevision: 1 }); };
  return { scope, setups, records, agents, directory, authorizer, clones, core, result, factory, service, auth, requestId, confirm, prepare };
}
describe("clone onboarding service", () => {
  it("preserves expired-session refresh and auth-outage recovery semantics", async () => {
    const f = fixture();
    f.authorizer.authorize.mockRejectedValueOnce(new CustomerAuthError("UNAUTHORIZED", 401));
    await expect(f.service.read(f.auth)).rejects.toMatchObject({ category: "authentication", retryable: false });
    f.authorizer.authorize.mockRejectedValueOnce(new CustomerAuthError("AUTH_UNAVAILABLE", 503));
    await expect(f.service.read(f.auth)).rejects.toMatchObject({ category: "unavailable", retryable: true });
    expect(await f.setups.read(f.scope)).toBeNull();
  });

  it("uses configured Gwani/Bodi by default and retains Gwana/Sulafat", async () => {
    const f = fixture();
    const view = await f.service.read(f.auth);
    expect(view.defaultSupportAgentId).toBe(f.agents[0]!.characterId);
    expect(view.supportAgents.map(a => a.voiceName)).toEqual(["Bodi", "Sulafat"]);
    expect(view.nextStep).toBe("name");
  });
  it("delegates support preference to the canonical directory", async () => {
    const f = fixture();
    const view = await f.service.selectSupport({ ...f.auth, characterId: f.agents[1]!.characterId });
    expect(f.directory.setDefaultPlatformAgent).toHaveBeenCalledTimes(1);
    expect(view.defaultSupportAgentId).toBe(f.agents[1]!.characterId);
  });
  it("does not invent a default or expose non-support entries", () => {
    const f = fixture();
    const agents = f.agents.map(a => ({ ...a, defaultPlatformAgent: true }));
    expect(projectCloneOnboarding(null, agents).defaultSupportAgentId).toBeNull();
    expect(projectCloneOnboarding(null, [{ ...agents[0]!, supportAgent: false }]).supportAgents).toEqual([]);
  });
  it("rejects unavailable support identities before changing preferences", async () => {
    const f = fixture();
    await expect(f.service.selectSupport({ ...f.auth, characterId: createCanonicalId("character") })).rejects.toThrow();
    expect(f.directory.setDefaultPlatformAgent).not.toHaveBeenCalled();
  });
  it("collects short fields and leaves creation untouched until confirmation", async () => {
    const f = fixture();
    expect((await f.service.save({ ...f.auth, expectedRevision: null, profile: { displayName: "Nasir" } })).nextStep).toBe("languages");
    expect((await f.service.save({ ...f.auth, expectedRevision: 1, profile: { languages: ["Hausa"] } })).nextStep).toBe("preview");
    expect((await f.service.preview({ ...f.auth, expectedRevision: 2 })).nextStep).toBe("confirm");
    expect(f.clones.create).not.toHaveBeenCalled();
  });
  it("provisions only the persisted preview and exact replay avoids another create", async () => {
    const f = fixture(); await f.prepare();
    const first = await f.service.confirm(f.confirm);
    expect(first.setup?.state).toBe("ready");
    expect(first.runtimeReadiness).toBe("not-verified");
    await f.service.confirm(f.confirm);
    expect(f.clones.create).toHaveBeenCalledTimes(1);
    expect(f.clones.create.mock.calls[0]?.[0]).toMatchObject({ displayName: "Nasir", languages: ["Hausa"] });
  });
  it("keeps confirmation durable when provisioning fails and resumes through a recreated service", async () => {
    const f = fixture(); await f.prepare();
    f.clones.create.mockRejectedValueOnce(new Error("provider/private failure"));
    await expect(f.service.confirm(f.confirm)).rejects.toThrow();
    expect((await f.factory().read(f.auth)).nextStep).toBe("recover");
    await expect(f.factory().save({ ...f.auth, expectedRevision: 3, profile: { displayName: "changed" } })).rejects.toThrow();
    const restored = await f.factory().confirm(f.confirm);
    expect(restored.setup?.result?.characterId).toBe(f.result.characterId);
  });
  it("cannot finish with an unavailable Core bundle and resumes after readiness is repaired", async () => {
    const f = fixture(); await f.prepare();
    f.core.ensure.mockRejectedValueOnce(new Error("Core not ready"));
    await expect(f.service.confirm(f.confirm)).rejects.toThrow();
    expect((await f.setups.read(f.scope))?.state).toBe("confirmed");
    const restored = await f.factory().confirm(f.confirm);
    expect(restored.setup?.state).toBe("ready");
    expect(f.core.ensure).toHaveBeenCalledWith({ authorizationHeader: f.auth.authorizationHeader, characterId: f.result.characterId });
  });
  it("rejects an old confirmation after profile changes", async () => {
    const f = fixture(); await f.prepare();
    await f.service.save({ ...f.auth, expectedRevision: 2, profile: { displayName: "New name" } });
    await expect(f.service.confirm(f.confirm)).rejects.toThrow();
    expect(f.clones.create).not.toHaveBeenCalled();
  });
  it("refuses a changed request after durable confirmation", async () => {
    const f = fixture(); await f.prepare();
    f.clones.create.mockRejectedValueOnce(new Error("interrupted"));
    await expect(f.service.confirm(f.confirm)).rejects.toThrow();
    await expect(f.service.confirm({ ...f.confirm, requestId: createCanonicalId("request") })).rejects.toThrow();
    expect(f.clones.create).toHaveBeenCalledTimes(1);
  });
  it("requires authorization before touching private drafts", async () => {
    const f = fixture();
    f.authorizer.authorize.mockRejectedValue(new Error("secret policy details"));
    await expect(f.service.save({ ...f.auth, expectedRevision: null, profile: {} })).rejects.toMatchObject({ category: "authorization", message: "Clone setup access denied" });
    expect(f.records.size).toBe(0);
  });
  it("revalidates capability after provisioning and preserves confirmed recovery on revocation", async () => {
    const f = fixture(); await f.prepare();
    f.authorizer.authorize.mockResolvedValueOnce(f.scope).mockRejectedValueOnce(new Error("revoked"));
    await expect(f.service.confirm(f.confirm)).rejects.toMatchObject({ category: "authorization" });
    expect((await f.setups.read(f.scope))?.state).toBe("confirmed");
  });
  it("does not rebound a completed profile into another user's draft", async () => {
    const f = fixture(); await f.prepare();
    f.authorizer.authorize.mockResolvedValueOnce(f.scope).mockResolvedValueOnce({ ...f.scope, userId: createCanonicalId("user") });
    await expect(f.service.confirm(f.confirm)).rejects.toThrow();
    expect((await f.setups.read(f.scope))?.state).toBe("confirmed");
  });
  it("clears unconfirmed setup on cancel", async () => {
    const f = fixture(); await f.prepare();
    const view = await f.service.cancel({ ...f.auth, expectedRevision: 2 });
    expect(view.setup?.state).toBe("cancelled");
    expect(view.nextStep).toBe("name");
    expect(view.setup?.profile.displayName).toBeNull();
    expect(f.clones.create).not.toHaveBeenCalled();
  });
});

function coreFixture() {
  const scope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
  const characterId = createCanonicalId("character");
  // Development fixture evidence only; never a production Teaching certification.
  const teaching = skillVersion({ key: "core.teaching" });
  const optionalId = createCanonicalId("skill-version");
  const settings = { readiness: "ready" as SkillReadinessState, installMode: "automatic" as SkillInstallMode, includeGuide: true, ownerCharacterId: characterId };
  let current: CharacterSkillAssignment | null = { schemaVersion: 1, ...scope, characterId, skillVersionIds: [optionalId], revision: 2 };
  const assignments: CharacterSkillAssignmentRepository = {
    readForCharacter: vi.fn(async () => current),
    put: vi.fn(async request => { current = request.assignment; return request.assignment; }),
  };
  const guide = normalizeSkillGuide({ schemaVersion: 1, skillVersionId: teaching.skillVersionId, triggerDescription: "Teach when requested", instructions: "Development test fixture only", resources: [], discovery: { priority: 10, phrases: ["teach"], allOf: [], anyOf: [], noneOf: [], minScore: 1 } });
  const authorizer = { authorize: vi.fn(async () => scope) };
  const core = createAutomaticCloneCoreProvisioner({ authorizer, assignments,
    personalClones: {
      getOrCreatePersonalClone: async () => { throw new Error("must not create a second clone"); },
      readPersonalClone: async () => ({ ...scope, characterId: settings.ownerCharacterId, kind: "personal-clone", ownerUserId: scope.userId, createdAt: nowInstant() }),
    },
    skills: {
      registerBatch: async () => { throw new Error("must not seed certifications"); },
      putReadiness: async () => { throw new Error("must not change readiness"); },
      readSnapshot: async () => ({ skills: [{ skillId: teaching.skillId, key: teaching.key, createdAt: nowInstant() }], versions: [teaching], readiness: [{ revision: 1, readiness: { skillVersionId: teaching.skillVersionId, state: settings.readiness, advertised: settings.readiness === "ready", reasonCode: settings.readiness === "ready" ? null : "provider.unavailable", checkedAt: nowInstant() } }] }),
    },
    guides: {
      putGuide: async () => { throw new Error("must not author guidance"); }, readGuide: async () => guide,
      readGuides: async () => settings.includeGuide ? [guide] : [],
    },
    distribution: {
      put: async () => { throw new Error("must not change policy"); }, read: async () => null,
      listForAudience: async () => [{ schemaVersion: 1, skillVersionId: teaching.skillVersionId, audiences: ["personal-clone"], installMode: settings.installMode, category: "teaching", sortOrder: 1 }],
    },
  });
  return { core, scope, characterId, teaching, optionalId, settings, assignments, authorizer, current: () => current, request: { authorizationHeader: "Bearer private", characterId } };
}
describe("automatic clone Core provisioning", () => {
  it("installs exact ready automatic Core Teaching while preserving optional assignments", async () => {
    const f = coreFixture(); await f.core.ensure(f.request);
    expect(f.current()?.skillVersionIds).toEqual([f.teaching.skillVersionId, f.optionalId].sort());
    expect(f.assignments.put).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 2 }));
    await f.core.ensure(f.request);
    expect(f.assignments.put).toHaveBeenCalledTimes(1);
  });
  it("does not promote optional Teaching into automatic Core", async () => {
    const f = coreFixture(); f.settings.installMode = "optional";
    await expect(f.core.ensure(f.request)).rejects.toThrow();
    expect(f.assignments.put).not.toHaveBeenCalled();
  });
  it("refuses unavailable current readiness even when the Skill was installed previously", async () => {
    const f = coreFixture(); await f.core.ensure(f.request); f.settings.readiness = "blocked";
    await expect(f.core.ensure(f.request)).rejects.toThrow();
    expect(f.assignments.put).toHaveBeenCalledTimes(1);
  });
  it("requires canonical guidance and exact creator ownership", async () => {
    const f = coreFixture(); f.settings.includeGuide = false;
    await expect(f.core.ensure(f.request)).rejects.toThrow();
    f.settings.includeGuide = true; f.settings.ownerCharacterId = createCanonicalId("character");
    await expect(f.core.ensure(f.request)).rejects.toThrow();
    expect(f.assignments.put).not.toHaveBeenCalled();
  });
  it("does not assign anything after capability denial", async () => {
    const f = coreFixture(); f.authorizer.authorize.mockRejectedValue(new Error("revoked"));
    await expect(f.core.ensure(f.request)).rejects.toThrow();
    expect(f.assignments.put).not.toHaveBeenCalled();
  });
});
