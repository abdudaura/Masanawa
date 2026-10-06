import { describe, expect, it } from "vitest";
import type {
  StoryEpisode,
  StoryListeningProgress,
  StoryRadioRepository,
  StoryReaction,
  StoryReactionSummary,
  StorySeries,
} from "@masanawa/content";
import { createStoryRadioService, StoryRadioError } from "./story_radio.js";

function fakeRepository(): StoryRadioRepository {
  const series = new Map<string, StorySeries>();
  const episodes = new Map<string, StoryEpisode>();
  const progress = new Map<string, StoryListeningProgress>();
  const reactions = new Map<string, StoryReaction>();

  const summary = (
    tenantId: string,
    userId: string,
    episodeId: string,
  ): StoryReactionSummary => {
    const counts = { like: 0, love: 0, funny: 0, thoughtful: 0 };
    for (const [key, value] of reactions) {
      if (key.startsWith(tenantId + "|") && key.endsWith("|" + episodeId)) {
        counts[value] += 1;
      }
    }
    return Object.freeze({
      counts: Object.freeze(counts),
      mine: reactions.get(tenantId + "|" + userId + "|" + episodeId) ?? null,
    });
  };

  return {
    async createSeries(input) {
      const row: StorySeries = Object.freeze({
        ...input,
        state: "draft",
        publishedAt: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      series.set(row.seriesId, row);
      return row;
    },
    async updateSeries(input) {
      const current = series.get(input.seriesId);
      if (!current || current.tenantId !== input.tenantId) return null;
      const next = Object.freeze({ ...current, ...input });
      series.set(input.seriesId, next);
      return next;
    },
    async setSeriesPublication(input) {
      const current = series.get(input.seriesId);
      if (!current || current.tenantId !== input.tenantId) return null;
      if (input.published &&
          ![...episodes.values()].some(
            e =>
              e.tenantId === input.tenantId &&
              e.seriesId === input.seriesId &&
              e.state === "published",
          )) {
        throw new Error("story_radio.series.requires_published_episode");
      }
      const next: StorySeries = Object.freeze({
        ...current,
        state: input.published ? "published" : "draft",
        publishedAt: input.published ? input.at : null,
        updatedAt: input.at,
      });
      series.set(input.seriesId, next);
      return next;
    },
    async createEpisode(input) {
      const row: StoryEpisode = Object.freeze({
        ...input,
        state: "draft",
        publishedAt: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      episodes.set(row.episodeId, row);
      return row;
    },
    async updateEpisode(input) {
      const current = episodes.get(input.episodeId);
      if (!current || current.tenantId !== input.tenantId) return null;
      const next = Object.freeze({ ...current, ...input });
      episodes.set(input.episodeId, next);
      return next;
    },
    async setEpisodePublication(input) {
      const current = episodes.get(input.episodeId);
      if (!current || current.tenantId !== input.tenantId) return null;
      const parent = series.get(current.seriesId);
      if (
        !input.published &&
        current.state === "published" &&
        parent?.tenantId === input.tenantId &&
        parent.state === "published"
      ) {
        const publishedCount = [...episodes.values()].filter(
          (item) =>
            item.tenantId === input.tenantId &&
            item.seriesId === current.seriesId &&
            item.state === "published",
        ).length;
        if (publishedCount <= 1) {
          throw new Error("story_radio.episode.last_published_in_live_series");
        }
      }
      const next: StoryEpisode = Object.freeze({
        ...current,
        state: input.published ? "published" : "draft",
        publishedAt: input.published ? input.at : null,
        updatedAt: input.at,
      });
      episodes.set(input.episodeId, next);
      return next;
    },
    async listSeries(input) {
      return Object.freeze([...series.values()].filter(
        s => s.tenantId === input.tenantId,
      ));
    },
    async getSeries(input) {
      const row = series.get(input.seriesId);
      return row?.tenantId === input.tenantId ? row : null;
    },
    async listEpisodes(input) {
      return Object.freeze([...episodes.values()].filter(
        e => e.tenantId === input.tenantId && e.seriesId === input.seriesId,
      ));
    },
    async listPublishedSeries(input) {
      return Object.freeze([...series.values()].filter(
        s => s.tenantId === input.tenantId && s.state === "published",
      ));
    },
    async getPublishedSeries(input) {
      const row = series.get(input.seriesId);
      return row?.tenantId === input.tenantId && row.state === "published"
        ? row
        : null;
    },
    async listPublishedEpisodes(input) {
      return Object.freeze([...episodes.values()]
        .filter(e =>
          e.tenantId === input.tenantId &&
          e.seriesId === input.seriesId &&
          e.state === "published")
        .sort((a,b) => a.seasonNumber-b.seasonNumber || a.episodeNumber-b.episodeNumber));
    },
    async getPublishedEpisode(input) {
      const row = episodes.get(input.episodeId);
      const parent = row ? series.get(row.seriesId) : null;
      return row?.tenantId === input.tenantId &&
        row.state === "published" &&
        parent?.tenantId === input.tenantId &&
        parent.state === "published"
        ? row
        : null;
    },
    async getContinueProgress(input) {
      return [...progress.values()]
        .filter(p => p.tenantId === input.tenantId && p.userId === input.userId)
        .sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
    },
    async saveProgress(input) {
      const e = episodes.get(input.episodeId);
      const s = e ? series.get(e.seriesId) : null;
      if (
        !e ||
        e.tenantId !== input.tenantId ||
        e.state !== "published" ||
        s?.tenantId !== input.tenantId ||
        s.state !== "published"
      ) {
        throw new Error("story_radio.episode.unavailable");
      }
      progress.set(
        input.tenantId + "|" + input.userId + "|" + input.episodeId,
        input,
      );
      return input;
    },
    async getReactionSummary(input) {
      const e = episodes.get(input.episodeId);
      const s = e ? series.get(e.seriesId) : null;
      if (
        !e ||
        e.tenantId !== input.tenantId ||
        e.state !== "published" ||
        s?.tenantId !== input.tenantId ||
        s.state !== "published"
      ) {
        throw new Error("story_radio.episode.unavailable");
      }
      return summary(input.tenantId, input.userId, input.episodeId);
    },
    async setReaction(input) {
      const e = episodes.get(input.episodeId);
      const s = e ? series.get(e.seriesId) : null;
      if (
        !e ||
        e.tenantId !== input.tenantId ||
        e.state !== "published" ||
        s?.tenantId !== input.tenantId ||
        s.state !== "published"
      ) {
        throw new Error("story_radio.episode.unavailable");
      }
      reactions.set(
        input.tenantId + "|" + input.userId + "|" + input.episodeId,
        input.reaction,
      );
      return summary(input.tenantId, input.userId, input.episodeId);
    },
  };
}

const session = (userId: string, tenantId = "tenant_test") => ({
  authorize: async () => ({
    tenantId,
    userId,
    profile: {
      tenantId,
      userId,
      phone: null,
      email: null,
      name: "Test",
      locale: "en-NG",
      createdAt: "2026-10-06T00:00:00.000Z",
    },
  } as any),
});

describe("StoryRadioService", () => {
  it("keeps drafts out of customer projections and supports admin publication", async () => {
    const repo = fakeRepository();
    const service = createStoryRadioService({
      repository: repo,
      sessions: session("user_admin"),
      adminUserIds: new Set(["user_admin"]),
      now: () => "2026-10-06T10:00:00.000Z",
    });

    const s: any = await service.adminCreateSeries({
      authorizationHeader: "Bearer x",
      title: "Night Stories",
      description: "Stories for listening",
      language: "Hausa",
    });
    expect((await service.home({ authorizationHeader: "Bearer x" }) as any).series).toHaveLength(0);

    const e: any = await service.adminCreateEpisode({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "The Journey",
      description: "",
      durationSeconds: 300,
      audioUrl: "https://media.example/journey.mp3",
    });
    await service.adminSetEpisodePublication({
      authorizationHeader: "Bearer x",
      episodeId: e.episodeId,
      published: true,
    });
    await service.adminSetSeriesPublication({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      published: true,
    });

    const home: any = await service.home({ authorizationHeader: "Bearer x" });
    expect(home.series).toHaveLength(1);
    const detail: any = await service.series({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
    });
    expect(detail.episodes[0].nextEpisodeId).toBeNull();
  });

  it("keeps published Story Radio content inside the authenticated tenant", async () => {
    const repo = fakeRepository();
    const admin = createStoryRadioService({
      repository: repo,
      sessions: session("user_admin", "tenant_a"),
      adminUserIds: new Set(["user_admin"]),
      now: () => "2026-10-06T10:00:00.000Z",
    });
    const s: any = await admin.adminCreateSeries({
      authorizationHeader: "Bearer a",
      title: "Tenant A Stories",
      description: "",
      language: "English",
    });
    const e: any = await admin.adminCreateEpisode({
      authorizationHeader: "Bearer a",
      seriesId: s.seriesId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Private to tenant A",
      description: "",
      durationSeconds: 60,
      audioUrl: "https://media.example/tenant-a.mp3",
    });
    await admin.adminSetEpisodePublication({
      authorizationHeader: "Bearer a",
      episodeId: e.episodeId,
      published: true,
    });
    await admin.adminSetSeriesPublication({
      authorizationHeader: "Bearer a",
      seriesId: s.seriesId,
      published: true,
    });

    const tenantB = createStoryRadioService({
      repository: repo,
      sessions: session("user_b", "tenant_b"),
    });
    const home: any = await tenantB.home({ authorizationHeader: "Bearer b" });
    expect(home.series).toHaveLength(0);
    await expect(tenantB.series({
      authorizationHeader: "Bearer b",
      seriesId: s.seriesId,
    })).rejects.toMatchObject({
      code: "story_radio.series.not_found",
      statusCode: 404,
    });
  });

  it("does not allow a live series to lose its last published episode", async () => {
    const repo = fakeRepository();
    const service = createStoryRadioService({
      repository: repo,
      sessions: session("user_admin"),
      adminUserIds: new Set(["user_admin"]),
      now: () => "2026-10-06T10:00:00.000Z",
    });
    const s: any = await service.adminCreateSeries({
      authorizationHeader: "Bearer x",
      title: "Series",
      description: "",
      language: "English",
    });
    const e: any = await service.adminCreateEpisode({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "Episode",
      description: "",
      durationSeconds: 60,
      audioUrl: "https://media.example/episode.mp3",
    });
    await service.adminSetEpisodePublication({
      authorizationHeader: "Bearer x",
      episodeId: e.episodeId,
      published: true,
    });
    await service.adminSetSeriesPublication({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      published: true,
    });

    await expect(service.adminSetEpisodePublication({
      authorizationHeader: "Bearer x",
      episodeId: e.episodeId,
      published: false,
    })).rejects.toMatchObject({
      code: "story_radio.episode.last_published_in_live_series",
      statusCode: 409,
    });
  });

  it("denies publication commands to ordinary authenticated users", async () => {
    const service = createStoryRadioService({
      repository: fakeRepository(),
      sessions: session("user_customer"),
      adminUserIds: new Set(["user_admin"]),
    });
    await expect(service.adminList({ authorizationHeader: "Bearer x" }))
      .rejects.toMatchObject({ code: "story_radio.admin.forbidden", statusCode: 403 });
  });

  it("persists progress and one reaction per user", async () => {
    const repo = fakeRepository();
    const admin = createStoryRadioService({
      repository: repo,
      sessions: session("user_admin"),
      adminUserIds: new Set(["user_admin"]),
      now: () => "2026-10-06T10:00:00.000Z",
    });
    const s: any = await admin.adminCreateSeries({
      authorizationHeader: "Bearer x", title: "Series", description: "", language: "English",
    });
    const e: any = await admin.adminCreateEpisode({
      authorizationHeader: "Bearer x", seriesId: s.seriesId, seasonNumber: 1, episodeNumber: 1,
      title: "Episode", description: "", durationSeconds: 100,
      audioUrl: "https://media.example/episode.mp3",
    });
    await admin.adminSetEpisodePublication({authorizationHeader:"Bearer x",episodeId:e.episodeId,published:true});
    await admin.adminSetSeriesPublication({authorizationHeader:"Bearer x",seriesId:s.seriesId,published:true});

    const listener = createStoryRadioService({
      repository: repo,
      sessions: session("user_listener"),
      now: () => "2026-10-06T10:01:00.000Z",
    });
    const saved: any = await listener.saveProgress({
      authorizationHeader:"Bearer x",seriesId:s.seriesId,episodeId:e.episodeId,
      positionSeconds:40,durationSeconds:100,completed:false,
    });
    expect(saved.positionSeconds).toBe(40);
    const first: any = await listener.react({
      authorizationHeader:"Bearer x",episodeId:e.episodeId,reaction:"like",
    });
    expect(first.counts.like).toBe(1);
    const second: any = await listener.react({
      authorizationHeader:"Bearer x",episodeId:e.episodeId,reaction:"love",
    });
    expect(second.counts.like).toBe(0);
    expect(second.counts.love).toBe(1);

    await admin.adminSetSeriesPublication({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      published: false,
    });
    await expect(listener.saveProgress({
      authorizationHeader: "Bearer x",
      seriesId: s.seriesId,
      episodeId: e.episodeId,
      positionSeconds: 50,
      durationSeconds: 100,
      completed: false,
    })).rejects.toMatchObject({
      code: "story_radio.episode.unavailable",
      statusCode: 404,
    });
    await expect(listener.reactions({
      authorizationHeader: "Bearer x",
      episodeId: e.episodeId,
    })).rejects.toMatchObject({
      code: "story_radio.episode.unavailable",
      statusCode: 404,
    });
    await expect(listener.react({
      authorizationHeader: "Bearer x",
      episodeId: e.episodeId,
      reaction: "like",
    })).rejects.toMatchObject({
      code: "story_radio.episode.unavailable",
      statusCode: 404,
    });
  });
});
