import type {
  DirectTwinInstructionRecord,
  DirectTwinRepository,
  DirectTwinSeatRecord,
} from "./service.js";

interface SqlResult<Row> {
  readonly rows: Row[];
  readonly rowCount: number | null;
}

export interface DirectTwinSqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
}

interface SeatRow extends Record<string, unknown> {
  tenant_id: string;
  talk_id: string;
  seat_id: string;
  persona_id: string;
  kind: "expert" | "twin";
  owner_user_id: string | null;
  admitted: boolean;
  removed: boolean;
}

interface InstructionRow extends Record<string, unknown> {
  tenant_id: string;
  talk_id: string;
  seat_id: string;
  persona_id: string;
  owner_user_id: string;
  revision: number;
  instruction: string | null;
  updated_at: string | Date;
  expires_at: string | Date | null;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function seat(row: SeatRow): DirectTwinSeatRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    talkId: row.talk_id,
    seatId: row.seat_id,
    personaId: row.persona_id,
    kind: row.kind,
    ownerUserId: row.owner_user_id,
    admitted: row.admitted,
    removed: row.removed,
  });
}

function instruction(row: InstructionRow): DirectTwinInstructionRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    talkId: row.talk_id,
    seatId: row.seat_id,
    personaId: row.persona_id,
    ownerUserId: row.owner_user_id,
    revision: Number(row.revision),
    instruction: row.instruction,
    updatedAt: iso(row.updated_at),
    expiresAt: row.expires_at === null ? null : iso(row.expires_at),
  });
}

export function createPostgresDirectTwinRepository(
  pool: DirectTwinSqlPool,
): DirectTwinRepository {
  return Object.freeze<DirectTwinRepository>({
    async readSeat(input) {
      const result = await pool.query<SeatRow>(
        `SELECT s.tenant_id,
                s.talk_id,
                s.participant_id AS seat_id,
                s.persona_id,
                s.kind,
                owner.user_id AS owner_user_id,
                s.active AS admitted,
                NOT s.active AS removed
           FROM talks.talk_seats s
           LEFT JOIN talks.persona_profiles p
             ON p.tenant_id = s.tenant_id
            AND p.public_id = s.persona_id
           LEFT JOIN talks.public_profiles owner
             ON owner.tenant_id = p.tenant_id
            AND owner.handle = p.owner_handle
          WHERE s.tenant_id = $1
            AND s.talk_id = $2
            AND s.participant_id = $3
          LIMIT 1`,
        [input.tenantId, input.talkId, input.seatId],
      );
      return result.rows[0] ? seat(result.rows[0]) : null;
    },

    async listOwnedTwinSeats(input) {
      const result = await pool.query<SeatRow>(
        `SELECT s.tenant_id,
                s.talk_id,
                s.participant_id AS seat_id,
                s.persona_id,
                s.kind,
                owner.user_id AS owner_user_id,
                s.active AS admitted,
                NOT s.active AS removed
           FROM talks.talk_seats s
           JOIN talks.persona_profiles p
             ON p.tenant_id = s.tenant_id
            AND p.public_id = s.persona_id
           JOIN talks.public_profiles owner
             ON owner.tenant_id = p.tenant_id
            AND owner.handle = p.owner_handle
          WHERE s.tenant_id = $1
            AND s.talk_id = $2
            AND s.kind = 'twin'
            AND s.active = TRUE
            AND owner.user_id = $3
          ORDER BY s.participant_id ASC`,
        [input.tenantId, input.talkId, input.ownerUserId],
      );
      return Object.freeze(result.rows.map(seat));
    },

    async readInstruction(input) {
      const result = await pool.query<InstructionRow>(
        `SELECT tenant_id,talk_id,seat_id,persona_id,owner_user_id,
                revision,instruction,updated_at,expires_at
           FROM talks.direct_twin_instructions
          WHERE tenant_id=$1 AND talk_id=$2 AND seat_id=$3
          LIMIT 1`,
        [input.tenantId, input.talkId, input.seatId],
      );
      return result.rows[0] ? instruction(result.rows[0]) : null;
    },

    async writeInstruction(input) {
      const result = await pool.query<InstructionRow>(
        `INSERT INTO talks.direct_twin_instructions(
           tenant_id,talk_id,seat_id,persona_id,owner_user_id,
           revision,instruction,updated_at,expires_at
         )
         SELECT $1,$2,$3,$4,$5,1,$7,$8,$9
          WHERE $6::int IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM talks.direct_twin_instructions
               WHERE tenant_id=$1 AND talk_id=$2 AND seat_id=$3
            )
         ON CONFLICT (tenant_id,talk_id,seat_id) DO UPDATE
           SET persona_id=EXCLUDED.persona_id,
               owner_user_id=EXCLUDED.owner_user_id,
               revision=talks.direct_twin_instructions.revision+1,
               instruction=EXCLUDED.instruction,
               updated_at=EXCLUDED.updated_at,
               expires_at=EXCLUDED.expires_at
         WHERE talks.direct_twin_instructions.revision=$6
         RETURNING tenant_id,talk_id,seat_id,persona_id,owner_user_id,
                   revision,instruction,updated_at,expires_at`,
        [
          input.tenantId,
          input.talkId,
          input.seatId,
          input.personaId,
          input.ownerUserId,
          input.expectedRevision,
          input.instruction,
          input.updatedAt,
          input.expiresAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Direct Twin instruction revision conflict");
      return instruction(row);
    },
  });
}
