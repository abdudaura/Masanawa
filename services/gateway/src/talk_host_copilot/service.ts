import { randomUUID } from "node:crypto";
import type { TalkRepository, TalkRecord } from "../talks/model.js";
import type { TalkAuthorizer } from "../talks/service.js";
import type { TalkAiSeatService } from "../talk_ai_seats/service.js";

export type HostPrepPhase = "draft" | "publishing" | "published";
export type HostPrepRecord = Readonly<{
  prepId: string; tenantId: string; hostUserId: string;
  title: string; topic: string; questions: readonly string[];
  revision: number; phase: HostPrepPhase; talkId: string | null;
  createdAt: string; updatedAt: string;
}>;
export type HostPrepView = Omit<HostPrepRecord, "tenantId" | "hostUserId">;

export interface HostPrepRepository {
  create(input: Omit<HostPrepRecord, "revision" | "phase" | "talkId">): Promise<HostPrepRecord>;
  read(input: { tenantId: string; hostUserId: string; prepId: string }): Promise<HostPrepRecord | null>;
  list(input: { tenantId: string; hostUserId: string; limit: number }): Promise<readonly HostPrepRecord[]>;
  edit(input: { tenantId: string; hostUserId: string; prepId: string; revision: number;
    title: string; topic: string; questions: readonly string[]; now: string }): Promise<HostPrepRecord | null>;
  beginPublish(input: { tenantId: string; hostUserId: string; prepId: string; revision: number;
    talkId: string; now: string }): Promise<HostPrepRecord | null>;
  finishPublish(input: { tenantId: string; hostUserId: string; prepId: string;
    talkId: string; now: string }): Promise<HostPrepRecord | null>;
}

export class HostPrepError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "HostPrepError";
  }
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new HostPrepError(`host_prep.${field}_invalid`, 400);
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new HostPrepError(`host_prep.${field}_invalid`, 400);
  }
  return normalized;
}
function questions(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 8) throw new HostPrepError("host_prep.questions_invalid", 400);
  return Object.freeze(value.map((v) => text(v, "question", 240)));
}
function prepId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new HostPrepError("host_prep.id_invalid", 400);
  }
  return value;
}
function view(record: HostPrepRecord): HostPrepView {
  return Object.freeze({
    prepId: record.prepId, title: record.title, topic: record.topic,
    questions: Object.freeze([...record.questions]), revision: record.revision,
    phase: record.phase, talkId: record.talkId, createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
function sameTalk(record: TalkRecord, prep: HostPrepRecord, talkId: string): boolean {
  return record.talkId === talkId &&
    record.tenantId === prep.tenantId &&
    record.hostUserId === prep.hostUserId;
}

export interface HostPrepService {
  create(input: { authorizationHeader: string | undefined; title: string; topic: string; questions: readonly string[] }): Promise<HostPrepView>;
  get(input: { authorizationHeader: string | undefined; prepId: string }): Promise<HostPrepView>;
  list(input: { authorizationHeader: string | undefined }): Promise<readonly HostPrepView[]>;
  edit(input: { authorizationHeader: string | undefined; prepId: string; revision: number;
    title: string; topic: string; questions: readonly string[] }): Promise<HostPrepView>;
  goLive(input: { authorizationHeader: string | undefined; prepId: string; revision: number;
    confirmGoLive: true }): Promise<HostPrepView>;
  verify(input: { authorizationHeader: string | undefined; prepId: string }): Promise<HostPrepView>;
  availableExperts(input: { authorizationHeader: string | undefined; prepId: string }): Promise<readonly unknown[]>;
  quoteExpert(input: { authorizationHeader: string | undefined; prepId: string; personaId: string }): Promise<unknown>;
}

export function createHostPrepService(deps: {
  authorizer: TalkAuthorizer;
  repository: HostPrepRepository;
  talks: TalkRepository;
  aiSeats?: Pick<TalkAiSeatService, "candidates" | "quote">;
  now?: () => string;
  createId?: () => string;
}): HostPrepService {
  const now = deps.now ?? (() => new Date().toISOString());
  const createId = deps.createId ?? randomUUID;
  async function owner(header: string | undefined) {
    return deps.authorizer.authorize({ authorizationHeader: header });
  }
  async function owned(header: string | undefined, id: string) {
    const actor = await owner(header);
    const record = await deps.repository.read({
      tenantId: actor.tenantId, hostUserId: actor.userId, prepId: prepId(id),
    });
    if (!record) throw new HostPrepError("host_prep.not_found", 404);
    return { actor, record };
  }
  async function canonicalRead(record: HostPrepRecord, talkId: string): Promise<boolean> {
    const found = await deps.talks.getTalk({
      tenantId: record.tenantId, talkId, viewerUserId: record.hostUserId,
    });
    if (!found) return false;
    if (!sameTalk(found.talk, record, talkId)) {
      throw new HostPrepError("host_prep.talk_conflict", 409);
    }
    return true;
  }
  async function settle(record: HostPrepRecord): Promise<HostPrepView> {
    const id = record.talkId;
    if (!id) throw new HostPrepError("host_prep.missing_publication_id", 500);
    const isPresent = await canonicalRead(record, id);
    if (!isPresent) throw new HostPrepError("host_prep.publication_unresolved", 409);
    const finished = await deps.repository.finishPublish({
      tenantId: record.tenantId, hostUserId: record.hostUserId,
      prepId: record.prepId, talkId: id, now: now(),
    });
    if (!finished) throw new HostPrepError("host_prep.publication_unresolved", 409);
    return view(finished);
  }
  return Object.freeze<HostPrepService>({
    async create(input) {
      const actor = await owner(input.authorizationHeader);
      const stamp = now();
      const record = await deps.repository.create({
        prepId: prepId(createId()), tenantId: actor.tenantId,
        hostUserId: actor.userId, title: text(input.title, "title", 160),
        topic: text(input.topic, "topic", 240), questions: questions(input.questions),
        createdAt: stamp, updatedAt: stamp,
      });
      return view(record);
    },
    async list(input) {
      const actor = await owner(input.authorizationHeader);
      const rows = await deps.repository.list({ tenantId: actor.tenantId,
        hostUserId: actor.userId, limit: 20 });
      return Object.freeze(rows.map(view));
    },
    async get(input) {
      const { record } = await owned(input.authorizationHeader, input.prepId);
      return view(record);
    },
    async edit(input) {
      const { actor, record } = await owned(input.authorizationHeader, input.prepId);
      if (!Number.isSafeInteger(input.revision) || input.revision < 1 ||
          record.phase !== "draft" || record.revision !== input.revision) {
        throw new HostPrepError("host_prep.stale_or_published", 409);
      }
      const updated = await deps.repository.edit({
        tenantId: actor.tenantId, hostUserId: actor.userId, prepId: record.prepId,
        revision: input.revision, title: text(input.title, "title", 160),
        topic: text(input.topic, "topic", 240), questions: questions(input.questions), now: now(),
      });
      if (!updated) throw new HostPrepError("host_prep.stale_or_published", 409);
      return view(updated);
    },
    async goLive(input) {
      if (input.confirmGoLive !== true) throw new HostPrepError("host_prep.confirmation_required", 400);
      const { actor, record } = await owned(input.authorizationHeader, input.prepId);
      if (record.phase !== "draft" || record.revision !== input.revision) {
        throw new HostPrepError("host_prep.stale_or_published", 409);
      }
      // One deterministic canonical Talk ID; a lost response cannot create a second Talk.
      const id = `talk_${record.prepId}`;
      const reserved = await deps.repository.beginPublish({
        tenantId: actor.tenantId, hostUserId: actor.userId, prepId: record.prepId,
        revision: input.revision, talkId: id, now: now(),
      });
      if (!reserved) throw new HostPrepError("host_prep.stale_or_published", 409);
      try {
        await deps.talks.createTalk({
          tenantId: actor.tenantId, talkId: id, hostUserId: actor.userId,
          hostName: text(actor.profile.name, "host_name", 160),
          title: reserved.title, topic: reserved.topic, createdAt: now(),
        });
      } catch {
        // Could be already committed or an indeterminate DB write. Never replay.
        throw new HostPrepError("host_prep.publication_unresolved", 409);
      }
      return settle(reserved);
    },
    async verify(input) {
      const { record } = await owned(input.authorizationHeader, input.prepId);
      if (record.phase === "draft") return view(record);
      return settle(record);
    },
    async availableExperts(input) {
      const { record } = await owned(input.authorizationHeader, input.prepId);
      if (!record.talkId || record.phase !== "published" || !deps.aiSeats) {
        throw new HostPrepError("host_prep.experts_unavailable", 409);
      }
      // Canonical Seat service owns role/availability/price admission; no inferred costs.
      return deps.aiSeats.candidates({ authorizationHeader: input.authorizationHeader, talkId: record.talkId });
    },
    async quoteExpert(input) {
      const { record } = await owned(input.authorizationHeader, input.prepId);
      if (!record.talkId || record.phase !== "published" || !deps.aiSeats) {
        throw new HostPrepError("host_prep.experts_unavailable", 409);
      }
      return deps.aiSeats.quote({
        authorizationHeader: input.authorizationHeader, talkId: record.talkId,
        personaId: text(input.personaId, "persona_id", 160), mode: "host_add",
      });
      // Quote is only a preview. No confirmation, payment, or admission here.
    },
  });
}
