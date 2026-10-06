export type StoryPublicationState = "draft" | "published";
export type StoryReaction = "like" | "love" | "funny" | "thoughtful";

export interface StorySeries {
  readonly tenantId: string;
  readonly seriesId: string;
  readonly title: string;
  readonly description: string;
  readonly language: string;
  readonly audienceLabel: string | null;
  readonly artworkUrl: string | null;
  readonly state: StoryPublicationState;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryEpisode {
  readonly tenantId: string;
  readonly episodeId: string;
  readonly seriesId: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title: string;
  readonly description: string;
  readonly durationSeconds: number;
  readonly audioUrl: string;
  readonly artworkUrl: string | null;
  readonly state: StoryPublicationState;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StoryListeningProgress {
  readonly tenantId: string;
  readonly userId: string;
  readonly seriesId: string;
  readonly episodeId: string;
  readonly positionSeconds: number;
  readonly durationSeconds: number;
  readonly completed: boolean;
  readonly updatedAt: string;
}

export interface StoryReactionSummary {
  readonly counts: Readonly<Record<StoryReaction, number>>;
  readonly mine: StoryReaction | null;
}

export interface StoryRadioRepository {
  createSeries(input: Omit<StorySeries, "state" | "publishedAt" | "createdAt" | "updatedAt"> & {
    readonly createdAt: string;
  }): Promise<StorySeries>;
  updateSeries(input: Readonly<{
    tenantId: string;
    seriesId: string;
    title: string;
    description: string;
    language: string;
    audienceLabel: string | null;
    artworkUrl: string | null;
    updatedAt: string;
  }>): Promise<StorySeries | null>;
  setSeriesPublication(input: Readonly<{
    tenantId: string;
    seriesId: string;
    published: boolean;
    at: string;
  }>): Promise<StorySeries | null>;
  createEpisode(input: Omit<StoryEpisode, "state" | "publishedAt" | "createdAt" | "updatedAt"> & {
    readonly createdAt: string;
  }): Promise<StoryEpisode>;
  updateEpisode(input: Readonly<{
    tenantId: string;
    episodeId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    description: string;
    durationSeconds: number;
    audioUrl: string;
    artworkUrl: string | null;
    updatedAt: string;
  }>): Promise<StoryEpisode | null>;
  setEpisodePublication(input: Readonly<{
    tenantId: string;
    episodeId: string;
    published: boolean;
    at: string;
  }>): Promise<StoryEpisode | null>;
  listSeries(input: Readonly<{ tenantId: string }>): Promise<readonly StorySeries[]>;
  getSeries(input: Readonly<{ tenantId: string; seriesId: string }>): Promise<StorySeries | null>;
  listEpisodes(input: Readonly<{ tenantId: string; seriesId: string }>): Promise<readonly StoryEpisode[]>;
  listPublishedSeries(input: Readonly<{ tenantId: string }>): Promise<readonly StorySeries[]>;
  getPublishedSeries(input: Readonly<{ tenantId: string; seriesId: string }>): Promise<StorySeries | null>;
  listPublishedEpisodes(input: Readonly<{ tenantId: string; seriesId: string }>): Promise<readonly StoryEpisode[]>;
  getPublishedEpisode(input: Readonly<{ tenantId: string; episodeId: string }>): Promise<StoryEpisode | null>;
  getContinueProgress(input: Readonly<{ tenantId: string; userId: string }>): Promise<StoryListeningProgress | null>;
  saveProgress(input: StoryListeningProgress): Promise<StoryListeningProgress>;
  getReactionSummary(input: Readonly<{ tenantId: string; userId: string; episodeId: string }>): Promise<StoryReactionSummary>;
  setReaction(input: Readonly<{
    tenantId: string;
    userId: string;
    episodeId: string;
    reaction: StoryReaction;
    updatedAt: string;
  }>): Promise<StoryReactionSummary>;
}

export function assertStoryReaction(value: string): StoryReaction {
  if (value === "like" || value === "love" || value === "funny" || value === "thoughtful") return value;
  throw new TypeError("story_radio.reaction.invalid");
}

export function assertHttpsStoryUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new TypeError("story_radio.url.https_required");
  return value;
}
