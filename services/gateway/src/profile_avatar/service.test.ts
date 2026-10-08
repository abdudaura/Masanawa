import { describe, expect, it } from "vitest";
import { createProfileAvatarService, type ProfileAvatarRepository } from "./service.js";
import type { AvatarObjectStore } from "./s3_store.js";
import { validAvatarPng } from "./test_png_fixture.js";

const keyBase = "profile-avatars/" + "a".repeat(64) + "/" + "b".repeat(64) + "/";
const uploadId = "12345678-1234-4123-8123-123456789abc";

class _Repository implements ProfileAvatarRepository {
  url: string | null = null;
  exists = true;
  staged: string[] = [];
  garbage: string[] = [];
  rejectAttach = false;
  mutations = 0;

  async current() {
    return { exists: this.exists, url: this.url };
  }
  async stage(input: { key: string }) {
    this.staged.push(input.key);
  }
  async attach(input: { expectedUrl: string | null; url: string; key: string }) {
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
  async claimGarbage(limit: number) {
    return this.garbage.splice(0, limit);
  }
  async finalizeDeleted(key: string) {
    this.staged = this.staged.filter(value => value !== key);
  }
  async releaseFailedDeletion(key: string) {
    this.garbage.push(key);
  }
}

function setup(repo = new _Repository()) {
  const writes: Array<{ key: string; png: Buffer }> = [];
  const deletes: string[] = [];
  let failDelete = false;
  let failPut = false;
  const objects: AvatarObjectStore = {
    async put(key, png) {
      if (failPut) throw Error("storage failed");
      writes.push({ key, png });
    },
    async delete(key) {
      if (failDelete) throw Error("delete failed");
      deletes.push(key);
    },
    publicUrl: key => "https://cdn.example.test/" + key,
    managedKey: url => url?.startsWith("https://cdn.example.test/")
      ? url.slice("https://cdn.example.test/".length) : null,
  };
  const service = createProfileAvatarService({
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer owner") {
          throw Object.assign(Error("unauthorized"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant", userId: "user",
        } as never;
      },
    },
    repository: repo,
    objects,
    makeId: () => uploadId,
  });
  return {
    service, repo, writes, deletes,
    setFailDelete: (value: boolean) => { failDelete = value; },
    setFailPut: (value: boolean) => { failPut = value; },
  };
}
const authorized = { authorizationHeader: "Bearer owner" };

describe("durable profile avatar lifecycle", () => {
  it("authenticates before storage and publishes sanitized private metadata-free PNG", async () => {
    const h = setup();
    await expect(h.service.upload({
      authorizationHeader: undefined, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(h.repo.staged).toHaveLength(0);
    const accepted = await h.service.upload({
      ...authorized, png: validAvatarPng({ metadata: true }), expectedUrl: null,
    });
    expect(accepted.avatarUrl).toContain(keyBase.slice(0, 16));
    expect(h.repo.staged).toHaveLength(1);
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]!.png.includes(Buffer.from("GPS"))).toBe(false);
    expect(h.repo.url).toBe(accepted.avatarUrl);
  });

  it("does not publish invalid images or create junk objects", async () => {
    const h = setup();
    await expect(h.service.upload({
      ...authorized, png: Buffer.alloc(200), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 422 });
    expect(h.repo.staged).toHaveLength(0);
    expect(h.writes).toHaveLength(0);
  });

  it("reserves object key before S3 write so failed writes remain reclaimable", async () => {
    const h = setup();
    h.setFailPut(true);
    await expect(h.service.upload({
      ...authorized, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toThrow("storage failed");
    expect(h.repo.staged).toHaveLength(1);
    expect(h.repo.mutations).toBe(0);
  });

  it("fails closed on concurrent replacement and does not overwrite newer avatar", async () => {
    const h = setup();
    h.repo.rejectAttach = true;
    await expect(h.service.upload({
      ...authorized, png: validAvatarPng(), expectedUrl: null,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(h.repo.url).toBeNull();
    expect(h.repo.staged).toHaveLength(1);
    expect(h.writes).toHaveLength(1);
  });

  it("revokes avatar URL only for its authenticated owner", async () => {
    const h = setup();
    const { avatarUrl } = await h.service.upload({
      ...authorized, png: validAvatarPng(), expectedUrl: null,
    });
    expect(h.repo.url).toBe(avatarUrl);
    await expect(h.service.remove({ authorizationHeader: undefined, expectedUrl: avatarUrl }))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(h.repo.url).toBe(avatarUrl);
    expect(await h.service.remove({ ...authorized, expectedUrl: avatarUrl })).toEqual({ avatarUrl: null });
    expect(h.repo.url).toBeNull();
  });

  it("retries orphan deletions without losing the durable garbage lease", async () => {
    const h = setup();
    h.repo.garbage.push(keyBase + uploadId + ".png");
    h.setFailDelete(true);
    expect(await h.service.collectGarbage()).toEqual({ deleted: 0, failed: 1 });
    expect(h.repo.garbage).toHaveLength(1);
    h.setFailDelete(false);
    expect(await h.service.collectGarbage()).toEqual({ deleted: 1, failed: 0 });
    expect(h.deletes).toHaveLength(1);
  });
});
