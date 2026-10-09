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
  it("rejects calendar-overflow and PostgreSQL-invalid page cursors before any SQL call", async () => {
    const { svc, repo } = harness();
    const observed: Array<{ updatedAt: string; userId: string } | null> = [];
    Object.assign(repo, {
      async listPage({ after }: { after: { updatedAt: string; userId: string } | null }) {
        observed.push(after);
        return { contacts: [], next: null };
      },
    });
    // C01 cursors are client-visible positions, not signed capabilities. The
    // attacker can supply their own actor/tenant, so validate the date itself.
    const cursor = (timestamp: string) => Buffer.from(
      JSON.stringify(["tenant_1", "user_al", timestamp, "user_bo"]),
    ).toString("base64url");
    expect(Number.isFinite(Date.parse("2026-02-30T11:00:00.123456Z"))).toBe(true);
    for (const timestamp of [
      "2026-02-30T11:00:00.123456Z", // JS normalizes it, PostgreSQL rejects it
      "2026-04-31T11:00:00.123456Z",
      "2026-11-31T11:00:00.123456Z",
      "2025-02-29T11:00:00.123456Z",
      "1900-02-29T11:00:00.123456Z", // century non-leap
      "0000-01-01T11:00:00.123456Z", // no PostgreSQL year zero
      "2026-13-01T11:00:00.123456Z",
      "2026-00-01T11:00:00.123456Z",
      "2026-01-00T11:00:00.123456Z",
      "2026-01-01T24:00:00.123456Z",
      "2026-01-01T11:60:00.123456Z",
      "2026-01-01T11:00:60.123456Z",
      "2026-01-01T11:00:00.12345Z", // microsecond keyset required
      "2026-01-01T11:00:00.123456+00:00", // UTC canonical only
    ]) {
      await expect(svc().page({ authorizationHeader: "Bearer okay", cursor: cursor(timestamp) }))
        .rejects.toMatchObject({ code: "messages.invalid_page_cursor", statusCode: 400 });
    }
    expect(observed).toEqual([]); // no repository/SQL reached

    for (const timestamp of [
      "0001-01-01T00:00:00.000001Z",
      "2000-02-29T23:59:59.999999Z", // Gregorian 400-year leap
      "2024-02-29T11:00:00.123456Z",
      "9999-12-31T23:59:59.999999Z",
    ]) {
      expect(await svc().page({ authorizationHeader: "Bearer okay", cursor: cursor(timestamp) }))
        .toEqual({ contacts: [], nextCursor: null });
    }
    expect(observed).toEqual([
      { updatedAt: "0001-01-01T00:00:00.000001Z", userId: "user_bo" },
      { updatedAt: "2000-02-29T23:59:59.999999Z", userId: "user_bo" },
      { updatedAt: "2024-02-29T11:00:00.123456Z", userId: "user_bo" },
      { updatedAt: "9999-12-31T23:59:59.999999Z", userId: "user_bo" },
    ]);
  });

});
