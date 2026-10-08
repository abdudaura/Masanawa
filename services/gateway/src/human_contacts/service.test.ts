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
        canMessage: accepted || receiverPolicy === "anyone",
      };
    },
    async getOwnPolicy({ userId }) { return userId === receiverId ? receiverPolicy : actorPolicy; },
    async setOwnPolicy({ userId, policy: next }) { if (userId === receiverId) receiverPolicy = next; else actorPolicy = next; return next; },
    async request({ tenantId, requesterId, handle }) {
      if (tenantId !== tenant || requesterId === receiverId || handle !== "bob" || blocked || receiverPolicy === "nobody") return "unavailable";
      if (accepted) return "accepted";
      if (pending || declined) return "existing";
      if (receiverPolicy === "anyone") { accepted = true; return "accepted"; }
      pending = true; return "pending";
    },
    async respond({ tenantId, recipientId, requesterId, accept }) {
      if (tenantId !== tenant || recipientId !== receiverId || requesterId !== actor || blocked) return false;
      if (pending) { pending = false; accepted = accept; declined = !accept; return true; }
      return accept ? accepted : declined;
    },
    async list({ tenantId, userId }) {
      if (tenantId !== tenant || blocked || (!pending && !accepted)) return [];
      return [{
        userId: userId === receiverId ? actor : receiverId,
        handle: userId === receiverId ? "alice" : "bob",
        displayName: "Contact", avatarUrl: null,
        status: accepted ? "accepted" : userId === receiverId ? "incoming" : "outgoing",
        updatedAt: "2026-10-08T09:00:00.000Z",
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
    expect(await svc().ownPolicy({ authorizationHeader: "Bearer okay" })).toEqual({ policy: "requests" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "pending" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "existing" });
    expect((await svc("user_bo").list({ authorizationHeader: "Bearer okay" })).contacts[0]?.status).toBe("incoming");
    await expect(svc().respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", accept: true })).rejects.toMatchObject({ statusCode: 404 });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", accept: true })).toEqual({ status: "accepted" });
    expect(await svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).toMatchObject({ canMessage: true, status: "accepted" });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", accept: true })).toEqual({ status: "accepted" });
  });
  it("can decline and will not let requester resurrect declined request", async () => {
    const { svc } = harness();
    await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" });
    expect(await svc("user_bo").respond({ authorizationHeader: "Bearer okay", requesterId: "user_al", accept: false })).toEqual({ status: "declined" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "existing" });
    expect(await svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).toMatchObject({ canMessage: false, status: "declined" });
  });
  it("enforces subject privacy policy and reciprocal blocks", async () => {
    const { svc, block } = harness();
    await svc("user_bo").updatePolicy({ authorizationHeader: "Bearer okay", policy: "nobody" });
    await expect(svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
    await svc("user_bo").updatePolicy({ authorizationHeader: "Bearer okay", policy: "anyone" });
    expect(await svc().request({ authorizationHeader: "Bearer okay", handle: "bob" })).toEqual({ status: "accepted" });
    block();
    await expect(svc().lookup({ authorizationHeader: "Bearer okay", handle: "bob" })).rejects.toMatchObject({ statusCode: 404 });
  });
  it("validates policy and page sizes rather than trusting requests", async () => {
    const { svc } = harness();
    await expect(svc().updatePolicy({ authorizationHeader: "Bearer okay", policy: "unlimited" as never })).rejects.toBeInstanceOf(HumanContactError);
    await expect(svc().list({ authorizationHeader: "Bearer okay", limit: 50000 })).rejects.toMatchObject({ statusCode: 400 });
  });
});
