import type { GeminiCredentialPool } from "../production_inference.js";
import type { ReplayMediaRepository } from "../talk_replay/egress/postgres_media_repository.js";
import type { ReplayObjectStore } from "../talk_replay/playback/s3_object_store.js";
import { createGeminiReplayInsightProcessor } from "./gemini_processor.js";
import type { ReplayInsightAuthorizer } from "./model.js";
import { createPostgresReplayInsightRepository, type InsightSqlPool } from "./postgres_repository.js";
import { createReplayInsightService, type ReplayInsightService } from "./service.js";

// Sole Gateway integrator registers routes only after F09 clearances and F11
// migrations are qualified. This factory installs no routes or startup work.
export function composeReplayInsights(input: Readonly<{
  pool: InsightSqlPool;
  authorizer: ReplayInsightAuthorizer;
  media: ReplayMediaRepository;
  objects: ReplayObjectStore;
  credentials: GeminiCredentialPool;
  objectOrigin: string;
  fetchImpl?: typeof fetch;
}>): ReplayInsightService {
  const repository = createPostgresReplayInsightRepository(input.pool);
  const processor = createGeminiReplayInsightProcessor({
    media:input.media, objects:input.objects, credentials:input.credentials,
    objectOrigin:input.objectOrigin,
    ...(input.fetchImpl ? {fetchImpl:input.fetchImpl} : {}),
    async authorizeSource(source) {
      const current = await repository.source(source.tenantId,source.hostUserId,source.talkId);
      return current !== null && current.recordingId === source.recordingId &&
        current.checksumSha256 === source.checksumSha256 &&
        current.replayRevision === source.replayRevision && current.hostUserId === source.hostUserId;
    },
  });
  return createReplayInsightService({repository,processor,authorizer:input.authorizer});
}
