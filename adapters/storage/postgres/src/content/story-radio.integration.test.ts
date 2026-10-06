import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../migrations.js";
import { createPostgresStoryRadioRepository } from "./story-radio.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("Story Radio PostgreSQL acceptance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [{
      owner: "content",
      directory: fileURLToPath(
        new URL("../../../../../packages/content/migrations", import.meta.url),
      ),
    }]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("keeps drafts private and isolates listener progress and reactions", async () => {
    const repository = createPostgresStoryRadioRepository(pool);
    const suffix = Date.now().toString(36);
    const tenantId = "tenant_story_" + suffix;
    const userOne = "user_story_one_" + suffix;
    const userTwo = "user_story_two_" + suffix;
    const createdAt = "2026-10-06T10:00:00.000Z";

    const series = await repository.createSeries({
      tenantId,
      seriesId: "story_series_" + suffix,
      title: "Night Stories",
      description: "Serialized audio",
      language: "Hausa",
      audienceLabel: "General",
      artworkUrl: "https://media.example/series.jpg",
      createdAt,
    });
    const episode = await repository.createEpisode({
      tenantId,
      episodeId: "story_episode_" + suffix,
      seriesId: series.seriesId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "The Journey",
      description: "",
      durationSeconds: 120,
      audioUrl: "https://media.example/story.mp3",
      artworkUrl: null,
      createdAt,
    });

    await expect(repository.listPublishedSeries({ tenantId }))
      .resolves.toHaveLength(0);
    await expect(repository.getPublishedEpisode({
      tenantId,
      episodeId: episode.episodeId,
    })).resolves.toBeNull();

    await repository.setEpisodePublication({
      tenantId,
      episodeId: episode.episodeId,
      published: true,
      at: "2026-10-06T10:01:00.000Z",
    });
    await repository.setSeriesPublication({
      tenantId,
      seriesId: series.seriesId,
      published: true,
      at: "2026-10-06T10:02:00.000Z",
    });

    await expect(repository.listPublishedSeries({ tenantId }))
      .resolves.toHaveLength(1);

    await repository.saveProgress({
      tenantId,
      userId: userOne,
      seriesId: series.seriesId,
      episodeId: episode.episodeId,
      positionSeconds: 35,
      durationSeconds: 120,
      completed: false,
      updatedAt: "2026-10-06T10:03:00.000Z",
    });
    await repository.saveProgress({
      tenantId,
      userId: userTwo,
      seriesId: series.seriesId,
      episodeId: episode.episodeId,
      positionSeconds: 80,
      durationSeconds: 120,
      completed: false,
      updatedAt: "2026-10-06T10:04:00.000Z",
    });

    await expect(repository.getContinueProgress({ tenantId, userId: userOne }))
      .resolves.toMatchObject({ positionSeconds: 35 });
    await expect(repository.getContinueProgress({ tenantId, userId: userTwo }))
      .resolves.toMatchObject({ positionSeconds: 80 });

    await repository.setReaction({
      tenantId,
      userId: userOne,
      episodeId: episode.episodeId,
      reaction: "like",
      updatedAt: "2026-10-06T10:05:00.000Z",
    });
    const replaced = await repository.setReaction({
      tenantId,
      userId: userOne,
      episodeId: episode.episodeId,
      reaction: "love",
      updatedAt: "2026-10-06T10:06:00.000Z",
    });
    expect(replaced.mine).toBe("love");
    expect(replaced.counts.like).toBe(0);
    expect(replaced.counts.love).toBe(1);

    const other = await repository.getReactionSummary({
      tenantId,
      userId: userTwo,
      episodeId: episode.episodeId,
    });
    expect(other.mine).toBeNull();
    expect(other.counts.love).toBe(1);

    await expect(repository.setEpisodePublication({
      tenantId,
      episodeId: episode.episodeId,
      published: false,
      at: "2026-10-06T10:06:30.000Z",
    })).rejects.toThrow(
      "story_radio.episode.last_published_in_live_series",
    );

    await repository.setSeriesPublication({
      tenantId,
      seriesId: series.seriesId,
      published: false,
      at: "2026-10-06T10:07:00.000Z",
    });

    await expect(repository.listPublishedSeries({ tenantId }))
      .resolves.toHaveLength(0);
    await expect(repository.getPublishedEpisode({
      tenantId,
      episodeId: episode.episodeId,
    })).resolves.toBeNull();
    await expect(repository.saveProgress({
      tenantId,
      userId: userOne,
      seriesId: series.seriesId,
      episodeId: episode.episodeId,
      positionSeconds: 40,
      durationSeconds: 120,
      completed: false,
      updatedAt: "2026-10-06T10:08:00.000Z",
    })).rejects.toThrow("story_radio.episode.unavailable");
  });
});
