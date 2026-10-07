import type { TalkDiscoveryItem } from "../talks/model.js";

export interface TalkDraftPreview {
  readonly id: string;
  readonly topic: string;
  readonly title: string;
  readonly updatedAt: string;
}

export type OwnedTalkDiscoveryItem = TalkDiscoveryItem &
  Readonly<{ viewerIsHost: true }>;

export interface MyTalksView {
  readonly live: readonly OwnedTalkDiscoveryItem[];
  readonly replays: readonly OwnedTalkDiscoveryItem[];
  readonly drafts: readonly TalkDraftPreview[];
}

export interface TalkSavedState {
  readonly saved: boolean;
}

export interface TalkLibraryRepository {
  loadMine(input: Readonly<{
    tenantId: string;
    userId: string;
    limit: number;
  }>): Promise<MyTalksView>;

  loadSaved(input: Readonly<{
    tenantId: string;
    userId: string;
    limit: number;
  }>): Promise<readonly TalkDiscoveryItem[]>;

  savedState(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
  }>): Promise<TalkSavedState | null>;

  setSaved(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    saved: boolean;
    changedAt: string;
  }>): Promise<TalkSavedState | null>;
}
