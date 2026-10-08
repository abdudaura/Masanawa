import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  HumanProfileRecord,
  HumanProfileView,
  PersonaProfileRecord,
  PersonaProfileView,
  TalkProfileRepository,
} from "./model.js";

export interface TalkProfileAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkProfileError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkProfileError";
  }
}

export interface TalkProfileService {
  human(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
  }>): Promise<HumanProfileView>;
  humanByUserId(input: Readonly<{
    authorizationHeader: string | undefined;
    userId: string;
  }>): Promise<HumanProfileView>;
  saveSelf(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
    displayName: string;
    bio: string;
  }>): Promise<HumanProfileView>;
  follow(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
    following: boolean;
  }>): Promise<HumanProfileView>;
  followUser(input: Readonly<{
    authorizationHeader: string | undefined;
    userId: string;
    following: boolean;
  }>): Promise<HumanProfileView>;
  persona(input: Readonly<{
    authorizationHeader: string | undefined;
    publicId: string;
  }>): Promise<PersonaProfileView>;
}

function normalizeHandle(handle: string): string {
  const value = handle.trim().toLowerCase().replace(/^@/u, "");
  if (!/^[a-z0-9_][a-z0-9_.-]{1,39}$/u.test(value)) {
    throw new TalkProfileError("profiles.handle_invalid", 400);
  }
  return value;
}

function normalizeUserId(userId: string): string {
  const value = userId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$/u.test(value)) {
    throw new TalkProfileError("profiles.user_id_invalid", 400);
  }
  return value;
}

function normalizePublicId(publicId: string): string {
  const value = publicId.trim();
  if (!value || value.length > 160) throw new TalkProfileError("personas.public_id_invalid", 400);
  return value;
}

export function createTalkProfileService(input: Readonly<{
  repository: TalkProfileRepository;
  authorizer: TalkProfileAuthorizer;
  now?: () => string;
}>): TalkProfileService {
  const now = input.now ?? (() => new Date().toISOString());

  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  return Object.freeze<TalkProfileService>({
    async human(request) {
      const viewer = await identity(request.authorizationHeader);
      const profile = await input.repository.readHuman({
        tenantId: viewer.tenantId,
        viewerUserId: viewer.userId,
        handle: normalizeHandle(request.handle),
      });
      if (!profile) throw new TalkProfileError("profiles.not_found", 404);
      return profile;
    },

    async humanByUserId(request) {
      const viewer = await identity(request.authorizationHeader);
      const profile = await input.repository.readHumanByUserId({
        tenantId: viewer.tenantId,
        viewerUserId: viewer.userId,
        userId: normalizeUserId(request.userId),
      });
      if (!profile) throw new TalkProfileError("profiles.not_found", 404);
      return profile;
    },

    async saveSelf(request) {
      const viewer = await identity(request.authorizationHeader);
      const handle = normalizeHandle(request.handle);
      const displayName = request.displayName.trim();
      const bio = request.bio.trim();
      if (!displayName || displayName.length > 160 ||
          /[\\u0000-\\u001F\\u007F]/u.test(displayName)) {
        throw new TalkProfileError("profiles.display_name_invalid", 400);
      }
      if (bio.length > 1000 ||
          /[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/u.test(bio)) {
        throw new TalkProfileError("profiles.bio_invalid", 400);
      }
      try {
        return await input.repository.saveSelf({
          tenantId: viewer.tenantId,
          userId: viewer.userId,
          handle,
          displayName,
          bio,
        });
      } catch (error) {
        // PostgreSQL unique_violation is the final arbiter of handle ownership,
        // including simultaneous requests. Do not pre-check and race.
        if (typeof error === "object" && error !== null &&
            "code" in error && error.code === "23505") {
          throw new TalkProfileError("profiles.handle_taken", 409);
        }
        throw error;
      }
    },

    async follow(request) {
      const viewer = await identity(request.authorizationHeader);
      let profile: HumanProfileView | null;
      try {
        profile = await input.repository.setFollowing({
          tenantId: viewer.tenantId,
          viewerUserId: viewer.userId,
          handle: normalizeHandle(request.handle),
          following: request.following,
          changedAt: now(),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "profiles.cannot_follow_self") {
          throw new TalkProfileError("profiles.cannot_follow_self", 409);
        }
        throw error;
      }
      if (!profile) throw new TalkProfileError("profiles.not_found", 404);
      return profile;
    },

    async followUser(request) {
      const viewer = await identity(request.authorizationHeader);
      let profile: HumanProfileView | null;
      try {
        profile = await input.repository.setFollowingByUserId({
          tenantId: viewer.tenantId,
          viewerUserId: viewer.userId,
          userId: normalizeUserId(request.userId),
          following: request.following,
          changedAt: now(),
        });
      } catch (error) {
        if (error instanceof Error && error.message === "profiles.cannot_follow_self") {
          throw new TalkProfileError("profiles.cannot_follow_self", 409);
        }
        throw error;
      }
      if (!profile) throw new TalkProfileError("profiles.not_found", 404);
      return profile;
    },

    async persona(request) {
      const viewer = await identity(request.authorizationHeader);
      const profile = await input.repository.readPersona({
        tenantId: viewer.tenantId,
        viewerUserId: viewer.userId,
        publicId: normalizePublicId(request.publicId),
      });
      if (!profile) throw new TalkProfileError("personas.not_found", 404);
      return profile;
    },
  });
}

export type { HumanProfileRecord, PersonaProfileRecord };
