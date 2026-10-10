import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import {
  diversifyRankedTalks,
  rankTalksForExplore,
  type RankedTalkState,
} from "../talk_ranking/ranking.js";
import {
  toTalkCommentView,
  toTalkDiscoveryItem,
  type TalkCommentView,
  type TalkDetailView,
  type TalkDiscoveryItem,
  type TalkFeedKind,
  type TalkRepository,
} from "./model.js";

export interface TalkAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "TalkServiceError";
  }
}

export interface TalkService {
  list(input: Readonly<{
    authorizationHeader: string | undefined;
    feed: TalkFeedKind;
  }>): Promise<readonly TalkDiscoveryItem[]>;
  create(input: Readonly<{
    authorizationHeader: string | undefined;
    topic: string;
    title?: string;
  }>): Promise<TalkDiscoveryItem>;
  detail(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkDetailView>;
  update(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    title?: string;
    topic?: string;
    summary?: string;
  }>): Promise<TalkDiscoveryItem>;
  comment(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    body: string;
  }>): Promise<TalkCommentView>;
}

function normalizeSummary(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length > 1000) {
    throw new TalkServiceError("talks.summary_invalid", 400);
  }
  return normalized;
}

function normalizeText(value: string, field: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength) {
    throw new TalkServiceError(`talks.${field}_invalid`, 400);
  }
  return normalized;
}

export function createTalkService(input: Readonly<{
  repository: TalkRepository;
  authorizer: TalkAuthorizer;
  now?: () => string;
  createId?: (kind: "talk" | "comment") => string;
}>): TalkService {
  const now = input.now ?? (() => new Date().toISOString());
  const createId =
    input.createId ??
    ((kind: "talk" | "comment") =>
      kind === "talk" ? `talk_${randomUUID()}` : `talk-comment_${randomUUID()}`);

  async function identity(authorizationHeader: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader });
  }

  return Object.freeze<TalkService>({
    async list(request) {
      const viewer = await identity(request.authorizationHeader);
      const rows = await input.repository.listTalks({
        tenantId: viewer.tenantId,
        viewerUserId: viewer.userId,
        feed: request.feed,
        limit: request.feed === "explore" ? 150 : 50,
      });

      if (request.feed === "live") {
        return Object.freeze(rows.slice(0, 50).map(toTalkDiscoveryItem));
      }

      const ranked = rankTalksForExplore(
        rows.map((row) => {
          if (!["live", "reconnecting", "ended"].includes(row.talk.state)) {
            throw new TalkServiceError("talks.feed_state_invalid", 500);
          }
          return Object.freeze({
            row,
            talkId: row.talk.talkId,
            hostId: row.talk.hostUserId,
            state: row.talk.state as RankedTalkState,
            listenerCount: row.talk.listenerCount,
            commentCount: row.commentCount,
            reactionCount: row.reactionCount,
            startedAt: row.talk.createdAt,
            updatedAt: row.talk.updatedAt,
            followedHost: row.followedHost,
            // No synthetic personalization: these remain neutral until a real
            // request-context relevance/language signal is available.
            languageMatch: 0,
            relevance: 0,
          });
        }),
        { now: now() },
      );
      const diversified = diversifyRankedTalks(ranked, 2);
      return Object.freeze(
        diversified.slice(0, 50).map((entry) => toTalkDiscoveryItem(entry.item.row)),
      );
    },

    async create(request) {
      const host = await identity(request.authorizationHeader);
      const topic = normalizeText(request.topic, "topic", 240);
      const title = request.title === undefined
        ? topic
        : normalizeText(request.title, "title", 160);
      const createdAt = now();
      const record = await input.repository.createTalk({
        tenantId: host.tenantId,
        talkId: createId("talk"),
        hostUserId: host.userId,
        hostName: normalizeText(host.profile.name, "host_name", 160),
        title,
        topic,
        createdAt,
      });
      return toTalkDiscoveryItem({ talk: record, commentCount: 0 });
    },

    async detail(request) {
      const viewer = await identity(request.authorizationHeader);
      const found = await input.repository.getTalk({
        tenantId: viewer.tenantId,
        talkId: request.talkId,
        viewerUserId: viewer.userId,
      });
      if (!found) throw new TalkServiceError("talks.not_found", 404);
      const comments = await input.repository.listComments({
        tenantId: viewer.tenantId,
        talkId: request.talkId,
        viewerUserId: viewer.userId,
        limit: 200,
      });
      return Object.freeze({
        talk: toTalkDiscoveryItem(found),
        comments: Object.freeze(comments.map(toTalkCommentView)),
      });
    },

    async update(request) {
      const host = await identity(request.authorizationHeader);
      if (
        request.title === undefined &&
        request.topic === undefined &&
        request.summary === undefined
      ) {
        throw new TalkServiceError("talks.metadata_empty", 400);
      }
      const updated = await input.repository.updateMetadata({
        tenantId: host.tenantId,
        talkId: request.talkId,
        hostUserId: host.userId,
        ...(request.title === undefined
          ? {}
          : { title: normalizeText(request.title, "title", 160) }),
        ...(request.topic === undefined
          ? {}
          : { topic: normalizeText(request.topic, "topic", 240) }),
        ...(request.summary === undefined
          ? {}
          : { summary: normalizeSummary(request.summary) }),
        updatedAt: now(),
      });
      if (!updated) throw new TalkServiceError("talks.host_forbidden", 403);
      const refreshed = await input.repository.getTalk({
        tenantId: host.tenantId,
        talkId: request.talkId,
        viewerUserId: host.userId,
      });
      if (!refreshed) throw new TalkServiceError("talks.not_found", 404);
      return toTalkDiscoveryItem(refreshed);
    },

    async comment(request) {
      const author = await identity(request.authorizationHeader);
      const body = normalizeText(request.body, "comment", 2000);
      const created = await input.repository.addComment({
        tenantId: author.tenantId,
        talkId: request.talkId,
        commentId: createId("comment"),
        authorUserId: author.userId,
        authorName: normalizeText(author.profile.name, "author_name", 160),
        body,
        createdAt: now(),
      });
      if (!created) throw new TalkServiceError("talks.not_found", 404);
      return toTalkCommentView(created);
    },
  });
}
