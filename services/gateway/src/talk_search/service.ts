import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  TalkSearchRepository,
  TalkSearchResults,
  TalkSearchType,
} from "./model.js";

export interface TalkSearchAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkSearchError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkSearchError";
  }
}

export interface TalkSearchService {
  search(input: Readonly<{
    authorizationHeader: string | undefined;
    query: string;
    type: TalkSearchType;
    limit: number;
  }>): Promise<TalkSearchResults>;
}

function normalizeQuery(query: string): string {
  const value = query.trim().replace(/\s+/gu, " ");
  if (value.length < 2 || value.length > 120) {
    throw new TalkSearchError("search.query_invalid", 400);
  }
  return value;
}

function boundedLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new TalkSearchError("search.limit_invalid", 400);
  }
  return limit;
}

function allBudgets(limit: number): Readonly<{
  talks: number;
  people: number;
  personas: number;
}> {
  const base = Math.floor(limit / 3);
  const remainder = limit % 3;
  return Object.freeze({
    talks: base + (remainder > 0 ? 1 : 0),
    people: base + (remainder > 1 ? 1 : 0),
    personas: base,
  });
}

export function createTalkSearchService(input: Readonly<{
  repository: TalkSearchRepository;
  authorizer: TalkSearchAuthorizer;
}>): TalkSearchService {
  return Object.freeze<TalkSearchService>({
    async search(request) {
      const viewer = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const query = normalizeQuery(request.query);
      const limit = boundedLimit(request.limit);

      if (request.type === "talks") {
        const talks = await input.repository.searchTalks({
          tenantId: viewer.tenantId,
          query,
          limit,
        });
        return Object.freeze({
          talks,
          people: Object.freeze([]),
          personas: Object.freeze([]),
        });
      }

      if (request.type === "people") {
        const people = await input.repository.searchPeople({
          tenantId: viewer.tenantId,
          query,
          limit,
        });
        return Object.freeze({
          talks: Object.freeze([]),
          people,
          personas: Object.freeze([]),
        });
      }

      if (request.type === "experts" || request.type === "twins") {
        const personas = await input.repository.searchPersonas({
          tenantId: viewer.tenantId,
          query,
          kind: request.type === "experts" ? "expert" : "twin",
          limit,
        });
        return Object.freeze({
          talks: Object.freeze([]),
          people: Object.freeze([]),
          personas,
        });
      }

      const budget = allBudgets(limit);
      const [talks, people, personas] = await Promise.all([
        budget.talks === 0
          ? Promise.resolve(Object.freeze([]))
          : input.repository.searchTalks({
              tenantId: viewer.tenantId,
              query,
              limit: budget.talks,
            }),
        budget.people === 0
          ? Promise.resolve(Object.freeze([]))
          : input.repository.searchPeople({
              tenantId: viewer.tenantId,
              query,
              limit: budget.people,
            }),
        budget.personas === 0
          ? Promise.resolve(Object.freeze([]))
          : input.repository.searchPersonas({
              tenantId: viewer.tenantId,
              query,
              limit: budget.personas,
            }),
      ]);

      return Object.freeze({ talks, people, personas });
    },
  });
}
