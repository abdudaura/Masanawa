import { describe, expect, it } from "vitest";
import { createProfileAvatarService, type ProfileAvatarRepository } from "./service.js";
import type { AvatarObjectStore } from "./s3_store.js";
import { validAvatarPng } from "./test_png_fixture.js";

const owner = { tenantId: "tenant_123456789012", userId: "user_123456789012" };
const digest = "a".repeat(64);
const garbageKey = "profiles/" + owner.tenantId + "/" + owner.userId +
  "/sha256-" + digest + ".webp";

class FakeRepository implements ProfileAvatarRepository {
  url: string | null = null;
  exists = true;
  staged: string[] = [];
  garbage: Array<{ key: string; tenantId: string; userId: string }> = [];
  rejectAttach = false;
  rejectStage = false;
  mutations = 0;
  async current() { return { exists: this.exists, url: this.url }; }
  async stage(input: { key: string }) {
    if (this.rejectStage) return false;
    this.staged.push(input.key);
    return true;
  }
  async attach(input: { expectedUrl: string | null; url: string }) {
    if (this.rejectAttach || input.expectedUrl !== this.url) return false;
    this.url = input.url;
    this.mutations++;
    return true;
  }
  async remove(input: { expectedUrl: string | null }) {
    if (input.expectedUrl !== this.url) return false;
    this.url = null;
    this.mutations++;
    return true;
  }
  async claimGarbage(limit: number) { return this.garbage.splice(0, limit); }
  async finalizeDeleted(key: string) {
    this.staged = this.staged.filter(value => value !== key);
  }
  async releaseFailedDeletion(key: string) {
    this.garbage.push({ ...owner, key });
  }
}
function setup(repo = new FakeRepository()) {
  const writes: Array<{ key: string; bytes: Buffer }> = [];
  const deletes: string[] = [];
  let failDelete = false;
  let failPut = false;
  let authorizeCalls = 0;
  let revokedAt = Infinity;
  let changedAt = Infinity;
  const keyFor = (sha: string) =>
    "profiles/" + owner.tenantId + "/" + owner.userId + "/sha256-" + sha + ".webp";
  const objects: AvatarObjectStore = {
    async put(_, avatar) {
      if (failPut) throw Error("storage failed");
      const key = keyFor(avatar.sha256);
      writes.push({ key, bytes: avatar.bytes });
      return { key, url: "https://cdn.example.test/" + key, sha256: avatar.sha256 };
    },
    async delete(_, sha) {
      if (failDelete) throw Error("delete failed");
      deletes.push(sha);
    },
    urlFor(_, sha) { return "https://cdn.example.test/" + keyFor(sha); },
  };
  const service = createProfileAvatarService({
    authorizer: {
      async authorize({ authorizationHeader }) {
        authorizeCalls++;
        if (authorizationHeader !== "Bearer owner" || authorizeCalls >= revokedAt) {
          throw Object.assign(Error("unauthorized"), { statusCode: 401 });
        }
        return (authorizeCalls >= changedAt ? { ...owner, userId: "user_other12345678" } : owner) as never;
      },
    },
    repository: repo,
    objects,
  });
  return {
    service, repo, writes, deletes,
    revokeAt: (call: number) => { revokedAt = call; },
    changeAt: (call: number) => { changedAt = call; },
    setFailDelete: (value: boolean) => { failDelete = value; },
    setFailPut: (value: boolean) => { failPut = value; },
  };
}
const auth = { authorizationHeader: "Bearer owner" };

describe("authenticated avatar storage lifecycle", () => {
  it("authenticates before S3 and commits only server normalized WebP", async () => {
    const h = setup();
    await expect(h.service.upload({
      authorizationHeader: undefined, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(h.repo.staged).toHaveLength(0);
    const result = await h.service.upload({
      ...auth, png: validAvatarPng({ metadata: true }), expectedUrl: null,
    });
    expect(result.avatarUrl).toContain("https://cdn.example.test/profiles/");
    expect(h.repo.staged).toHaveLength(1);
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]!.bytes.includes(Buffer.from("GPS"))).toBe(false);
    expect(h.repo.url).toBe(result.avatarUrl);
  });

  it("denies invalid source images without S3 side effects", async () => {
    const h = setup();
    await expect(h.service.upload({
      ...auth, png: Buffer.alloc(200), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 415 });
    expect(h.repo.staged).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });

  it("fails closed before object-store PUT when staging was revoked or garbage collection owns the key", async () => {
    const h = setup();
    h.repo.rejectStage = true;
    await expect(h.service.upload({
      ...auth, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({
      code: "profiles.avatar.stage_conflict", statusCode: 409,
    });
    expect(h.writes).toHaveLength(0);
    expect(h.repo.mutations).toBe(0);
    expect(h.repo.staged).toHaveLength(0);
  });

  it("stages objects before write and retains reclaimable failed uploads", async () => {
    const h = setup();
    h.setFailPut(true);
    await expect(h.service.upload({
      ...auth, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toThrow("storage failed");
    expect(h.repo.staged).toHaveLength(1);
    expect(h.repo.mutations).toBe(0);
  });

  it("rejects changes from a stale phone before reserving an object", async () => {
    const h = setup();
    h.repo.url = "https://cdn.example.test/changed.png";
    await expect(h.service.upload({
      ...auth, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(h.repo.staged).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });

  it("does not overwrite on lost concurrent CAS", async () => {
    const h = setup();
    h.repo.rejectAttach = true;
    await expect(h.service.upload({
      ...auth, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(h.repo.url).toBeNull();
    expect(h.repo.staged).toHaveLength(1);
  });

  it("removes a photo only from the authenticated owner's version", async () => {
    const h = setup();
    const { avatarUrl } = await h.service.upload({
      ...auth, png: validAvatarPng(), expectedUrl: null,
    });
    await expect(h.service.remove({
      authorizationHeader: undefined, expectedUrl: avatarUrl,
    })).rejects.toMatchObject({ statusCode: 401 });
    await expect(h.service.remove({
      ...auth, expectedUrl: "https://cdn.example.test/old.png",
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(await h.service.remove({
      ...auth, expectedUrl: avatarUrl,
    })).toEqual({ avatarUrl: null });
    expect(h.repo.url).toBeNull();
  });

  it("retries durable orphan cleanup after object-store failures", async () => {
    const h = setup();
    h.repo.garbage.push({ ...owner, key: garbageKey });
    h.setFailDelete(true);
    expect(await h.service.collectGarbage()).toEqual({ deleted: 0, failed: 1 });
    expect(h.repo.garbage).toHaveLength(1);
    h.setFailDelete(false);
    expect(await h.service.collectGarbage()).toEqual({ deleted: 1, failed: 0 });
    expect(h.deletes).toEqual([digest]);
  });
});


describe("avatar current-session fences", () => {
  for (const call of [2, 3, 4, 5, 6]) {
    it(`denies revoked upload at authorization boundary ${call}`, async () => {
      const h = setup();
      h.revokeAt(call);
      await expect(h.service.upload({ ...auth, png: validAvatarPng(), expectedUrl: null }))
        .rejects.toMatchObject({ statusCode: 401 });
      expect(h.writes).toHaveLength(call >= 5 ? 1 : 0);
      expect(h.repo.mutations).toBe(call === 6 ? 1 : 0);
      // Staged writes remain journaled; post-commit revocation is a lost receipt.
      expect(h.repo.staged).toHaveLength(call >= 4 ? 1 : 0);
    });
    it(`denies switched account at authorization boundary ${call}`, async () => {
      const h = setup();
      h.changeAt(call);
      await expect(h.service.upload({ ...auth, png: validAvatarPng(), expectedUrl: null }))
        .rejects.toMatchObject({ code: "profiles.avatar.session_changed", statusCode: 401 });
      expect(h.repo.mutations).toBe(call === 6 ? 1 : 0);
    });
  }
  for (const call of [2, 3, 4]) {
    it(`denies revoked removal at authorization boundary ${call}`, async () => {
      const h = setup();
      const previous = "https://cdn.example.test/old.webp";
      h.repo.url = previous;
      h.revokeAt(call);
      await expect(h.service.remove({ ...auth, expectedUrl: previous }))
        .rejects.toMatchObject({ statusCode: 401 });
      expect(h.repo.url).toBe(call === 4 ? null : previous);
      expect(h.repo.mutations).toBe(call === 4 ? 1 : 0);
    });
  }
});
