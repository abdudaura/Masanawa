import { describe, expect, it, vi } from "vitest";
import type { CleanupCandidate } from "./media_cleanup.js";
import { createS3MediaCleanupDeleter } from "./media_cleanup_s3.js";

const immutable: CleanupCandidate = {
  tenantId: "tenant_123456789012", kind: "avatar",
  objectKey: "profiles/tenant_123456789012/user_123456789012/sha256-" + "a".repeat(64) + ".webp",
  objectVersion: null, leaseToken: "valid_claim_token_12345",
  referenceRevision: 7, createdAtMs: 1_700_000_000_000, retainUntilMs: 1_700_100_000_000,
};
function fixture(status = 204, code?: string) {
  const fetchImpl = vi.fn(async () => new Response(null, {
    status, headers: code ? { "x-amz-error-code": code } : {},
  }));
  const store = createS3MediaCleanupDeleter({
    endpoint: "https://objects.example.test/", bucket: "masanawa-private",
    region: "ams3", accessKey: "safeTestAccessKey",
    secretKey: "do-not-use-production-secret-000000",
    now: () => new Date("2026-10-10T01:02:03Z"), fetchImpl,
  });
  return { store, fetchImpl };
}

describe("AF15 exact-version S3 media deletion", () => {
  it("signs a tenant-scoped immutable-key DELETE and refuses redirects", async () => {
    const x = fixture();
    expect(await x.store.deleteExact(immutable)).toBe("deleted");
    const [url, init] = vi.mocked(x.fetchImpl).mock.calls[0]!;
    expect(String(url)).toBe("https://objects.example.test/masanawa-private/" + immutable.objectKey);
    expect(init!.method).toBe("DELETE");
    expect(init!.redirect).toBe("error");
    expect(String((init!.headers as Record<string, string>).authorization))
      .toMatch(/^AWS4-HMAC-SHA256 Credential=safeTestAccessKey\//u);
  });

  it("pins the exact provider VersionId and signs its encoded query", async () => {
    const x = fixture();
    const candidate = { ...immutable, objectVersion: "my/object+version=" };
    expect(await x.store.deleteExact(candidate)).toBe("deleted");
    const [url, init] = vi.mocked(x.fetchImpl).mock.calls[0]!;
    expect(String(url)).toContain("?versionId=my%2Fobject%2Bversion%3D");
    expect((init!.headers as Record<string, string>).authorization)
      .toMatch(/Signature=[0-9a-f]{64}$/u);
  });

  it("rejects unsafe identities and mutable keys before network access", async () => {
    const x = fixture();
    for (const c of [
      { ...immutable, tenantId: "tenant_other1234567" },
      { ...immutable, objectKey: "profiles/tenant_123456789012/mutable.webp" },
      { ...immutable, objectVersion: "../latest" },
    ]) {
      await expect(x.store.deleteExact(c)).rejects.toThrow(/invalid_object_identity/u);
    }
    expect(x.fetchImpl).not.toHaveBeenCalled();
  });

  it("acknowledges explicit version absence but quarantines ambiguous 404 and 5xx", async () => {
    expect(await fixture(404, "NoSuchVersion").store.deleteExact(immutable)).toBe("absent");
    await expect(fixture(404).store.deleteExact(immutable))
      .rejects.toThrow(/s3_delete_uncertain/u);
    await expect(fixture(503).store.deleteExact(immutable))
      .rejects.toThrow(/s3_delete_uncertain/u);
  });

  it("validates HTTPS storage origins without leaking secrets", () => {
    expect(() => createS3MediaCleanupDeleter({
      endpoint: "http://objects.example.test/", bucket: "masanawa-private",
      region: "ams3", accessKey: "safeTestAccessKey",
      secretKey: "do-not-use-production-secret-000000",
    })).toThrow(/invalid_s3_origin/u);
  });
});
