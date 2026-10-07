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
  follow(input: Readonly<{
    authorizationHeader: string | undefined;
    handle: string;
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

  return Object.freeze({
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

    async follow(request) {
      const viewer = await identity(request.authorizationHeader);
      const profile = await input.repository.setFollowing({
        tenantId: viewer.tenantId,
        viewerUserId: viewer.userId,
        handle: normalizeHandle(request.handle),
        following: request.following,
        changedAt: now(),
      });
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
