import { describe, expect, it } from "vitest";
import { createTalkService } from "./service.js";
import type {
  TalkRecord,
  TalkRepository,
  TalkListRow,
} from "./model.js";

function talk(input: Partial<TalkRecord> & Pick<TalkRecord, "talkId" | "hostUserId">): TalkRecord {
  return Object.freeze({
    tenantId: "tenant-1",
    hostName: input.hostUserId,
    title: input.talkId,
    topic: "Topic",
    summary: "",
    state: "live",
    listenerCount: 0,
    durationSeconds: null,
    createdAt: "2026-10-07T09:00:00.000Z",
    updatedAt: "2026-10-07T09:00:00.000Z",
    ...input,
  });
}

function repository(rows: readonly TalkListRow[]): TalkRepository {
  return {
    async createTalk() {
      throw new Error("not used");
    },
    async listTalks(input) {
      if (input.feed === "live") {
        return rows.filter((row) => row.talk.state === "live").slice(0, input.limit);
      }
      return rows.slice(0, input.limit);
    },
    async getTalk() {
      return null;
    },
    async updateMetadata() {
      return null;
    },
    async listComments() {
      return [];
    },
    async addComment() {
      return null;
    },
  };
}

function service(rows: readonly TalkListRow[]) {
  return createTalkService({
    repository: repository(rows),
    authorizer: {
      async authorize() {
        return {
          tenantId: "tenant-1" as never,
          userId: "viewer-1" as never,
          profile: {
            tenantId: "tenant-1" as never,
            userId: "viewer-1" as never,
            name: "Viewer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    now: () => "2026-10-07T10:00:00.000Z",
  });
}

describe("Talk Host metadata editing", () => {
  it("passes the authenticated user as the only Host mutation authority", async () => {
    let updateInput:
      | Parameters<TalkRepository["updateMetadata"]>[0]
      | undefined;
    const updatedTalk = talk({
      talkId: "talk-edit",
      hostUserId: "viewer-1",
      title: "Updated title",
      topic: "Updated topic",
      summary: "Updated summary",
    });
    const repo = repository([]);
    repo.updateMetadata = async (input) => {
      updateInput = input;
      return updatedTalk;
    };
    repo.getTalk = async () => ({ talk: updatedTalk, commentCount: 3 });

    const result = await createTalkService({
      repository: repo,
      authorizer: {
        async authorize() {
          return {
            tenantId: "tenant-1" as never,
            userId: "viewer-1" as never,
            profile: {
              tenantId: "tenant-1" as never,
              userId: "viewer-1" as never,
              name: "Viewer",
              email: null,
              phone: null,
              locale: "en",
              createdAt: "2026-10-07T00:00:00.000Z",
            },
          };
        },
      },
      now: () => "2026-10-07T12:10:00.000Z",
    }).update({
      authorizationHeader: "Bearer viewer",
      talkId: "talk-edit",
      title: " Updated title ",
      topic: " Updated topic ",
      summary: " Updated summary ",
    });

    expect(updateInput).toMatchObject({
      tenantId: "tenant-1",
      talkId: "talk-edit",
      hostUserId: "viewer-1",
      title: "Updated title",
      topic: "Updated topic",
      summary: "Updated summary",
      updatedAt: "2026-10-07T12:10:00.000Z",
    });
    expect(result).toMatchObject({
      id: "talk-edit",
      title: "Updated title",
      topic: "Updated topic",
      summary: "Updated summary",
      commentCount: 3,
    });
  });

  it("rejects a metadata update when the repository cannot match that Host", async () => {
    const repo = repository([]);
    repo.updateMetadata = async () => null;

    await expect(
      createTalkService({
        repository: repo,
        authorizer: {
          async authorize() {
            return {
              tenantId: "tenant-1" as never,
              userId: "viewer-1" as never,
              profile: {
                tenantId: "tenant-1" as never,
                userId: "viewer-1" as never,
                name: "Viewer",
                email: null,
                phone: null,
                locale: "en",
                createdAt: "2026-10-07T00:00:00.000Z",
              },
            };
          },
        },
      }).update({
        authorizationHeader: "Bearer viewer",
        talkId: "talk-other-host",
        title: "Not mine",
      }),
    ).rejects.toMatchObject({
      code: "talks.host_forbidden",
      statusCode: 403,
    });
  });
});

describe("Talk participant discovery projection", () => {
  it("keeps the Host first and includes human Expert and Twin Seats once", async () => {
    const rows: TalkListRow[] = [
      {
        talk: talk({
          talkId: "talk-table",
          hostUserId: "user_host",
          hostName: "Host",
        }),
        commentCount: 0,
        reactionCount: 0,
        followedHost: false,
        participants: [
          {
            id: "user_host",
            name: "Duplicate Host Seat",
            kind: "human",
            avatarUrl: null,
            isHost: false,
          },
          {
            id: "user_speaker",
            name: "Amina",
            kind: "human",
            avatarUrl: null,
            isHost: false,
          },
          {
            id: "persona_economist",
            name: "Economist",
            kind: "expert",
            avatarUrl: null,
            isHost: false,
          },
          {
            id: "persona_twin",
            name: "Amina Twin",
            kind: "twin",
            avatarUrl: null,
            isHost: false,
          },
        ],
      },
    ];

    const result = await service(rows).list({
      authorizationHeader: "Bearer viewer",
      feed: "live",
    });

    expect(result[0]?.participants).toEqual([
      {
        id: "user_host",
        name: "Host",
        kind: "human",
        avatarUrl: null,
        isHost: true,
      },
      {
        id: "user_speaker",
        name: "Amina",
        kind: "human",
        avatarUrl: null,
        isHost: false,
      },
      {
        id: "persona_economist",
        name: "Economist",
        kind: "expert",
        avatarUrl: null,
        isHost: false,
      },
      {
        id: "persona_twin",
        name: "Amina Twin",
        kind: "twin",
        avatarUrl: null,
        isHost: false,
      },
    ]);
  });
});

describe("Talk Explore feed ranking integration", () => {
  it("lets meaningful engagement outrank pure recency in Explore", async () => {
    const rows: TalkListRow[] = [
      {
        talk: talk({
          talkId: "talk-new-quiet",
          hostUserId: "host-new",
          listenerCount: 1,
          updatedAt: "2026-10-07T09:59:50.000Z",
        }),
        commentCount: 0,
        reactionCount: 0,
        followedHost: false,
      },
      {
        talk: talk({
          talkId: "talk-engaged",
          hostUserId: "host-engaged",
          listenerCount: 120,
          updatedAt: "2026-10-07T09:35:00.000Z",
        }),
        commentCount: 40,
        reactionCount: 300,
        followedHost: false,
      },
    ];

    const result = await service(rows).list({
      authorizationHeader: "Bearer viewer",
      feed: "explore",
    });

    expect(result.map((item) => item.id)).toEqual([
      "talk-engaged",
      "talk-new-quiet",
    ]);
  });

  it("uses canonical follow state as a modest Explore boost", async () => {
    const base = talk({
      talkId: "unfollowed",
      hostUserId: "host-a",
      listenerCount: 10,
      updatedAt: "2026-10-07T09:55:00.000Z",
    });
    const rows: TalkListRow[] = [
      {
        talk: base,
        commentCount: 2,
        reactionCount: 4,
        followedHost: false,
      },
      {
        talk: { ...base, talkId: "followed", hostUserId: "host-b" },
        commentCount: 2,
        reactionCount: 4,
        followedHost: true,
      },
    ];

    const result = await service(rows).list({
      authorizationHeader: "Bearer viewer",
      feed: "explore",
    });

    expect(result[0]?.id).toBe("followed");
  });

  it("diversifies the top of Explore after two consecutive Talks from one Host", async () => {
    const rows: TalkListRow[] = [
      {
        talk: talk({
          talkId: "a1",
          hostUserId: "host-a",
          listenerCount: 300,
          updatedAt: "2026-10-07T09:59:00.000Z",
        }),
        commentCount: 20,
        reactionCount: 100,
        followedHost: false,
      },
      {
        talk: talk({
          talkId: "a2",
          hostUserId: "host-a",
          listenerCount: 250,
          updatedAt: "2026-10-07T09:58:00.000Z",
        }),
        commentCount: 18,
        reactionCount: 90,
        followedHost: false,
      },
      {
        talk: talk({
          talkId: "a3",
          hostUserId: "host-a",
          listenerCount: 200,
          updatedAt: "2026-10-07T09:57:00.000Z",
        }),
        commentCount: 15,
        reactionCount: 80,
        followedHost: false,
      },
      {
        talk: talk({
          talkId: "b1",
          hostUserId: "host-b",
          listenerCount: 20,
          updatedAt: "2026-10-07T09:50:00.000Z",
        }),
        commentCount: 4,
        reactionCount: 10,
        followedHost: false,
      },
    ];

    const result = await service(rows).list({
      authorizationHeader: "Bearer viewer",
      feed: "explore",
    });

    expect(result.slice(0, 4).map((item) => item.id)).toEqual([
      "a1",
      "a2",
      "b1",
      "a3",
    ]);
  });

  it("keeps Live feed live-only without applying Explore diversification", async () => {
    const rows: TalkListRow[] = [
      {
        talk: talk({ talkId: "live-a", hostUserId: "host-a", state: "live" }),
        commentCount: 0,
        reactionCount: 0,
        followedHost: false,
      },
      {
        talk: talk({ talkId: "ended", hostUserId: "host-b", state: "ended" }),
        commentCount: 100,
        reactionCount: 100,
        followedHost: true,
      },
    ];

    const result = await service(rows).list({
      authorizationHeader: "Bearer viewer",
      feed: "live",
    });

    expect(result.map((item) => item.id)).toEqual(["live-a"]);
  });
});

