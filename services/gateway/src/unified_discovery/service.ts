import type { TalkSearchService } from "../talk_search/service.js";
import type { TalkSearchResults, TalkSearchType } from "../talk_search/model.js";

/**
 * Public discovery is a presentation of the canonical authenticated /search
 * index, NOT a replacement directory. That repository already enforces tenant,
 * safety visibility, approved Experts and published Twins at query time.
 * Never search private DMs, contacts or hidden person records here.
 */
export type DiscoveryKind = "talk" | "person" | "expert" | "twin";
export type DiscoveryFilter = TalkSearchType;

export type DiscoveryItem =
  | Readonly<{ kind: "talk"; id: string; title: string; subtitle: string; isLive: boolean; listenerCount: number; avatarUrl: string | null }>
  | Readonly<{ kind: "person"; id: string; title: string; subtitle: string; isLive: boolean; avatarUrl: string | null }>
  | Readonly<{ kind: "expert" | "twin"; id: string; title: string; subtitle: string; available: boolean; verified: boolean; seatFeeLabel: string; avatarUrl: string | null }>;

export interface DiscoveryResponse {
  readonly items: readonly DiscoveryItem[];
  readonly nextOffset: number | null;
  /** True if the canonical search cap was reached; not a claim of exhaustiveness. */
  readonly searchWindowSaturated: boolean;
}

export class DiscoveryRequestError extends Error {
  readonly statusCode = 400;
  constructor(readonly code: string) {
    super(code);
    this.name = "DiscoveryRequestError";
  }
}

export interface UnifiedDiscoveryService {
  search(input: Readonly<{
    authorizationHeader: string | undefined;
    query: string;
    filter?: DiscoveryFilter;
    liveOnly?: boolean;
    offset?: number;
    limit?: number;
  }>): Promise<DiscoveryResponse>;
}

const maxSourceWindow = 50;
const maxPageSize = 20;

function requireQuery(raw: string): string {
  const q = raw.trim().replace(/\s+/gu, " ");
  if (q.length < 2 || q.length > 120 || /[\u0000-\u001f\u007f]/u.test(q)) {
    throw new DiscoveryRequestError("discovery.invalid_query");
  }
  return q;
}

function requireInteger(value: number, min: number, max: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new DiscoveryRequestError(code);
  }
  return value;
}

function project(results: TalkSearchResults, liveOnly: boolean): DiscoveryItem[] {
  const talks: DiscoveryItem[] = results.talks
    .filter((item) => !liveOnly || item.isLive)
    .map((item) => Object.freeze({
      kind: "talk" as const,
      id: item.id,
      title: item.title,
      subtitle: item.hostName,
      isLive: item.isLive,
      listenerCount: item.listenerCount,
      avatarUrl: item.hostAvatarUrl,
    }));
  const people: DiscoveryItem[] = results.people
    .filter((item) => !liveOnly || item.isLive)
    .map((item) => Object.freeze({
      kind: "person" as const,
      id: item.handle,
      title: item.displayName,
      subtitle: "@" + item.handle,
      isLive: item.isLive,
      avatarUrl: item.avatarUrl,
    }));
  const personas: DiscoveryItem[] = liveOnly ? [] : results.personas.map((item) => Object.freeze({
    kind: item.kind,
    id: item.publicId,
    title: item.displayName,
    subtitle: item.role,
    available: item.isAvailable,
    verified: item.isVerified,
    seatFeeLabel: item.seatFeeLabel,
    avatarUrl: item.avatarUrl,
  }));
  // Stable section ordering is intentional: Talks, People, Experts, Twins.
  return [...talks, ...people,
    ...personas.filter((x) => x.kind === "expert"),
    ...personas.filter((x) => x.kind === "twin")];
}

export function createUnifiedDiscoveryService(search: TalkSearchService): UnifiedDiscoveryService {
  return Object.freeze<UnifiedDiscoveryService>({
    async search(request) {
      const query = requireQuery(request.query);
      const limit = requireInteger(request.limit ?? 20, 1, maxPageSize, "discovery.invalid_limit");
      const offset = requireInteger(request.offset ?? 0, 0, maxSourceWindow - 1, "discovery.invalid_offset");
      const filter = request.filter ?? "all";
      if (!["all", "talks", "people", "experts", "twins"].includes(filter)) {
        throw new DiscoveryRequestError("discovery.invalid_filter");
      }
      if (typeof request.liveOnly !== "undefined" && typeof request.liveOnly !== "boolean") {
        throw new DiscoveryRequestError("discovery.invalid_live_filter");
      }
      // Even an empty-looking page performs canonical authentication.
      // Fetching the shared maximum rather than offset+limit preserves stable
      // ranking in a bounded source window; no unbounded DB scan.
      const canonical = await search.search({
        authorizationHeader: request.authorizationHeader,
        query, type: filter, limit: maxSourceWindow,
      });
      const items = project(canonical, request.liveOnly ?? false);
      const page = items.slice(offset, offset + limit);
      const nextOffset = offset + limit < items.length ? offset + limit : null;
      const sourceCount = canonical.talks.length + canonical.people.length + canonical.personas.length;
      // /search assigns separate 17/17/16 budgets in "all" mode.
      // A single saturated section may hide further results even if other
      // sections are empty. Do not present a false exhaustive result.
      const isAll = filter === "all";
      const saturated = isAll
        ? canonical.talks.length >= 17 ||
          canonical.people.length >= 17 ||
          canonical.personas.length >= 16
        : sourceCount >= maxSourceWindow;
      return Object.freeze({
        items: Object.freeze(page),
        nextOffset,
        searchWindowSaturated: saturated,
      });
    },
  });
}

