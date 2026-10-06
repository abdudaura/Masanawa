import { createHash } from "node:crypto";
import type { PlatformCustomerSessionAuthorizer } from "./customer_auth.js";

export interface NewsCategoryView { readonly id: string; readonly label: string; readonly order: number; readonly visible: boolean; }
export interface NewsSourceView { readonly label: string; readonly publisher: string | null; readonly url: string; }
export interface NewsAudioView { readonly assetUrl: string; readonly durationSeconds?: number; }
export interface NewsItemView {
  readonly id: string; readonly title: string; readonly summary: string; readonly body: string;
  readonly categoryId: string | null; readonly imageUrl: string | null;
  readonly sources: readonly NewsSourceView[]; readonly evidenceRefs: readonly string[];
  readonly audio: NewsAudioView | null; readonly publishedAt: string; readonly visible: boolean; readonly pinned: boolean;
}
export interface NewsRoomView {
  readonly updatedAt: string; readonly featuredItemId: string | null;
  readonly categories: readonly NewsCategoryView[]; readonly items: readonly NewsItemView[];
}
export interface NewsFeedConfig {
  readonly id: string; readonly label: string; readonly url: string; readonly categoryId: string;
  readonly publisher?: string; readonly pinLatest?: boolean; readonly visible?: boolean;
}
export interface NewsCategoryConfig { readonly id: string; readonly label: string; readonly order: number; readonly visible?: boolean; }
export interface NewsService {
  load(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<NewsRoomView>;
}

function isHttpsUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname); }
  catch { return false; }
}

function xmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, (_all, inner: string) => inner)
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&").replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ").trim();
}

function capture(block: string, tag: string): string | null {
  const open = block.toLowerCase().indexOf("<" + tag.toLowerCase());
  if (open < 0) return null;
  const openEnd = block.indexOf(">", open);
  if (openEnd < 0) return null;
  const close = block.toLowerCase().indexOf("</" + tag.toLowerCase() + ">", openEnd + 1);
  if (close < 0) return null;
  return xmlText(block.slice(openEnd + 1, close));
}

function firstCapture(block: string, tags: readonly string[]): string | null {
  for (const tag of tags) { const value = capture(block, tag); if (value) return value; }
  return null;
}

function captureLink(block: string): string | null {
  const rss = capture(block, "link");
  if (rss && isHttpsUrl(rss)) return rss;
  const match = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/iu.exec(block);
  const atom = match?.[1];
  return atom && isHttpsUrl(atom) ? atom : null;
}

function parsePublishedAt(block: string): string {
  const raw = firstCapture(block, ["pubDate", "published", "updated", "dc:date"]);
  if (!raw) return new Date(0).toISOString();
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString();
}

function blocks(xml: string): string[] {
  const result: string[] = [];
  for (const pair of [["<item", "</item>"], ["<entry", "</entry>"]] as const) {
    let offset = 0;
    const lower = xml.toLowerCase();
    while (result.length < 50) {
      const start = lower.indexOf(pair[0], offset);
      if (start < 0) break;
      const openEnd = xml.indexOf(">", start);
      if (openEnd < 0) break;
      const end = lower.indexOf(pair[1], openEnd + 1);
      if (end < 0) break;
      result.push(xml.slice(openEnd + 1, end));
      offset = end + pair[1].length;
    }
  }
  return result;
}

function parseFeedItems(xml: string, feed: NewsFeedConfig): NewsItemView[] {
  const items: NewsItemView[] = [];
  for (const block of blocks(xml).slice(0, 25)) {
    const title = capture(block, "title");
    const link = captureLink(block);
    if (!title || !link) continue;
    const description = firstCapture(block, ["description", "summary", "content", "content:encoded"]) ?? title;
    const publishedAt = parsePublishedAt(block);
    const id = createHash("sha256").update(feed.id + "\n" + link).digest("hex").slice(0, 24);
    items.push(Object.freeze({
      id: "news-" + id, title: title.slice(0, 300), summary: description.slice(0, 600),
      body: description.slice(0, 12000), categoryId: feed.categoryId, imageUrl: null,
      sources: Object.freeze([Object.freeze({
        label: title.slice(0, 300), publisher: feed.publisher?.trim() || feed.label, url: link,
      })]),
      evidenceRefs: Object.freeze([link]), audio: null, publishedAt,
      visible: feed.visible !== false, pinned: false,
    }));
  }
  return items;
}

async function fetchFeed(feed: NewsFeedConfig, fetchImpl: typeof globalThis.fetch, timeoutMs: number): Promise<NewsItemView[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl(feed.url, {
      method: "GET",
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9", "user-agent": "Masanawa-News/1.0" },
      signal: controller.signal, redirect: "follow",
    });
    if (!response.ok) return [];
    const text = await response.text();
    if (text.length > 2000000) return [];
    return parseFeedItems(text, feed);
  } catch { return []; }
  finally { clearTimeout(timer); }
}

function validateConfig(categories: readonly NewsCategoryConfig[], feeds: readonly NewsFeedConfig[]): void {
  const ids = new Set<string>();
  for (const category of categories) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(category.id)) throw new TypeError("news.category.id.invalid");
    if (!category.label.trim() || !Number.isSafeInteger(category.order) || category.order < 0) throw new TypeError("news.category.invalid");
    if (ids.has(category.id)) throw new TypeError("news.category.duplicate");
    ids.add(category.id);
  }
  const feedIds = new Set<string>();
  for (const feed of feeds) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(feed.id) || feedIds.has(feed.id)) throw new TypeError("news.feed.id.invalid");
    feedIds.add(feed.id);
    if (!feed.label.trim() || !isHttpsUrl(feed.url) || !ids.has(feed.categoryId)) throw new TypeError("news.feed.invalid");
  }
}

export function createNewsService(input: Readonly<{
  authorizer: PlatformCustomerSessionAuthorizer; categories: readonly NewsCategoryConfig[]; feeds: readonly NewsFeedConfig[];
  fetch?: typeof globalThis.fetch; now?: () => Date; timeoutMs?: number; maxItems?: number;
}>): NewsService {
  validateConfig(input.categories, input.feeds);
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const now = input.now ?? (() => new Date());
  const timeoutMs = input.timeoutMs ?? 8000;
  const maxItems = input.maxItems ?? 60;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) throw new TypeError("news.timeout.invalid");
  if (!Number.isSafeInteger(maxItems) || maxItems < 1 || maxItems > 200) throw new TypeError("news.max_items.invalid");
  return Object.freeze({
    async load(request) {
      await input.authorizer.authorize({ authorizationHeader: request.authorizationHeader });
      const categoryViews = input.categories.map((category) => Object.freeze({
        id: category.id, label: category.label.trim(), order: category.order, visible: category.visible !== false,
      })).sort((a, b) => a.order - b.order);
      const visibleCategories = new Set(categoryViews.filter((category) => category.visible).map((category) => category.id));
      const enabledFeeds = input.feeds.filter((feed) => feed.visible !== false && visibleCategories.has(feed.categoryId));
      const batches = await Promise.all(enabledFeeds.map((feed) => fetchFeed(feed, fetchImpl, timeoutMs)));
      const dedup = new Map<string, NewsItemView>();
      for (let feedIndex = 0; feedIndex < batches.length; feedIndex += 1) {
        const feed = enabledFeeds[feedIndex]; if (!feed) continue;
        const batch = batches[feedIndex] ?? [];
        for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
          const item = batch[itemIndex]; if (!item) continue;
          const link = item.sources[0]?.url; if (!link || dedup.has(link)) continue;
          dedup.set(link, Object.freeze({ ...item, pinned: Boolean(feed.pinLatest && itemIndex === 0) }));
        }
      }
      const items = [...dedup.values()].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      }).slice(0, maxItems);
      const featured = items.find((item) => item.pinned) ?? items[0] ?? null;
      return Object.freeze({
        updatedAt: now().toISOString(), featuredItemId: featured?.id ?? null,
        categories: Object.freeze(categoryViews), items: Object.freeze(items),
      });
    },
  });
}

export function parseNewsConfig(value: string | undefined): Readonly<{
  categories: readonly NewsCategoryConfig[]; feeds: readonly NewsFeedConfig[];
}> | null {
  if (!value?.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new TypeError("MASANAWA_NEWS_CONFIG_JSON is invalid JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("MASANAWA_NEWS_CONFIG_JSON is invalid");
  const row = parsed as Record<string, unknown>;
  if (!Array.isArray(row.categories) || !Array.isArray(row.feeds)) throw new TypeError("MASANAWA_NEWS_CONFIG_JSON requires categories and feeds");
  const categories: NewsCategoryConfig[] = row.categories.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("news.category.invalid");
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.order !== "number") throw new TypeError("news.category.invalid");
    return { id: item.id, label: item.label, order: item.order, ...(typeof item.visible === "boolean" ? { visible: item.visible } : {}) };
  });
  const feeds: NewsFeedConfig[] = row.feeds.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("news.feed.invalid");
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.label !== "string" || typeof item.url !== "string" || typeof item.categoryId !== "string") throw new TypeError("news.feed.invalid");
    return {
      id: item.id, label: item.label, url: item.url, categoryId: item.categoryId,
      ...(typeof item.publisher === "string" ? { publisher: item.publisher } : {}),
      ...(typeof item.pinLatest === "boolean" ? { pinLatest: item.pinLatest } : {}),
      ...(typeof item.visible === "boolean" ? { visible: item.visible } : {}),
    };
  });
  validateConfig(categories, feeds);
  return Object.freeze({ categories: Object.freeze(categories), feeds: Object.freeze(feeds) });
}
