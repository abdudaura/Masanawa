import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import { createPostgresHumanDmRepository, type HumanDmPool } from "./postgres_repository.js";
import { createHumanDmService, type HumanDmService } from "./service.js";
/** C02 composer interface for existing main.ts/Gateway integrator; no second auth, pool or API server. */
export function composeHumanDmService(input: {
  pool: HumanDmPool;
  sessions: PlatformCustomerSessionAuthorizer;
}): HumanDmService {
  return createHumanDmService({
    repository:createPostgresHumanDmRepository(input.pool),
    authorizer:input.sessions,
  });
}
