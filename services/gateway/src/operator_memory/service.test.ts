import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  createMemoryService,
  type CanonicalMemoryPort, type Consent, type MemoryActor,
  type MemoryScope, type MemorySnapshot,
} from "./service.js";

const tenantId = createCanonicalId("tenant");
const userA = createCanonicalId("user");
const userB = createCanonicalId("user");
const scopeA: MemoryScope = {
  kind: "relationship", relationshipId: createCanonicalId("relationship"),
};
const scopeB: MemoryScope = {
  kind: "relationship", relationshipId: createCanonicalId("relationship"),
};

function harness() {
  let enabled = false;
  let revision = 0;
  let account = userA;
  const records = new Map<string, MemorySnapshot>();
  const memory: CanonicalMemoryPort = {
    async createMemoryRecord(input) {
      const item: MemorySnapshot = {
        record: {
          tenantId: String(input.tenantId),
          memoryRecordId: String(input.memoryRecordId),
          memoryType: String(input.memoryType),
          scope: input.scope as MemoryScope,
          lifecycleState: "active", revision: 1, lifecycleRevision: 1,
        },
        currentRevision: {
          memoryRevisionId: String(input.memoryRevisionId),
          content: String(input.content),
          payload: input.payload as { readonly [key: string]: unknown },
          observedAt: String(input.observedAt),
          expiresAt: String(input.expiresAt),
        },
      };
      records.set(item.record.memoryRecordId, item);
      return item;
    },
    async appendMemoryRevision(input) {
      const existing = records.get(String(input.memoryRecordId));
      if (!existing || existing.record.revision !== input.expectedRevision) {
        throw new Error("canonical stale revision");
      }
      const updated: MemorySnapshot = {
        record: { ...existing.record, revision: existing.record.revision + 1 },
        currentRevision: {
          ...existing.currentRevision,
          memoryRevisionId: String(input.memoryRevisionId),
          content: String(input.content),
          observedAt: String(input.observedAt),
        },
      };
      records.set(updated.record.memoryRecordId, updated);
      return updated;
    },
    async getMemoryRecordInScope({ tenantId, memoryRecordId, scope }) {
      const item = records.get(memoryRecordId);
      return item?.record.tenantId === tenantId &&
        item.record.scope.relationshipId === scope.relationshipId ? item : null;
    },
    async listMemoryRecordsByScopes({ tenantId, scopes, limit }) {
      return [...records.values()]
        .filter(item => item.record.tenantId === tenantId &&
          scopes.some(s => item.record.scope.relationshipId === s.relationshipId))
        .slice(0, limit);
    },
  };
  const consent = {
    async get(): Promise<Consent> { return { enabled, revision }; },
    async compareAndSet(input: MemoryActor & { enabled: boolean; expectedRevision: number }) {
      if (input.expectedRevision !== revision) return null;
      revision++;
      enabled = input.enabled;
      return { enabled, revision };
    },
  };
  const service = createMemoryService({
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer valid") throw new Error("unauthorized");
        return { tenantId, userId: account } as never;
      },
    },
    scopes: { async resolve(actor) {
      return actor.userId === userA ? scopeA : scopeB;
    } },
    consent,
    memory,
    now: () => new Date("2026-10-09T00:00:00.000Z"),
  });
  const auth = { authorizationHeader: "Bearer valid" };
  return { service, auth, records, setAccount(id: string) { account = id as typeof userA; } };
}

describe("U05 consented canonical memory adapter", () => {
  it("defaults off, denies silent assistant recall and any write without opt-in", async () => {
    const { service, auth } = harness();
    expect(await service.consent(auth)).toEqual({ enabled: false, revision: 0 });
    await expect(service.list({ ...auth, forAssistant: true }))
      .rejects.toMatchObject({ code: "MEMORY_OPT_IN_REQUIRED" });
    await expect(service.remember({ ...auth, kind: "preference",
      content: "Use Hausa", ttlDays: 30 }))
      .rejects.toMatchObject({ code: "MEMORY_OPT_IN_REQUIRED" });
    expect(await service.list(auth)).toEqual([]);
  });

  it("requires exact consent revision and denies stale concurrent opt-in/out", async () => {
    const { service, auth } = harness();
    expect(await service.setConsent({ ...auth, enabled: true, expectedRevision: 0 }))
      .toEqual({ enabled: true, revision: 1 });
    await expect(service.setConsent({ ...auth, enabled: false, expectedRevision: 0 }))
      .rejects.toMatchObject({ code: "MEMORY_REVISION_CHANGED" });
    expect(await service.setConsent({ ...auth, enabled: false, expectedRevision: 1 }))
      .toEqual({ enabled: false, revision: 2 });
    await expect(service.list({ ...auth, forAssistant: true }))
      .rejects.toMatchObject({ code: "MEMORY_OPT_IN_REQUIRED" });
  });

  it("writes real canonical memory data with bounded TTL and explicit provenance", async () => {
    const { service, auth, records } = harness();
    await service.setConsent({ ...auth, enabled: true, expectedRevision: 0 });
    const item = await service.remember({
      ...auth, kind: "preference", content: "Speak Hausa", ttlDays: 30,
    });
    expect(item.kind).toBe("preference");
    expect(item.expiresAt).toBe("2026-11-08T00:00:00.000Z");
    const raw = records.get(item.id)!;
    expect(raw.currentRevision.payload.operatorUserId).toBe(userA);
    expect(raw.record.scope.relationshipId).toBe(scopeA.relationshipId);
    expect(await service.list({ ...auth, forAssistant: true })).toHaveLength(1);
    await expect(service.remember({ ...auth, kind: "preference",
      content: "secret", ttlDays: 400 }))
      .rejects.toMatchObject({ code: "MEMORY_INVALID_TTL" });
    await expect(service.remember({ ...auth, kind: "private-dm" as never,
      content: "human chat", ttlDays: 30 }))
      .rejects.toMatchObject({ code: "MEMORY_INVALID_KIND" });
  });

  it("corrects with CAS; wrong account cannot see, correct or prepare forget", async () => {
    const { service, auth, setAccount } = harness();
    await service.setConsent({ ...auth, enabled: true, expectedRevision: 0 });
    const item = await service.remember({
      ...auth, kind: "preference", content: "Old", ttlDays: 90,
    });
    const changed = await service.correct({
      ...auth, id: item.id, expectedRevision: item.revision, content: "New",
    });
    expect(changed.revision).toBe(2);
    await expect(service.correct({ ...auth, id: item.id,
      expectedRevision: 1, content: "Stale" }))
      .rejects.toMatchObject({ code: "MEMORY_REVISION_CHANGED" });
    setAccount(userB);
    expect(await service.list(auth)).toEqual([]);
    await expect(service.correct({ ...auth, id: item.id,
      expectedRevision: 2, content: "Hijack" }))
      .rejects.toMatchObject({ code: "MEMORY_NOT_FOUND" });
    await expect(service.prepareForget({ ...auth, id: item.id, expectedRevision: 2 }))
      .rejects.toMatchObject({ code: "MEMORY_NOT_FOUND" });
  });

  it("requires governed approval for forget: no direct delete fallback", async () => {
    const { service, auth, records } = harness();
    await service.setConsent({ ...auth, enabled: true, expectedRevision: 0 });
    const item = await service.remember({
      ...auth, kind: "research-note", content: "Source checked", ttlDays: 1,
    });
    await expect(service.prepareForget({ ...auth, id: item.id, expectedRevision: 1 }))
      .rejects.toMatchObject({ code: "MEMORY_FORGET_NOT_QUALIFIED" });
    expect(records.get(item.id)?.record.lifecycleState).toBe("active");
  });

  it("rejects unverified authentication before any personal memory is exposed", async () => {
    const { service } = harness();
    await expect(service.list({ authorizationHeader: "Bearer invalid" }))
      .rejects.toThrow("unauthorized");
  });
});
