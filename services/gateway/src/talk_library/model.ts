import type { TalkDiscoveryItem, TalkRecord } from "../talks/model.js";

export type TalkLibraryRow = Readonly<{
  talk: TalkRecord;
  commentCount: number;
}>;

export type OwnedTalkDiscoveryItem = TalkDiscoveryItem &
  Readonly<{ viewerIsHost: true }>;

export interface MyTalksView {
  readonly live: readonly OwnedTalkDiscoveryItem[];
  readonly replays: readonly OwnedTalkDiscoveryItem[];
  readonly drafts: readonly [];
}

export interface TalkSavedState {
  readonly talkId: string;
  readonly saved: boolean;
}

export interface TalkLibraryRepository {
  listOwned(input: Readonly<{
    tenantId: string;
    userId: string;
    limit: number;
  }>): Promise<readonly TalkLibraryRow[]>;

  listSaved(input: Readonly<{
    tenantId: string;
    userId: string;
    limit: number;
  }>): Promise<readonly TalkLibraryRow[]>;

  readSaved(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
  }>): Promise<boolean | null>;

  setSaved(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    saved: boolean;
    changedAt: string;
  }>): Promise<boolean | null>;
}
