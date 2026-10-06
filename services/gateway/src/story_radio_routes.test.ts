import { afterEach, describe, expect, it } from "vitest";
import type { StoryRadioService } from "./story_radio.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function service(): StoryRadioService {
  return {
    async home() {
      return {
        featured: null,
        series: [],
        continueProgress: null,
      };
    },
    async series(input) {
      return {
        id: input.seriesId,
        title: "Series",
        language: "English",
        description: "",
        artworkUrl: null,
        audienceLabel: null,
        episodes: [],
      };
    },
    async saveProgress(input) {
      return {
        seriesId: input.seriesId,
        episodeId: input.episodeId,
        positionSeconds: input.positionSeconds,
        durationSeconds: input.durationSeconds,
        completed: input.completed,
        updatedAt: "2026-10-06T10:00:00.000Z",
      };
    },
    async reactions() {
      return {
        counts: { like: 1, love: 0, funny: 0, thoughtful: 0 },
        mine: "like",
      };
    },
    async react(input) {
      return {
        counts: {
          like: input.reaction === "like" ? 1 : 0,
          love: input.reaction === "love" ? 1 : 0,
          funny: input.reaction === "funny" ? 1 : 0,
          thoughtful: input.reaction === "thoughtful" ? 1 : 0,
        },
        mine: input.reaction,
      };
    },
    async adminList() { return { series: [] }; },
    async adminCreateSeries() { throw new Error("unused"); },
    async adminUpdateSeries() { throw new Error("unused"); },
    async adminSetSeriesPublication() { throw new Error("unused"); },
    async adminCreateEpisode() { throw new Error("unused"); },
    async adminUpdateEpisode() { throw new Error("unused"); },
    async adminSetEpisodePublication() { throw new Error("unused"); },
  };
}

describe("Story Radio routes", () => {
  it("registers the customer listening surface", async () => {
    const app = createGatewayApp({ storyRadio: service() });
    apps.push(app);

    const home = await app.inject({
      method: "GET",
      url: "/story-radio/home",
      headers: { authorization: "Bearer customer" },
    });
    expect(home.statusCode).toBe(200);
    expect(home.json()).toMatchObject({ series: [] });

    const detail = await app.inject({
      method: "GET",
      url: "/story-radio/series/series-1",
      headers: { authorization: "Bearer customer" },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: "series-1" });

    const progress = await app.inject({
      method: "PUT",
      url: "/story-radio/progress",
      headers: { authorization: "Bearer customer" },
      payload: {
        seriesId: "series-1",
        episodeId: "episode-1",
        positionSeconds: 20,
        durationSeconds: 100,
        completed: false,
      },
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json()).toMatchObject({ positionSeconds: 20 });

    const reaction = await app.inject({
      method: "PUT",
      url: "/story-radio/episodes/episode-1/reaction",
      headers: { authorization: "Bearer customer" },
      payload: { reaction: "love" },
    });
    expect(reaction.statusCode).toBe(200);
    expect(reaction.json()).toMatchObject({ mine: "love" });
  });

  it("rejects malformed reaction values at the HTTP boundary", async () => {
    const app = createGatewayApp({ storyRadio: service() });
    apps.push(app);

    const response = await app.inject({
      method: "PUT",
      url: "/story-radio/episodes/episode-1/reaction",
      payload: { reaction: "angry" },
    });

    expect(response.statusCode).toBe(400);
  });
});
