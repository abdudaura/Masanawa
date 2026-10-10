import { createPostgresHumanDmRealtimeRepository, type RealtimeSqlPool } from "./postgres_repository.js";
import {
  createHumanDmRealtimeService,
  type HumanDmRealtimeAuthorizer,
  type HumanDmRealtimeService,
} from "./service.js";

/** A real C03 composition seam for the shared Gateway integrator.
 * Call only after C01/C02/C03 migrations are installed. Reuse the very same
 * pg Pool and canonical session authorizer used by human_messages C02.
 */
export function composeHumanDmRealtime(input: {
  pool:RealtimeSqlPool;
  authorizer:HumanDmRealtimeAuthorizer;
}):HumanDmRealtimeService {
  return createHumanDmRealtimeService({
    repository:createPostgresHumanDmRealtimeRepository(input.pool),
    authorizer:input.authorizer,
  });
}
