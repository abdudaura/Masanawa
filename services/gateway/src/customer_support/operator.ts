
import type { SupportSqlPool } from "./postgres_repository.js";
import { SupportError, type SupportTicket, type SupportTicketStatus } from "./model.js";

export interface SupportStaffAuthorizer {
  // Integration MUST validate platform-session identity + current trusted support
  // operator role, separately from ordinary citizen session authorization.
  authorize(input: Readonly<{ authorizationHeader: string | undefined }>): Promise<Readonly<{
    tenantId: string;
    actorId: string;
  }>>;
}
export interface SupportQueueTicket extends SupportTicket { readonly userId: string }
export interface SupportQueueRepository {
  queue(input: Readonly<{ tenantId: string; limit: number }>): Promise<readonly SupportQueueTicket[]>;
  transition(input: Readonly<{
    tenantId: string; actorId: string; ticketId: string;
    expectedStatus: SupportTicketStatus; nextStatus: SupportTicketStatus;
    resolution: string | null;
  }>): Promise<SupportQueueTicket | null>;
}
export interface SupportStaffService {
  queue(input: Readonly<{ authorizationHeader: string | undefined; limit: number }>): Promise<readonly SupportQueueTicket[]>;
  transition(input: Readonly<{
    authorizationHeader: string | undefined; ticketId: string;
    expectedStatus: SupportTicketStatus; nextStatus: SupportTicketStatus;
    resolution?: string;
  }>): Promise<SupportQueueTicket>;
}
const allowed: Readonly<Record<SupportTicketStatus, readonly SupportTicketStatus[]>> = {
  queued: ["reviewing"],
  reviewing: ["resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};
function map(row: Record<string, unknown>): SupportQueueTicket {
  const iso=(v:unknown)=>v instanceof Date?v.toISOString():new Date(String(v)).toISOString();
  return Object.freeze({
    id:String(row.id), userId:String(row.user_id),
    kind:row.kind as SupportTicket["kind"],referenceMask:row.reference_mask as string|null,
    operationPhase:row.operation_phase as SupportTicket["operationPhase"],
    summary:String(row.summary),status:row.status as SupportTicketStatus,
    resolution:row.resolution as string|null,
    createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),
  });
}
const cols="id, user_id, kind, reference_mask, operation_phase, summary, status, resolution, created_at, updated_at";
export function createPostgresSupportQueue(pool: SupportSqlPool): SupportQueueRepository {
  return Object.freeze({
    async queue(input) {
      const res=await pool.query(
        `SELECT ${cols} FROM support.customer_tickets
          WHERE tenant_id=$1 AND status IN ('queued','reviewing')
          ORDER BY created_at ASC, id ASC LIMIT $2`,[input.tenantId,input.limit]);
      return Object.freeze(res.rows.map(map));
    },
    async transition(input) {
      // One statement: no lost updates and immutable event emitted atomically.
      const res=await pool.query(
        `WITH changed AS (
           UPDATE support.customer_tickets
              SET status=$4,
                  resolution=CASE WHEN $4='resolved' THEN $6 ELSE resolution END,
                  updated_at=now()
            WHERE tenant_id=$1 AND id=$2::uuid AND status=$3
            RETURNING tenant_id, ${cols}
         ), audited AS (
           INSERT INTO support.ticket_events
             (tenant_id, ticket_id, actor_id, previous_status, next_status, resolution)
           SELECT tenant_id, id, $5, $3, $4, $6 FROM changed
           RETURNING ticket_id
         )
         SELECT ${cols} FROM changed
          WHERE EXISTS (SELECT 1 FROM audited)`,
        [input.tenantId,input.ticketId,input.expectedStatus,input.nextStatus,input.actorId,input.resolution]);
      return res.rows[0]?map(res.rows[0]):null;
    },
  });
}
export function createSupportStaffService(input: Readonly<{
  authorizer: SupportStaffAuthorizer;
  repository: SupportQueueRepository;
}>): SupportStaffService {
  return Object.freeze({
    async queue(request) {
      const staff=await input.authorizer.authorize({authorizationHeader:request.authorizationHeader});
      if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 100) {
        throw new SupportError("INVALID_LIMIT",400);
      }
      return input.repository.queue({tenantId:staff.tenantId,limit:request.limit});
    },
    async transition(request) {
      const staff=await input.authorizer.authorize({authorizationHeader:request.authorizationHeader});
      if (!/^[0-9a-f-]{36}$/iu.test(request.ticketId)) throw new SupportError("SUPPORT_NOT_FOUND",404);
      if (!allowed[request.expectedStatus]?.includes(request.nextStatus)) {
        throw new SupportError("INVALID_SUPPORT_TRANSITION",400);
      }
      const resolution=request.resolution?.trim()??null;
      if (request.nextStatus==="resolved" && (!resolution || resolution.length < 20 || resolution.length > 1000)) {
        throw new SupportError("SUPPORT_RESOLUTION_REQUIRED",400);
      }
      if (request.nextStatus!=="resolved" && resolution) {
        throw new SupportError("INVALID_SUPPORT_TRANSITION",400);
      }
      const updated=await input.repository.transition({
        tenantId:staff.tenantId,actorId:staff.actorId,ticketId:request.ticketId,
        expectedStatus:request.expectedStatus,nextStatus:request.nextStatus,resolution,
      });
      if (!updated) throw new SupportError("SUPPORT_CONFLICT_OR_UNAVAILABLE",409);
      return updated;
    },
  });
}
