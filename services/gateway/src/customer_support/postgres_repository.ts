
import type { SupportTicket, SupportTicketStore } from "./model.js";

interface QueryResult<Row> { readonly rows: Row[]; readonly rowCount: number | null }
export interface SupportSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
}
interface TicketRow extends Record<string, unknown> {
  id: string; kind: SupportTicket["kind"]; reference_mask: string | null;
  operation_phase: SupportTicket["operationPhase"]; summary: string;
  status: SupportTicket["status"]; resolution: string | null;
  created_at: string | Date; updated_at: string | Date;
}
const selectColumns = "id, kind, reference_mask, operation_phase, summary, status, resolution, created_at, updated_at";
function map(row: TicketRow): SupportTicket {
  const iso = (v: string | Date) => v instanceof Date ? v.toISOString() : new Date(v).toISOString();
  return Object.freeze({ id: row.id, kind: row.kind, referenceMask: row.reference_mask,
    operationPhase: row.operation_phase, summary: row.summary, status: row.status,
    resolution: row.resolution, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
}
export function createPostgresSupportTicketStore(pool: SupportSqlPool): SupportTicketStore {
  return Object.freeze({
    async create(input) {
      const created = await pool.query<TicketRow>(
        `INSERT INTO support.customer_tickets
          (tenant_id, user_id, id, request_key, request_digest, kind, operation_ref, reference_mask,
           operation_phase, summary, consented_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$11)
         ON CONFLICT (tenant_id, user_id, request_key) DO UPDATE
           SET request_key = EXCLUDED.request_key
         WHERE support.customer_tickets.request_digest = EXCLUDED.request_digest
         RETURNING ${selectColumns}`,
        [input.tenantId, input.userId, input.id, input.requestKey, input.requestDigest, input.kind,
         input.reference, input.referenceMask, input.operationPhase, input.summary, input.createdAt],
      );
      return created.rows[0] ? map(created.rows[0]) : null;
    },
    async list(input) {
      const result = await pool.query<TicketRow>(
        `SELECT ${selectColumns} FROM support.customer_tickets
           WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC, id DESC LIMIT $3`,
        [input.tenantId, input.userId, input.limit]);
      return Object.freeze(result.rows.map(map));
    },
    async read(input) {
      const result = await pool.query<TicketRow>(
        `SELECT ${selectColumns} FROM support.customer_tickets
           WHERE tenant_id=$1 AND user_id=$2 AND id=$3 LIMIT 1`,
        [input.tenantId, input.userId, input.id]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
  });
}
