/** C26 public-only search. Results never include human accounts or private content. */
export const SEARCH_KINDS = ["masana", "rooms", "posts", "videos"] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];
export interface SearchHit {
  readonly kind: SearchKind;
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sourceUrl?: string;
}
export interface SearchPage {
  readonly items: readonly SearchHit[];
  readonly nextCursor: string | null;
}
export interface SearchQuery {
  readonly tenantId: string;
  readonly kind: SearchKind;
  readonly q: string;
  readonly cursor: string | null;
  readonly limit: number;
}
export interface SearchStore { search(query: SearchQuery): Promise<SearchPage>; }
export class SearchRequestError extends Error {
  constructor(readonly code: string) { super(code); }
}
/** Strictly bound to published, versioned public categories. No arbitrary tenant/user filters. */
export function parseSearchQuery(raw: unknown): Omit<SearchQuery, "tenantId"> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new SearchRequestError("invalid_query");
  const data = raw as Record<string, unknown>;
  if (Object.keys(data).some(k => !["q", "kind", "cursor", "limit"].includes(k)))
    throw new SearchRequestError("unexpected_search_filter");
  if (typeof data.q !== "string") throw new SearchRequestError("invalid_query");
  const q = data.q.trim().normalize("NFC");
  if (q.length < 2 || q.length > 80 || /[\u0000-\u001f\u007f]/u.test(q))
    throw new SearchRequestError("invalid_query");
  const kind = data.kind === undefined ? "masana" : data.kind;
  if (typeof kind !== "string" || !SEARCH_KINDS.some(k => k === kind))
    throw new SearchRequestError("invalid_kind");
  const rawLimit = data.limit === undefined ? 15 : Number(data.limit);
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 20)
    throw new SearchRequestError("invalid_limit");
  const rawCursor = data.cursor;
  let cursor: string | null = null;
  if (rawCursor !== undefined && rawCursor !== null) {
    if (typeof rawCursor !== "string" || rawCursor.length < 1 ||
        rawCursor.length > 160 || !/^[a-zA-Z0-9_-]+$/.test(rawCursor))
      throw new SearchRequestError("invalid_cursor");
    cursor = rawCursor;
  }
  return { q, kind: kind as SearchKind, limit: rawLimit, cursor };
}
