import test from "node:test";
import assert from "node:assert/strict";
import { createFollowingService, FollowingError } from "./following.ts";

const alice = Object.freeze({ tenantId: "tenantA", accountId: "alice", authorId: "alice", authorKind: "human" });
const bob = Object.freeze({ tenantId: "tenantA", accountId: "bob", authorId: "bob", authorKind: "human" });
const clone = Object.freeze({ tenantId: "tenantA", accountId: "cloneOwner", authorId: "persona7", authorKind: "masana" });

function fixture() {
  const followed = new Set();
  const creators = new Map([
    ["talk1", { tenantId: "tenantA", authorId: "alice", accountId: "alice", authorKind: "human", published: true }],
    ["talk2", { tenantId: "tenantA", authorId: "persona7", accountId: "cloneOwner", authorKind: "masana", published: true }],
    ["talk3", { tenantId: "tenantB", authorId: "other", accountId: "other", authorKind: "human", published: true }],
    ["talk4", { tenantId: "tenantA", authorId: "hidden", accountId: "hidden", authorKind: "human", published: false }],
  ]);
  const repository = {
    async setFromVisiblePost({ tenantId, accountId, postId, enabled }) {
      const creator = creators.get(postId);
      if (!creator || creator.tenantId !== tenantId || !creator.published ||
          creator.accountId === accountId || accountId === "blocked") return null;
      const key = [tenantId, accountId, creator.authorKind, creator.authorId].join("/");
      if (enabled) followed.add(key);
      else followed.delete(key);
      return { authorId: creator.authorId, authorKind: creator.authorKind, following: followed.has(key) };
    },
    async statusFromVisiblePost({ tenantId, accountId, postId }) {
      const creator = creators.get(postId);
      if (!creator || creator.tenantId !== tenantId || !creator.published ||
          creator.accountId === accountId || accountId === "blocked") return null;
      return {
        authorId: creator.authorId, authorKind: creator.authorKind,
        following: followed.has([tenantId, accountId, creator.authorKind, creator.authorId].join("/")),
      };
    },
    async feed({ tenantId, viewerId, limit, cursor }) {
      const ids = [...followed].filter(key => key.startsWith(tenantId + "/" + viewerId + "/"));
      return {
        items: ids.slice(0, limit).map((key, i) => ({
          tenantId, postId: "visible" + i, authorId: key.split("/").at(-1),
          authorAccountId: "hiddenAccount", authorKind: key.split("/")[2],
          assetId: "privateStorageKey", requestId: "privateRequest",
          title: "Audio from followed creator", durationMs: 15000,
          status: "published", revision: 1,
          createdAt: "2026-10-10T01:00:00.000Z",
          publishedAt: "2026-10-10T01:01:00.000Z",
          likeCount: 12, commentCount: 3,
        })),
        nextCursor: cursor ?? null,
      };
    },
  };
  return { service: createFollowingService(repository), followed, creators };
}

test("follow is idempotent and unfollow removes only the actor's creator relation", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.set(bob, { postId: "talk1", enabled: true }), {
    authorId: "alice", authorKind: "human", following: true,
  });
  await f.service.set(bob, { postId: "talk1", enabled: true });
  assert.equal(f.followed.size, 1);
  assert.equal((await f.service.feed(bob)).items.length, 1);
  await f.service.set(bob, { postId: "talk1", enabled: false });
  assert.equal(f.followed.size, 0);
  assert.equal((await f.service.feed(bob)).items.length, 0);
});

test("following a Masana preserves the creator kind without treating it as a person", async () => {
  const f = fixture();
  assert.deepEqual(await f.service.set(bob, { postId: "talk2", enabled: true }), {
    authorId: "persona7", authorKind: "masana", following: true,
  });
});

test("self-follow, hidden, foreign tenant and nonexistent posts all return neutral 404", async () => {
  const f = fixture();
  for (const [actor, postId] of [[alice, "talk1"], [bob, "talk3"], [bob, "talk4"], [bob, "missing"], [{ ...bob, accountId: "blocked" }, "talk1"]]) {
    await assert.rejects(f.service.set(actor, { postId, enabled: true }), e =>
      e instanceof FollowingError && e.code === "NOT_FOUND");
  }
  assert.equal(f.followed.size, 0);
});

test("another tenant or another viewer cannot read someone else's follows", async () => {
  const f = fixture();
  await f.service.set(bob, { postId: "talk1", enabled: true });
  assert.equal((await f.service.feed({ ...bob, tenantId: "tenantB" })).items.length, 0);
  assert.equal((await f.service.feed(clone)).items.length, 0);
});

test("reject invalid IDs, actor context, nonboolean states and malformed page cursors", async () => {
  const f = fixture();
  for (const postId of ["", "a/b", "../talk", " ".repeat(4)]) {
    await assert.rejects(f.service.set(bob, { postId, enabled: true }), e => e.code === "VALIDATION");
  }
  for (const enabled of ["true", 1, null]) {
    await assert.rejects(f.service.set(bob, { postId: "talk1", enabled }), e => e.code === "VALIDATION");
  }
  await assert.rejects(f.service.set({ ...bob, accountId: "" }, { postId: "talk1", enabled: true }),
    e => e.code === "FORBIDDEN");
  for (const input of [{ limit: 31 }, { limit: -1 }, { limit: 0 }, { limit: 1.2 },
    { cursor: "bad" }, { cursor: "1700000000000:bad/path" }]) {
    await assert.rejects(f.service.feed(bob, input), e => e.code === "VALIDATION");
  }
});

test("repository or visibility outage never fabricates a successful follow receipt", async () => {
  const service = createFollowingService({
    setFromVisiblePost: async () => { throw Error("policy_unavailable"); },
    feed: async () => { throw Error("db_unavailable"); },
  });
  await assert.rejects(service.set(bob, { postId: "talk1", enabled: true }), /policy_unavailable/);
  await assert.rejects(service.feed(bob), /db_unavailable/);
});

test("invalid repository follow receipts fail closed as unavailable capability", async () => {
  const service = createFollowingService({
    setFromVisiblePost: async () => ({ authorId: "alice", authorKind: "human", following: "yes" }),
    feed: async () => ({ items: null, nextCursor: null }),
  });
  await assert.rejects(service.set(bob, { postId: "talk1", enabled: true }), e =>
    e.code === "CAPABILITY_UNAVAILABLE");
  await assert.rejects(service.feed(bob), e => e.code === "CAPABILITY_UNAVAILABLE");
});

test("persisted follow status is account-scoped, permits unfollow after remount", async () => {
  const f = fixture();
  assert.equal((await f.service.status(bob, "talk1")).following, false);
  await f.service.set(bob, { postId: "talk1", enabled: true });
  assert.equal((await f.service.status(bob, "talk1")).following, true);
  const anotherViewer = { ...bob, accountId: "charlie", authorId: "charlie" };
  assert.equal((await f.service.status(anotherViewer, "talk1")).following, false);
  await f.service.set(bob, { postId: "talk1", enabled: false });
  assert.equal((await f.service.status(bob, "talk1")).following, false);
  await assert.rejects(f.service.status(bob, "talk4"), e => e.code === "NOT_FOUND");
});

test("Following applies shared safe public projection with persisted engagement counts", async () => {
  const f = fixture();
  await f.service.set(bob, { postId: "talk1", enabled: true });
  const page = await f.service.feed(bob);
  assert.equal(page.items.length, 1);
  const post = page.items[0];
  assert.equal(post.postId, "visible0");
  assert.equal(post.likeCount, 12);
  assert.equal(post.commentCount, 3);
  assert.equal(post.status, "published");
  assert.equal(post.authorId, "alice");
  assert.equal(post.tenantId, undefined);
  assert.equal(post.assetId, undefined);
  assert.equal(post.authorAccountId, undefined);
  assert.equal(post.requestId, undefined);
  assert.equal(JSON.stringify(page).includes("privateStorageKey"), false);
  assert.equal(JSON.stringify(page).includes("hiddenAccount"), false);
  assert.equal(JSON.stringify(page).includes("privateRequest"), false);
});

test("Following keeps Masana posts disclosed as AI without leaking creator account identity", async () => {
  const f = fixture();
  await f.service.set(bob, { postId: "talk2", enabled: true });
  const page = await f.service.feed(bob);
  assert.equal(page.items[0].authorId, "persona7");
  assert.equal(page.items[0].authorKind, "masana");
  assert.equal("authorAccountId" in page.items[0], false);
});


test("opaque PostgreSQL precision cursor is forwarded unchanged by both feed services", async () => {
  const stamp = "2026-10-10T02:51:54.123789Z";
  const cursor = Buffer.from(JSON.stringify([stamp, "postA"])).toString("base64url");
  const received = [];
  const repository = {
    feed: async args => { received.push(args); return { items: [], nextCursor: null }; },
    creatorFeed: async args => { received.push(args); return { items: [], nextCursor: null }; },
  };
  const service = createFollowingService(repository);
  await service.feed(bob, { cursor, limit: 3 });
  await service.creatorFeed(bob, { authorId: "alice", authorKind: "human", cursor, limit: 2 });
  assert.equal(received[0].cursor, cursor);
  assert.equal(received[1].cursor, cursor);
  assert.equal(received[0].viewerId, "bob");
  assert.equal(received[1].tenantId, "tenantA");
  await assert.rejects(service.feed(bob, { cursor: "1700000000000:postA" }),
    e => e.code === "VALIDATION");
});
test("invalid persisted page cursors return typed 400, corrupt rows typed 503", async () => {
  const service = createFollowingService({
    feed: async () => { throw Error("audio_posts.invalid_following_cursor"); },
    creatorFeed: async () => { throw Error("audio_posts.invalid_following_row"); },
  });
  await assert.rejects(service.feed(bob), e =>
    e instanceof FollowingError && e.code === "VALIDATION");
  await assert.rejects(service.creatorFeed(bob, { authorId: "alice", authorKind: "human" }), e =>
    e instanceof FollowingError && e.code === "CAPABILITY_UNAVAILABLE");
});
test("real repository outages are not disguised as malformed cursor errors", async () => {
  const service = createFollowingService({
    feed: async () => { throw Error("pg_connection_lost"); },
  });
  await assert.rejects(service.feed(bob), /pg_connection_lost/);
});
