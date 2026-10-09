import type { PlatformSessionIdentity } from "@masanawa/security";
import type { HumanDmRealtimeRepository, SyncPage } from "./postgres_repository.js";

export class HumanDmRealtimeError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "HumanDmRealtimeError";
  }
}
export interface HumanDmRealtimeAuthorizer {
  authorize(input: { authorizationHeader: string | undefined }): Promise<PlatformSessionIdentity>;
}
export interface HumanDmRealtimeService {
  sync(input: {
    authorizationHeader?: string | undefined;
    cursor?: string;
    limit?: number;
    waitMs?: number;
    /** When a client disconnects, stop polling; do not send another response. */
    shouldStop?: () => boolean;
  }): Promise<SyncPage>;
}

const MAX_CURSOR = 9223372036854775807n;
export function validCursor(value: string): string {
  if (!/^(0|[1-9][0-9]{0,18})$/u.test(value) ||
      BigInt(value) > MAX_CURSOR) {
    throw new HumanDmRealtimeError("messages.sync_cursor_invalid",400);
  }
  return value;
}
function bounds(limit: number | undefined, waitMs: number | undefined) {
  const size = limit ?? 50;
  const duration = waitMs ?? 0;
  if (!Number.isSafeInteger(size) || size < 1 || size > 100 ||
      !Number.isSafeInteger(duration) || duration < 0 || duration > 15000) {
    throw new HumanDmRealtimeError("messages.sync_bounds_invalid",400);
  }
  return { size,duration };
}
export function createHumanDmRealtimeService(input: {
  repository: HumanDmRealtimeRepository;
  authorizer: HumanDmRealtimeAuthorizer;
  sleep?: (ms: number) => Promise<void>;
}): HumanDmRealtimeService {
  const sleep = input.sleep ?? ((ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve,ms)));
  return Object.freeze<HumanDmRealtimeService>({
    async sync({ authorizationHeader, cursor, limit, waitMs, shouldStop }) {
      // Verify real Gateway session before DB calls and before opening a
      // wait loop. Never accept tenant/user/device IDs from the request body.
      const principal = await input.authorizer.authorize({ authorizationHeader });
      const tenantId = principal.tenantId, userId = principal.userId;
      const after = validCursor(cursor ?? "0");
      const initialSnapshot = cursor === undefined;
      const { size, duration } = bounds(limit,waitMs);
      if (shouldStop?.()) {
        return { events:[],nextCursor:after,hasMore:false,resetRequired:initialSnapshot };
      }
      const deadline = Date.now() + duration;
      let attempts = 0;
      while (true) {
        // A 15-second wait cannot keep using a token revoked during the
        // wait; recheck the canonical session before each subsequent read.
        if (attempts++ > 0) {
          const renewed = await input.authorizer.authorize({
            authorizationHeader,
          });
          if (renewed.tenantId !== tenantId || renewed.userId !== userId) {
            throw new HumanDmRealtimeError("messages.sync_session_changed",401);
          }
          if (shouldStop?.()) return {
            events:[],nextCursor:after,hasMore:false,resetRequired:false,
          };
        }
        const result = await input.repository.sync({
          tenantId,userId,after,limit:size,
        });
        if (shouldStop?.() || result.events.length || initialSnapshot ||
            Date.now() >= deadline) {
          // Session revocation can race the database read. Reauthorize just
          // before releasing private event metadata to the caller.
          const finalPrincipal = await input.authorizer.authorize({
            authorizationHeader,
          });
          if (finalPrincipal.tenantId !== tenantId ||
              finalPrincipal.userId !== userId) {
            throw new HumanDmRealtimeError("messages.sync_session_changed",401);
          }
          if (shouldStop?.()) return {
            events:[],nextCursor:after,hasMore:false,resetRequired:false,
          };
          return {
            ...result,
            resetRequired: initialSnapshot || result.resetRequired,
          };
        }
        await sleep(Math.min(750,Math.max(1,deadline-Date.now())));
      }
    },
  });
}
