import { describe, expect, it } from "vitest";
import { toPublicAudioPost, type AudioPostRecord, type FollowingRepository,
  type TalkListenStore, type AudioPostProcessingQueue } from "./audio-posts.js";

describe("canonical published-audio contract", () => {
  it("never leaks internal account, tenant, media, or idempotency keys in public projection", () => {
    const record: AudioPostRecord = {
      tenantId: "tenant-secret", postId: "post-1", authorId: "creator-1",
      authorAccountId: "account-secret", authorKind: "human", assetId: "media-secret",
      requestId: "request-secret", title: "Welcome", durationMs: 12000,
      status: "published", revision: 2, createdAt: "2026-10-10T00:00:00Z",
      publishedAt: "2026-10-10T00:00:05Z", likeCount: 3, commentCount: 4, listenCount: 5,
    };
    expect(toPublicAudioPost(record)).toEqual({
      postId: "post-1", authorId: "creator-1", authorKind: "human",
      title: "Welcome", durationMs: 12000, status: "published", revision: 2,
      createdAt: "2026-10-10T00:00:00Z", publishedAt: "2026-10-10T00:00:05Z",
      likeCount: 3, commentCount: 4, listenCount: 5,
    });
  });

  it("defaults missing derived counters without disclosing internal values", () => {
    const record: AudioPostRecord = {
      tenantId: "t", postId: "p", authorId: "a", authorAccountId: "secret",
      authorKind: "masana", assetId: "private", requestId: "secret",
      title: "Audio", durationMs: 3000, status: "processing", revision: 0,
      createdAt: "2026-10-10T00:00:00Z", publishedAt: null,
    };
    expect(toPublicAudioPost(record)).toMatchObject({
      likeCount: 0, commentCount: 0, listenCount: 0, status: "processing",
    });
    expect(Object.keys(toPublicAudioPost(record))).not.toContain("assetId");
  });

  it("exports the exact typed repository interfaces across package boundaries", () => {
    const follow: FollowingRepository["statusFromVisiblePost"] | undefined = undefined;
    const listen: TalkListenStore["open"] | undefined = undefined;
    const queue: AudioPostProcessingQueue["listPending"] | undefined = undefined;
    expect([follow, listen, queue]).toEqual([undefined, undefined, undefined]);
  });
});
