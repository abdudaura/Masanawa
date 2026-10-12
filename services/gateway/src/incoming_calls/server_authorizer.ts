import { timingSafeEqual } from "node:crypto";
import { IncomingCallError } from "./service.js";

/** Dedicated server credential; consumer sessions never confer initiation authority.
 * Current platform roster and recipient scope are checked by the service/repository.
 */
export function createIncomingServerAuthorizer(secret?: string) {
  const credential = secret?.trim();
  return Object.freeze({
    async authorize(request: {
      authorizationHeader: string | undefined;
      tenantId: string;
      characterId: string;
    }): Promise<void> {
      const expected = credential ? Buffer.from(`Bearer ${credential}`) : null;
      const actual = Buffer.from(request.authorizationHeader ?? "");
      if (
        !expected ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        throw new IncomingCallError("calls.incoming_server_forbidden", 403);
      }
    },
  });
}
