import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  registerExternalVideoRoutes,
} from "./routes.js";
import type { VideoStore } from "./service.js";
import type { VideoPrincipal } from "./contract.js";
import {
  registerYouTubeSourceAdminRoutes,
} from "../youtube_websub/source_admin_routes.js";
import type { AdminYouTubeSourceStore } from "../youtube_websub/source_admin.js";
import {
  registerYouTubeWebSubRoutes,
} from "../youtube_websub/routes.js";
import type { YouTubeWebSubStore } from "../youtube_websub/service.js";

/**
 * One feature-owned L-VIDEO gateway composition boundary for J14/J15.
 * AF00 provides existing session/RBAC authority and canonical PostgreSQL
 * stores, and calls this exactly once from the shared gateway composition.
 * It does not add a second auth mechanism, provider scheduler or schema.
 */
export interface ExternalVideoDomainDeps {
  readonly enabled: () => boolean;
  readonly resolvePrincipal: (request: FastifyRequest) => Promise<VideoPrincipal>;
  readonly videoStore: VideoStore;
  readonly sourceStore: AdminYouTubeSourceStore;
  readonly webhookStore: YouTubeWebSubStore;
}

export async function registerExternalVideoDomain(
  app: FastifyInstance,
  deps: ExternalVideoDomainDeps,
): Promise<void> {
  await app.register(async (scope) => {
    // Fail closed, including after a live feature pause. The official provider
    // callback is also paused, and a 503 allows the hub to retry later.
    scope.addHook("onRequest", async (_request, reply) => {
      if (deps.enabled() !== true) {
        return reply.code(503).send({ code: "video_feature_disabled" });
      }
    });
    registerExternalVideoRoutes(scope, {
      store: deps.videoStore,
      resolvePrincipal: deps.resolvePrincipal,
    });
    registerYouTubeSourceAdminRoutes(scope, {
      store: deps.sourceStore,
      resolvePrincipal: deps.resolvePrincipal,
    });
    await registerYouTubeWebSubRoutes(scope, { store: deps.webhookStore });
  });
}
