import { toInstant } from "@masanawa/contracts";
import {
  assertCurrentAuthority,
  type AuthorityContext,
} from "@masanawa/security";
import {
  assertWorkflowRunAccess,
  type WorkflowCurrentAuthorityGate,
} from "@masanawa/workflows";
import type { Pool } from "pg";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";
import { withTransaction } from "../transaction.js";

/**
 * Revalidates the admitted authority against current PostgreSQL policy/revocation
 * immediately before each Workflow node executes.
 *
 * Domain adapters invoked by the node must still enforce their own authority at
 * the consequential transaction boundary.
 */
export function createPostgresWorkflowCurrentAuthorityGate(
  pool: Pool,
): WorkflowCurrentAuthorityGate {
  return Object.freeze({
    async assertCurrent(input) {
      await withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ at: Date }>(
            "SELECT clock_timestamp() AS at",
          );
          const at = toInstant(result.rows[0]!.at);
          await assertCurrentAuthority(
            input.authority as AuthorityContext,
            createPostgresCurrentAuthoritySource(client),
            at,
          );
          assertWorkflowRunAccess(
            input.authority,
            input.run,
            "update",
            at,
          );
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}
