import { createHash } from "node:crypto";

export interface NewsRoomAuthorizer {
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<unknown>;
}

export interface NewsCategorySource {
  readonly id: string;
  readonly label: string;
  readonly query: string;
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

interface GdeltArticle {
  readonly url?: unknown;
  readonly title?: unknown;
  readonly seendate?: unknown;
  readonly socialimage?: unknown;
  readonly domain?: unknown;
  readonly sourcecountry?: unknown;
  readonly language?: unknown;
}

const DEFAULT_CATEGORIES: readonly NewsCategorySource[] = Object.freeze([
  Object.freeze({
    id: "world",
    label: "World",
    query: "sourcelang:english",
    order: 0,
    visible: true,
  }),
  Object.freeze({
    id: "africa",
    label: "Africa",
    query: "(africa OR nigeria OR kenya OR ghana OR southafrica) sourcelang:english",
    order: 1,
    visible: true,
  }),
  Object.freeze({
    id: "business",
    label: "Business",
    query: "(business OR economy OR markets OR company) sourcelang:english",
    order: 2,
    visible: true,
  }),
  Object.freeze({
    id: "technology",
    label: "Technology",
    query: "(technology OR software OR internet OR AI) sourcelang:english",
    order: 3,
    visible: true,
  }),
]);

function safeHttps(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized || null;
}

function gdeltDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/u.exec(raw);
  if (compact) {
    const iso =
      compact[1] + "-" + compact[2] + "-" + compact[3] + "T" +
      compact[4] + ":" + compact[5] + ":" + compact[6] + "Z";
    const time = Date.parse(iso);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function evidenceRef(categoryId: string, url: string, publishedAt: string): string {
  const digest = createHash("sha256")
    .update("gdelt|" + categoryId + "|" + url + "|" + publishedAt)
    .digest("hex")
    .slice(0, 24);
  return "gdelt:" + categoryId + ":" + digest;
}

function queryUrl(category: NewsCategorySource, maxRecords: number): string {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", category.query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("sort", "DateDesc");
  url.searchParams.set("timespan", "24h");
  url.searchParams.set("maxrecords", String(maxRecords));
  return url.toString();
}

function parseGdelt(
  payload: unknown,
  category: NewsCategorySource,
  maxRecords: number,
): NewsItemView[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const articles = (payload as { readonly articles?: unknown }).articles;
  if (!Array.isArray(articles)) return [];

  const items: NewsItemView[] = [];
  const seenUrls = new Set<string>();
  for (const raw of articles) {
    if (items.length >= maxRecords) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const article = raw as GdeltArticle;
    const url = safeHttps(article.url);
    const title = text(article.title);
    const publishedAt = gdeltDate(article.seendate);
    if (!url || !title || !publishedAt || seenUrls.has(url)) continue;
    seenUrls.add(url);

    const domain = text(article.domain) ?? new URL(url).host;
    const sourceCountry = text(article.sourcecountry);
    const language = text(article.language);
    const metadata = [
      "Indexed from " + domain,
      sourceCountry ? "source country: " + sourceCountry : null,
      language ? "language: " + language : null,
    ].filter((entry): entry is string => entry !== null);
    const summary = metadata.join(" · ");
    const body =
      "Masanawa found this current report through the GDELT open news index. " +
      "Open the original source (" + domain + ") to read the full article.";
    const id = createHash("sha256")
      .update("gdelt|" + category.id + "|" + url)
      .digest("hex")
      .slice(0, 24);

    items.push(Object.freeze({
      id: "news-" + id,
      title,
      summary,
      body,
      categoryId: category.id,
      imageUrl: safeHttps(article.socialimage),
      sources: Object.freeze([
        Object.freeze({
          label: title,
          publisher: domain,
          url,
        }),
      ]),
      evidenceRefs: Object.freeze([evidenceRef(category.id, url, publishedAt)]),
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
  categories?: readonly NewsCategorySource[];
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  cacheTtlMs?: number;
  perCategoryLimit?: number;
}>): NewsRoomService {
  const categories = (input.categories ?? DEFAULT_CATEGORIES)
    .filter((category) => category.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
  if (categories.length === 0) throw new TypeError("news.categories.required");
  for (const category of categories) {
    if (!/^[a-z0-9][a-z0-9_-]{1,31}$/u.test(category.id)) {
      throw new TypeError("news.category.id.invalid");
    }
    if (!category.label.trim() || !category.query.trim()) {
      throw new TypeError("news.category.invalid");
    }
  }

  const fetchImpl = input.fetch ?? globalThis.fetch;
  const now = input.now ?? (() => new Date());
  const cacheTtlMs = input.cacheTtlMs ?? 5 * 60_000;
  const perCategoryLimit = input.perCategoryLimit ?? 8;
  if (
    !Number.isSafeInteger(perCategoryLimit) ||
    perCategoryLimit < 1 ||
    perCategoryLimit > 50
  ) {
    throw new TypeError("news.per_category_limit.invalid");
  }

  let cached: { expiresAt: number; projection: NewsRoomProjection } | null = null;

  return Object.freeze({
    async read(request: Readonly<{ authorizationHeader: string | undefined }>) {
      await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });

      const time = now().getTime();
      if (cached && cached.expiresAt > time) return cached.projection;

      const batches = await Promise.allSettled(
        categories.map(async (category) => {
          const response = await fetchImpl(queryUrl(category, perCategoryLimit), {
            method: "GET",
            headers: {
              accept: "application/json",
              "user-agent": "Masanawa-News/1.0 (+https://masanawa.com)",
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) {
            throw new Error("news.gdelt.http_" + response.status);
          }
          return parseGdelt(
            await response.json(),
            category,
            perCategoryLimit,
          );
        }),
      );

      const byUrl = new Map<string, NewsItemView>();
      for (const result of batches) {
        if (result.status !== "fulfilled") continue;
        for (const item of result.value) {
          const sourceUrl = item.sources[0]?.url;
          if (!sourceUrl || byUrl.has(sourceUrl)) continue;
          byUrl.set(sourceUrl, item);
        }
      }

      const items = [...byUrl.values()].sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
      );
      if (items.length === 0) {
        if (cached) return cached.projection;
        throw new Error("news.feed.unavailable");
      }
      if (items[0]) {
        items[0] = Object.freeze({ ...items[0], pinned: true });
      }

      const projection: NewsRoomProjection = Object.freeze({
        updatedAt: now().toISOString(),
        featuredItemId: items[0]?.id ?? null,
        categories: Object.freeze(
          categories.map((category) =>
            Object.freeze({
              id: category.id,
              label: category.label,
              order: category.order,
              visible: true as const,
            }),
          ),
        ),
        items: Object.freeze(items),
      });
      cached = {
        expiresAt: time + cacheTtlMs,
        projection,
      };
      return projection;
    },
  });
}
