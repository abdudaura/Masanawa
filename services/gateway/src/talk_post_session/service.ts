import { randomUUID } from "node:crypto";
import type {
  ReplayInsightAuthorizer, ReplayInsightDraft, ReplayInsightProcessor,
  ReplayInsightRepository, ReplayInsightView,
} from "./model.js";

export class ReplayInsightError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "ReplayInsightError";
  }
}
function talkId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(value)) {
    throw new ReplayInsightError("talks.insights.invalid_talk", 400);
  }
  return value;
}
function normalizeDraft(value: ReplayInsightDraft): ReplayInsightDraft {
  if (!value || typeof value.summary !== "string" ||
      value.summary.trim().length < 1 || value.summary.length > 2400 ||
      !Array.isArray(value.highlights) || value.highlights.length > 6 ||
      value.highlights.some(item => typeof item !== "string" ||
        !item.trim() || item.length > 300) ||
      (value.nextTalkTitle !== null && (typeof value.nextTalkTitle !== "string" ||
        !value.nextTalkTitle.trim() || value.nextTalkTitle.length > 120))) {
    throw new ReplayInsightError("talks.insights.invalid_generation", 502);
  }
  // This is a PRIVATE HOST DRAFT, not commands, an approved publication, or verified claims.
  return Object.freeze({
    summary: value.summary.trim(),
    highlights: Object.freeze(value.highlights.map(item => item.trim())),
    nextTalkTitle: value.nextTalkTitle?.trim() ?? null,
  });
}
export interface ReplayInsightService {
  read(input: { readonly authorizationHeader: string | undefined; readonly talkId: string }): Promise<ReplayInsightView>;
  request(input: { readonly authorizationHeader: string | undefined; readonly talkId: string; readonly processingConsent: true }): Promise<ReplayInsightView>;
}
export function createReplayInsightService(input: {
  readonly authorizer: ReplayInsightAuthorizer;
  readonly repository: ReplayInsightRepository;
  readonly processor?: ReplayInsightProcessor;
  readonly timeoutMs?: number;
}): ReplayInsightService {
  const timeoutMs = input.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
    throw new TypeError("Invalid insights generation budget");
  }
  async function verified(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }
  return Object.freeze<ReplayInsightService>({
    async read(request) {
      const actor = await verified(request.authorizationHeader);
      const id = talkId(request.talkId);
      const source = await input.repository.source(actor.tenantId, actor.userId, id);
      if (!source) throw new ReplayInsightError("talks.insights.replay_unavailable", 404);
      const existing = await input.repository.read(actor.tenantId, actor.userId, id);
      if (existing) return existing;
      // This source comes from the current R13 authenticated SQL eligibility,
      // not from a client guess or an unverified model result.
      return {
        talkId: id, recordingId: source.recordingId,
        status: "eligible", summary: null, highlights: [],
        nextTalkTitle: null, updatedAt: new Date().toISOString(),
      };
    },
    async request(request) {
      // Exact boolean required by the route AND by direct service callers.
      if (request.processingConsent !== true) {
        throw new ReplayInsightError("talks.insights.consent_required", 400);
      }
      const actor = await verified(request.authorizationHeader);
      const id = talkId(request.talkId);
      if (!input.processor) throw new ReplayInsightError("talks.insights.provider_unavailable", 503);
      const source = await input.repository.source(actor.tenantId, actor.userId, id);
      if (!source) throw new ReplayInsightError("talks.insights.replay_unavailable", 404);
      const leaseToken = randomUUID();
      const acquired = await input.repository.claim(source, actor.userId, leaseToken);
      if (!acquired) {
        const previous = await input.repository.read(actor.tenantId, actor.userId, id);
        if (!previous) throw new ReplayInsightError("talks.insights.replay_unavailable", 404);
        return previous; // no duplicate generation for ready or leased processing
      }
      const claim = { source, leaseToken };
      try {
        const draft = normalizeDraft(await input.processor.generate(
          source, AbortSignal.timeout(timeoutMs),
        ));
        const applied = await input.repository.complete(claim, draft);
        if (!applied) throw new ReplayInsightError("talks.insights.source_changed", 409);
        const current = await input.repository.read(actor.tenantId, actor.userId, id);
        if (!current) throw new ReplayInsightError("talks.insights.replay_unavailable", 404);
        return current;
      } catch (error) {
        try { await input.repository.fail(claim); } catch { /* lease can already be revoked */ }
        if (error instanceof ReplayInsightError &&
            (error.statusCode === 409 || error.statusCode === 404)) throw error;
        // No provider details or transcript text in errors or logs.
        throw new ReplayInsightError("talks.insights.generation_failed", 503);
      }
    },
  });
}

