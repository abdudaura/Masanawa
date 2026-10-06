import { describe, expect, it } from "vitest";
import { createNewsRoomService } from "./news_room.js";

const GDELT = {
  articles: [
    {
      url: "https://example.com/story",
      title: "Verified headline",
      seendate: "20261006T080000Z",
      socialimage: "https://example.com/image.jpg",
      domain: "example.com",
      sourcecountry: "Nigeria",
      language: "English",
    },
  ],
};

describe("NewsRoomService", () => {
  it("authorizes, ingests GDELT metadata and projects evidence", async () => {
    let authorized = false;
    let requestedUrl = "";
    const service = createNewsRoomService({
      authorizer: {
        async authorize(input) {
          expect(input.authorizationHeader).toBe("Bearer customer");
          authorized = true;
        },
      },
      categories: [
        {
          id: "world",
          label: "World",
          query: "sourcelang:english",
          order: 0,
          visible: true,
        },
      ],
      fetch: async (url) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify(GDELT), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      now: () => new Date("2026-10-06T09:00:00Z"),
    });

    const result = await service.read({
      authorizationHeader: "Bearer customer",
    });

    expect(authorized).toBe(true);
    expect(requestedUrl).toContain("api.gdeltproject.org/api/v2/doc/doc");
    expect(requestedUrl).toContain("mode=ArtList");
    expect(result.categories).toEqual([
      { id: "world", label: "World", order: 0, visible: true },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sources[0]?.url).toBe(
      "https://example.com/story",
    );
    expect(result.items[0]?.evidenceRefs[0]).toMatch(/^gdelt:world:/u);
    expect(result.items[0]?.summary).toContain("example.com");
    expect(result.items[0]?.body).toContain("original source");
    expect(result.featuredItemId).toBe(result.items[0]?.id);
    expect(result.items[0]?.pinned).toBe(true);
  });

  it("does not republish article body text from the index response", async () => {
    const service = createNewsRoomService({
      authorizer: { async authorize() {} },
      categories: [
        {
          id: "world",
          label: "World",
          query: "sourcelang:english",
          order: 0,
          visible: true,
        },
      ],
      fetch: async () =>
        new Response(
          JSON.stringify({
            articles: [
              {
                ...GDELT.articles[0],
                description: "Publisher-owned body should never be projected",
              },
            ],
          }),
          { status: 200 },
        ),
    });

    const result = await service.read({
      authorizationHeader: "Bearer customer",
    });
    expect(result.items[0]?.body).not.toContain("Publisher-owned body");
  });

  it("fails closed when all source queries are unavailable and no cache exists", async () => {
    const service = createNewsRoomService({
      authorizer: { async authorize() {} },
      categories: [
        {
          id: "world",
          label: "World",
          query: "sourcelang:english",
          order: 0,
          visible: true,
        },
      ],
      fetch: async () => new Response("no", { status: 503 }),
    });

    await expect(
      service.read({ authorizationHeader: "Bearer customer" }),
    ).rejects.toThrow("news.feed.unavailable");
  });

  it("deduplicates the same source URL across categories", async () => {
    const service = createNewsRoomService({
      authorizer: { async authorize() {} },
      categories: [
        {
          id: "world",
          label: "World",
          query: "sourcelang:english",
          order: 0,
          visible: true,
        },
        {
          id: "africa",
          label: "Africa",
          query: "africa sourcelang:english",
          order: 1,
          visible: true,
        },
      ],
      fetch: async () =>
        new Response(JSON.stringify(GDELT), { status: 200 }),
    });

    const result = await service.read({
      authorizationHeader: "Bearer customer",
    });
    expect(result.items).toHaveLength(1);
  });
});
