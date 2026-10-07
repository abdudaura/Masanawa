import type { TalkReplaySession } from "@masanawa/agents";

export type TalkReplayProviderStatus =
  | "requested"
  | "starting"
  | "active"
  | "ending"
  | "complete"
  | "failed"
  | "aborted"
  | "limit_reached";

export interface TalkReplayRecord {
  readonly tenantId: string;
  readonly talkId: string;
  readonly recordingId: string;
  readonly hostUserId: string;
  readonly session: TalkReplaySession;
  readonly egressId: string | null;
  readonly objectKey: string;
  readonly providerStatus: TalkReplayProviderStatus;
  readonly providerError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TalkReplayView {
  readonly talkId: string;
  readonly status:
    | "recording"
    | "processing"
    | "private"
    | "published"
    | "blocked"
    | "unavailable";
  readonly published: boolean;
  readonly durationSeconds?: number;
  readonly playbackUrl?: string;
  readonly playbackExpiresAt?: string;
}

export interface TalkReplayRepository {
  prepare(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    publicationPreference: "publish" | "private";
    now: string;
  }>): Promise<TalkReplayRecord>;
  attachEgress(input: Readonly<{
    tenantId: string;
    talkId: string;
    egressId: string;
    providerStatus: TalkReplayProviderStatus;
    now: string;
  }>): Promise<TalkReplayRecord>;
  markProvider(input: Readonly<{
    tenantId: string;
    talkId: string;
    providerStatus: TalkReplayProviderStatus;
    providerError?: string;
    now: string;
  }>): Promise<TalkReplayRecord | null>;
  read(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<TalkReplayRecord | null>;
  finalizeSuccess(input: Readonly<{
    tenantId: string;
    talkId: string;
    startedAt: string;
    endedAt: string;
    checksumSha256: string;
    now: string;
  }>): Promise<TalkReplayRecord>;
  finalizeFailure(input: Readonly<{
    tenantId: string;
    talkId: string;
    providerStatus: "failed" | "aborted" | "limit_reached";
    providerError?: string;
    now: string;
  }>): Promise<TalkReplayRecord>;
  setPublished(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    published: boolean;
    now: string;
  }>): Promise<TalkReplayRecord>;
}
