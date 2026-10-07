import { describe, expect, it } from "vitest";
import { createTalkSearchService } from "./service.js";
import type { TalkSearchRepository } from "./model.js";

function repository() {
  const calls: Array<Readonly<{
    kind: string;
    tenantId: string;
    query: string;
    limit: number;
    personaKind?: string;
  }>> = [];

  const repo: TalkSearchRepository = {
    async searchTalks(input) {
      calls.push({ kind: "talks", ...input });
      return [];
    },
    async searchPeople(input) {
      calls.push({ kind: "people", ...input });
      return [];
    },
    async searchPersonas(input) {
      calls.push({
        kind: "personas",
        tenantId: input.tenantId,
        query: input.query,
        limit: input.limit,
        ...(input.kind ? { personaKind: input.kind } : {}),
      });
      return [];
    },
  };
  return { repo, calls };
}

function service(repo: TalkSearchRepository) {
  return createTalkSearchService({
    repository: repo,
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (authorizationHeader !== "Bearer viewer") {
          throw Object.assign(new Error("UNAUTHORIZED"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant_1" as never,
          userId: "user_viewer" as never,
          profile: {
            tenantId: "tenant_1" as never,
            userId: "user_viewer" as never,
            name: "Viewer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
  });
}

describe("Talk search service", () => {
  it("normalizes query and balances the all budget across categories", async () => {
    const { repo, calls } = repository();

    await service(repo).search({
      authorizationHeader: "Bearer viewer",
      query: "  artificial   intelligence  ",
      type: "all",
      limit: 10,
    });

    expect(calls).toEqual([
      {
        kind: "talks",
        tenantId: "tenant_1",
        query: "artificial intelligence",
        limit: 4,
      },
      {
        kind: "people",
        tenantId: "tenant_1",
        query: "artificial intelligence",
        limit: 3,
      },
      {
        kind: "personas",
        tenantId: "tenant_1",
        query: "artificial intelligence",
        limit: 3,
      },
    ]);
  });

  it("maps Experts and Twins to exact persona kinds", async () => {
    const first = repository();
    await service(first.repo).search({
      authorizationHeader: "Bearer viewer",
      query: "economy",
      type: "experts",
      limit: 30,
    });
    expect(first.calls).toEqual([
      {
        kind: "personas",
        tenantId: "tenant_1",
        query: "economy",
        limit: 30,
        personaKind: "expert",
      },
    ]);

    const second = repository();
    await service(second.repo).search({
      authorizationHeader: "Bearer viewer",
      query: "amina",
      type: "twins",
      limit: 30,
    });
    expect(second.calls[0]?.personaKind).toBe("twin");
  });

  it("rejects whitespace-only, short, and oversized queries", async () => {
    const { repo } = repository();
    const search = service(repo);

    await expect(
      search.search({
        authorizationHeader: "Bearer viewer",
        query: "  a  ",
        type: "all",
        limit: 30,
      }),
    ).rejects.toMatchObject({
      code: "search.query_invalid",
      statusCode: 400,
    });

    await expect(
      search.search({
        authorizationHeader: "Bearer viewer",
        query: "x".repeat(121),
        type: "all",
        limit: 30,
      }),
    ).rejects.toMatchObject({
      code: "search.query_invalid",
      statusCode: 400,
    });
  });
});
