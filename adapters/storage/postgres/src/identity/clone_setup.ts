import { parseCanonicalId } from "@masanawa/contracts";
import { CloneSetupError, emptyCloneSetupProfile, patchCloneSetupProfile, type CloneSetup, type CloneSetupRepository, type CloneSetupScope } from "@masanawa/identity";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

interface Row {
  tenant_id: CloneSetup["tenantId"];
  user_id: CloneSetup["userId"];
  revision: string;
  state: CloneSetup["state"];
  profile: CloneSetup["profile"];
  confirmation_request_id: string | null;
  confirmation_preview_revision: string | null;
  result: CloneSetup["result"];
}
function decode(row: Row): CloneSetup {
  const revision = Number(row.revision);
  const previewRevision = row.confirmation_preview_revision === null ? null : Number(row.confirmation_preview_revision);
  if (!Number.isSafeInteger(revision) || revision < 1 || (previewRevision !== null && (!Number.isSafeInteger(previewRevision) || previewRevision < 1))) throw new CloneSetupError("invalid");
  return Object.freeze({
    schemaVersion: 1, tenantId: parseCanonicalId("tenant", row.tenant_id), userId: parseCanonicalId("user", row.user_id),
    revision, state: row.state, profile: patchCloneSetupProfile(emptyCloneSetupProfile(), row.profile),
    confirmationRequestId: row.confirmation_request_id === null ? null : parseCanonicalId("request", row.confirmation_request_id),
    confirmationPreviewRevision: previewRevision,
    result: row.result === null ? null : Object.freeze({ ...row.result }),
  });
}
async function active(client: PoolClient, scope: CloneSetupScope): Promise<void> {
  parseCanonicalId("tenant", scope.tenantId);
  parseCanonicalId("user", scope.userId);
  const result = await client.query(`SELECT u.user_id FROM identity.users u JOIN identity.tenants t USING (tenant_id)
    WHERE u.tenant_id=$1 AND u.user_id=$2 AND u.state='active' AND t.state='active' FOR SHARE OF u,t`, [scope.tenantId, scope.userId]);
  if (result.rowCount !== 1) throw new CloneSetupError("invalid");
}
export function createPostgresCloneSetupRepository(pool: Pool): CloneSetupRepository {
  return Object.freeze<CloneSetupRepository>({
    async read(scope) {
      return withTransaction(pool, async client => {
        await active(client, scope);
        const rows = await client.query<Row>("SELECT * FROM identity.clone_setups WHERE tenant_id=$1 AND user_id=$2", [scope.tenantId, scope.userId]);
        return rows.rows[0] ? decode(rows.rows[0]) : null;
      });
    },
    async mutate(scope, transition) {
      return withTransaction(pool, async client => {
        await active(client, scope);
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [JSON.stringify(["identity:clone-setup", scope.tenantId, scope.userId])]);
        const rows = await client.query<Row>("SELECT * FROM identity.clone_setups WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE", [scope.tenantId, scope.userId]);
        const current = rows.rows[0] ? decode(rows.rows[0]) : null;
        const next = transition(current);
        if (next.tenantId !== scope.tenantId || next.userId !== scope.userId) throw new CloneSetupError("invalid");
        if (current && JSON.stringify(current) === JSON.stringify(next)) return current;
        const values = [scope.tenantId, scope.userId, next.revision, next.state, JSON.stringify(next.profile), next.confirmationRequestId, next.confirmationPreviewRevision, next.result ? JSON.stringify(next.result) : null];
        const saved = current
          ? await client.query<Row>(`UPDATE identity.clone_setups SET revision=$3,state=$4,profile=$5::jsonb,
              confirmation_request_id=$6,confirmation_preview_revision=$7,result=$8::jsonb,updated_at=clock_timestamp()
              WHERE tenant_id=$1 AND user_id=$2 RETURNING *`, values)
          : await client.query<Row>(`INSERT INTO identity.clone_setups(tenant_id,user_id,revision,state,profile,confirmation_request_id,confirmation_preview_revision,result)
              VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb) RETURNING *`, values);
        return decode(saved.rows[0]!);
      });
    },
  });
}
