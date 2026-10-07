import type { PlatformSessionIdentity } from "@masanawa/security";
import { isReplayPubliclyVisible } from "@masanawa/agents";
import type { TalkReplayEgress, ReplayEgressInfo } from "./livekit_egress.js";
import type { ReplayObjectStorage } from "./s3_storage.js";
import type {
  TalkReplayRecord,
  TalkReplayRepository,
  TalkReplayView,
} from "./model.js";

export interface TalkReplayAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export interface TalkReplayCoordinator {
  requestForHost(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    publicationPreference: "publish" | "private";
  }>): Promise<void>;
  ensureStarted(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
  }>): Promise<void>;
  stopForTalk(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<void>;
}

export interface TalkReplayService extends TalkReplayCoordinator {
  view(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkReplayView>;
  setPublished(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    published: boolean;
  }>): Promise<TalkReplayView>;
  reconcile(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<TalkReplayRecord | null>;
}

export class TalkReplayServiceError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkReplayServiceError";
  }
}

function bounded(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 180) {
    throw new TalkReplayServiceError(`talks.replay_${label}_invalid`, 400);
  }
  return normalized;
}

function providerStatus(
  info: ReplayEgressInfo,
): TalkReplayRecord["providerStatus"] {
  return info.status;
}

function publicView(
  record: TalkReplayRecord | null,
  viewerUserId: string,
  storage: ReplayObjectStorage,
  fallbackTalkId = "",
): TalkReplayView {
  if (!record) {
    return Object.freeze({
      talkId: fallbackTalkId,
      status: "unavailable",
      published: false,
    });
  }
  const host = record.hostUserId === viewerUserId;
  const published = isReplayPubliclyVisible(record.session);

  if (!host && !published) {
    return Object.freeze({
      talkId: record.talkId,
      status: "unavailable",
      published: false,
    });
  }

  const state = record.session.publicationState;
  const status: TalkReplayView["status"] =
    record.session.recordingState === "recording"
      ? record.providerStatus === "complete"
        ? "processing"
        : "recording"
      : state === "published"
        ? "published"
        : state === "blocked"
          ? "blocked"
          : "private";

  if (published && record.providerStatus === "complete") {
    const signed = storage.presignGet({
      objectKey: record.objectKey,
      expiresSeconds: 300,
    });
    const segment = record.session.segments.at(-1);
    return Object.freeze({
      talkId: record.talkId,
      status,
      published: true,
      ...(segment
        ? { durationSeconds: Math.max(1, Math.round(segment.durationMs / 1000)) }
        : {}),
      playbackUrl: signed.url,
      playbackExpiresAt: signed.expiresAt,
    });
  }

  return Object.freeze({
    talkId: record.talkId,
    status,
    published,
  });
}

function mapError(error: unknown): never {
  if (error instanceof TalkReplayServiceError) throw error;
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { readonly code?: unknown }).code === "string"
      ? (error as { readonly code: string }).code
      : error instanceof Error
        ? error.message
        : "talks.replay_failed";
  const status =
    code === "talks.not_found" || code === "talks.replay_not_found"
      ? 404
      : code === "talks.host_forbidden"
        ? 403
        : code.includes("not_live") ||
            code.includes("blocked") ||
            code.includes("not finalized") ||
            code.includes("no recorded media")
          ? 409
          : code.includes("egress") || code.includes("storage")
            ? 503
            : 400;
  throw new TalkReplayServiceError(code, status);
}

export function createTalkReplayService(input: Readonly<{
  repository: TalkReplayRepository;
  authorizer: TalkReplayAuthorizer;
  egress: TalkReplayEgress;
  storage: ReplayObjectStorage;
  now?: () => string;
}>): TalkReplayService {
  const now = input.now ?? (() => new Date().toISOString());

  async function identity(
    authorizationHeader: string | undefined,
  ): Promise<PlatformSessionIdentity> {
    return input.authorizer.authorize({ authorizationHeader });
  }

  async function tryStart(record: TalkReplayRecord): Promise<TalkReplayRecord> {
    if (record.egressId !== null) return record;
    try {
      const started = await input.egress.start({
        talkId: record.talkId,
        objectKey: record.objectKey,
      });
      return await input.repository.attachEgress({
        tenantId: record.tenantId,
        talkId: record.talkId,
        egressId: started.egressId,
        providerStatus: providerStatus(started),
        now: now(),
      });
    } catch (error) {
      await input.repository.markProvider({
        tenantId: record.tenantId,
        talkId: record.talkId,
        providerStatus: "requested",
        providerError:
          error instanceof Error ? error.message : "Replay start failed",
        now: now(),
      });
      return (await input.repository.read({
        tenantId: record.tenantId,
        talkId: record.talkId,
      })) ?? record;
    }
  }

  async function reconcileRecord(
    record: TalkReplayRecord,
  ): Promise<TalkReplayRecord> {
    if (!record.egressId || record.session.recordingState !== "recording") {
      return record;
    }
    let info: ReplayEgressInfo | null;
    try {
      info = await input.egress.inspect({ egressId: record.egressId });
    } catch {
      return record;
    }
    if (!info) return record;

    if (
      info.status === "starting" ||
      info.status === "active" ||
      info.status === "ending"
    ) {
      return (
        (await input.repository.markProvider({
          tenantId: record.tenantId,
          talkId: record.talkId,
          providerStatus: info.status,
          ...(info.error ? { providerError: info.error } : {}),
          now: now(),
        })) ?? record
      );
    }

    if (info.status === "complete") {
      try {
        const verified = await input.storage.sha256({
          objectKey: record.objectKey,
        });
        const reconciledAt = now();
        const startedAt = info.startedAt ?? record.session.startedAt;
        const endedAt = info.endedAt ?? reconciledAt;
        return await input.repository.finalizeSuccess({
          tenantId: record.tenantId,
          talkId: record.talkId,
          startedAt,
          endedAt,
          checksumSha256: verified.checksumSha256,
          now: reconciledAt,
        });
      } catch (error) {
        await input.repository.markProvider({
          tenantId: record.tenantId,
          talkId: record.talkId,
          providerStatus: "complete",
          providerError:
            error instanceof Error ? error.message : "Replay verification failed",
          now: now(),
        });
        return record;
      }
    }

    return input.repository.finalizeFailure({
      tenantId: record.tenantId,
      talkId: record.talkId,
      providerStatus: info.status,
      ...(info.error ? { providerError: info.error } : {}),
      now: now(),
    });
  }

  async function ensureStartedInternal(request: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    publicationPreference?: "publish" | "private";
  }>): Promise<void> {
    const existing = await input.repository.read({
      tenantId: request.tenantId,
      talkId: request.talkId,
    });
    const record =
      existing ??
      (request.publicationPreference
        ? await input.repository.prepare({
            tenantId: request.tenantId,
            talkId: request.talkId,
            hostUserId: request.hostUserId,
            publicationPreference: request.publicationPreference,
            now: now(),
          })
        : null);
    if (!record || record.hostUserId !== request.hostUserId) return;
    if (record.session.recordingState !== "recording") return;
    await tryStart(record);
  }

  return Object.freeze({
    async requestForHost(request) {
      try {
        await ensureStartedInternal(request);
      } catch (error) {
        mapError(error);
      }
    },

    async ensureStarted(request) {
      // This is intentionally retry-safe and non-fatal to the live audio session.
      try {
        await ensureStartedInternal(request);
      } catch {
        // Consent is already durable. A later Host reconnect can retry Egress.
      }
    },

    async stopForTalk(request) {
      try {
        let record = await input.repository.read({
          tenantId: request.tenantId,
          talkId: request.talkId,
        });
        if (!record || !record.egressId) return;
        if (
          record.providerStatus === "complete" ||
          record.providerStatus === "failed" ||
          record.providerStatus === "aborted" ||
          record.providerStatus === "limit_reached"
        ) {
          await reconcileRecord(record);
          return;
        }
        try {
          const stopped = await input.egress.stop({
            egressId: record.egressId,
          });
          const stoppedAt = now();
          if (stopped.status === "complete") {
            const verified = await input.storage.sha256({
              objectKey: record.objectKey,
            });
            await input.repository.finalizeSuccess({
              tenantId: record.tenantId,
              talkId: record.talkId,
              startedAt: stopped.startedAt ?? record.session.startedAt,
              endedAt: stopped.endedAt ?? stoppedAt,
              checksumSha256: verified.checksumSha256,
              now: stoppedAt,
            });
            return;
          }
          if (
            stopped.status === "failed" ||
            stopped.status === "aborted" ||
            stopped.status === "limit_reached"
          ) {
            await input.repository.finalizeFailure({
              tenantId: record.tenantId,
              talkId: record.talkId,
              providerStatus: stopped.status,
              ...(stopped.error ? { providerError: stopped.error } : {}),
              now: stoppedAt,
            });
            return;
          }
          record =
            (await input.repository.markProvider({
              tenantId: record.tenantId,
              talkId: record.talkId,
              providerStatus: stopped.status,
              ...(stopped.error ? { providerError: stopped.error } : {}),
              now: stoppedAt,
            })) ?? record;
        } catch {
          // Template Egress is tied to the room lifecycle and may already be ending.
        }
        await reconcileRecord(record);
      } catch {
        // Talk ending is authoritative even if replay provider cleanup must reconcile later.
      }
    },

    async reconcile(request) {
      const record = await input.repository.read({
        tenantId: request.tenantId,
        talkId: request.talkId,
      });
      return record ? reconcileRecord(record) : null;
    },

    async view(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = bounded(request.talkId, "talk_id");
      try {
        const record = await input.repository.read({
          tenantId: viewer.tenantId,
          talkId,
        });
        const reconciled = record ? await reconcileRecord(record) : null;
        return publicView(reconciled, viewer.userId, input.storage, talkId);
      } catch (error) {
        return mapError(error);
      }
    },

    async setPublished(request) {
      const viewer = await identity(request.authorizationHeader);
      const talkId = bounded(request.talkId, "talk_id");
      try {
        const record = await input.repository.setPublished({
          tenantId: viewer.tenantId,
          talkId,
          hostUserId: viewer.userId,
          published: request.published,
          now: now(),
        });
        return publicView(record, viewer.userId, input.storage);
      } catch (error) {
        return mapError(error);
      }
    },
  });
}
