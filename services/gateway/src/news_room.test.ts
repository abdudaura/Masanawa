import { describe, expect, it } from "vitest";
import { createNewsRoomService } from "./news_room.js";

const RSS = `<?xml version="1.0"?><rss><channel><title>Example Publisher</title>
<item><title>Verified headline</title><link>https://example.com/story</link>
<pubDate>Tue, 06 Oct 2026 08:00:00 GMT</pubDate>
<description><![CDATA[<p>A sourced summary.</p>]]></description>
<media:thumbnail url="https://example.com/image.jpg" /></item>
</channel></rss>`;

describe("NewsRoomService", () => {
  it("authorizes, ingests sourced RSS and projects evidence", async () => {
    let authorized = false;
    const service = createNewsRoomService({
      authorizer: { async authorize(input) {
        expect(input.authorizationHeader).toBe("Bearer customer");
        authorized = true;
      }},
      sources: [{ id: "world", label: "World", url: "https://feed.example/rss.xml", order: 0, visible: true }],
      fetch: async () => new Response(RSS, { status: 200 }),
      now: () => new Date("2026-10-06T09:00:00Z"),
    });
    const result = await service.read({ authorizationHeader: "Bearer customer" });
    expect(authorized).toBe(true);
    expect(result.categories).toEqual([{ id: "world", label: "World", order: 0, visible: true }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sources[0]?.url).toBe("https://example.com/story");
    expect(result.items[0]?.evidenceRefs[0]).toMatch(/^rss:world:/u);
    expect(result.featuredItemId).toBe(result.items[0]?.id);
    expect(result.items[0]?.pinned).toBe(true);
  });

  it("fails closed when all configured feeds are unavailable and no cache exists", async () => {
    const service = createNewsRoomService({
      authorizer: { async authorize() {} },
      sources: [{ id: "world", label: "World", url: "https://feed.example/rss.xml", order: 0, visible: true }],
      fetch: async () => new Response("no", { status: 503 }),
    });
    await expect(service.read({ authorizationHeader: "Bearer customer" })).rejects.toThrow("news.feed.unavailable");
  });
});
