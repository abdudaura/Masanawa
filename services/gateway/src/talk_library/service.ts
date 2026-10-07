import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  MyTalksView,
  TalkLibraryRepository,
  TalkSavedState,
} from "./model.js";

export interface TalkLibraryAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkLibraryError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkLibraryError";
  }
}

export interface TalkLibraryService {
  mine(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<MyTalksView>;

  saved(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<readonly import("../talks/model.js").TalkDiscoveryItem[]>;

  savedState(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkSavedState>;

  setSaved(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    saved: boolean;
  }>): Promise<TalkSavedState>;
}

function talkId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new TalkLibraryError("talks.library.talk_id_invalid", 400);
  }
  return normalized;
}

export function createTalkLibraryService(input: Readonly<{
  repository: TalkLibraryRepository;
  authorizer: TalkLibraryAuthorizer;
  now?: () => string;
  libraryLimit?: number;
}>): TalkLibraryService {
  const now = input.now ?? (() => new Date().toISOString());
  const libraryLimit = input.libraryLimit ?? 100;
  if (
    !Number.isSafeInteger(libraryLimit) ||
    libraryLimit < 1 ||
    libraryLimit > 500
  ) {
    throw new TypeError("Talk library limit must be between 1 and 500");
  }

  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  return Object.freeze({
    async mine(request) {
      const viewer = await identity(request.authorizationHeader);
      return input.repository.loadMine({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        limit: libraryLimit,
      });
    },

    async saved(request) {
      const viewer = await identity(request.authorizationHeader);
      return input.repository.loadSaved({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        limit: libraryLimit,
      });
    },

    async savedState(request) {
      const viewer = await identity(request.authorizationHeader);
      const state = await input.repository.savedState({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
      });
      if (!state) throw new TalkLibraryError("talks.not_found", 404);
      return state;
    },

    async setSaved(request) {
      const viewer = await identity(request.authorizationHeader);
      const state = await input.repository.setSaved({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        saved: request.saved,
        changedAt: now(),
      });
      if (!state) throw new TalkLibraryError("talks.not_found", 404);
      return state;
    },
  });
}
