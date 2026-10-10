import { randomUUID } from "node:crypto";
import { nextOccurrence, timezoneParts, type ScheduleRecord, type ScheduleSpec, type ScheduleState, ScheduleError } from "./domain.js";

export interface SqlResult<Row> { readonly rows: Row[]; readonly rowCount: number | null }
export interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}
export interface SqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
  connect(): Promise<SqlClient>;
}
export interface Actor { readonly tenantId: string; readonly userId: string }
export interface CreateCommand {
  readonly actor: Actor;
  readonly requestId: string;
  readonly fingerprint: string;
  readonly spec: ScheduleSpec;
  readonly dueAt: string;
}
export interface Occurrence {
  readonly occurrenceId: string;
  readonly scheduleId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly sequence: number;
  readonly scheduleRevision: number;
  readonly scheduledFor: string;
  readonly leaseToken: string;
}
export interface ScheduleRepository {
  create(command: CreateCommand): Promise<ScheduleRecord>;
  list(actor: Actor): Promise<readonly ScheduleRecord[]>;
  read(actor: Actor, id: string): Promise<ScheduleRecord | null>;
  change(actor: Actor, id: string, expectedRevision: number, state: ScheduleState, dueAt: string | null): Promise<ScheduleRecord>;
  cancelOwner(actor: Actor): Promise<number>;
  claimDue(now: Date, limit: number): Promise<readonly Occurrence[]>;
  reclaimExpired(now: Date, limit: number): Promise<readonly Occurrence[]>;
  readForDispatch(item: Occurrence): Promise<ScheduleRecord | null>;
  markStarted(item: Occurrence, now: Date): Promise<boolean>;
  markSkipped(item: Occurrence, now: Date): Promise<void>;
  finish(item: Occurrence, state: "sent" | "no_device" | "uncertain", now: Date): Promise<void>;
  expireUnknown(now: Date): Promise<number>;
}
type RecordRow = Record<string, unknown> & {
  schedule_id: string; kind: ScheduleSpec["kind"]; reference_id: string;
  frequency: ScheduleSpec["frequency"]; timezone: string;
  run_at: string | Date | null; local_time: string | null; day_of_week: number | null;
  quiet_start: string; quiet_end: string; state: ScheduleState; revision: number;
  next_due_at: string | Date | null;
};
type OccurrenceRow = Record<string, unknown> & {
  occurrence_id: string; schedule_id: string; tenant_id: string; user_id: string;
  sequence: number; schedule_revision: number; scheduled_for: Date | string;
  lease_token: string;
};
function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}
function record(row: RecordRow): ScheduleRecord {
  return Object.freeze({
    id: row.schedule_id, kind: row.kind, referenceId: row.reference_id,
    frequency: row.frequency, timezone: row.timezone,
    ...(row.run_at ? {runAt: iso(row.run_at)!} : {}),
    ...(row.local_time ? {localTime: row.local_time.trim()} : {}),
    ...(row.day_of_week ? {dayOfWeek: row.day_of_week} : {}),
    quietStart: row.quiet_start.trim(), quietEnd: row.quiet_end.trim(), optedIn: true as const,
    state: row.state, revision: Number(row.revision), nextDueAt: iso(row.next_due_at),
  });
}
function occurrence(row: OccurrenceRow): Occurrence {
  return Object.freeze({
    occurrenceId: row.occurrence_id, scheduleId: row.schedule_id,
    tenantId: row.tenant_id, userId: row.user_id,
    sequence: Number(row.sequence), scheduleRevision: Number(row.schedule_revision),
    scheduledFor: iso(row.scheduled_for)!, leaseToken: row.lease_token,
  });
}
async function transaction<T>(pool: SqlPool, task: (client: SqlClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await task(c);
    await c.query("COMMIT");
    return result;
  } catch (error) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { c.release(); }
}
const fields = `schedule_id,kind,reference_id,frequency,timezone,run_at,local_time,
 day_of_week,quiet_start,quiet_end,state,revision,next_due_at`;
const occurrenceFields = `occurrence_id,schedule_id,tenant_id,user_id,sequence,
 schedule_revision,scheduled_for,lease_token`;
export function createPostgresScheduleRepository(pool: SqlPool): ScheduleRepository {
  return Object.freeze({
    async create(input) {
      return transaction(pool, async c => {
        // Exclusive per-account creation lock; a concurrent cap check cannot admit >20.
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [`${input.actor.tenantId}:operator-schedule:${input.actor.userId}`]);
        const existing = await c.query<RecordRow & {payload_sha256: string}>(
          `SELECT ${fields},payload_sha256 FROM operator_scheduling.schedules
            WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3`,
          [input.actor.tenantId, input.actor.userId, input.requestId]);
        if (existing.rows[0]) {
          if (existing.rows[0].payload_sha256 !== input.fingerprint)
            throw new ScheduleError("schedule.idempotency_conflict",409);
          return record(existing.rows[0]);
        }
        const count = await c.query<{total: string}>(
          `SELECT count(*)::text AS total FROM operator_scheduling.schedules
            WHERE tenant_id=$1 AND user_id=$2 AND state <> 'cancelled'`,
          [input.actor.tenantId, input.actor.userId]);
        if (Number(count.rows[0]?.total ?? "0") >= 20)
          throw new ScheduleError("schedule.limit_reached",429);
        const s = input.spec;
        const created = await c.query<RecordRow>(
          `INSERT INTO operator_scheduling.schedules
           (schedule_id,tenant_id,user_id,request_id,payload_sha256,kind,reference_id,
            frequency,timezone,run_at,local_time,day_of_week,quiet_start,quiet_end,next_due_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING ${fields}`,
          [randomUUID(),input.actor.tenantId,input.actor.userId,input.requestId,
           input.fingerprint,s.kind,s.referenceId,s.frequency,s.timezone,
           s.runAt ?? null,s.localTime ?? null,s.dayOfWeek ?? null,
           s.quietStart,s.quietEnd,input.dueAt]);
        return record(created.rows[0]!);
      });
    },
    async list(actor) {
      const rows = await pool.query<RecordRow>(
        `SELECT ${fields} FROM operator_scheduling.schedules
          WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC,schedule_id DESC LIMIT 100`,
        [actor.tenantId, actor.userId]);
      return Object.freeze(rows.rows.map(record));
    },
    async read(actor, id) {
      const rows = await pool.query<RecordRow>(
        `SELECT ${fields} FROM operator_scheduling.schedules
          WHERE tenant_id=$1 AND user_id=$2 AND schedule_id=$3`,
        [actor.tenantId, actor.userId, id]);
      return rows.rows[0] ? record(rows.rows[0]) : null;
    },
    async change(actor, id, expectedRevision, state, dueAt) {
      return transaction(pool, async c => {
        const updated = await c.query<RecordRow>(
          `UPDATE operator_scheduling.schedules
              SET state=$5,next_due_at=$6,revision=revision+1,updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND user_id=$2 AND schedule_id=$3
              AND revision=$4 AND state<>'cancelled'
            RETURNING ${fields}`,
          [actor.tenantId,actor.userId,id,expectedRevision,state,dueAt]);
        const row = updated.rows[0];
        if (!row) throw new ScheduleError("schedule.revision_conflict_or_missing",409);
        // Unsent leased occurrences are fenced. A sending attempt is permanently
        // uncertain until the provider returns; never claim revocation mid-send.
        await c.query(
          `UPDATE operator_scheduling.occurrences SET state='skipped',finished_at=clock_timestamp()
           WHERE schedule_id=$1 AND state='claimed'`,[id]);
        return record(row);
      });
    },
    async cancelOwner(actor) {
      return transaction(pool, async c => {
        const updated = await c.query<{schedule_id:string}>(
          `UPDATE operator_scheduling.schedules SET state='cancelled',next_due_at=NULL,
             revision=revision+1,updated_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2 AND state<>'cancelled'
           RETURNING schedule_id`,[actor.tenantId, actor.userId]);
        await c.query(
          `UPDATE operator_scheduling.occurrences o SET state='skipped',finished_at=clock_timestamp()
           WHERE tenant_id=$1 AND user_id=$2 AND state='claimed'`,
          [actor.tenantId,actor.userId]);
        return updated.rows.length;
      });
    },
    async claimDue(now, limit) {
      const max = Math.max(1,Math.min(50,limit));
      return transaction(pool, async c => {
        const due = await c.query<RecordRow>(
          `SELECT ${fields} FROM operator_scheduling.schedules
           WHERE state='active' AND next_due_at<=$1
           ORDER BY next_due_at,schedule_id FOR UPDATE SKIP LOCKED LIMIT $2`,
           [now.toISOString(),max]);
        const all: Occurrence[] = [];
        for (const row of due.rows) {
          const s = record(row);
          const when = s.nextDueAt!;
          const lastDate = timezoneParts(Date.parse(when),s.timezone).date;
          const next = nextOccurrence(s,Math.max(now.getTime(),Date.parse(when)),lastDate);
          // Sequence is incremented atomically by the database.
          const changed = await c.query<{sequence: number}>(
            `UPDATE operator_scheduling.schedules
             SET sequence=sequence+1,next_due_at=$2,updated_at=clock_timestamp()
             WHERE schedule_id=$1 RETURNING sequence`,[s.id,next]);
          const item = await c.query<OccurrenceRow>(
            `INSERT INTO operator_scheduling.occurrences
             (occurrence_id,schedule_id,tenant_id,user_id,sequence,schedule_revision,
              scheduled_for,state,lease_token,lease_until)
             SELECT $1,schedule_id,tenant_id,user_id,$2,revision,$3,'claimed',$4,$5
             FROM operator_scheduling.schedules WHERE schedule_id=$6
             RETURNING ${occurrenceFields}`,
            [randomUUID(),changed.rows[0]!.sequence,when,randomUUID(),
             new Date(now.getTime()+30_000).toISOString(),s.id]);
          all.push(occurrence(item.rows[0]!));
        }
        return all;
      });
    },
    async reclaimExpired(now, limit) {
      const rows = await pool.query<OccurrenceRow>(
        `WITH expired AS (
           SELECT occurrence_id FROM operator_scheduling.occurrences
           WHERE state='claimed' AND lease_until<$1
           ORDER BY lease_until,occurrence_id
           FOR UPDATE SKIP LOCKED LIMIT $2
         )
         UPDATE operator_scheduling.occurrences o
            SET lease_token=$3,lease_until=$4
          FROM expired e WHERE o.occurrence_id=e.occurrence_id
         RETURNING ${occurrenceFields.split(",").map(x=>"o."+x.trim()).join(",")}`,
         [now.toISOString(),Math.max(1,Math.min(50,limit)),randomUUID(),
           new Date(now.getTime()+30_000).toISOString()]);
      return rows.rows.map(occurrence);
    },
    async readForDispatch(item) {
      const result = await pool.query<RecordRow>(
        `SELECT ${fields} FROM operator_scheduling.schedules
         WHERE schedule_id=$1 AND tenant_id=$2 AND user_id=$3 AND state='active'
           AND revision=$4`,
        [item.scheduleId,item.tenantId,item.userId,item.scheduleRevision]);
      return result.rows[0] ? record(result.rows[0]) : null;
    },
    async markStarted(item, now) {
      const result = await pool.query<{occurrence_id:string}>(
        `UPDATE operator_scheduling.occurrences o
         SET state='sending',sending_at=$3,lease_until=NULL
         WHERE o.occurrence_id=$1 AND o.lease_token=$2 AND o.state='claimed'
           AND o.lease_until>=$3
           AND EXISTS(SELECT 1 FROM operator_scheduling.schedules s
              WHERE s.schedule_id=o.schedule_id AND s.tenant_id=o.tenant_id
                AND s.user_id=o.user_id AND s.state='active'
                AND s.revision=o.schedule_revision)
         RETURNING occurrence_id`,
        [item.occurrenceId,item.leaseToken,now.toISOString()]);
      return result.rows.length === 1;
    },
    async markSkipped(item, now) {
      await pool.query(
        `UPDATE operator_scheduling.occurrences SET state='skipped',finished_at=$3,lease_until=NULL
          WHERE occurrence_id=$1 AND lease_token=$2 AND state='claimed'`,
          [item.occurrenceId,item.leaseToken,now.toISOString()]);
    },
    async finish(item, state, now) {
      await pool.query(
        `UPDATE operator_scheduling.occurrences
          SET state=$3,finished_at=$4 WHERE occurrence_id=$1 AND lease_token=$2 AND state='sending'`,
          [item.occurrenceId,item.leaseToken,state,now.toISOString()]);
    },
    async expireUnknown(now) {
      const r = await pool.query<{occurrence_id:string}>(
        `UPDATE operator_scheduling.occurrences
         SET state='uncertain',finished_at=$1
         WHERE state='sending' AND sending_at<$2 RETURNING occurrence_id`,
        [now.toISOString(),new Date(now.getTime()-120_000).toISOString()]);
      return r.rows.length;
    },
  });
}
