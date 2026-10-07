import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type {
  TalkPollOptionDraft,
  TalkPollRepository,
  TalkPollView,
} from "./model.js";

export interface TalkPollAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkPollError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkPollError";
  }
}

export interface TalkPollService {
  current(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkPollView | null>;
  create(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    question: string;
    options: readonly string[];
  }>): Promise<TalkPollView>;
  vote(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    pollId: string;
    optionId: string;
  }>): Promise<TalkPollView>;
  close(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    pollId: string;
  }>): Promise<TalkPollView>;
}

function bounded(value: string, name: string, max: number): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > max) {
    throw new TalkPollError(`talks.poll.${name}_invalid`, 400);
  }
  return normalized;
}

function optionDrafts(values: readonly string[]): readonly TalkPollOptionDraft[] {
  if (values.length < 2 || values.length > 4) {
    throw new TalkPollError("talks.poll.options_invalid", 400);
  }
  const normalized = values.map((value) => bounded(value, "option", 120));
  if (new Set(normalized.map((value) => value.toLocaleLowerCase())).size !== normalized.length) {
    throw new TalkPollError("talks.poll.options_duplicate", 400);
  }
  return Object.freeze(normalized.map((label) => Object.freeze({
    optionId: `option_${randomUUID()}`,
    label,
  })));
}

function mapError(error: unknown): never {
  if (error instanceof TalkPollError) throw error;
  const code = error instanceof Error ? error.message : "talks.poll.failed";
  const postgresCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const status =
    code === "talks.not_found" ? 404 :
    code === "talks.host_forbidden" ? 403 :
    code === "talks.not_live" ||
    code === "talks.poll.not_open" || code === "talks.poll.option_not_found" ? 409 :
    code === "talks.poll.open_exists" || postgresCode === "23505" ? 409 :
    400;
  throw new TalkPollError(
    postgresCode === "23505" ? "talks.poll.open_exists" : code,
    status,
  );
}

export function createTalkPollService(input: Readonly<{
  repository: TalkPollRepository;
  authorizer: TalkPollAuthorizer;
  now?: () => string;
}>): TalkPollService {
  const now = input.now ?? (() => new Date().toISOString());
  const identity = (authorizationHeader: string | undefined) =>
    input.authorizer.authorize({ authorizationHeader });

  return Object.freeze({
    async current(request) {
      const viewer = await identity(request.authorizationHeader);
      return input.repository.current({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: bounded(request.talkId, "talk_id", 160),
      });
    },
    async create(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        const result = await input.repository.create({
          tenantId: viewer.tenantId,
          hostUserId: viewer.userId,
          talkId: bounded(request.talkId, "talk_id", 160),
          pollId: `poll_${randomUUID()}`,
          question: bounded(request.question, "question", 240),
          options: optionDrafts(request.options),
          now: now(),
        });
        if (!result) throw new TalkPollError("talks.not_found", 404);
        return result;
      } catch (error) {
        return mapError(error);
      }
    },
    async vote(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        const result = await input.repository.vote({
          tenantId: viewer.tenantId,
          userId: viewer.userId,
          talkId: bounded(request.talkId, "talk_id", 160),
          pollId: bounded(request.pollId, "poll_id", 160),
          optionId: bounded(request.optionId, "option_id", 160),
          now: now(),
        });
        if (!result) throw new TalkPollError("talks.poll.not_open", 409);
        return result;
      } catch (error) {
        return mapError(error);
      }
    },
    async close(request) {
      const viewer = await identity(request.authorizationHeader);
      try {
        const result = await input.repository.close({
          tenantId: viewer.tenantId,
          hostUserId: viewer.userId,
          talkId: bounded(request.talkId, "talk_id", 160),
          pollId: bounded(request.pollId, "poll_id", 160),
          now: now(),
        });
        if (!result) throw new TalkPollError("talks.poll.not_open", 409);
        return result;
      } catch (error) {
        return mapError(error);
      }
    },
  });
}
