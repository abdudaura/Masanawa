import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { NormalizedProfileAvatar } from "./normalizer.js";
import { createS3AvatarObjectStore } from "./s3_store.js";

const owner = Object.freeze({
  tenantId: "tenant_00000000-0000-4000-8000-000000000001",
  userId: "user_00000000-0000-4000-8000-000000000002",
});
const bytes = Buffer.from("normalized-webp-payload-fixture");
const digest = createHash("sha256").update(bytes).digest("hex");
const avatar: NormalizedProfileAvatar = {
  bytes, mediaType: "image/webp", width: 512, height: 512,
  sha256: digest,
};
const at = () => new Date("2026-10-08T06:00:00.000Z");

function store(fetchImpl: typeof fetch) {
  return createS3AvatarObjectStore({
    endpoint: "https://s3.example.test/",
    publicBaseUrl: "https://avatar.example.test/",
    bucket: "avatars-bucket",
    region: "ams3",
    accessKey: "EXAMPLEACCESS",
    secretKey: "example-secret-longer-than-16",
    fetchImpl,
    now: at,
  });
}

describe("R18 owner-scoped private S3 avatar writes", () => {
  it("signs the exact WebP payload, fixes content type and returns a CDN URL", async () => {
    const mock = vi.fn(async (_url: URL | string, _init: RequestInit) => new Response(null, { status: 200 }));
    const result = await store(mock as unknown as typeof fetch).put(owner, avatar);
    expect(mock).toHaveBeenCalledOnce();
    const [url, init] = mock.mock.calls[0]!;
    expect(url.toString()).toBe(
      `https://s3.example.test/avatars-bucket/profiles/${owner.tenantId}/${owner.userId}/sha256-${digest}.webp`,
    );
    expect(init.method).toBe("PUT");
    expect(init.redirect).toBe("error");
    expect(init.body).toEqual(new Uint8Array(bytes));
    expect(new Headers(init.headers).get("content-type")).toBe("image/webp");
    expect(new Headers(init.headers).get("x-amz-content-sha256")).toBe(digest);
    expect(new Headers(init.headers).get("x-amz-date")).toBe("20261008T060000Z");
    expect(new Headers(init.headers).get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=EXAMPLEACCESS\/20261008\/ams3\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/u,
    );
    expect(init.headers).not.toHaveProperty("x-amz-acl");
    expect(result).toEqual({
      key: `profiles/${owner.tenantId}/${owner.userId}/sha256-${digest}.webp`,
      url: `https://avatar.example.test/profiles/${owner.tenantId}/${owner.userId}/sha256-${digest}.webp`,
      sha256: digest,
    });
  });

  it("rejects mismatching digest and owner escape without requesting S3", async () => {
    const mock = vi.fn(async (_url: URL | string, _init: RequestInit) => new Response(null, { status: 200 }));
    const storage = store(mock as unknown as typeof fetch);
    await expect(storage.put(owner, { ...avatar, sha256: "a".repeat(64) }))
      .rejects.toThrow("checksum");
    await expect(storage.put({
      ...owner, userId: "../another-user",
    }, avatar)).rejects.toThrow("owner-scoped");
    await expect(storage.put(owner, { ...avatar, mediaType: "image/jpeg" as never }))
      .rejects.toThrow("normalized");
    expect(mock).not.toHaveBeenCalled();
  });

  it("does not expose a success URL until object PUT succeeded", async () => {
    const mock = vi.fn(async (_url: URL | string, _init: RequestInit) => new Response(null, { status: 503 }));
    await expect(store(mock as unknown as typeof fetch).put(owner, avatar))
      .rejects.toThrow("profile.avatar.object_write_failed");
  });

  it("deletes only a generated immutable key and treats already missing keys as deleted", async () => {
    const mock = vi.fn(async (_url: URL | string, _init: RequestInit) => new Response(null, { status: 404 }));
    const storage = store(mock as unknown as typeof fetch);
    await storage.delete(owner, digest);
    expect(mock).toHaveBeenCalledOnce();
    const [url, init] = mock.mock.calls[0]!;
    expect(url.toString()).toContain(`/${owner.userId}/sha256-${digest}.webp`);
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("x-amz-content-sha256")).toBe(
      createHash("sha256").update("").digest("hex"),
    );
    expect(new Headers(init.headers).get("authorization")).toMatch(/SignedHeaders=host;x-amz-content-sha256;x-amz-date/u);
  });

  it("rejects untrusted S3 or public CDN configuration", () => {
    const valid = {
      endpoint: "https://s3.example.test/",
      publicBaseUrl: "https://avatar.example.test/",
      bucket: "avatars-bucket",
      region: "ams3",
      accessKey: "ACCESS",
      secretKey: "example-secret-longer-than-16",
    };
    for (const invalid of [
      { endpoint: "http://s3.example.test/" },
      { endpoint: "https://username@private.example.test/" },
      { publicBaseUrl: "http://cdn.example.test/" },
      { publicBaseUrl: "https://cdn.example.test/avatars?token=unsafe" },
      { bucket: "../bucket" },
      { region: "not a region" },
      { secretKey: "short" },
    ]) {
      expect(() => createS3AvatarObjectStore({ ...valid, ...invalid }))
        .toThrow();
    }
  });

  it("separates object keys across tenant/user identities even for identical content", () => {
    const storage = store(async () => new Response(null, { status: 200 }));
    const a = storage.urlFor(owner, digest);
    const b = storage.urlFor({ ...owner,
      userId: "user_00000000-0000-4000-8000-000000000003",
    }, digest);
    expect(a).not.toBe(b);
    expect(a).not.toContain("s3.example.test");
    expect(b).toContain("avatar.example.test");
  });
});

