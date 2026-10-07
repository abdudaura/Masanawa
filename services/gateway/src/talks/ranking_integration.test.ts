import { describe, expect, it } from "vitest";
import { createTalkService } from "./service.js";
import type {
  TalkRecord,
  TalkRepository,
} from "./model.js";

function talk(input: Readonly<{
  id: string;
  hostId: string;
  listeners: number;
  createdAt: string;
  updatedAt: string;
}>): TalkRecord {
  return Object.freeze({
    tenantId: "tenant_1",
    talkId: input.id,
    hostUserId: input.hostId,
    hostName: input.hostId,
    title: input.id,
    topic: "Topic",
    summary: "",
    state: "live",
    listenerCount: input.listeners,
    durationSeconds: null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

function repository(rows: readonly Readonly<{
  talk: TalkRecord;
  commentCount: number;
  reactionCount: number;
  followedHost: boolean;
}>[]): TalkRepository {
  return {
    async createTalk() {
      throw new Error("unused");
    },
    async listTalks() {
      return rows;
    },
    async getTalk() {
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

function service(rows: Parameters<typeof repository>[0]) {
  return createTalkService({
    repository: repository(rows),
    authorizer: {
      async authorize() {
        return {
          tenantId: "tenant_1" as never,
          userId: "viewer_1" as never,
          profile: {
            tenantId: "tenant_1" as never,
            userId: "viewer_1" as never,
            name: "Viewer",
            email: null,
            phone: null,
            locale: "en",
            createdAt: "2026-10-07T00:00:00.000Z",
          },
        };
      },
    },
    now: () => "2026-10-07T12:00:00.000Z",
  });
}

describe("Talk Explore ranking integration", () => {
  const low = Object.freeze({
    talk: talk({
      id: "talk_low",
      hostId: "host_low",
      listeners: 1,
      createdAt: "2026-10-07T11:59:00.000Z",
      updatedAt: "2026-10-07T11:59:00.000Z",
    }),
    commentCount: 0,
    reactionCount: 0,
    followedHost: false,
  });
  const strong = Object.freeze({
    talk: talk({
      id: "talk_strong",
      hostId: "host_strong",
      listeners: 500,
      createdAt: "2026-10-07T11:00:00.000Z",
      updatedAt: "2026-10-07T11:45:00.000Z",
    }),
    commentCount: 30,
    reactionCount: 80,
    followedHost: true,
  });

  it("ranks Explore after repository safety filtering", async () => {
    const result = await service([low, strong]).list({
      authorizationHeader: "Bearer viewer",
      feed: "explore",
    });

    expect(result.map((item) => item.id)).toEqual([
      "talk_strong",
      "talk_low",
    ]);
  });

  it("preserves repository operational ordering for Live feed", async () => {
    const result = await service([low, strong]).list({
      authorizationHeader: "Bearer viewer",
      feed: "live",
    });

    expect(result.map((item) => item.id)).toEqual([
      "talk_low",
      "talk_strong",
    ]);
  });

  it("diversifies long same-Host runs without bypassing scores", async () => {
    const sameHostA = Object.freeze({
      ...strong,
      talk: talk({
        id: "talk_a",
        hostId: "host_same",
        listeners: 800,
        createdAt: "2026-10-07T11:00:00.000Z",
        updatedAt: "2026-10-07T11:58:00.000Z",
      }),
    });
    const sameHostB = Object.freeze({
      ...strong,
      talk: talk({
        id: "talk_b",
        hostId: "host_same",
        listeners: 700,
        createdAt: "2026-10-07T11:00:00.000Z",
        updatedAt: "2026-10-07T11:57:00.000Z",
      }),
    });
    const sameHostC = Object.freeze({
      ...strong,
      talk: talk({
        id: "talk_c",
        hostId: "host_same",
        listeners: 600,
        createdAt: "2026-10-07T11:00:00.000Z",
        updatedAt: "2026-10-07T11:56:00.000Z",
      }),
    });
    const other = Object.freeze({
      ...low,
      talk: talk({
        id: "talk_other",
        hostId: "host_other",
        listeners: 5,
        createdAt: "2026-10-07T11:00:00.000Z",
        updatedAt: "2026-10-07T11:55:00.000Z",
      }),
    });

    const result = await service([
      sameHostA,
      sameHostB,
      sameHostC,
      other,
    ]).list({
      authorizationHeader: "Bearer viewer",
      feed: "explore",
    });

    expect(result.slice(0, 3).map((item) => item.id)).toEqual([
      "talk_a",
      "talk_b",
      "talk_other",
    ]);
  });
});
