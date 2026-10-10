import { describe, expect, it } from "vitest";
import { createTalkService } from "./service.js";
import type { TalkCommentRecord, TalkRecord, TalkRepository } from "./model.js";

const baseTalk: TalkRecord = {
  tenantId: "tenant_a",
  talkId: "talk_authorized",
  hostUserId: "host_a",
  hostName: "Human Host",
  title: "Authorized Talk",
  topic: "A topic",
  summary: "",
  state: "live",
  listenerCount: 1,
  durationSeconds: null,
  createdAt: "2026-10-09T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
};

const publicComment: TalkCommentRecord = {
  tenantId: "tenant_a",
  talkId: "talk_authorized",
  commentId: "comment_public",
  authorUserId: "author_a",
  authorName: "Author",
  body: "Approved comment",
  createdAt: "2026-10-09T00:01:00.000Z",
};

function fixture(options: { found?: boolean; authorized?: boolean } = {}) {
  const reads: string[] = [];
  const repository: TalkRepository = {
    async createTalk() { throw new Error("not used"); },
    async listTalks() { throw new Error("not used"); },
    async getTalk(input) {
      reads.push(`get:${input.tenantId}:${input.viewerUserId}`);
      if (options.found === false) return null;
      return { talk: baseTalk, commentCount: 1 };
    },
    async updateMetadata() { throw new Error("not used"); },
    async listComments(input) {
      reads.push(`comments:${input.tenantId}:${input.viewerUserId}:${input.limit}`);
      return [publicComment];
    },
    async addComment() { throw new Error("not used"); },
  };
  const service = createTalkService({
    repository,
    authorizer: {
      async authorize({ authorizationHeader }) {
        if (options.authorized === false || authorizationHeader !== "Bearer viewer_a") {
          throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
        }
        return {
          tenantId: "tenant_a" as never,
          userId: "viewer_a" as never,
          profile: {
            tenantId: "tenant_a" as never,
            userId: "viewer_a" as never,
            name: "Viewer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-09T00:00:00.000Z",
          },
        };
      },
    },
  });
  return { service, reads };
}

describe("F08 Talk detail comment authorization", () => {
  it("passes only the verified account/tenant into parent and comment queries", async () => {
    const { service, reads } = fixture();
    const result = await service.detail({
      authorizationHeader: "Bearer viewer_a",
      talkId: "talk_authorized",
    });
    expect(reads).toEqual([
      "get:tenant_a:viewer_a",
      "comments:tenant_a:viewer_a:200",
    ]);
    expect(result.talk.id).toBe("talk_authorized");
    expect(result.comments.map((comment) => comment.body)).toEqual(["Approved comment"]);
  });

  it("does not query or reveal comments when the parent Talk is inaccessible", async () => {
    const { service, reads } = fixture({ found: false });
    await expect(service.detail({
      authorizationHeader: "Bearer viewer_a",
      talkId: "talk_authorized",
    })).rejects.toMatchObject({ code: "talks.not_found", statusCode: 404 });
    expect(reads).toEqual(["get:tenant_a:viewer_a"]);
  });

  it("does not read the database when authentication fails", async () => {
    const { service, reads } = fixture({ authorized: false });
    await expect(service.detail({
      authorizationHeader: "Bearer untrusted",
      talkId: "talk_authorized",
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(reads).toEqual([]);
  });
});
