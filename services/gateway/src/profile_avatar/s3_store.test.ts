import { describe, expect, it } from "vitest";
import { createS3AvatarStore } from "./s3_store.js";

const key = "profile-avatars/" + "a".repeat(64) + "/" +
  "b".repeat(64) + "/12345678-1234-4123-8123-123456789abc.png";

function fixture(fetchImpl?: typeof fetch) {
  return createS3AvatarStore({
    endpoint: "https://ams3.digitaloceanspaces.com",
    region: "ams3",
    bucket: "profile-public",
    accessKey: "accesskey",
    secretKey: "0123456789abcdef",
    publicBaseUrl: "https://images.masanawa.example/avatars/",
    now: () => new Date("2026-10-08T06:00:00.000Z"),
    fetchImpl,
  });
}
describe("S3 avatar durable and authorized objects", () => {
  it("signs PNG PUT without including credentials in CDN URLs", async () => {
    let method: string | undefined;
    let headers: Record<string, string> | undefined;
    let target = "";
    const store = fixture(async (url, init) => {
      target = String(url);
      method = init?.method;
      headers = init?.headers as Record<string, string>;
      return new Response(null, { status: 201 });
    });
    await store.put(key, Buffer.alloc(64));
    expect(method).toBe("PUT");
    expect(target).toContain("/profile-public/profile-avatars/");
    expect(headers?.["content-type"]).toBe("image/png");
    expect(headers?.authorization).toContain("AWS4-HMAC-SHA256 Credential=accesskey/");
    expect(headers?.["x-amz-content-sha256"]).toMatch(/^[a-f0-9]{64}$/u);
    const url = store.publicUrl(key);
    expect(url).toContain("https://images.masanawa.example/avatars/");
    expect(url).not.toContain("0123456789abcdef");
    expect(store.managedKey(url)).toBe(key);
  });

  it("does not permit deleting arbitrary user-provided URLs or keys", async () => {
    const store = fixture();
    expect(store.managedKey("https://evil.test/" + key)).toBeNull();
    expect(store.managedKey("https://images.masanawa.example/avatars/../escape")).toBeNull();
    expect(() => store.publicUrl("../escape")).toThrow();
    await expect(store.delete("../escape")).rejects.toThrow();
  });

  it("treats already-deleted objects as safe repeated cleanup", async () => {
    let called = false;
    const store = fixture(async (_, init) => {
      called = true;
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 404 });
    });
    await store.delete(key);
    expect(called).toBe(true);
  });

  it("never reports storage errors as a successful upload", async () => {
    const store = fixture(async () => new Response(null, { status: 503 }));
    await expect(store.put(key, Buffer.alloc(64))).rejects.toThrow(
      "profiles.avatar.store_unavailable",
    );
  });

  it("rejects non-HTTPS CDN or incomplete signing credentials", () => {
    expect(() => createS3AvatarStore({
      endpoint: "http://insecure.test/",
      region: "ams3", bucket: "avatar-public",
      accessKey: "accesskey", secretKey: "0123456789abcdef",
      publicBaseUrl: "https://images.masanawa.example/",
    })).toThrow();
  });
});
