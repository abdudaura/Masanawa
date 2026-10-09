import { randomUUID } from "node:crypto";
import {
  nextOccurrence, scheduleFingerprint, validateSpec,
  type ScheduleRecord, type ScheduleSpec, ScheduleError,
} from "./domain.js";
import type { Actor, ScheduleRepository } from "./repository.js";

export interface CustomerAuthority {
  authorize(input: Readonly<{authorizationHeader: string | undefined}>): Promise<Actor>;
}
export interface ReferenceAuthority {
  /** Real scoped domain lookup, not syntax-only verification.
   * A missing or unconfigured authorizer MUST deny scheduling.
   */
  canSchedule(actor: Actor, spec: ScheduleSpec): Promise<boolean>;
}
export interface ScheduleService {
  list(authorizationHeader: string | undefined): Promise<readonly ScheduleRecord[]>;
  create(input: Readonly<{
    authorizationHeader: string | undefined;
    requestId: string;
    spec: unknown;
  }>): Promise<ScheduleRecord>;
  change(input: Readonly<{
    authorizationHeader: string | undefined;
    scheduleId: string;
    revision: number;
    action: "pause" | "resume" | "cancel";
  }>): Promise<ScheduleRecord>;
}
function validateId(id: string, field: string): string {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ScheduleError(`schedule.${field}_invalid`);
  }
  return id;
}
export function createScheduleService(input: Readonly<{
  repository: ScheduleRepository;
  customers: CustomerAuthority;
  references: ReferenceAuthority;
  clock?: () => Date;
}>): ScheduleService {
  const clock = input.clock ?? (() => new Date());
  return Object.freeze<ScheduleService>({
    async list(header) {
      const actor = await input.customers.authorize({authorizationHeader:header});
      return input.repository.list(actor);
    },
    async create(request) {
      // Authenticate *before* validation or provider lookup to prevent enumeration.
      const actor = await input.customers.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      validateId(request.requestId,"request_id");
      const spec = validateSpec(request.spec,clock().getTime());
      if (!await input.references.canSchedule(actor,spec))
        throw new ScheduleError("schedule.reference_not_available",404);
      return input.repository.create({
        actor,requestId:request.requestId,fingerprint:scheduleFingerprint(spec),
        spec,dueAt:nextOccurrence(spec,clock().getTime())!,
      });
    },
    async change(request) {
      const actor = await input.customers.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      validateId(request.scheduleId,"id");
      if (!Number.isSafeInteger(request.revision) || request.revision <= 0)
        throw new ScheduleError("schedule.revision_invalid");
      if (!["pause","resume","cancel"].includes(request.action))
        throw new ScheduleError("schedule.action_invalid");
      const current = await input.repository.read(actor,request.scheduleId);
      if (!current || current.state === "cancelled")
        throw new ScheduleError("schedule.not_found",404);
      if (current.revision !== request.revision)
        throw new ScheduleError("schedule.revision_conflict_or_missing",409);
      let next: string | null = null;
      if (request.action === "resume") {
        if (!await input.references.canSchedule(actor,current))
          throw new ScheduleError("schedule.reference_not_available",404);
        next = nextOccurrence(current,clock().getTime());
        if (!next) throw new ScheduleError("schedule.already_elapsed",409);
      }
      return input.repository.change(
        actor,request.scheduleId,request.revision,
        request.action === "cancel" ? "cancelled" :
          request.action === "pause" ? "paused" : "active",
        next,
      );
    },
  });
}
export function createScheduleDeletionRevoker(repository: ScheduleRepository) {
  return Object.freeze({
    /** To be invoked in the authenticated account-deletion transaction boundary. */
    cancelAllForAccount(actor: Actor) { return repository.cancelOwner(actor); },
  });
}

