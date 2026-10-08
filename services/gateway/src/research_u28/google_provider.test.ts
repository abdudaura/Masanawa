import { describe, expect, it } from "vitest";
import { googleResearchProvider } from "./google_provider.js";

describe("U28 fixed-origin governed provider", () => {
  it("fails closed if no server-side provider configuration", () => {
    expect(() => googleResearchProvider({ apiKey: "", engineId: undefined }))
      .toThrow("research.not_configured");
  });

  it("requests only fixed Google endpoint, bounds results and preserves exact provenance", async () => {
    const seen: string[] = [];
    const provider = googleResearchProvider({
      apiKey: "private-key", engineId: "engine-1",
      fetcher: async (url, opts) => {
        seen.push(String(url));
        expect(opts?.redirect).toBe("error");
        expect(opts?.signal).toBeDefined();
        return new Response(JSON.stringify({ items: [
          { title: "<b>News</b>", link: "https://example.org/article",
            snippet: "<b>Indexed only</b>",
            pagemap: { metatags: [{ "article:published_time": "2026-10-08T00:00:00Z" }] } },
        ] }), { status: 200 });
      },
    });
    const result = await provider.search({ query: "solar energy", limit: 3 });
    expect(seen).toHaveLength(1);
    const url = new URL(seen[0]!);
    expect(url.origin).toBe("https://www.googleapis.com");
    expect(url.pathname).toBe("/customsearch/v1");
    expect(url.searchParams.get("q")).toBe("solar energy");
    expect(result).toEqual([{
      title: "News", url: "https://example.org/article",
      excerpt: "Indexed only", publishedAt: "2026-10-08T00:00:00.000Z",
    }]);
  });

  it("sanitizes upstream failures and excessive bodies", async () => {
    const failed = googleResearchProvider({
      apiKey: "private-key", engineId: "engine-1",
      fetcher: async () => { throw Error("secret=private-key"); },
    });
    await expect(failed.search({ query: "rainfall", limit: 3 }))
      .rejects.toMatchObject({ code: "research.provider_unavailable", statusCode: 503 });
    const large = googleResearchProvider({
      apiKey: "key", engineId: "engine",
      fetcher: async () => new Response("a".repeat(270000), { status: 200 }),
    });
    await expect(large.search({ query: "rainfall", limit: 2 }))
      .rejects.toMatchObject({ code: "research.provider_unavailable" });
  });

  it("rejects upstream non-200 and cancellation without returning fake results", async () => {
    const noResults = googleResearchProvider({
      apiKey: "key", engineId: "engine",
      fetcher: async () => new Response("{}", { status: 429 }),
    });
    await expect(noResults.search({ query: "rainfall", limit: 2 }))
      .rejects.toMatchObject({ code: "research.provider_unavailable" });
    const abort = new AbortController();
    abort.abort();
    await expect(noResults.search({ query: "rainfall", limit: 2, signal: abort.signal }))
      .rejects.toMatchObject({ code: "research.cancelled" });
  });
});
