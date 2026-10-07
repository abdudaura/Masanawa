export type RankedTalkState = "live" | "reconnecting" | "ended";

export interface TalkRankingCandidate {
  readonly talkId: string;
  readonly state: RankedTalkState;
  readonly listenerCount: number;
  readonly commentCount: number;
  readonly reactionCount: number;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly followedHost: boolean;
  readonly languageMatch: number;
  readonly relevance: number;
}

export interface TalkRankingContext {
  readonly now: string;
}

export interface RankedTalk<T extends TalkRankingCandidate = TalkRankingCandidate> {
  readonly item: T;
  readonly score: number;
  readonly reasons: readonly string[];
}

function integer(value: number, name: string, max: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function fraction(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function timestamp(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new TypeError(`${name} is invalid`);
  return parsed;
}

function text(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 256) {
    throw new TypeError(`${name} is invalid`);
  }
  return value.trim();
}

function stateWeight(state: RankedTalkState): number {
  switch (state) {
    case "live": return 1000;
    case "reconnecting": return 760;
    case "ended": return 320;
  }
}

function freshnessScore(updatedAtMs: number, nowMs: number): number {
  const ageMinutes = Math.max(0, (nowMs - updatedAtMs) / 60_000);
  if (ageMinutes <= 5) return 120;
  if (ageMinutes <= 30) return 100 - ((ageMinutes - 5) / 25) * 30;
  if (ageMinutes <= 180) return 70 - ((ageMinutes - 30) / 150) * 40;
  if (ageMinutes <= 1440) return 30 - ((ageMinutes - 180) / 1260) * 20;
  return Math.max(0, 10 - ((ageMinutes - 1440) / 10080) * 10);
}

function engagementScore(candidate: TalkRankingCandidate): number {
  const listeners = Math.log2(1 + candidate.listenerCount) * 28;
  const comments = Math.log2(1 + candidate.commentCount) * 10;
  const reactions = Math.log2(1 + candidate.reactionCount) * 6;
  return Math.min(220, listeners + comments + reactions);
}

export function scoreTalkForExplore(
  candidate: TalkRankingCandidate,
  context: TalkRankingContext,
): RankedTalk {
  text(candidate.talkId, "talkId");
  if (!["live", "reconnecting", "ended"].includes(candidate.state)) {
    throw new TypeError("state is invalid");
  }
  integer(candidate.listenerCount, "listenerCount", 10_000_000);
  integer(candidate.commentCount, "commentCount", 10_000_000);
  integer(candidate.reactionCount, "reactionCount", 100_000_000);
  const startedAt = timestamp(candidate.startedAt, "startedAt");
  const updatedAt = timestamp(candidate.updatedAt, "updatedAt");
  const now = timestamp(context.now, "now");
  if (updatedAt < startedAt) throw new TypeError("Talk timestamps are inconsistent");
  fraction(candidate.languageMatch, "languageMatch");
  fraction(candidate.relevance, "relevance");

  const reasons: string[] = [];
  let score = stateWeight(candidate.state);
  reasons.push(candidate.state === "live" ? "live" : candidate.state);

  const engagement = engagementScore(candidate);
  if (engagement > 0) reasons.push("engagement");
  score += engagement;

  const freshness = freshnessScore(updatedAt, now);
  if (freshness >= 40) reasons.push("fresh");
  score += freshness;

  const relevance = candidate.relevance * 180;
  if (candidate.relevance >= 0.65) reasons.push("relevant");
  score += relevance;

  const language = candidate.languageMatch * 70;
  if (candidate.languageMatch >= 0.75) reasons.push("language");
  score += language;

  if (candidate.followedHost) {
    score += 85;
    reasons.push("followed-host");
  }

  return Object.freeze({
    item: candidate,
    score: Math.round(score * 1000) / 1000,
    reasons: Object.freeze(reasons),
  });
}

export function rankTalksForExplore<T extends TalkRankingCandidate>(
  candidates: readonly T[],
  context: TalkRankingContext,
): readonly RankedTalk<T>[] {
  const now = timestamp(context.now, "now");
  const seen = new Set<string>();
  const ranked = candidates.map((candidate) => {
    const id = text(candidate.talkId, "talkId");
    if (seen.has(id)) throw new TypeError("Duplicate talkId in ranking candidates");
    seen.add(id);
    return scoreTalkForExplore(candidate, { now: new Date(now).toISOString() }) as RankedTalk<T>;
  });

  ranked.sort((a, b) =>
    b.score - a.score ||
    timestamp(b.item.updatedAt, "updatedAt") - timestamp(a.item.updatedAt, "updatedAt") ||
    a.item.talkId.localeCompare(b.item.talkId)
  );

  return Object.freeze(ranked);
}

export function diversifyRankedTalks<T extends TalkRankingCandidate & { readonly hostId: string }>(
  ranked: readonly RankedTalk<T>[],
  maxConsecutivePerHost = 2,
): readonly RankedTalk<T>[] {
  if (!Number.isSafeInteger(maxConsecutivePerHost) ||
      maxConsecutivePerHost < 1 ||
      maxConsecutivePerHost > 10) {
    throw new RangeError("maxConsecutivePerHost is invalid");
  }

  const remaining = [...ranked];
  const result: RankedTalk<T>[] = [];
  let lastHost = "";
  let run = 0;

  while (remaining.length > 0) {
    let index = 0;
    if (run >= maxConsecutivePerHost) {
      const alternative = remaining.findIndex((entry) => entry.item.hostId !== lastHost);
      if (alternative >= 0) index = alternative;
    }
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    if (next.item.hostId === lastHost) run += 1;
    else {
      lastHost = next.item.hostId;
      run = 1;
    }
    result.push(next);
  }

  return Object.freeze(result);
}
