import { describe, expect, it } from "vitest";
import { createHumanContactService, HumanContactError } from "./service.js";
import type { HumanContactRepository, HumanContactPolicy } from "./model.js";

function harness(tenant = "tenant_1", actor = "user_al") {
  let receiverPolicy: HumanContactPolicy = "requests";
  let actorPolicy: HumanContactPolicy = "requests";
  let accepted = false;
  let pending = false;
  let declined = false;
  let blocked = false;
  const receiverId = "user_bo";
  const repo: HumanContactRepository = {
    async lookup({ tenantId, viewerId, handle }) {
      if (blocked || tenantId !== tenant || viewerId === receiverId || handle !== "bob") return null;
      return {
        userId: receiverId, handle: "bob", displayName: "Bob", avatarUrl: null,
        status: accepted ? "accepted" : declined ? "declined" : pending ? "outgoing" : "none",
        canMessage: accepted || (receiverPolicy === "anyone" && !declined),
        requestRevision: pending || accepted || declined ? "1" : null,
      };
    },
    async getOwnPreferences({ userId }) { return { policy: userId === receiverId ? receiverPolicy : actorPolicy, discoverableByHandle: true }; },
    async setOwnPreferences({ userId, policy: next }) { if (next !== undefined) { if (userId === receiverId) receiverPolicy = next; else actorPolicy = next; } return { policy: userId === receiverId ? receiverPolicy : actorPolicy, discoverableByHandle: true }; },
    async request({ tenantId, requesterId, handle }) {
      if (tenantId !== tenant || requesterId === receiverId || handle !== "bob" || blocked || receiverPolicy === "nobody") return "unavailable";
      if (accepted) return "accepted";
      if (pending) return "pending";
      if (declined) return "existing";
      if (receiverPolicy === "anyone") { accepted = true; return "accepted"; }
      pending = true; return "pending";
    },
    async respond({ tenantId, recipientId, requesterId, accept }) {
      if (tenantId !== tenant || recipientId !== receiverId || requesterId !== actor || blocked) return false;
      if (pending) { pending = false; accepted = accept; declined = !accept; return true; }
      return accept ? accepted : declined;
    },
    async revoke({ tenantId, actorId, otherUserId }) {
      if (tenantId !== tenant || blocked || ![actor, receiverId].includes(actorId) ||
          ![actor, receiverId].includes(otherUserId) || actorId === otherUserId ||
          (!pending && !accepted && !declined)) return false;
      accepted = false; pending = false; declined = true; return true;
    },
    async list({ tenantId, userId }) {
      if (tenantId !== tenant || blocked || (!pending && !accepted)) return [];
      return [{
        userId: userId === receiverId ? actor : receiverId,
        handle: userId === receiverId ? "alice" : "bob",
        displayName: "Contact", avatarUrl: null,
        status: accepted ? "accepted" : userId === receiverId ? "incoming" : "outgoing",
        updatedAt: "2026-10-08T09:00:00.000Z",
        requestRevision: "1",
      }];
    },
  };
  const svc = (asUser = actor, asTenant = tenant) => createHumanContactService({
    repository: repo,
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer okay") throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        return { tenantId: asTenant, userId: asUser } as never;
      },
    },
  });
  return { svc, block: () => { blocked = true; }, repo };
}

describe("C01 authenticated human-contact consent", () => {
  it("requires real session authority; never uses caller-submitted user ids", async () => {
    const { svc } = harness();
    await expect(svc().lookup({ authorizationHeader: undefined, handle: "bob" })).rejects.toMatchObject({ statusCode: 401 });
    await expect(svc("user_al", "another_tenant").lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("normalizes exact public handles, rejects enumeration and self contacts", async () => {
    const { svc } = harness();
    const result = await svc().lookup({ authorizationHeader: "Bearer okay", handle: " @BoB " });
    expect(result).toMatchObject({ userId: "user_bo", canMessage: false, status: "none" });
    await expect(svc().lookup({ authorizationHeader: "Bearer okay", handle: "%' OR 1=1" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc("user_bo").lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("defaults to request-only, is replay-safe, and requires recipient acceptance", async () => {
    const { svc } = harness();
    expect(await svc().ownPreferences({ authorizationHeader: "Bearer okay" })).toEqual({ policy: "requests", discoverableByHandle: true });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "pending" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "pending" });
    expect((await svc("user_bo").list({ authorizationHeader: "Bearer okay" })).contacts[0]?.status).toBe("incoming");
    await expect(svc().respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", requestRevision: "1", accept: true })).rejects.toMatchObject({ statusCode: 404 });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", requestRevision: "1", accept: true })).toEqual({ status: "accepted" });
    expect(await svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).toMatchObject({ canMessage: true, status: "accepted" });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", requestRevision: "1", accept: true })).toEqual({ status: "accepted" });
  });
  it("can decline and will not let requester resurrect declined request", async () => {
    const { svc } = harness();
    await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", requestRevision: "1", accept: false })).toEqual({ status: "declined" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "existing" });
    expect(await svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).toMatchObject({ canMessage: false, status: "declined" });
  });
  it("enforces subject privacy policy and reciprocal blocks", async () => {
    const { svc, block } = harness();
    await svc("user_bo").updatePreferences({ authorizationHeader: "Bearer okay", policy: "nobody" });
    await expect(svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
    await svc("user_bo").updatePreferences({ authorizationHeader: "Bearer okay", policy: "anyone" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "accepted" });
    block();
    await expect(svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("lets either member revoke an accepted relationship, then denies messaging", async () => {
    const { svc } = harness();
    await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" });
    await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", requestRevision: "1", accept: true });
    expect(await svc().revoke({ authorizationHeader: "Bearer okay", otherUserId: "user_bo" })).toEqual({ status: "revoked" });
    expect(await svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).toMatchObject({ canMessage: false });
    await expect(svc().revoke({ authorizationHeader: "Bearer okay", otherUserId: "user_al" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("rejects missing, malformed or overflowing response revision", async () => {
    const { svc } = harness();
    for (const revision of ["", "0", "-1", "1.2", "9223372036854775808", undefined]) {
      await expect(svc("user_bo").respond({
        authorizationHeader: "Bearer okay", requesterId: "user_al",
        requestRevision: revision as string, accept: true,
      })).rejects.toMatchObject({ statusCode: 400 });
    }
  });
  it("validates policy and page sizes rather than trusting requests", async () => {
    const { svc } = harness();
    await expect(svc().updatePreferences({ authorizationHeader: "Bearer okay", policy: "unlimited" as never })).rejects.toBeInstanceOf(HumanContactError);
    await expect(svc().list({ authorizationHeader: "Bearer okay", limit: 50000 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("paginates only for the fresh session owner; rejects forged or stale account cursors", async () => {
    const { svc, repo } = harness();
    const timestamp = "2026-10-08T11:00:00.123456Z";
    const seen: unknown[] = [];
    Object.assign(repo, {
      async listPage({ tenantId, userId, limit, after }: {
        tenantId: string; userId: string; limit: number;
        after: { updatedAt: string; userId: string } | null;
      }) {
        seen.push({ tenantId, userId, limit, after });
        return {
          contacts: [], next: after === null
            ? { updatedAt: timestamp, userId: "user_bo" } : null,
        };
      },
    });
    const first = await svc().page({ authorizationHeader: "Bearer okay", limit: 2 });
    expect(first.contacts).toEqual([]);
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    const second = await svc().page({
      authorizationHeader: "Bearer okay", limit: 2, cursor: first.nextCursor!,
    });
    expect(second.nextCursor).toBeNull();
    expect(seen).toEqual([
      { tenantId: "tenant_1", userId: "user_al", limit: 2, after: null },
      { tenantId: "tenant_1", userId: "user_al", limit: 2,
        after: { updatedAt: timestamp, userId: "user_bo" } },
    ]);
    await expect(svc("user_bo").page({
      authorizationHeader: "Bearer okay", cursor: first.nextCursor!,
    })).rejects.toMatchObject({ statusCode: 400, code: "messages.invalid_page_cursor" });
    await expect(svc("user_al", "another_tenant").page({
      authorizationHeader: "Bearer okay", cursor: first.nextCursor!,
    })).rejects.toMatchObject({ statusCode: 400 });
    for (const cursor of ["!", "AAAA", "x".repeat(1025),
      Buffer.from(JSON.stringify(["tenant_1", "user_al", "2026-10-08T11:00:00.123Z", "user_bo"])).toString("base64url"),
      Buffer.from(JSON.stringify(["tenant_1", "user_al", timestamp, ""])).toString("base64url")]) {
      await expect(svc().page({ authorizationHeader: "Bearer okay", cursor }))
        .rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(svc().page({ authorizationHeader: undefined })).rejects.toMatchObject({ statusCode: 401 });
    await expect(svc().page({ authorizationHeader: "Bearer okay", limit: 101 })).rejects.toMatchObject({ statusCode: 400 });
  });
});


