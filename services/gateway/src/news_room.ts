import { createHash } from "node:crypto";

export interface NewsRoomAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<unknown>;
}

export interface NewsFeedSource {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly order: number;
  readonly visible: boolean;
}

export interface NewsSourceView {
  readonly label: string;
  readonly publisher: string | null;
  readonly url: string;
}

export interface NewsAudioView {
  readonly assetUrl: string;
  readonly durationSeconds: number | null;
}

export interface NewsItemView {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly categoryId: string | null;
  readonly imageUrl: string | null;
  readonly sources: readonly NewsSourceView[];
  readonly evidenceRefs: readonly string[];
  readonly audio: NewsAudioView | null;
  readonly publishedAt: string;
  readonly visible: true;
  readonly pinned: boolean;
}

export interface NewsCategoryView {
  readonly id: string;
  readonly label: string;
  readonly order: number;
  readonly visible: true;
}

export interface NewsRoomProjection {
  readonly updatedAt: string;
  readonly featuredItemId: string | null;
  readonly categories: readonly NewsCategoryView[];
  readonly items: readonly NewsItemView[];
}

export interface NewsRoomService {
  read(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<NewsRoomProjection>;
}

const DEFAULT_FEEDS: readonly NewsFeedSource[] = Object.freeze([
  Object.freeze({ id: "world", label: "World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", order: 0, visible: true }),
  Object.freeze({ id: "africa", label: "Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", order: 1, visible: true }),
  Object.freeze({ id: "business", label: "Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", order: 2, visible: true }),
  Object.freeze({ id: "technology", label: "Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", order: 3, visible: true }),
]);

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(\`<\${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/\${name}>\`, "iu").exec(block);
  return match?.[1] ? decodeXml(match[1]) : null;
}

function attr(block: string, tagName: string, attrName: string): string | null {
  const match = new RegExp(\`<\${tagName}\\b[^>]*\\b\${attrName}=["']([^"']+)["'][^>]*>\`, "iu").exec(block);
  return match?.[1]?.trim() || null;
}

function safeHttps(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function evidenceRef(sourceId: string, url: string, publishedAt: string): string {
  const digest = createHash("sha256").update(\`\${sourceId}|\${url}|\${publishedAt}\`).digest("hex").slice(0, 24);
  return \`rss:\${sourceId}:\${digest}\`;
}

function parseFeed(xml: string, source: NewsFeedSource, perFeedLimit: number): NewsItemView[] {
  const publisher = tag(xml, "title");
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/giu)].map((match) => match[1] ?? "");
  const items: NewsItemView[] = [];
  for (const block of blocks) {
    if (items.length >= perFeedLimit) break;
    const title = tag(block, "title");
    const link = safeHttps(tag(block, "link"));
    const publishedAt = isoDate(tag(block, "pubDate") ?? tag(block, "dc:date"));
    const description = tag(block, "description") ?? tag(block, "content:encoded");
    if (!title || !link || !publishedAt || !description) continue;
    const imageUrl = safeHttps(
      attr(block, "media:thumbnail", "url") ??
      attr(block, "media:content", "url") ??
      attr(block, "enclosure", "url"),
    );
    const guid = tag(block, "guid") ?? link;
    const id = createHash("sha256").update(\`\${source.id}|\${guid}\`).digest("hex").slice(0, 24);
    items.push(Object.freeze({
      id: \`news-\${id}\`,
      title,
      summary: description.length > 360 ? \`\${description.slice(0, 357)}...\` : description,
      body: description,
      categoryId: source.id,
      imageUrl,
      sources: Object.freeze([Object.freeze({
        label: title,
        publisher: publisher || source.label,
        url: link,
      })]),
      evidenceRefs: Object.freeze([evidenceRef(source.id, link, publishedAt)]),
      audio: null,
      publishedAt,
      visible: true as const,
      pinned: false,
    }));
  }
  return items;
}

export function createNewsRoomService(input: Readonly<{
  authorizer: NewsRoomAuthorizer;
  sources?: readonly NewsFeedSource[];
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  cacheTtlMs?: number;
  perFeedLimit?: number;
}>): NewsRoomService {
  const sources = (input.sources ?? DEFAULT_FEEDS)
    .filter((source) => source.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  if (sources.length === 0) throw new TypeError("news.sources.required");
  for (const source of sources) {
    if (!/^[a-z0-9][a-z0-9_-]{1,31}$/u.test(source.id)) throw new TypeError("news.source.id.invalid");
    if (!safeHttps(source.url)) throw new TypeError("news.source.url.invalid");
  }
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const now = input.now ?? (() => new Date());
  const cacheTtlMs = input.cacheTtlMs ?? 5 * 60_000;
  const perFeedLimit = input.perFeedLimit ?? 8;
  let cached: { expiresAt: number; projection: NewsRoomProjection } | null = null;

  return Object.freeze({
    async read(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const time = now().getTime();
      if (cached && cached.expiresAt > time) return cached.projection;

      const batches = await Promise.allSettled(
        sources.map(async (source) => {
          const response = await fetchImpl(source.url, {
            method: "GET",
            headers: { accept: "application/rss+xml, application/xml, text/xml;q=0.9" },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) throw new Error(\`news.feed.http_\${response.status}\`);
          return parseFeed(await response.text(), source, perFeedLimit);
        }),
      );

      const items = batches.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      if (items.length === 0) {
        if (cached) return cached.projection;
        throw new Error("news.feed.unavailable");
      }
      items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      if (items[0]) items[0] = Object.freeze({ ...items[0], pinned: true });
      const projection: NewsRoomProjection = Object.freeze({
        updatedAt: now().toISOString(),
        featuredItemId: items[0]?.id ?? null,
        categories: Object.freeze(sources.map((source) => Object.freeze({
          id: source.id,
          label: source.label,
          order: source.order,
          visible: true as const,
        }))),
        items: Object.freeze(items),
      });
      cached = { expiresAt: time + cacheTtlMs, projection };
      return projection;
    },
  });
}
