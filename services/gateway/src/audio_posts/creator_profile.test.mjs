import test from "node:test";
import assert from "node:assert/strict";
import { createFollowingService, FollowingError } from "./following.ts";

const bob = { tenantId: "tenantA", accountId: "bob", authorId: "bob", authorKind: "human" };
const post = (changes = {}) => ({
  tenantId: "tenantA", postId: "one", authorId: "alice",
  authorKind: "human", authorAccountId: "private-account",
  assetId: "private-object", requestId: "secret-request", title: "Hello",
  durationMs: 4000, status: "published", revision: 1,
  createdAt: "2026-10-10T01:00:00.000Z",
  publishedAt: "2026-10-10T01:01:00.000Z",
  likeCount: 2, commentCount: 1, ...changes,
});
const fixture = (creatorFeed) => createFollowingService({
  creatorFeed, feed: async () => ({ items: [], nextCursor: null }),
  setFromVisiblePost: async () => null, statusFromVisiblePost: async () => null,
});

test("creator profile uses authenticated tenant and public projection", async () => {
  let input;
  const service = fixture(async arg => {
    input = arg; return { items: [post()], nextCursor: null };
  });
  const result = await service.creatorFeed(bob, { authorId: "alice", authorKind: "human", limit: 12 });
  assert.deepEqual(input, {
    tenantId: "tenantA", viewerId: "bob", authorId: "alice",
    authorKind: "human", limit: 12, cursor: null,
  });
  assert.equal(result.items[0].likeCount, 2);
  for (const secret of ["tenantId", "authorAccountId", "assetId", "requestId"]) {
    assert.equal(secret in result.items[0], false);
  }
});

test("wrong creator, AI identity mismatch and unpublished results fail closed", async () => {
  for (const change of [
    { authorId: "other" }, { authorKind: "masana" }, { status: "processing" },
  ]) {
    const service = fixture(async () => ({ items: [post(change)], nextCursor: null }));
    await assert.rejects(service.creatorFeed(bob, { authorId: "alice", authorKind: "human" }),
      error => error instanceof FollowingError && error.code === "CAPABILITY_UNAVAILABLE");
  }
});

test("creator profile rejects invalid identity, actor and cursor", async () => {
  const service = fixture(async () => ({ items: [], nextCursor: null }));
  for (const input of [
    { authorId: "../private", authorKind: "human" },
    { authorId: "alice", authorKind: "robot" },
    { authorId: "alice", authorKind: "human", limit: 31 },
    { authorId: "alice", authorKind: "human", cursor: "bad" },
  ]) await assert.rejects(service.creatorFeed(bob, input), e => e.code === "VALIDATION");
  await assert.rejects(service.creatorFeed({ ...bob, accountId: "" },
    { authorId: "alice", authorKind: "human" }), e => e.code === "FORBIDDEN");
});

test("visibility outage propagates and never manufactures an empty success", async () => {
  const service = fixture(async () => { throw Error("visibility offline"); });
  await assert.rejects(service.creatorFeed(bob, { authorId: "alice", authorKind: "human" }),
    /visibility offline/);
});
