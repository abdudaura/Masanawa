import { afterEach, describe, expect, it } from "vitest";
import { createGatewayApp } from "./app.js";
import type { NewsRoomService } from "./news_room.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("News Room HTTP route", () => {
  it("passes the canonical authorization header and returns the projection", async () => {
    const service: NewsRoomService = {
      async read(input) {
        expect(input.authorizationHeader).toBe("Bearer customer");
        return {
          updatedAt: "2026-10-06T10:00:00.000Z",
          featuredItemId: "news-1",
          categories: [
            {
              id: "world",
              label: "World",
              order: 0,
              visible: true,
            },
          ],
          items: [
            {
              id: "news-1",
              title: "Verified headline",
              summary: "Indexed from example.com",
              body: "Open the original source.",
              categoryId: "world",
              imageUrl: null,
              sources: [
                {
                  label: "Verified headline",
                  publisher: "example.com",
                  url: "https://example.com/story",
                },
              ],
              evidenceRefs: ["gdelt:world:abc"],
              audio: null,
              publishedAt: "2026-10-06T09:30:00.000Z",
              visible: true,
              pinned: true,
            },
          ],
        };
      },
    };

    const app = createGatewayApp({ newsRoom: service });
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/v1/rooms/news",
      headers: { authorization: "Bearer customer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().featuredItemId).toBe("news-1");
    expect(response.json().items[0].sources[0].url).toBe(
      "https://example.com/story",
    );
  });

  it("returns a bounded 503 when current source metadata is unavailable", async () => {
    const service: NewsRoomService = {
      async read() {
        throw new Error("news.feed.unavailable");
      },
    };
    const app = createGatewayApp({ newsRoom: service });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/rooms/news",
      headers: { authorization: "Bearer customer" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: "NEWS_UNAVAILABLE",
        message: "Current news is temporarily unavailable.",
      },
    });
  });

  it("preserves canonical authorization failures from the News authorizer", async () => {
    const service: NewsRoomService = {
      async read() {
        throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
      },
    };
    const app = createGatewayApp({ newsRoom: service });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/rooms/news",
    });

    expect(response.statusCode).toBe(401);
  });
});
