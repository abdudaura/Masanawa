import { createHash, randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import { sanitizeAvatarPng } from "./png.js";
import type { AvatarObjectStore } from "./s3_store.js";

export interface ProfileAvatarRepository {
  current(owner: Readonly<{ tenantId: string; userId: string }>): Promise<
    Readonly<{ exists: boolean; url: string | null }>
  >;
  stage(input: Readonly<{
    tenantId: string; userId: string; key: string; url: string;
  }>): Promise<void>;
  attach(input: Readonly<{
    tenantId: string; userId: string; key: string; url: string;
    expectedUrl: string | null;
  }>): Promise<boolean>;
  remove(input: Readonly<{
    tenantId: string; userId: string; expectedUrl: string | null;
  }>): Promise<boolean>;
  claimGarbage(limit: number): Promise<readonly string[]>;
  finalizeDeleted(key: string): Promise<void>;
  releaseFailedDeletion(key: string): Promise<void>;
}

export class ProfileAvatarError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "ProfileAvatarError";
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
  makeId?: () => string;
}>) {
  const makeId = input.makeId ?? randomUUID;
  async function owner(authorizationHeader: string | undefined) {
    const identity = await input.authorizer.authorize({ authorizationHeader });
    return { tenantId: String(identity.tenantId), userId: String(identity.userId) };
  }
  return Object.freeze({
    async upload(request: Readonly<{
      authorizationHeader: string | undefined;
      png: Buffer;
      expectedUrl: string | null;
    }>): Promise<{ avatarUrl: string }> {
      const who = await owner(request.authorizationHeader);
      let validated;
      try {
        validated = sanitizeAvatarPng(request.png);
      } catch {
        throw new ProfileAvatarError("profiles.avatar.invalid_png", 422);
      }
      const profile = await input.repository.current(who);
      if (!profile.exists) throw new ProfileAvatarError("profiles.not_found", 404);
      if (profile.url !== request.expectedUrl) {
        throw new ProfileAvatarError("profiles.avatar.changed_elsewhere", 409);
      }
      const h = (part: string) => createHash("sha256").update(part).digest("hex");
      const key = "profile-avatars/" + h(who.tenantId) + "/" +
        h(who.userId) + "/" + makeId() + ".png";
      // Persist an orphan-recovery record BEFORE uploading to object storage.
      const url = input.objects.publicUrl(key);
      await input.repository.stage({ ...who, key, url });
      await input.objects.put(key, validated.png);
      const accepted = await input.repository.attach({
        ...who, key, url, expectedUrl: profile.url,
      });
      if (!accepted) {
        // Uploaded bytes stay journaled for the garbage collector.
        throw new ProfileAvatarError("profiles.avatar.changed_elsewhere", 409);
      }
      return { avatarUrl: url };
    },
    async remove(request: Readonly<{
      authorizationHeader: string | undefined;
      expectedUrl: string | null;
    }>): Promise<{ avatarUrl: null }> {
      const who = await owner(request.authorizationHeader);
      const profile = await input.repository.current(who);
      if (!profile.exists) throw new ProfileAvatarError("profiles.not_found", 404);
      if (profile.url !== request.expectedUrl) {
        throw new ProfileAvatarError("profiles.avatar.changed_elsewhere", 409);
      }
      if (profile.url !== null) {
        const removed = await input.repository.remove({
          ...who, expectedUrl: profile.url,
        });
        if (!removed) {
          throw new ProfileAvatarError("profiles.avatar.changed_elsewhere", 409);
        }
      }
      return { avatarUrl: null };
    },
    async collectGarbage(limit = 20): Promise<{
      deleted: number; failed: number;
    }> {
      const keys = await input.repository.claimGarbage(limit);
      let deleted = 0;
      let failed = 0;
      for (const key of keys) {
        try {
          await input.objects.delete(key);
          await input.repository.finalizeDeleted(key);
          deleted++;
        } catch {
          failed++;
          // A crash while deleting is recovered from the durable deleting lease.
          await input.repository.releaseFailedDeletion(key);
        }
      }
      return { deleted, failed };
    },
  });
}
