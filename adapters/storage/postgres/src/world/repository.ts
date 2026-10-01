import {
  PlatformError,
  toInstant,
  type CharacterId,
  type CharacterVersionId,
  type TenantId,
  type WorldEventId,
  type WorldGenerationId,
  type WorldId,
} from "@masanawa/contracts";
import {
  assertSimulationTimeDoesNotMoveBackward,
  normalizeSimulationInputKey,
  normalizeSimulationInputKind,
  normalizeWorldPolicy,
  type AdmitSimulationInput,
  type CharacterLifeState,
  type CharacterLifeStateChange,
  type CommitWorldGenerationInput,
  type CommitWorldGenerationResult,
  type CreateWorldInput,
  type SimulationInput,
  type World,
  type WorldEvent,
  type WorldEventDraft,
  type WorldGeneration,
  type WorldRepository,
} from "@masanawa/world";
import type { PoolClient } from "pg";

interface WorldRow {
  tenant_id: TenantId;
  world_id: WorldId;
  status: World["status"];
  policy: World["policy"];
  policy_revision: string;
  current_generation_id: WorldGenerationId;
  current_generation_number: string;
  simulation_time: Date;
  revision: string;
  created_at: Date;
  updated_at: Date;
}

interface GenerationRow {
  tenant_id: TenantId;
  world_id: WorldId;
  world_generation_id: WorldGenerationId;
  generation_number: string;
  previous_generation_id: WorldGenerationId | null;
  simulation_time: Date;
  committed_at: Date;
}

interface InputRow {
  tenant_id: TenantId;
  world_id: WorldId;
  sequence: string;
  idempotency_key: string;
  kind: string;
  payload: SimulationInput["payload"];
  state: SimulationInput["state"];
  received_at: Date;
  effective_at: Date;
  completed_generation_number: string | null;
}

interface ActiveCharacterRow {
  character_id: CharacterId;
  active_character_version_id: CharacterVersionId;
}

interface LifeStateRow {
  tenant_id: TenantId;
  world_id: WorldId;
  character_id: CharacterId;
  availability: string | null;
  narrative_state: string | null;
  active_goal: string | null;
  story_arc: string | null;
  coarse_location: string | null;
  revision: string;
  effective_at: Date;
  updated_at: Date;
}

interface WorldEventRow {
  tenant_id: TenantId;
  world_id: WorldId;
  world_event_id: WorldEventId;
  generation_number: string;
  character_id: CharacterId | null;
  source_character_version_id: CharacterVersionId | null;
  kind: string;
  payload: WorldEvent["payload"];
  provenance: WorldEvent["provenance"];
  visibility: WorldEvent["visibility"];
  canon_state: WorldEvent["canonState"];
  occurrence_key: string | null;
  valid_from: Date;
  valid_until: Date | null;
  recorded_at: Date;
  approved_at: Date | null;
  retired_at: Date | null;
}

function integer(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL returned invalid ${name}`);
  }
  return parsed;
}

function asWorld(row: WorldRow): World {
  return Object.freeze({
    tenantId: row.tenant_id,
    worldId: row.world_id,
    status: row.status,
    policy: normalizeWorldPolicy(row.policy),
    policyRevision: integer(row.policy_revision, "policy revision"),
    currentGenerationId: row.current_generation_id,
    currentGenerationNumber: integer(
      row.current_generation_number,
      "generation number",
    ),
    simulationTime: toInstant(row.simulation_time),
    revision: integer(row.revision, "world revision"),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function asGeneration(row: GenerationRow): WorldGeneration {
  return Object.freeze({
    tenantId: row.tenant_id,
    worldId: row.world_id,
    worldGenerationId: row.world_generation_id,
    generationNumber: integer(row.generation_number, "generation number"),
    previousGenerationId: row.previous_generation_id,
    simulationTime: toInstant(row.simulation_time),
    committedAt: toInstant(row.committed_at),
  });
}

function asInput(row: InputRow): SimulationInput {
  return Object.freeze({
    tenantId: row.tenant_id,
    worldId: row.world_id,
    sequence: integer(row.sequence, "input sequence"),
    idempotencyKey: row.idempotency_key,
    kind: row.kind,
    payload: Object.freeze({ ...row.payload }),
    state: row.state,
    receivedAt: toInstant(row.received_at),
    effectiveAt: toInstant(row.effective_at),
    completedGenerationNumber:
      row.completed_generation_number === null
        ? null
        : integer(row.completed_generation_number, "completed generation number"),
  });
}

function asLifeState(row: LifeStateRow): CharacterLifeState {
  return Object.freeze({
    tenantId: row.tenant_id,
    worldId: row.world_id,
    characterId: row.character_id,
    availability: row.availability,
    narrativeState: row.narrative_state,
    activeGoal: row.active_goal,
    storyArc: row.story_arc,
    coarseLocation: row.coarse_location,
    revision: integer(row.revision, "life-state revision"),
    effectiveAt: toInstant(row.effective_at),
    updatedAt: toInstant(row.updated_at),
  });
}

function asWorldEvent(row: WorldEventRow): WorldEvent {
  return Object.freeze({
    tenantId: row.tenant_id,
    worldId: row.world_id,
    worldEventId: row.world_event_id,
    generationNumber: integer(row.generation_number, "event generation number"),
    characterId: row.character_id,
    sourceCharacterVersionId: row.source_character_version_id,
    kind: row.kind,
    payload: Object.freeze({ ...row.payload }),
    provenance: row.provenance,
    visibility: row.visibility,
    canonState: row.canon_state,
    occurrenceKey: row.occurrence_key,
    validFrom: toInstant(row.valid_from),
    validUntil: row.valid_until ? toInstant(row.valid_until) : null,
    recordedAt: toInstant(row.recorded_at),
    approvedAt: row.approved_at ? toInstant(row.approved_at) : null,
    retiredAt: row.retired_at ? toInstant(row.retired_at) : null,
  });
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function notFound(): PlatformError {
  return new PlatformError({
    code: "world.not_found",
    category: "not-found",
    message: "World does not exist in the requested tenant",
    retryable: false,
  });
}

async function loadWorld(
  client: PoolClient,
  tenantId: TenantId,
  worldId: WorldId,
  forUpdate: boolean,
): Promise<World | null> {
  const result = await client.query<WorldRow>(
    `SELECT tenant_id,
            world_id,
            status,
            policy,
            policy_revision,
            current_generation_id,
            current_generation_number,
            simulation_time,
            revision,
            created_at,
            updated_at
       FROM world.worlds
      WHERE tenant_id = $1
        AND world_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, worldId],
  );
  return result.rows[0] ? asWorld(result.rows[0]) : null;
}

export async function createWorld(
  client: PoolClient,
  input: CreateWorldInput,
): Promise<World> {
  const policy = normalizeWorldPolicy(input.policy);

  const inserted = await client.query<WorldRow>(
    `INSERT INTO world.worlds (
       tenant_id,
       world_id,
       policy,
       policy_revision,
       current_generation_id,
       current_generation_number,
       simulation_time,
       revision,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3::jsonb, 1, $4, 0, $5, 1, $6, $6)
     RETURNING tenant_id,
               world_id,
               status,
               policy,
               policy_revision,
               current_generation_id,
               current_generation_number,
               simulation_time,
               revision,
               created_at,
               updated_at`,
    [
      input.tenantId,
      input.worldId,
      JSON.stringify(policy),
      input.initialGenerationId,
      input.simulationTime,
      input.createdAt,
    ],
  );

  await client.query(
    `INSERT INTO world.generations (
       tenant_id,
       world_id,
       world_generation_id,
       generation_number,
       previous_generation_id,
       simulation_time,
       committed_at
     )
     VALUES ($1, $2, $3, 0, NULL, $4, $5)`,
    [
      input.tenantId,
      input.worldId,
      input.initialGenerationId,
      input.simulationTime,
      input.createdAt,
    ],
  );

  return asWorld(inserted.rows[0]!);
}

export async function getWorld(
  client: PoolClient,
  tenantId: TenantId,
  worldId: WorldId,
): Promise<World | null> {
  return loadWorld(client, tenantId, worldId, false);
}

export async function admitSimulationInput(
  client: PoolClient,
  input: AdmitSimulationInput,
): Promise<SimulationInput> {
  const idempotencyKey = normalizeSimulationInputKey(input.idempotencyKey);
  const kind = normalizeSimulationInputKind(input.kind);

  const result = await client.query<InputRow>(
    `INSERT INTO world.simulation_inputs (
       tenant_id,
       world_id,
       idempotency_key,
       kind,
       payload,
       received_at,
       effective_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (tenant_id, world_id, idempotency_key)
     DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       WHERE world.simulation_inputs.kind = EXCLUDED.kind
         AND world.simulation_inputs.payload = EXCLUDED.payload
         AND world.simulation_inputs.effective_at = EXCLUDED.effective_at
     RETURNING tenant_id,
               world_id,
               sequence,
               idempotency_key,
               kind,
               payload,
               state,
               received_at,
               effective_at,
               completed_generation_number`,
    [
      input.tenantId,
      input.worldId,
      idempotencyKey,
      kind,
      JSON.stringify(input.payload),
      input.receivedAt,
      input.effectiveAt,
    ],
  );

  if (!result.rows[0]) {
    throw conflict(
      "world.simulation_input_conflict",
      "Simulation input idempotency key was reused with different content",
    );
  }
  return asInput(result.rows[0]);
}

export async function commitWorldGeneration(
  client: PoolClient,
  input: CommitWorldGenerationInput,
): Promise<CommitWorldGenerationResult> {
  if (
    !Number.isSafeInteger(input.expectedGenerationNumber) ||
    input.expectedGenerationNumber < 0
  ) {
    throw new RangeError("expectedGenerationNumber must be non-negative");
  }

  const current = await loadWorld(
    client,
    input.tenantId,
    input.worldId,
    true,
  );
  if (!current) {
    throw notFound();
  }
  if (current.currentGenerationNumber !== input.expectedGenerationNumber) {
    throw conflict(
      "world.generation_conflict",
      "World generation was advanced by another writer",
    );
  }

  assertSimulationTimeDoesNotMoveBackward(
    current.simulationTime,
    input.simulationTime,
  );

  const sequences = [
    ...new Set(input.completedInputSequences),
  ].sort((left, right) => left - right);

  for (const sequence of sequences) {
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new RangeError("completed input sequences must be positive integers");
    }
  }

  let inputs: InputRow[] = [];
  if (sequences.length > 0) {
    const claimed = await client.query<InputRow>(
      `SELECT tenant_id,
              world_id,
              sequence,
              idempotency_key,
              kind,
              payload,
              state,
              received_at,
              effective_at,
              completed_generation_number
         FROM world.simulation_inputs
        WHERE tenant_id = $1
          AND world_id = $2
          AND sequence = ANY($3::bigint[])
        ORDER BY sequence
        FOR UPDATE`,
      [input.tenantId, input.worldId, sequences],
    );
    inputs = claimed.rows;
    if (
      inputs.length !== sequences.length ||
      inputs.some((row) => row.state !== "admitted")
    ) {
      throw conflict(
        "world.simulation_input_not_admitted",
        "One or more simulation inputs are missing or already settled",
      );
    }
  }

  const nextGenerationNumber = input.expectedGenerationNumber + 1;

  const generationResult = await client.query<GenerationRow>(
    `INSERT INTO world.generations (
       tenant_id,
       world_id,
       world_generation_id,
       generation_number,
       previous_generation_id,
       simulation_time,
       committed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING tenant_id,
               world_id,
               world_generation_id,
               generation_number,
               previous_generation_id,
               simulation_time,
               committed_at`,
    [
      input.tenantId,
      input.worldId,
      input.nextGenerationId,
      nextGenerationNumber,
      current.currentGenerationId,
      input.simulationTime,
      input.committedAt,
    ],
  );

  if (sequences.length > 0) {
    const completed = await client.query<InputRow>(
      `UPDATE world.simulation_inputs
          SET state = 'completed',
              completed_generation_number = $4
        WHERE tenant_id = $1
          AND world_id = $2
          AND sequence = ANY($3::bigint[])
          AND state = 'admitted'
      RETURNING tenant_id,
                world_id,
                sequence,
                idempotency_key,
                kind,
                payload,
                state,
                received_at,
                effective_at,
                completed_generation_number`,
      [
        input.tenantId,
        input.worldId,
        sequences,
        nextGenerationNumber,
      ],
    );
    inputs = completed.rows;
  }

  const worldResult = await client.query<WorldRow>(
    `UPDATE world.worlds
        SET current_generation_id = $3,
            current_generation_number = $4,
            simulation_time = $5,
            revision = revision + 1,
            updated_at = $6
      WHERE tenant_id = $1
        AND world_id = $2
        AND current_generation_number = $7
      RETURNING tenant_id,
                world_id,
                status,
                policy,
                policy_revision,
                current_generation_id,
                current_generation_number,
                simulation_time,
                revision,
                created_at,
                updated_at`,
    [
      input.tenantId,
      input.worldId,
      input.nextGenerationId,
      nextGenerationNumber,
      input.simulationTime,
      input.committedAt,
      input.expectedGenerationNumber,
    ],
  );

  if (!worldResult.rows[0]) {
    throw conflict(
      "world.generation_conflict",
      "World generation was advanced by another writer",
    );
  }

  return Object.freeze({
    world: asWorld(worldResult.rows[0]),
    generation: asGeneration(generationResult.rows[0]!),
    completedInputs: Object.freeze(inputs.map(asInput)),
  });
}

export function createPostgresWorldRepository(
  client: PoolClient,
): WorldRepository {
  const repository: WorldRepository = {
    createWorld: (input: CreateWorldInput) => createWorld(client, input),
    getWorld: (tenantId: TenantId, worldId: WorldId) =>
      getWorld(client, tenantId, worldId),
    admitSimulationInput: (input: AdmitSimulationInput) =>
      admitSimulationInput(client, input),
    commitGeneration: (input: CommitWorldGenerationInput) =>
      commitWorldGeneration(client, input),
  };
  return Object.freeze(repository);
}
