import { describe, expect, it, vi } from "vitest";
import { createNewsService, parseNewsConfig } from "./news_service.js";

const authorizer = {
  authorize: vi.fn(async ({ authorizationHeader }: { authorizationHeader: string | undefined }) => {
    if (authorizationHeader !== "Bearer customer") throw new Error("unauthorized");
    return {} as never;
  }),
};

describe("news service", () => {
  it("loads RSS items with source evidence and server-controlled categories", async () => {
    const fetch = vi.fn(async () => new Response(
      '<?xml version="1.0"?><rss><channel><item><title>Verified headline</title><link>https://publisher.example/story</link><description><![CDATA[<p>Sourced summary text.</p>]]></description><pubDate>Tue, 06 Oct 2026 08:30:00 GMT</pubDate></item></channel></rss>',
      { status: 200, headers: { "content-type": "application/rss+xml" } },
    ));
    const service = createNewsService({
      authorizer,
      categories: [{ id: "world", label: "World", order: 0 }],
      feeds: [{
        id: "example",
        label: "Example",
        publisher: "Example News",
        url: "https://publisher.example/rss.xml",
        categoryId: "world",
        pinLatest: true,
      }],
      fetch,
      now: () => new Date("2026-10-06T09:00:00Z"),
    });

    const result = await service.load({ authorizationHeader: "Bearer customer" });

    expect(result.categories).toEqual([{ id: "world", label: "World", order: 0, visible: true }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Verified headline",
      summary: "Sourced summary text.",
      categoryId: "world",
      pinned: true,
      publishedAt: "2026-10-06T08:30:00.000Z",
      sources: [{ publisher: "Example News", url: "https://publisher.example/story" }],
      evidenceRefs: ["https://publisher.example/story"],
    });
    expect(result.featuredItemId).toBe(result.items[0]?.id);
  });

  it("fails closed on invalid or insecure configured sources", () => {
    expect(() => parseNewsConfig(JSON.stringify({
      categories: [{ id: "world", label: "World", order: 0 }],
      feeds: [{ id: "bad", label: "Bad", url: "http://example.com/rss", categoryId: "world" }],
    }))).toThrow("news.feed.invalid");
  });

  it("does not fabricate stories when a feed is unavailable", async () => {
    const service = createNewsService({
      authorizer,
      categories: [{ id: "world", label: "World", order: 0 }],
      feeds: [{ id: "example", label: "Example", url: "https://publisher.example/rss", categoryId: "world" }],
      fetch: vi.fn(async () => new Response("no", { status: 503 })),
    });

    const result = await service.load({ authorizationHeader: "Bearer customer" });
    expect(result.items).toEqual([]);
    expect(result.featuredItemId).toBeNull();
  });
});
