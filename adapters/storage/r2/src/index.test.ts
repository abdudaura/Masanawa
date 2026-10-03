import { describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { createR2PrivateMediaStorage } from "./index.js";
function fixture() {
  const at = toInstant("2026-10-03T10:00:00Z"), tenantId = createCanonicalId("tenant"), relationshipId = createCanonicalId("relationship");
  const authority = createAuthorityContext({ tenantId, principal: { kind: "user", userId: createCanonicalId("user") },
    capabilities: ["storage.media.upload", "storage.media.read"], scopes: [], resourceScope: { relationshipIds: [relationshipId] },
    policyRevision: "policy-1", issuedAt: at, approvalIds: [], delegationChain: [], requestId: "request", correlationId: "correlation" });
  const input = { authority, resource: { tenantId, relationshipId, mediaArtifactId: createCanonicalId("media-artifact") }, expiresInSeconds: 60,
    mimeType: "image/jpeg", byteLength: 1234 };
  const config = { accountId: "a".repeat(32), bucket: "masanawa-private-media", accessKeyId: "A".repeat(32), secretAccessKey: "B".repeat(64),
    now: () => at, currentAuthority: { async getPolicyRevision() { return "policy-1"; }, async isRevoked() { return false; } } };
  return { input, config };
}
describe("R2 private media transfer signing", () => {
  it("signs scoped opaque object, MIME, byte length, expiry and method without exposing secret key", async () => {
    const f = fixture(), grant = await createR2PrivateMediaStorage(f.config).grantUpload(f.input);
    const url = new URL(grant.url);
    expect(url.hostname).toBe(`${f.config.accountId}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe(`/masanawa-private-media/${f.input.resource.tenantId}/${f.input.resource.relationshipId}/${f.input.resource.mediaArtifactId}`);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request");
    expect(grant.headers).toEqual({ "content-type": "image/jpeg", "content-length": "1234" });
    expect(grant.url).not.toContain(f.config.secretAccessKey);
    expect(grant.expiresAt).toBe(toInstant("2026-10-03T10:01:00Z"));
    expect(Object.isFrozen(grant.headers)).toBe(true);
  });
  it("grants bounded private download using the same owner-scoped object", async () => {
    const f = fixture(), storage = createR2PrivateMediaStorage(f.config);
    const upload = await storage.grantUpload(f.input), download = await storage.grantDownload(f.input);
    expect(download.method).toBe("GET");
    expect(download.objectKey).toBe(upload.objectKey);
    expect(download.headers).toEqual({});
    expect(download.url).not.toEqual(upload.url);
  });
  it("denies cross-Tenant, cross-Relationship and missing capability", async () => {
    const f = fixture(), storage = createR2PrivateMediaStorage(f.config);
    for (const input of [
      { ...f.input, resource: { ...f.input.resource, tenantId: createCanonicalId("tenant") } },
      { ...f.input, resource: { ...f.input.resource, relationshipId: createCanonicalId("relationship") } },
      { ...f.input, authority: { ...f.input.authority, capabilities: [] } },
    ]) await expect(storage.grantUpload(input)).rejects.toMatchObject({ code: "storage.media_access_denied" });
  });
  it("denies expired and stale/revoked authority and delegated parent revocation", async () => {
    const f = fixture();
    await expect(createR2PrivateMediaStorage(f.config).grantUpload({ ...f.input,
      authority: { ...f.input.authority, expiresAt: toInstant("2026-10-03T10:00:30Z") } })).rejects.toThrow();
    await expect(createR2PrivateMediaStorage({ ...f.config, currentAuthority: { async getPolicyRevision() { return "policy-2"; } } }).grantUpload(f.input)).rejects.toMatchObject({ code: "authority.stale_policy" });
    const parent = createCanonicalId("authority-context");
    await expect(createR2PrivateMediaStorage({ ...f.config, currentAuthority: { ...f.config.currentAuthority,
      async isRevoked(context) { return context.authorityContextId === parent; } } }).grantUpload({ ...f.input,
      authority: { ...f.input.authority, delegationChain: [parent] } })).rejects.toThrow();
  });
  it("rechecks authority after asynchronous signing", async () => {
    const f = fixture(); let calls = 0;
    await expect(createR2PrivateMediaStorage({ ...f.config, currentAuthority: { ...f.config.currentAuthority,
      async isRevoked() { return ++calls > 1; } } }).grantUpload(f.input)).rejects.toMatchObject({ code: "authority.revoked" });
  });
  it("rejects path injection, invalid uploads and excessive grant durations", async () => {
    const f = fixture(), storage = createR2PrivateMediaStorage(f.config);
    for (const value of [0, 301, NaN, 1.5]) await expect(storage.grantUpload({ ...f.input, expiresInSeconds: value })).rejects.toThrow();
    for (const byteLength of [0, 12 * 1024 * 1024 + 1, Infinity]) await expect(storage.grantUpload({ ...f.input, byteLength })).rejects.toThrow();
    await expect(storage.grantUpload({ ...f.input, mimeType: "text/html" })).rejects.toThrow();
    await expect(storage.grantUpload({ ...f.input, resource: { ...f.input.resource, mediaArtifactId: "../../private" as never } })).rejects.toThrow();
    expect(() => createR2PrivateMediaStorage({ ...f.config, accountId: "evil.example/" })).toThrow();
  });
});
