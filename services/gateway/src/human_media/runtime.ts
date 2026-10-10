import type { createPrivateVoiceNoteService } from "./service.js";
import { composeHumanVoiceNotes } from "./composition.js";
import { registerHumanVoiceRoutes } from "./routes.js";
import type { FastifyInstance } from "fastify";
import type { VoiceSqlPool } from "./postgres_repository.js";
import type { VoiceNoteAuthorizer } from "./service.js";

/** Cleanup is a durable SQL/S3 reconciliation sweep, never a best-effort deletion of a
 * local file. Run on one Gateway node or on multiple nodes: the repository's
 * SKIP LOCKED claims prevent parallel object deletion in a single sweep.
 *
 * The interval is intentionally owned by the Gateway lifecycle, not a detached
 * background promise. Never log object keys or private media contents.
 */
export function startHumanVoiceGarbageCollector(
  service: Pick<ReturnType<typeof createPrivateVoiceNoteService>, "collectGarbage">,
  input: Readonly<{
    intervalMs?: number;
    batchSize?: number;
    onFailure?: () => void;
  }> = {},
): { stop(): Promise<void>; sweep(): Promise<void> } {
  const intervalMs = input.intervalMs ?? 60_000;
  const batchSize = input.batchSize ?? 20;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 10_000 ||
      intervalMs > 86_400_000 || !Number.isSafeInteger(batchSize) ||
      batchSize < 1 || batchSize > 100) {
    throw new RangeError("Invalid private voice cleanup bounds");
  }
  let stopped = false;
  let inFlight: Promise<void> | undefined;
  const signalFailure=()=>{try{input.onFailure?.()}catch{/* payload-free observability must not stop retries */}};
  const sweep = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    const run = Promise.resolve()
      .then(() => service.collectGarbage(batchSize))
      .then(result => {if(result.failed>0)signalFailure();})
      .catch(() => {
        // A failure MUST NOT stop future cleanup attempts. The callback is
        // intentionally payload-free: no storage keys, account IDs or audio.
        signalFailure();
      });
    inFlight = run.finally(() => { inFlight = undefined; });
    return inFlight;
  };
  const timer = setInterval(() => { void sweep(); }, intervalMs);
  // A background cleanup sweep must not prevent a clean process shutdown.
  timer.unref?.();
  void sweep();
  return {
    sweep,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
    },
  };
}

export type HumanVoiceModuleConfig = Readonly<{
  pool: VoiceSqlPool;
  authorizer: VoiceNoteAuthorizer;
  privateS3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
  cleanup?: { intervalMs?: number; batchSize?: number; onFailure?: () => void };
}>;

/** Complete C04-owned, opt-in module mount for the SINGLE Gateway composer.
 * This function does not invent a second auth server or a fallback public bucket.
 * C01/C02 migrations and canonical session wiring must exist before mount.
 *
 * Call the returned shutdown during Fastify close; attaching the onClose hook
 * here prevents the cleanup loop from outliving the authenticated server.
 */
export function installHumanVoiceModule(
  app: FastifyInstance,
  config: HumanVoiceModuleConfig,
): void {
  // Validate ALL configuration and build private storage before exposing routes.
  const service = composeHumanVoiceNotes(config);
  const collector = startHumanVoiceGarbageCollector(service, config.cleanup);
  try {
    registerHumanVoiceRoutes(app, service);
    app.addHook("onClose", async () => { await collector.stop(); });
  } catch (error) {
    void collector.stop();
    throw error;
  }
}
