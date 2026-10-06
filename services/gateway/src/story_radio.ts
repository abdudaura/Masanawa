import { randomUUID } from "node:crypto";
import {
  assertHttpsStoryUrl,
  assertStoryReaction,
  type StoryEpisode,
  type StoryRadioRepository,
  type StoryReaction,
  type StorySeries,
} from "@masanawa/content";
import type { PlatformCustomerSessionAuthorizer } from "./customer_auth.js";

export class StoryRadioError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "StoryRadioError";
  }
}

export interface StoryRadioService {
  home(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<unknown>;
  series(input: Readonly<{ authorizationHeader: string | undefined; seriesId: string }>): Promise<unknown>;
  saveProgress(input: Readonly<{
    authorizationHeader: string | undefined;
    seriesId: string;
    episodeId: string;
    positionSeconds: number;
    durationSeconds: number;
    completed: boolean;
  }>): Promise<unknown>;
  reactions(input: Readonly<{
    authorizationHeader: string | undefined;
    episodeId: string;
  }>): Promise<unknown>;
  react(input: Readonly<{
    authorizationHeader: string | undefined;
    episodeId: string;
    reaction: string;
  }>): Promise<unknown>;
  adminList(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<unknown>;
  adminCreateSeries(input: Readonly<{
    authorizationHeader: string | undefined;
    title: string;
    description: string;
    language: string;
    audienceLabel?: string | null;
    artworkUrl?: string | null;
  }>): Promise<unknown>;
  adminUpdateSeries(input: Readonly<{
    authorizationHeader: string | undefined;
    seriesId: string;
    title: string;
    description: string;
    language: string;
    audienceLabel?: string | null;
    artworkUrl?: string | null;
  }>): Promise<unknown>;
  adminSetSeriesPublication(input: Readonly<{
    authorizationHeader: string | undefined;
    seriesId: string;
    published: boolean;
  }>): Promise<unknown>;
  adminCreateEpisode(input: Readonly<{
    authorizationHeader: string | undefined;
    seriesId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    description: string;
    durationSeconds: number;
    audioUrl: string;
    artworkUrl?: string | null;
  }>): Promise<unknown>;
  adminUpdateEpisode(input: Readonly<{
    authorizationHeader: string | undefined;
    episodeId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    description: string;
    durationSeconds: number;
    audioUrl: string;
    artworkUrl?: string | null;
  }>): Promise<unknown>;
  adminSetEpisodePublication(input: Readonly<{
    authorizationHeader: string | undefined;
    episodeId: string;
    published: boolean;
  }>): Promise<unknown>;
}

function text(value: string, field: string, max: number, allowEmpty = false): string {
  const v = value.trim();
  if ((!allowEmpty && !v) || v.length > max) {
    throw new StoryRadioError("story_radio." + field + ".invalid", 400);
  }
  return v;
}

function positiveInt(value: number, field: string, max = 100000): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new StoryRadioError("story_radio." + field + ".invalid", 400);
  }
  return value;
}

function optionalText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length > max) throw new StoryRadioError("story_radio.value.invalid", 400);
  return v;
}

function optionalHttps(value: string | null | undefined): string | null {
  const v = optionalText(value, 2048);
  if (v === null) return null;
  try {
    return assertHttpsStoryUrl(v);
  } catch {
    throw new StoryRadioError("story_radio.url.invalid", 400);
  }
}

function episodeView(
  item: StoryEpisode,
  nextEpisodeId: string | null,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: item.episodeId,
    seriesId: item.seriesId,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    title: item.title,
    description: item.description,
    durationSeconds: item.durationSeconds,
    audioUrl: item.audioUrl,
    artworkUrl: item.artworkUrl,
    publishedAt: item.publishedAt,
    nextEpisodeId,
  });
}

function seriesCard(item: StorySeries, episodeCount: number) {
  return Object.freeze({
    id: item.seriesId,
    title: item.title,
    language: item.language,
    description: item.description,
    audienceLabel: item.audienceLabel,
    artworkUrl: item.artworkUrl,
    episodeCount,
  });
}

function progressView(item: Awaited<ReturnType<StoryRadioRepository["getContinueProgress"]>>) {
  if (!item) return null;
  return Object.freeze({
    seriesId: item.seriesId,
    episodeId: item.episodeId,
    positionSeconds: item.positionSeconds,
    durationSeconds: item.durationSeconds,
    completed: item.completed,
    updatedAt: item.updatedAt,
  });
}

export function createStoryRadioService(input: Readonly<{
  repository: StoryRadioRepository;
  sessions: PlatformCustomerSessionAuthorizer;
  adminUserIds?: ReadonlySet<string>;
  now?: () => string;
}>): StoryRadioService {
  const now = input.now ?? (() => new Date().toISOString());
  const admins = input.adminUserIds ?? new Set<string>();

  async function customer(header: string | undefined) {
    return input.sessions.authorize({ authorizationHeader: header });
  }

  async function admin(header: string | undefined) {
    const identity = await customer(header);
    if (!admins.has(String(identity.userId))) {
      throw new StoryRadioError("story_radio.admin.forbidden", 403);
    }
    return identity;
  }

  async function publishedEpisodes(tenantId: string, seriesId: string) {
    return input.repository.listPublishedEpisodes({ tenantId, seriesId });
  }

  async function customerEpisodeOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "story_radio.episode.unavailable"
      ) {
        throw new StoryRadioError("story_radio.episode.unavailable", 404);
      }
      throw error;
    }
  }

  async function adminView(tenantId: string, s: StorySeries) {
    const episodes = await input.repository.listEpisodes({
      tenantId,
      seriesId: s.seriesId,
    });
    return Object.freeze({
      ...s,
      episodes,
    });
  }

  return Object.freeze<StoryRadioService>({
    async home(request) {
      const identity = await customer(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      const items = await input.repository.listPublishedSeries({ tenantId });
      const cards = [];
      for (const item of items) {
        const episodes = await publishedEpisodes(tenantId, item.seriesId);
        cards.push(seriesCard(item, episodes.length));
      }
      const progress = await input.repository.getContinueProgress({
        tenantId,
        userId: String(identity.userId),
      });
      let continuation = progressView(progress);
      if (progress?.completed) {
        const episodes = await publishedEpisodes(tenantId, progress.seriesId);
        const index = episodes.findIndex(
          (episode) => episode.episodeId === progress.episodeId,
        );
        const next = index >= 0 ? episodes[index + 1] : undefined;
        continuation = next
          ? Object.freeze({
              seriesId: next.seriesId,
              episodeId: next.episodeId,
              positionSeconds: 0,
              durationSeconds: next.durationSeconds,
              completed: false,
              updatedAt: progress.updatedAt,
            })
          : null;
      }
      return Object.freeze({
        featured: cards[0] ?? null,
        series: Object.freeze(cards),
        continueProgress: continuation,
      });
    },

    async series(request) {
      const identity = await customer(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      const seriesId = text(request.seriesId, "series_id", 128);
      const s = await input.repository.getPublishedSeries({ tenantId, seriesId });
      if (!s) throw new StoryRadioError("story_radio.series.not_found", 404);
      const episodes = await publishedEpisodes(tenantId, seriesId);
      return Object.freeze({
        id: s.seriesId,
        title: s.title,
        language: s.language,
        description: s.description,
        artworkUrl: s.artworkUrl,
        audienceLabel: s.audienceLabel,
        episodes: Object.freeze(
          episodes.map((item, index) =>
            episodeView(item, episodes[index + 1]?.episodeId ?? null),
          ),
        ),
      });
    },

    async saveProgress(request) {
      const identity = await customer(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      const seriesId = text(request.seriesId, "series_id", 128);
      const episodeId = text(request.episodeId, "episode_id", 128);
      positiveInt(request.durationSeconds, "duration_seconds", 86400);
      if (
        !Number.isSafeInteger(request.positionSeconds) ||
        request.positionSeconds < 0 ||
        request.positionSeconds > request.durationSeconds
      ) {
        throw new StoryRadioError("story_radio.progress.invalid", 400);
      }
      const saved = await customerEpisodeOperation(() =>
        input.repository.saveProgress({
          tenantId,
          userId: String(identity.userId),
          seriesId,
          episodeId,
          positionSeconds: request.positionSeconds,
          durationSeconds: request.durationSeconds,
          completed: request.completed,
          updatedAt: now(),
        }),
      );
      return progressView(saved);
    },

    async reactions(request) {
      const identity = await customer(request.authorizationHeader);
      return customerEpisodeOperation(() =>
        input.repository.getReactionSummary({
          tenantId: String(identity.tenantId),
          userId: String(identity.userId),
          episodeId: text(request.episodeId, "episode_id", 128),
        }),
      );
    },

    async react(request) {
      const identity = await customer(request.authorizationHeader);
      let reaction: StoryReaction;
      try {
        reaction = assertStoryReaction(request.reaction);
      } catch {
        throw new StoryRadioError("story_radio.reaction.invalid", 400);
      }
      return customerEpisodeOperation(() =>
        input.repository.setReaction({
          tenantId: String(identity.tenantId),
          userId: String(identity.userId),
          episodeId: text(request.episodeId, "episode_id", 128),
          reaction,
          updatedAt: now(),
        }),
      );
    },

    async adminList(request) {
      const identity = await admin(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      const list = await input.repository.listSeries({ tenantId });
      return Object.freeze({
        series: Object.freeze(
          await Promise.all(list.map((item) => adminView(tenantId, item))),
        ),
      });
    },

    async adminCreateSeries(request) {
      const identity = await admin(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      return input.repository.createSeries({
        tenantId,
        seriesId: "story_series_" + randomUUID(),
        title: text(request.title, "title", 200),
        description: text(request.description, "description", 4000, true),
        language: text(request.language, "language", 64),
        audienceLabel: optionalText(request.audienceLabel, 100),
        artworkUrl: optionalHttps(request.artworkUrl),
        createdAt: now(),
      });
    },

    async adminUpdateSeries(request) {
      const identity = await admin(request.authorizationHeader);
      const updated = await input.repository.updateSeries({
        tenantId: String(identity.tenantId),
        seriesId: text(request.seriesId, "series_id", 128),
        title: text(request.title, "title", 200),
        description: text(request.description, "description", 4000, true),
        language: text(request.language, "language", 64),
        audienceLabel: optionalText(request.audienceLabel, 100),
        artworkUrl: optionalHttps(request.artworkUrl),
        updatedAt: now(),
      });
      if (!updated) throw new StoryRadioError("story_radio.series.not_found", 404);
      return updated;
    },

    async adminSetSeriesPublication(request) {
      const identity = await admin(request.authorizationHeader);
      let updated: StorySeries | null;
      try {
        updated = await input.repository.setSeriesPublication({
          tenantId: String(identity.tenantId),
          seriesId: text(request.seriesId, "series_id", 128),
          published: request.published,
          at: now(),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "story_radio.series.requires_published_episode"
        ) {
          throw new StoryRadioError(
            "story_radio.series.requires_published_episode",
            409,
          );
        }
        throw error;
      }
      if (!updated) throw new StoryRadioError("story_radio.series.not_found", 404);
      return updated;
    },

    async adminCreateEpisode(request) {
      const identity = await admin(request.authorizationHeader);
      const tenantId = String(identity.tenantId);
      const seriesId = text(request.seriesId, "series_id", 128);
      const exists = await input.repository.getSeries({ tenantId, seriesId });
      if (!exists) throw new StoryRadioError("story_radio.series.not_found", 404);
      let audioUrl: string;
      try {
        audioUrl = assertHttpsStoryUrl(text(request.audioUrl, "audio_url", 2048));
      } catch {
        throw new StoryRadioError("story_radio.audio_url.invalid", 400);
      }
      return input.repository.createEpisode({
        tenantId,
        episodeId: "story_episode_" + randomUUID(),
        seriesId,
        seasonNumber: positiveInt(request.seasonNumber, "season_number", 1000),
        episodeNumber: positiveInt(request.episodeNumber, "episode_number", 100000),
        title: text(request.title, "title", 200),
        description: text(request.description, "description", 4000, true),
        durationSeconds: positiveInt(request.durationSeconds, "duration_seconds", 86400),
        audioUrl,
        artworkUrl: optionalHttps(request.artworkUrl),
        createdAt: now(),
      });
    },

    async adminUpdateEpisode(request) {
      const identity = await admin(request.authorizationHeader);
      let audioUrl: string;
      try {
        audioUrl = assertHttpsStoryUrl(text(request.audioUrl, "audio_url", 2048));
      } catch {
        throw new StoryRadioError("story_radio.audio_url.invalid", 400);
      }
      const updated = await input.repository.updateEpisode({
        tenantId: String(identity.tenantId),
        episodeId: text(request.episodeId, "episode_id", 128),
        seasonNumber: positiveInt(request.seasonNumber, "season_number", 1000),
        episodeNumber: positiveInt(request.episodeNumber, "episode_number", 100000),
        title: text(request.title, "title", 200),
        description: text(request.description, "description", 4000, true),
        durationSeconds: positiveInt(request.durationSeconds, "duration_seconds", 86400),
        audioUrl,
        artworkUrl: optionalHttps(request.artworkUrl),
        updatedAt: now(),
      });
      if (!updated) throw new StoryRadioError("story_radio.episode.not_found", 404);
      return updated;
    },

    async adminSetEpisodePublication(request) {
      const identity = await admin(request.authorizationHeader);
      let updated;
      try {
        updated = await input.repository.setEpisodePublication({
          tenantId: String(identity.tenantId),
          episodeId: text(request.episodeId, "episode_id", 128),
          published: request.published,
          at: now(),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "story_radio.episode.last_published_in_live_series"
        ) {
          throw new StoryRadioError(
            "story_radio.episode.last_published_in_live_series",
            409,
          );
        }
        throw error;
      }
      if (!updated) throw new StoryRadioError("story_radio.episode.not_found", 404);
      return updated;
    },
  });
}
