import {
  parseCanonicalId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  normalizeTeachingProgress,
  type TeachingProgress,
  type TeachingProgressRepository,
  type TeachingProgressScope,
} from "../teaching.js";

/**
 * A narrow adapter for the *existing* Study-mode assistant and persisted
 * teaching_progress table. No second lesson database, grading oracle or
 * client-authoritative progress status is introduced.
 *
 * The Gateway must derive actor from verified authentication and scope from
 * the authorized Character relationship, never from a model tool argument.
 */
export interface VerifiedLearner {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export type StudyAction =
  | "continue"
  | "practice"
  | "explain_again"
  | "simpler"
  | "slower"
  | "answer";

export interface StudyActionRequest {
  readonly action: StudyAction;
  readonly requestId: string;
  /** Exact server progress timestamp that the user saw. Null for a new lesson. */
  readonly expectedUpdatedAt: string | null;
  readonly answer?: string;
}

export interface StudyDispatchResult {
  /** "uncertain" means do not retry with a different requestId. */
  readonly state: "accepted" | "uncertain" | "rejected";
  readonly code?: string;
}

export interface TeachingTurnDispatcher {
  dispatch(input: Readonly<{
    scope: TeachingProgressScope;
    requestId: string;
    /** Routed to the canonical Study-mode assistant, NOT executed as a tool. */
    studyText: string;
  }>): Promise<StudyDispatchResult>;
}

export interface TeachingReadback {
  readonly state: "empty" | "available";
  readonly progress: TeachingProgress | null;
}

export class TeachingContinuityError extends Error {
  constructor(
    readonly code:
      | "learning.forbidden"
      | "learning.invalid_action"
      | "learning.stale_checkpoint"
      | "learning.dispatch_unavailable",
  ) {
    super(code);
    this.name = "TeachingContinuityError";
  }
}

const actionDirections: Readonly<Record<StudyAction, string>> = Object.freeze({
  continue: "Continue the next step with a worked example and short check.",
  practice: "Give an exercise based on the stored checkpoint and explain how to check the answer.",
  explain_again: "Explain the stored checkpoint again, with a different concrete example.",
  simpler: "Explain the stored checkpoint in simpler language with a smaller example.",
  slower: "Break down the stored checkpoint into shorter steps and check one at a time.",
  answer: "Review the learner's proposed answer to the previous exercise; explain mistakes and provide a corrected worked solution. Do not guess if the question is absent.",
});

function scoped(actor: VerifiedLearner, scope: TeachingProgressScope): TeachingProgressScope {
  const tenant = parseCanonicalId("tenant", actor.tenantId);
  const user = parseCanonicalId("user", actor.userId);
  if (parseCanonicalId("tenant", scope.tenantId) !== tenant ||
      parseCanonicalId("user", scope.userId) !== user) {
    throw new TeachingContinuityError("learning.forbidden");
  }
  return Object.freeze({
    tenantId: tenant,
    userId: user,
    characterId: parseCanonicalId("character", scope.characterId),
    relationshipId: parseCanonicalId("relationship", scope.relationshipId),
  });
}

function validRequest(input: StudyActionRequest): void {
  if (!Object.prototype.hasOwnProperty.call(actionDirections, input.action) ||
      !/^[a-zA-Z0-9_-]{8,128}$/u.test(input.requestId) ||
      (input.expectedUpdatedAt !== null &&
       (typeof input.expectedUpdatedAt !== "string" ||
        !Number.isFinite(Date.parse(input.expectedUpdatedAt))))) {
    throw new TeachingContinuityError("learning.invalid_action");
  }
  if (input.action === "answer") {
    if (typeof input.answer !== "string" ||
        !input.answer.trim() || input.answer.length > 2000) {
      throw new TeachingContinuityError("learning.invalid_action");
    }
  } else if (input.answer !== undefined) {
    throw new TeachingContinuityError("learning.invalid_action");
  }
}

/** Bounds untrusted answer text as data, never a system/tool instruction. */
function studyMessage(action: StudyAction, answer: string | undefined): string {
  const data = {
    instruction: actionDirections[action],
    ...(action === "answer" ? { learnerAnswer: answer?.trim() } : {}),
    learnerAnswerIsUntrustedData: true,
  };
  const json = JSON.stringify(data).replace(/</gu, "\\u003c");
  return "<masanawa_study>" + json;
}

export function createTeachingContinuity(input: Readonly<{
  repository: TeachingProgressRepository;
  dispatcher: TeachingTurnDispatcher;
}>) {
  async function read(actor: VerifiedLearner, rawScope: TeachingProgressScope):
      Promise<TeachingReadback> {
    const scope = scoped(actor, rawScope);
    const progress = await input.repository.read(scope);
    if (!progress) return Object.freeze({ state: "empty" as const, progress: null });
    const normalized = normalizeTeachingProgress(progress);
    if (normalized.tenantId !== scope.tenantId ||
        normalized.userId !== scope.userId ||
        normalized.characterId !== scope.characterId ||
        normalized.relationshipId !== scope.relationshipId) {
      throw new TeachingContinuityError("learning.forbidden");
    }
    return Object.freeze({
      state: "available" as const,
      progress: normalized,
    });
  }

  return Object.freeze({
    read,
    async act(
      actor: VerifiedLearner,
      rawScope: TeachingProgressScope,
      request: StudyActionRequest,
    ): Promise<Readonly<{
      state: "accepted" | "uncertain" | "rejected";
      code?: string;
      latest: TeachingReadback;
    }>> {
      const scope = scoped(actor, rawScope);
      validRequest(request);
      const previous = await read(actor, scope);
      if ((previous.progress?.updatedAt ?? null) !== request.expectedUpdatedAt) {
        throw new TeachingContinuityError("learning.stale_checkpoint");
      }
      let outcome: StudyDispatchResult;
      try {
        // The dispatcher must implement canonical requestId idempotency.
        outcome = await input.dispatcher.dispatch({
          scope,
          requestId: request.requestId,
          studyText: studyMessage(request.action, request.answer),
        });
      } catch {
        // Transport failure after dispatch may be ambiguous: never blindly
        // replay under a new key or infer the lesson was saved.
        return Object.freeze({ state: "uncertain" as const, code: "learning.dispatch_unavailable", latest: previous });
      }
      if (!["accepted", "uncertain", "rejected"].includes(outcome.state)) {
        throw new TeachingContinuityError("learning.dispatch_unavailable");
      }
      // A dispatch ACK does not prove a learning checkpoint was persisted.
      // Re-read for display, but leave completion truth to Study-mode turn
      // reconciliation / the canonical server-side teaching repository.
      let latest = previous;
      try {
        latest = await read(actor, scope);
      } catch {
        // Keep the pre-dispatch readback rather than showing fabricated data.
      }
      return Object.freeze({
        state: outcome.state,
        ...(outcome.state === "accepted" ? {} :
          { code: outcome.code ?? "learning.dispatch_unavailable" }),
        latest,
      });
    },
  });
}
