import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createHostPrepService, HostPrepError,
  type HostPrepRecord, type HostPrepRepository,
} from "./service.js";
import type { TalkRepository, TalkRecord } from "../talks/model.js";

function fixture() {
  const drafts = new Map<string, HostPrepRecord>();
  const talks = new Map<string, TalkRecord>();
  let authorized = "user-a";
  let talkWrites = 0;
  let failAfterInsert = false;
  const authorizer = {
    authorize: vi.fn(async ({ authorizationHeader }: { authorizationHeader?: string }) => {
      if (authorizationHeader !== "Bearer a" && authorizationHeader !== "Bearer b") {
        throw new HostPrepError("unauthorized", 401);
      }
      authorized = authorizationHeader === "Bearer a" ? "user-a" : "user-b";
      return { tenantId: "tenant-a", userId: authorized, profile: { name: "Host" } } as never;
    }),
  };
  const repository: HostPrepRepository = {
    async create(input) {
      const row: HostPrepRecord = { ...input, revision: 1, phase: "draft", talkId: null };
      drafts.set(input.prepId, row);
      return row;
    },
    async list(input) {
      return [...drafts.values()].filter((row) => row.hostUserId === input.hostUserId &&
        row.tenantId === input.tenantId).slice(0, input.limit);
    },
    async read(input) {
      const row = drafts.get(input.prepId);
      return row?.hostUserId === input.hostUserId && row.tenantId === input.tenantId ? row : null;
    },
    async edit(input) {
      const old = await repository.read(input);
      if (!old || old.phase !== "draft" || old.revision !== input.revision) return null;
      const next = { ...old, title: input.title, topic: input.topic,
        questions: input.questions, revision: old.revision + 1, updatedAt: input.now };
      drafts.set(input.prepId, next);
      return next;
    },
    async beginPublish(input) {
      const old = await repository.read(input);
      if (!old || old.phase !== "draft" || old.revision !== input.revision) return null;
      const next: HostPrepRecord = { ...old, phase: "publishing",
        talkId: input.talkId, revision: old.revision + 1, updatedAt: input.now };
      drafts.set(input.prepId, next);
      return next;
    },
    async finishPublish(input) {
      const old = await repository.read(input);
      if (!old || old.talkId !== input.talkId) return null;
      if (old.phase === "published") return old;
      if (old.phase !== "publishing") return null;
      const next: HostPrepRecord = { ...old, phase: "published",
        revision: old.revision + 1, updatedAt: input.now };
      drafts.set(input.prepId, next);
      return next;
    },
  };
  const canonicalTalks = {
    async createTalk(input: {
      tenantId: string; talkId: string; hostUserId: string; hostName: string;
      title: string; topic: string; createdAt: string;
    }) {
      talkWrites++;
      if (talks.has(input.talkId)) throw new Error("duplicate");
      const row: TalkRecord = {
        ...input, summary: "", state: "live", listenerCount: 0,
        durationSeconds: null, updatedAt: input.createdAt,
      };
      talks.set(input.talkId, row);
      if (failAfterInsert) throw new Error("socket lost after commit");
      return row;
    },
    async getTalk(input: { tenantId: string; talkId: string; viewerUserId: string }) {
      const row = talks.get(input.talkId);
      if (!row || row.tenantId !== input.tenantId ||
          row.hostUserId !== input.viewerUserId) return null;
      return { talk: row, commentCount: 0 };
    },
  };
  const quote = vi.fn(async () => ({ quoteId: "q-1", totalLabel: "4 Credits" }));
  const service = createHostPrepService({
    authorizer, repository,
    talks: canonicalTalks as unknown as TalkRepository,
    aiSeats: {
      candidates: vi.fn(async () => [{ personaId: "expert-1", isAvailable: true }]) as never,
      quote: quote as never,
    },
    createId: randomUUID, now: () => "2026-10-09T00:00:00.000Z",
  });
  const begin = () => service.create({
    authorizationHeader: "Bearer a", title: "A helpful topic",
    topic: "Discuss useful ideas", questions: ["First question?"],
  });
  return { service, begin, talks, drafts, quote, get writes() { return talkWrites; },
    set loseResponse(value: boolean) { failAfterInsert = value; } };
}

describe("U14 host-only preparation", () => {
  it("keeps creation private until deliberate Go Live", async () => {
    const f = fixture(); const draft = await f.begin();
    expect(draft.phase).toBe("draft");
    expect(draft.talkId).toBeNull();
    expect(f.writes).toBe(0);
  });
  it("lists only the authenticated host drafts for process restart", async () => {
    const f = fixture(); const a = await f.begin();
    const own = await f.service.list({ authorizationHeader: "Bearer a" });
    const other = await f.service.list({ authorizationHeader: "Bearer b" });
    expect(own.map((d) => d.prepId)).toContain(a.prepId);
    expect(other).toHaveLength(0);
  });
  it("denies a second user even if they guess the prep UUID", async () => {
    const f = fixture(); const draft = await f.begin();
    await expect(f.service.get({ authorizationHeader: "Bearer b", prepId: draft.prepId }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(f.service.goLive({ authorizationHeader: "Bearer b", prepId: draft.prepId,
      revision: 1, confirmGoLive: true })).rejects.toMatchObject({ statusCode: 404 });
    expect(f.writes).toBe(0);
  });
  it("requires auth, explicit confirmation and exact revision", async () => {
    const f = fixture(); const draft = await f.begin();
    await expect(f.service.get({ prepId: draft.prepId })).rejects.toMatchObject({ statusCode: 401 });
    await expect(f.service.goLive({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 0, confirmGoLive: true }))
      .rejects.toMatchObject({ code: "host_prep.stale_or_published" });
    await expect(f.service.goLive({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, confirmGoLive: false as never }))
      .rejects.toMatchObject({ code: "host_prep.confirmation_required" });
    expect(f.writes).toBe(0);
  });
  it("rejects markup abuse, lengthy questions and stale edits", async () => {
    const f = fixture(); const draft = await f.begin();
    await expect(f.service.edit({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, title: "  ", topic: "Okay", questions: [] }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(f.service.edit({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, title: "Okay", topic: "Okay",
      questions: Array(9).fill("Too many") })).rejects.toMatchObject({ statusCode: 400 });
    const edited = await f.service.edit({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, title: "New", topic: "Revised", questions: [] });
    expect(edited.revision).toBe(2);
    await expect(f.service.edit({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, title: "Old", topic: "Old", questions: [] }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
  it("creates one canonical Talk ID and reconciles readback", async () => {
    const f = fixture(); const draft = await f.begin();
    const done = await f.service.goLive({
      authorizationHeader: "Bearer a", prepId: draft.prepId, revision: 1, confirmGoLive: true,
    });
    expect(done.phase).toBe("published");
    expect(done.talkId).toBe(`talk_${draft.prepId}`);
    expect(f.writes).toBe(1);
    expect((await f.service.verify({ authorizationHeader: "Bearer a", prepId: draft.prepId })).phase)
      .toBe("published");
    expect(f.writes).toBe(1);
  });
  it("does not replay uncertain publication; verification recovers committed write", async () => {
    const f = fixture(); const draft = await f.begin(); f.loseResponse = true;
    await expect(f.service.goLive({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, confirmGoLive: true }))
      .rejects.toMatchObject({ code: "host_prep.publication_unresolved" });
    expect(f.writes).toBe(1);
    const readback = await f.service.verify({ authorizationHeader: "Bearer a", prepId: draft.prepId });
    expect(readback.phase).toBe("published");
    expect(f.writes).toBe(1);
  });
  it("concurrent go-live requests have only one canonical create", async () => {
    const f = fixture(); const draft = await f.begin();
    const tasks = await Promise.allSettled([1, 2].map(() => f.service.goLive({
      authorizationHeader: "Bearer a", prepId: draft.prepId, revision: 1, confirmGoLive: true,
    })));
    expect(tasks.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.writes).toBe(1);
  });
  it("Expert listing and quote are canonical previews, not paid confirmations", async () => {
    const f = fixture(); const draft = await f.begin();
    await expect(f.service.availableExperts({ authorizationHeader: "Bearer a", prepId: draft.prepId }))
      .rejects.toMatchObject({ statusCode: 409 });
    await f.service.goLive({ authorizationHeader: "Bearer a",
      prepId: draft.prepId, revision: 1, confirmGoLive: true });
    const quoted = await f.service.quoteExpert({
      authorizationHeader: "Bearer a", prepId: draft.prepId, personaId: "expert-1",
    });
    expect(quoted).toMatchObject({ quoteId: "q-1" });
    expect(f.quote).toHaveBeenCalledWith(expect.objectContaining({ mode: "host_add" }));
    expect(f.writes).toBe(1);
  });
});
