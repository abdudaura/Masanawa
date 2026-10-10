/** Published audio reports use the existing TalkSafetyService report ledger.
 * The scoped target ID keeps these posts distinct from legacy live Talk IDs.
 * AF00 registers this route with one AF08 actor and canonical visibility policy.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import type { PostActor, AudioPostRecord } from "./contract.js";
import type { TalkSafetyService } from "../talk_safety/service.js";
import type { TalkSafetyReportReason } from "../talk_safety/policy.js";

export class PublishedAudioReportError extends Error {
  constructor(public readonly code: "VALIDATION" | "AUTH_REQUIRED" | "NOT_FOUND" | "CAPABILITY_UNAVAILABLE") {
    super(code);
    this.name = "PublishedAudioReportError";
  }
}
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const reasons = new Set<TalkSafetyReportReason>([
  "spam", "harassment", "hate", "sexual", "violence", "self-harm",
  "fraud", "impersonation", "privacy", "other",
]);
const sameActor = (a: PostActor, b: PostActor): boolean =>
  b.tenantId === a.tenantId && b.accountId === a.accountId &&
  b.authorId === a.authorId && b.authorKind === a.authorKind;
export interface PublishedAudioReportDeps {
  requireActor(authorization: string | undefined): Promise<PostActor>;
  repository: Pick<{
    byId(tenantId: string, postId: string): Promise<AudioPostRecord | null>;
  }, "byId">;
  visibility: {
    canView(input: { tenantId: string; viewerId: string; authorAccountId: string }): Promise<boolean>;
  };
  /** The canonical, authenticated, idempotent TalkSafetyService, NOT a new report store. */
  safety: Pick<TalkSafetyService, "report">;
}
export function createPublishedAudioReportService(deps: PublishedAudioReportDeps) {
  return Object.freeze({
    async report(input: { authorization: string | undefined; postId: unknown; body: unknown }) {
      const actor = await deps.requireActor(input.authorization);
      if (!actor || !id(actor.tenantId) || !id(actor.accountId) ||
          !id(actor.authorId) || !["human", "masana"].includes(actor.authorKind)) {
        throw new PublishedAudioReportError("AUTH_REQUIRED");
      }
      if (!id(input.postId)) throw new PublishedAudioReportError("VALIDATION");
      const body = input.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new PublishedAudioReportError("VALIDATION");
      }
      const fields = body as Record<string, unknown>;
      if (Object.keys(fields).some(k => !["reason", "detail", "clientRequestId"].includes(k)) ||
          typeof fields.reason !== "string" ||
          !reasons.has(fields.reason as TalkSafetyReportReason) ||
          !id(fields.clientRequestId) || fields.clientRequestId.length > 96 ||
          (fields.detail !== undefined && fields.detail !== null &&
            (typeof fields.detail !== "string" || fields.detail.trim().length < 1 ||
             fields.detail.trim().length > 400 || /[\u0000-\u001f\u007f-\u009f]/u.test(fields.detail)))) {
        throw new PublishedAudioReportError("VALIDATION");
      }
      const tenantId = actor.tenantId, accountId = actor.accountId;
      const postId = input.postId;
      const found = await deps.repository.byId(tenantId, postId);
      if (!found || found.tenantId !== tenantId || found.postId !== postId ||
          found.status !== "published" || !id(found.authorAccountId) ||
          !await deps.visibility.canView({tenantId,viewerId:accountId,authorAccountId:found.authorAccountId})) {
        // Blocked, deleted, unpublished, foreign-tenant and nonexistent all look identical.
        throw new PublishedAudioReportError("NOT_FOUND");
      }
      // Require the same live actor again after asynchronous visibility checks;
      // canonical safety service independently authorizes the supplied header.
      const current = await deps.requireActor(input.authorization);
      if (!current || !sameActor(actor, current)) {
        throw new PublishedAudioReportError("AUTH_REQUIRED");
      }
      const saved = await deps.safety.report({
        authorizationHeader: input.authorization,
        targetKind: "talk",
        // Distinct from old live session IDs without changing the shared safety schema.
        targetId: "published-audio:" + postId,
        reason: fields.reason as TalkSafetyReportReason,
        detail: fields.detail == null ? null : (fields.detail as string).trim(),
        clientRequestId: fields.clientRequestId,
      });
      if (!saved || saved.accepted !== true || !id(saved.reportId)) {
        throw new PublishedAudioReportError("CAPABILITY_UNAVAILABLE");
      }
      return { accepted: true as const, reportId: saved.reportId };
    },
  });
}
export function registerPublishedAudioReportRoutes(
  app: FastifyInstance, deps: PublishedAudioReportDeps,
): void {
  const service = createPublishedAudioReportService(deps);
  app.post("/audio-posts/:postId/report", async (request, reply: FastifyReply) => {
    reply.header("Cache-Control", "private, no-store");
    try {
      const params = request.params as {postId?: unknown};
      const receipt = await service.report({
        authorization: request.headers.authorization,
        postId: params?.postId, body: request.body,
      });
      return reply.code(202).send(receipt);
    } catch (error) {
      if (error instanceof PublishedAudioReportError) {
        const status = error.code === "NOT_FOUND" ? 404 :
          error.code === "AUTH_REQUIRED" ? 401 :
          error.code === "CAPABILITY_UNAVAILABLE" ? 503 : 400;
        return reply.code(status).send({ code: error.code });
      }
      throw error;
    }
  });
}
