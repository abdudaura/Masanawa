import type { PlatformSessionIdentity } from "@masanawa/security";
import {
  toTalkDiscoveryItem,
  type TalkDiscoveryItem,
} from "../talks/model.js";
import type {
  MyTalksView,
  OwnedTalkDiscoveryItem,
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
  myTalks(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<MyTalksView>;

  savedTalks(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<readonly TalkDiscoveryItem[]>;

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

function normalizeTalkId(value: string): string {
  const talkId = value.trim();
  if (!talkId || talkId.length > 160) {
    throw new TalkLibraryError("talks.library.talk_id_invalid", 400);
  }
  return talkId;
}

function owned(
  row: Parameters<typeof toTalkDiscoveryItem>[0],
): OwnedTalkDiscoveryItem {
  return Object.freeze({
    ...toTalkDiscoveryItem(row),
    isLive: row.talk.state === "live" || row.talk.state === "reconnecting",
    viewerIsHost: true as const,
  });
}

export function createTalkLibraryService(input: Readonly<{
  repository: TalkLibraryRepository;
  authorizer: TalkLibraryAuthorizer;
  now?: () => string;
}>): TalkLibraryService {
  const now = input.now ?? (() => new Date().toISOString());

  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  return Object.freeze<TalkLibraryService>({
    async myTalks(request) {
      const viewer = await identity(request.authorizationHeader);
      const rows = await input.repository.listOwned({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        limit: 100,
      });

      const live: OwnedTalkDiscoveryItem[] = [];
      const replays: OwnedTalkDiscoveryItem[] = [];
      for (const row of rows) {
        const item = owned(row);
        if (row.talk.state === "live" || row.talk.state === "reconnecting") {
          live.push(item);
        } else if (row.talk.state === "ended") {
          replays.push(item);
        }
      }

      return Object.freeze({
        live: Object.freeze(live),
        replays: Object.freeze(replays),
        drafts: Object.freeze([]),
      });
    },

    async savedTalks(request) {
      const viewer = await identity(request.authorizationHeader);
      const rows = await input.repository.listSaved({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        limit: 100,
      });
      return Object.freeze(rows.map(toTalkDiscoveryItem));
    },

    async savedState(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = normalizeTalkId(request.talkId);
      const saved = await input.repository.readSaved({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId,
      });
      if (saved === null) {
        throw new TalkLibraryError("talks.not_found", 404);
      }
      return Object.freeze({ talkId, saved });
    },

    async setSaved(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = normalizeTalkId(request.talkId);
      const saved = await input.repository.setSaved({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId,
        saved: request.saved,
        changedAt: now(),
      });
      if (saved === null) {
        throw new TalkLibraryError("talks.not_found", 404);
      }
      return Object.freeze({ talkId, saved });
    },
  });
}
