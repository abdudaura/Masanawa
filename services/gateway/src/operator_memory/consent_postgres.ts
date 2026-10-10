import type { Consent, ConsentPort, MemoryActor } from "./service.js";

/** Uses the SQL in sql/001_opt_in_consent.sql, applied only by migration owner. */
export interface ConsentSqlClient {
  query<T extends object>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}
interface ConsentRow { enabled: boolean; revision: number | string }
function decoded(row?: ConsentRow): Consent {
  if (!row) return Object.freeze({ enabled: false, revision: 0 });
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Invalid durable operator memory consent revision");
  }
  return Object.freeze({ enabled: row.enabled === true, revision });
}

export function createPostgresMemoryConsent(client: ConsentSqlClient): ConsentPort {
  return Object.freeze({
    async get(actor: MemoryActor): Promise<Consent> {
      const result = await client.query<ConsentRow>(
        "SELECT enabled, revision FROM operator_memory.opt_in_consent WHERE tenant_id = $1 AND user_id = $2",
        [actor.tenantId, actor.userId],
      );
      return decoded(result.rows[0]);
    },
    async compareAndSet(input): Promise<Consent | null> {
      // Atomic single-statement CAS, including the first opt-in; two concurrent
      // devices cannot overwrite a more recent opt-out or approval.
      const insert = input.expectedRevision === 0;
      const result = await client.query<ConsentRow>(
        insert
          ? "INSERT INTO operator_memory.opt_in_consent (tenant_id,user_id,enabled,revision,updated_at) VALUES ($1,$2,$3,1,now()) ON CONFLICT (tenant_id,user_id) DO NOTHING RETURNING enabled,revision"
          : "UPDATE operator_memory.opt_in_consent SET enabled=$3,revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND user_id=$2 AND revision=$4 RETURNING enabled,revision",
        insert
          ? [input.tenantId, input.userId, input.enabled]
          : [input.tenantId, input.userId, input.enabled, input.expectedRevision],
      );
      return result.rows[0] ? decoded(result.rows[0]) : null;
    },
  });
}
