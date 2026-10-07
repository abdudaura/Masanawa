import type { TalkDiscoveryItem } from "../talks/model.js";

export interface TalkReplayHostView {
  readonly talkId: string;
  readonly recordingId: string;
  readonly recordingState: "recording" | "finalized" | "discarded";
  readonly publicationState: "not_ready" | "private" | "published" | "blocked";
  readonly publicationPreference: "publish" | "private";
  readonly segmentCount: number;
  readonly durationSeconds: number;
  readonly revision: number;
  readonly isPublic: boolean;
  readonly startedAt: string;
  readonly finalizedAt?: string;
  readonly publishedAt?: string;
}

export interface MyTalksView {
  readonly live: readonly TalkDiscoveryItem[];
  readonly replays: readonly TalkDiscoveryItem[];
}

export interface TalkReplayRepository {
  start(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    recordingId: string;
    hostRecordingConsent: boolean;
    publicationPreference: "publish" | "private";
    now: string;
  }>): Promise<TalkReplayHostView | null>;
  hostView(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
  }>): Promise<TalkReplayHostView | null>;
  hostAction(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    action: "publish" | "unpublish" | "discard";
    now: string;
  }>): Promise<TalkReplayHostView | null>;
  appendSegment(input: Readonly<{
    tenantId: string;
    talkId: string;
    segmentId: string;
    startedAt: string;
    endedAt: string;
    mediaRef: string;
    checksumSha256: string;
    now: string;
  }>): Promise<TalkReplayHostView | null>;
  finalizeFromLive(input: Readonly<{
    tenantId: string;
    talkId: string;
    reason: "host_ended" | "host_grace_expired" | "platform_ended";
    now: string;
  }>): Promise<TalkReplayHostView | null>;
  platformBlock(input: Readonly<{
    tenantId: string;
    talkId: string;
    now: string;
  }>): Promise<TalkReplayHostView | null>;
  myTalks(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    limit: number;
  }>): Promise<MyTalksView>;
}
