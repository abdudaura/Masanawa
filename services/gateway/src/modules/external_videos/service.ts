import { randomUUID } from "node:crypto";
import {
  parseExternalVideoUrl, strictManualVideoInput, type ExternalVideo,
  type VideoPrincipal, type VideoProvider,
} from "./contract.js";

export interface VideoStore {
  submit(item: ExternalVideo, actorId: string): Promise<ExternalVideo>;
  review(input: {
    tenantId: string; id: string; actorId: string; expectedState: "pending" | "approved" | "hidden" | "unavailable";
    state: "pending" | "approved" | "hidden" | "unavailable";
    reasonReference?: string | null;
    verificationReference: string | null;
  }): Promise<ExternalVideo | null>;
  list(input: { tenantId: string; provider?: VideoProvider; publicOnly: boolean; limit: number; before?: string }): Promise<readonly ExternalVideo[]>;
}
const videoUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export class VideoAdmissionError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
function requireStaff(actor: VideoPrincipal): string {
  if (!actor.actorId || !actor.staffRoles.some(r => r === "content_editor" || r === "ops_admin" || r === "super_admin")) {
    throw new VideoAdmissionError(403, "video_staff_required", "Video curation requires staff permission");
  }
  return actor.actorId;
}
function requireTenant(actor: VideoPrincipal): string {
  if (!actor.tenantId || actor.tenantId.length > 200) {
    throw new VideoAdmissionError(403, "video_tenant_required", "Tenant context unavailable");
  }
  return actor.tenantId;
}
export function createVideoAdmissionService(store: VideoStore) {
  return {
    async submit(actor: VideoPrincipal, input: unknown): Promise<ExternalVideo> {
      const tenantId = requireTenant(actor), actorId = requireStaff(actor);
      let value;
      try { value = strictManualVideoInput(input); } catch {
        throw new VideoAdmissionError(400, "video_invalid_input", "Enter a valid title, channel and video URL");
      }
      let parsed;
      try { parsed = parseExternalVideoUrl(value.url); } catch {
        throw new VideoAdmissionError(400, "video_invalid_url", "Use a supported official video URL");
      }
      const now = new Date().toISOString();
      return store.submit({
        id: randomUUID(), tenantId, ...parsed, title: value.title,
        channelName: value.channelName, reviewState: "pending",
        verifiedAt: null, createdAt: now,
      }, actorId);
    },
    async review(actor: VideoPrincipal, id: string, input: unknown): Promise<ExternalVideo> {
      const tenantId = requireTenant(actor), actorId = requireStaff(actor);
      if (!videoUuid.test(id)) throw new VideoAdmissionError(400, "video_invalid_id", "Invalid video ID");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new VideoAdmissionError(400,"video_invalid_review","Invalid review");
      const x = input as Record<string, unknown>;
      const keys = Object.keys(x).sort().join(",");
      if (keys !== "state,verificationReference" && keys !== "expectedState,state,verificationReference") {
        throw new VideoAdmissionError(400,"video_invalid_review","Unexpected review fields");
      }
      const state = x.state as "pending" | "approved" | "hidden" | "unavailable";
      if (!["pending","approved","hidden","unavailable"].includes(state)) throw new VideoAdmissionError(400,"video_invalid_review","Invalid review state");
      const previous = x.expectedState;
      if (state === "pending" && previous !== "hidden" && previous !== "unavailable") {
        throw new VideoAdmissionError(400,"video_invalid_review","Re-review requires the last hidden or unavailable state");
      }
      if (state !== "pending" && previous !== undefined) {
        throw new VideoAdmissionError(400,"video_invalid_review","Do not supply a previous state for this transition");
      }
      // A staff verification record is mandatory before an item can be public.
      const verificationReference = typeof x.verificationReference === "string" ? x.verificationReference.trim() : null;
      if (state === "approved" && (!verificationReference || verificationReference.length < 12 || verificationReference.length > 250)) {
        throw new VideoAdmissionError(400,"video_verification_required","Record official player/rights eligibility evidence before approval");
      }
      if (state !== "approved" && verificationReference !== null) throw new VideoAdmissionError(400,"video_invalid_review","Only approval accepts verification evidence");
      const expectedState = state === "pending" ? previous as "hidden" | "unavailable"
        : state === "approved" ? "pending" : "approved";
      const updated = await store.review({ tenantId, id, actorId,
        expectedState, state, verificationReference });
      if (!updated) throw new VideoAdmissionError(409, "video_review_conflict", "Video is missing or review state changed");
      return updated;
    },
    async list(actor: VideoPrincipal, query: {provider?: unknown; before?: unknown; limit?: unknown}, publicOnly = true): Promise<readonly ExternalVideo[]> {
      const tenantId = requireTenant(actor);
      if (!publicOnly) requireStaff(actor);
      if (query.provider !== undefined && !["youtube","tiktok","facebook"].includes(String(query.provider))) {
        throw new VideoAdmissionError(400, "video_invalid_provider", "Unsupported provider");
      }
      if (query.before !== undefined && (typeof query.before !== "string" || !videoUuid.test(query.before))) {
        throw new VideoAdmissionError(400, "video_invalid_cursor", "Invalid cursor");
      }
      const limit = query.limit === undefined ? 20 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new VideoAdmissionError(400,"video_invalid_limit","Limit out of range");
      return store.list({tenantId, publicOnly, limit,
        ...(query.provider === undefined ? {} : {provider: query.provider as VideoProvider}),
        ...(query.before === undefined ? {} : {before: query.before as string})});
    },
  };
}
