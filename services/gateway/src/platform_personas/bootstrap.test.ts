import { describe, expect, it, vi } from "vitest";
import type { AgentPresentation, AgentPresentationRepository } from "@masanawa/agents";
import { createCanonicalId, type TenantId, type CharacterId } from "@masanawa/contracts";
import type { CharacterVersionReader, CharacterOwnershipReader } from "@masanawa/identity";
import type { PlatformAgentIdentityProvisioner } from "../platform_agent_bootstrap.js";
import { CANONICAL_PERSONA_ROSTER, CANONICAL_EXPERT_DRAFTS } from "./catalog.js";
import { ensureUnqualifiedExpertDrafts, type PersonaSeedReservations, type PersonaSeedBinding } from "./bootstrap.js";

function fixture() {
  const bindings = new Map<string, PersonaSeedBinding>();
  const published = new Map<string, boolean>();
  const ownership = new Map<string, "platform" | "business">();
  const presentations: AgentPresentation[] = [];
  let failPresentationOnce = false;
  const provision = vi.fn(async ({ characterId }: Parameters<PlatformAgentIdentityProvisioner["provision"]>[0]) => {
    published.set(characterId, true);
    ownership.set(characterId, "platform");
  });
  const identity = { provision } satisfies PlatformAgentIdentityProvisioner;
  const versions = {
    async readCharacterVersion({ characterId, characterVersionId, tenantId }: {
      characterId: CharacterId; characterVersionId: string; tenantId: TenantId;
    }) {
      if (!published.get(characterId)) return null;
      return { tenantId, characterId, characterVersionId, state: "published" };
    },
  } as unknown as CharacterVersionReader;
  const owner = {
    async readForCharacter({ characterId, tenantId }: { characterId: CharacterId; tenantId: TenantId }) {
      const kind = ownership.get(characterId);
      return kind ? { tenantId, characterId, kind, ownerUserId: null } : null;
    },
  } as unknown as CharacterOwnershipReader;
  const presentationsRepo = {
    async listAll({ tenantId }: { tenantId: TenantId }) {
      return presentations.filter((entry) => entry.tenantId === tenantId);
    },
    async readForCharacter({ tenantId, characterId }: { tenantId: TenantId; characterId: CharacterId }) {
      return presentations.find((entry) => entry.tenantId === tenantId && entry.characterId === characterId) ?? null;
    },
    async put({ presentation }: { presentation: AgentPresentation }) {
      if (failPresentationOnce) {
        failPresentationOnce = false;
        throw new Error("injected after-identity interruption");
      }
      if (presentations.some((entry) => entry.tenantId === presentation.tenantId &&
        entry.characterId === presentation.characterId)) throw new Error("CAS conflict");
      presentations.push(presentation);
      return presentation;
    },
  } as unknown as AgentPresentationRepository;
  const reservations = {
    async withSeedLease<T>({ tenantId, seedKey, allocate, run }: {
      tenantId: TenantId; seedKey: string;
      allocate: () => PersonaSeedBinding; run: (binding: PersonaSeedBinding) => Promise<T>;
    }): Promise<T> {
      const key = tenantId + ":" + seedKey;
      if (!bindings.has(key)) bindings.set(key, allocate());
      return run(bindings.get(key)!);
    },
  } satisfies PersonaSeedReservations;
  return {
    bindings, published, ownership, presentations, provision, identity,
    versions, owner, presentationsRepo, reservations,
    failNextPresentation() { failPresentationOnce = true; },
  };
}

function run(tenantId: TenantId, f: ReturnType<typeof fixture>) {
  return ensureUnqualifiedExpertDrafts({
    tenantId, reservations: f.reservations, identity: f.identity, versions: f.versions,
    ownership: f.owner, presentations: f.presentationsRepo,
  });
}

describe("F03 canonical Masanawa persona roster", () => {
  it("matches all 17 approved names, 9 male and 8 female, with no fabricated Expert voices", () => {
    expect(CANONICAL_PERSONA_ROSTER.map((s) => s.displayName)).toEqual([
      "Gwani", "Gwana", "Wazobia", "Naira", "Sardauna", "Sadauki",
      "Kwararre", "Kwararriya", "Haziki", "Hazika", "Basiru", "Basira",
      "Jagora", "Madugu", "Shugaba", "Sarauniya", "Gimbiya",
    ]);
    expect(CANONICAL_PERSONA_ROSTER.filter((s) => s.genderPresentation === "male")).toHaveLength(9);
    expect(CANONICAL_PERSONA_ROSTER.filter((s) => s.genderPresentation === "female")).toHaveLength(8);
    expect(new Set(CANONICAL_PERSONA_ROSTER.map((s) => s.seedKey)).size).toBe(17);
    expect(CANONICAL_PERSONA_ROSTER[0]?.voiceName).toBe("Bodi");
    expect(CANONICAL_PERSONA_ROSTER[1]?.voiceName).toBe("Sulafat");
    expect(CANONICAL_EXPERT_DRAFTS).toHaveLength(15);
    expect(CANONICAL_EXPERT_DRAFTS.every((s) => s.voiceName === null && !s.supportAgent)).toBe(true);
  });

  it("provisions only 15 hidden unqualified Experts and is idempotent", async () => {
    const f = fixture(), tenantId = createCanonicalId("tenant");
    const initial = await run(tenantId, f);
    expect(initial).toHaveLength(15);
    expect(initial.every((s) => s.outcome === "created-hidden")).toBe(true);
    expect(f.provision).toHaveBeenCalledTimes(15);
    expect(f.presentations.every((p) => p.visibleInUserApp === false)).toBe(true);
    expect(f.presentations.every((p) => p.roleLabel.startsWith("Masanawa AI Expert"))).toBe(true);
    const second = await run(tenantId, f);
    expect(second.every((s) => s.outcome === "already-present")).toBe(true);
    expect(f.provision).toHaveBeenCalledTimes(15);
    expect(f.presentations).toHaveLength(15);
  });

  it("preserves admin edits, hidden status, versions and ID reservations", async () => {
    const f = fixture(), tenantId = createCanonicalId("tenant");
    await run(tenantId, f);
    const first = f.presentations[0]!;
    f.presentations[0] = { ...first, displayName: "Admin Wazobia", roleLabel: "Admin edited", revision: 7 };
    const results = await run(tenantId, f);
    expect(results[0]?.outcome).toBe("already-present");
    expect(f.presentations[0]).toMatchObject({ displayName: "Admin Wazobia", roleLabel: "Admin edited", revision: 7 });
    expect(f.presentations[0]?.characterId).toBe(first.characterId);
  });

  it("never adopts or overwrites a same-name admin persona", async () => {
    const f = fixture(), tenantId = createCanonicalId("tenant");
    f.presentations.push({
      schemaVersion: 1, tenantId, characterId: createCanonicalId("character"),
      characterVersionId: createCanonicalId("character-version"),
      displayName: "wAzObIa", roleLabel: "Owner's Expert", about: "custom",
      greeting: null, sortOrder: 99, revision: 9, visibleInUserApp: true,
    });
    const results = await run(tenantId, f);
    expect(results[0]?.outcome).toBe("name-collision");
    expect(f.presentations.filter((p) => p.displayName.toLowerCase() === "wazobia")).toHaveLength(1);
    expect(f.presentations.find((p) => p.roleLabel === "Owner's Expert")?.revision).toBe(9);
    expect(f.provision).toHaveBeenCalledTimes(14);
  });

  it("recovers after presentation failure without minting a new Character", async () => {
    const f = fixture(), tenantId = createCanonicalId("tenant");
    f.failNextPresentation();
    await expect(run(tenantId, f)).rejects.toThrow("injected");
    const reserved = f.bindings.get(tenantId + ":platform.wazobia")!;
    expect(f.published.get(reserved.characterId)).toBe(true);
    const replay = await run(tenantId, f);
    expect(replay[0]).toMatchObject({ outcome: "created-hidden", characterId: reserved.characterId });
    expect(f.provision).toHaveBeenCalledTimes(15); // no duplicate Wazobia identity
  });

  it("blocks partial identity and wrong-platform ownership without mutation", async () => {
    const f = fixture(), tenantId = createCanonicalId("tenant");
    const binding = { characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version") };
    f.bindings.set(tenantId + ":platform.wazobia", binding);
    f.published.set(binding.characterId, true);
    let result = await run(tenantId, f);
    expect(result[0]?.outcome).toBe("partial-identity");
    expect(f.presentations.some((p) => p.characterId === binding.characterId)).toBe(false);
    f.ownership.set(binding.characterId, "business");
    result = await run(tenantId, f);
    expect(result[0]?.outcome).toBe("identity-mismatch");
    expect(f.presentations.some((p) => p.characterId === binding.characterId)).toBe(false);
  });

  it("partitions id reservations and presentation per tenant", async () => {
    const f = fixture(), tenantA = createCanonicalId("tenant"), tenantB = createCanonicalId("tenant");
    await run(tenantA, f);
    await run(tenantB, f);
    expect(f.provision).toHaveBeenCalledTimes(30);
    expect(f.presentations.filter((p) => p.tenantId === tenantA)).toHaveLength(15);
    expect(f.presentations.filter((p) => p.tenantId === tenantB)).toHaveLength(15);
  });
});
