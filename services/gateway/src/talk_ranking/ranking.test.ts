import { describe, expect, it } from "vitest";
import {
  type RankedTalk,
  type TalkRankingCandidate,
  diversifyRankedTalks,
  rankTalksForExplore,
  scoreTalkForExplore,
  type TalkRankingCandidate,
} from "./ranking.js";

const now = "2026-10-07T10:45:00.000Z";

function candidate(overrides: Partial<TalkRankingCandidate> = {}): TalkRankingCandidate {
  return {
    talkId: "talk-a",
    state: "live",
    listenerCount: 10,
    commentCount: 3,
    reactionCount: 8,
    startedAt: "2026-10-07T10:00:00.000Z",
    updatedAt: "2026-10-07T10:44:00.000Z",
    followedHost: false,
    languageMatch: 0.5,
    relevance: 0.5,
    ...overrides,
  };
}

describe("Talk Explore ranking", () => {
  it("keeps live Talks above equivalent reconnecting and ended Talks", () => {
    const live = scoreTalkForExplore(candidate({ talkId: "live", state: "live" }), { now });
    const reconnecting = scoreTalkForExplore(
      candidate({ talkId: "reconnecting", state: "reconnecting" }),
      { now },
    );
    const ended = scoreTalkForExplore(candidate({ talkId: "ended", state: "ended" }), { now });

    expect(live.score).toBeGreaterThan(reconnecting.score);
    expect(reconnecting.score).toBeGreaterThan(ended.score);
  });

  it("lets meaningful live engagement beat pure recency", () => {
    const recentQuiet = candidate({
      talkId: "recent-quiet",
      listenerCount: 1,
      commentCount: 0,
      reactionCount: 0,
      updatedAt: "2026-10-07T10:44:50.000Z",
      relevance: 0.4,
    });
    const engaged = candidate({
      talkId: "engaged",
      listenerCount: 120,
      commentCount: 40,
      reactionCount: 300,
      updatedAt: "2026-10-07T10:20:00.000Z",
      relevance: 0.4,
    });

    const ranked = rankTalksForExplore([recentQuiet, engaged], { now });
    expect(ranked[0]?.item.talkId).toBe("engaged");
  });

  it("uses follows as a modest boost rather than an absolute override", () => {
    const followedWeak = candidate({
      talkId: "followed",
      followedHost: true,
      listenerCount: 0,
      commentCount: 0,
      reactionCount: 0,
      relevance: 0.1,
      languageMatch: 0.1,
      startedAt: "2026-10-07T08:00:00.000Z",
      updatedAt: "2026-10-07T09:00:00.000Z",
    });
    const unfamiliarStrong = candidate({
      talkId: "new-host",
      followedHost: false,
      listenerCount: 300,
      commentCount: 80,
      reactionCount: 500,
      relevance: 0.95,
      languageMatch: 0.9,
      updatedAt: "2026-10-07T10:44:00.000Z",
    });

    const ranked = rankTalksForExplore([followedWeak, unfamiliarStrong], { now });
    expect(ranked[0]?.item.talkId).toBe("new-host");
  });

  it("boosts dynamic language and topical relevance without hardcoding a language", () => {
    const matching = scoreTalkForExplore(
      candidate({
        talkId: "matching",
        languageMatch: 1,
        relevance: 1,
      }),
      { now },
    );
    const nonMatching = scoreTalkForExplore(
      candidate({
        talkId: "non-matching",
        languageMatch: 0,
        relevance: 0,
      }),
      { now },
    );

    expect(matching.score).toBeGreaterThan(nonMatching.score);
    expect(matching.reasons).toContain("language");
    expect(matching.reasons).toContain("relevant");
  });

  it("is deterministic for equal scores using recency then Talk id", () => {
    const a = candidate({ talkId: "a", updatedAt: "2026-10-07T10:43:00.000Z" });
    const b = candidate({ talkId: "b", updatedAt: "2026-10-07T10:44:00.000Z" });
    const c = candidate({ talkId: "c", updatedAt: "2026-10-07T10:44:00.000Z" });

    const ranked = rankTalksForExplore([c, a, b], { now });
    expect(ranked.map((entry) => entry.item.talkId)).toEqual(["b", "c", "a"]);
  });

  it("rejects duplicate Talk ids and malformed candidate signals", () => {
    expect(() =>
      rankTalksForExplore(
        [candidate({ talkId: "same" }), candidate({ talkId: "same" })],
        { now },
      ),
    ).toThrow("Duplicate");

    expect(() =>
      scoreTalkForExplore(candidate({ languageMatch: 1.1 }), { now }),
    ).toThrow("languageMatch");

    expect(() =>
      scoreTalkForExplore(candidate({ updatedAt: "2026-10-07T09:00:00.000Z" }), { now }),
    ).toThrow("Talk timestamps are inconsistent");

    expect(() =>
      scoreTalkForExplore(candidate({ listenerCount: -1 }), { now }),
    ).toThrow("listenerCount");
  });

  it("limits long runs from one Host without changing underlying scores", () => {
    const ranked: readonly RankedTalk<TalkRankingCandidate & { readonly hostId: string }>[] = [
      { item: { ...candidate({ talkId: "a1" }), hostId: "host-a" }, score: 100, reasons: [] },
      { item: { ...candidate({ talkId: "a2" }), hostId: "host-a" }, score: 99, reasons: [] },
      { item: { ...candidate({ talkId: "a3" }), hostId: "host-a" }, score: 98, reasons: [] },
      { item: { ...candidate({ talkId: "b1" }), hostId: "host-b" }, score: 80, reasons: [] },
    ];

    const diversified = diversifyRankedTalks(ranked, 2);
    expect(diversified.map((entry) => entry.item.talkId)).toEqual(["a1", "a2", "b1", "a3"]);
    expect(diversified.find((entry) => entry.item.talkId === "a3")?.score).toBe(98);
  });
});
