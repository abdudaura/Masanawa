import { normalizeProfileAvatar } from "./normalizer.js";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
import type { AvatarObjectStore } from "./s3_store.js";
import type { PlatformSessionIdentity } from "@masanawa/security";

export interface ProfileAvatarRepository {
  current(owner: Readonly<{ tenantId: string; userId: string }>): Promise<
    Readonly<{ exists: boolean; url: string | null }>
  >;
  stage(input: Readonly<{
    tenantId: string; userId: string; key: string; url: string;
  }>): Promise<boolean>;
  attach(input: Readonly<{
    tenantId: string; userId: string; key: string; url: string;
    expectedUrl: string | null;
  }>): Promise<boolean>;
  remove(input: Readonly<{
    tenantId: string; userId: string; expectedUrl: string | null;
  }>): Promise<boolean>;
  claimGarbage(limit: number): Promise<readonly Readonly<{
    key: string; tenantId: string; userId: string;
  }>[]>;
  finalizeDeleted(key: string): Promise<void>;
  releaseFailedDeletion(key: string): Promise<void>;
}

export class AvatarMutationError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "AvatarMutationError";
  }
}

export function createProfileAvatarService(input: Readonly<{
  authorizer: {
    authorize(request: Readonly<{
      authorizationHeader: string | undefined;
    }>): Promise<PlatformSessionIdentity>;
  };
  repository: ProfileAvatarRepository;
  objects: AvatarObjectStore;
}>) {
  async function owner(authorizationHeader: string | undefined) {
    const identity = await input.authorizer.authorize({ authorizationHeader });
    return { tenantId: String(identity.tenantId), userId: String(identity.userId) };
  }
  async function assertCurrent(authorizationHeader: string | undefined, expected: Readonly<{ tenantId: string; userId: string }>) {
    const current = await owner(authorizationHeader);
    if (current.tenantId !== expected.tenantId || current.userId !== expected.userId) {
      throw new AvatarMutationError("profiles.avatar.session_changed", 401);
    }
  }
  return Object.freeze({
    async upload(request: Readonly<{
      authorizationHeader: string | undefined;
      png: Buffer;
      expectedUrl: string | null;
    }>): Promise<{ avatarUrl: string }> {
      const who = await owner(request.authorizationHeader);
      if (!Buffer.isBuffer(request.png) || request.png.length < 8 ||
          !request.png.subarray(0, 8).equals(pngSignature)) {
        throw new AvatarMutationError('profiles.avatar.png_required', 415);
      }
      const normalized = await normalizeProfileAvatar(request.png);
      await assertCurrent(request.authorizationHeader, who);
      const profile = await input.repository.current(who);
      await assertCurrent(request.authorizationHeader, who);
      if (!profile.exists) throw new AvatarMutationError("profiles.not_found", 404);
      if (profile.url !== request.expectedUrl) {
        throw new AvatarMutationError("profiles.avatar.changed_elsewhere", 409);
      }
      const url = input.objects.urlFor(who, normalized.sha256);
      if (profile.url === url) return { avatarUrl: url };

      // The merged S3 adapter uses stable owner-scoped SHA256 WebP paths.
      // Record a recoverable staged object BEFORE external storage writes.
      const key = new URL(url).pathname.slice(1);
      if (!key.startsWith("profiles/") ||
          !key.endsWith("/sha256-" + normalized.sha256 + ".webp")) {
        throw new AvatarMutationError("profiles.avatar.invalid_storage_key", 500);
      }
      const staged = await input.repository.stage({ ...who, key, url });
      if (!staged) {
        // An object already active, being deleted, or owned under conflicting
        // metadata is not a writable stage. Do not race S3 garbage collection.
        throw new AvatarMutationError("profiles.avatar.stage_conflict", 409);
      }
      await assertCurrent(request.authorizationHeader, who);
      const stored = await input.objects.put(who, normalized);
      await assertCurrent(request.authorizationHeader, who);
      if (stored.key !== key || stored.url !== url ||
          stored.sha256 !== normalized.sha256) {
        throw new AvatarMutationError("profiles.avatar.storage_mismatch", 503);
      }
      const accepted = await input.repository.attach({
        ...who, key, url, expectedUrl: profile.url,
      });
      // A lost acknowledgement does not undo an already committed attachment.
      await assertCurrent(request.authorizationHeader, who);
      if (!accepted) {
        throw new AvatarMutationError("profiles.avatar.changed_elsewhere", 409);
      }
      return { avatarUrl: url };
    },
    async remove(request: Readonly<{
      authorizationHeader: string | undefined;
      expectedUrl: string | null;
    }>): Promise<{ avatarUrl: null }> {
      const who = await owner(request.authorizationHeader);
      await assertCurrent(request.authorizationHeader, who);
      const profile = await input.repository.current(who);
      await assertCurrent(request.authorizationHeader, who);
      if (!profile.exists) throw new AvatarMutationError("profiles.not_found", 404);
      if (profile.url !== request.expectedUrl) {
        throw new AvatarMutationError("profiles.avatar.changed_elsewhere", 409);
      }
      if (profile.url !== null) {
        const removed = await input.repository.remove({
          ...who, expectedUrl: profile.url,
        });
        await assertCurrent(request.authorizationHeader, who);
        if (!removed) {
          throw new AvatarMutationError("profiles.avatar.changed_elsewhere", 409);
        }
      }
      return { avatarUrl: null };
    },
    async collectGarbage(limit = 20): Promise<{
      deleted: number; failed: number;
    }> {
      const queued = await input.repository.claimGarbage(limit);
      let deleted = 0;
      let failed = 0;
      for (const row of queued) {
        try {
          const match = /^profiles\/[^/]+\/[^/]+\/sha256-([a-f0-9]{64})\.webp$/u.exec(row.key);
          if (!match || !row.key.startsWith(
              "profiles/" + row.tenantId + "/" + row.userId + "/")) {
            throw new Error("profiles.avatar.invalid_queued_key");
          }
          await input.objects.delete({
            tenantId: row.tenantId, userId: row.userId,
          }, match[1]!);
          await input.repository.finalizeDeleted(row.key);
          deleted++;
        } catch {
          failed++;
          // Durable timed leases survive a crash, failed S3 DELETE or DB write.
          await input.repository.releaseFailedDeletion(row.key);
        }
      }
      return { deleted, failed };
    },
  });
}
