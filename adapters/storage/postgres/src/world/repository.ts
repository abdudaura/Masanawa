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
  type AppendWorldEventInput,
  type ApproveWorldEventInput,
  type CharacterLifeState,
  type CommitWorldGenerationInput,
  type CommitWorldGenerationResult,
  type CreateWorldInput,
  type GovernedWorldRepository,
  type PutCharacterLifeStateInput,
  type SimulationInput,
  type World,
  type WorldEvent,
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
  world_event_id: WorldEventId;
  world_id: WorldId;
  character_id: CharacterId | null;
  character_version_id: CharacterVersionId | null;
  event_kind: string;
  payload: WorldEvent["payload"];
  provenance: WorldEvent["provenance"];
  visibility: WorldEvent["visibility"];
  canon_state: WorldEvent["canonState"];
  occurrence_key: string | null;
  effective_start: Date;
  effective_end: Date | null;
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
    worldEventId: row.world_event_id,
    worldId: row.world_id,
    characterId: row.character_id,
    characterVersionId: row.character_version_id,
    eventKind: row.event_kind,
    payload: Object.freeze({ ...row.payload }),
    provenance: row.provenance,
    visibility: row.visibility,
    canonState: row.canon_state,
    occurrenceKey: row.occurrence_key,
    effectiveStart: toInstant(row.effective_start),
    effectiveEnd: row.effective_end ? toInstant(row.effective_end) : null,
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

function boundedText(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function nullableText(
  value: string | null,
  name: string,
  max: number,
): string | null {
  return value === null ? null : boundedText(value, name, max);
}

async function assertActiveCharacterVersion(
  client: PoolClient,
  tenantId: TenantId,
  characterId: CharacterId,
  characterVersionId: CharacterVersionId,
): Promise<void> {
  const result = await client.query(
    `SELECT 1
       FROM identity.characters c
       JOIN identity.character_versions v
         ON v.tenant_id = c.tenant_id
        AND v.character_id = c.character_id
        AND v.character_version_id = c.active_character_version_id
      WHERE c.tenant_id = $1
        AND c.character_id = $2
        AND c.state = 'active'
        AND c.active_character_version_id = $3
        AND v.state = 'published'`,
    [tenantId, characterId, characterVersionId],
  );
  if ((result.rowCount ?? 0) !== 1) {
    throw conflict(
      "world.character_version_not_active",
      "World mutation requires the Character's active published version",
    );
  }
}

export async function putCharacterLifeState(
  client: PoolClient,
  input: PutCharacterLifeStateInput,
): Promise<CharacterLifeState> {
  await assertActiveCharacterVersion(
    client,
    input.tenantId,
    input.characterId,
    input.characterVersionId,
  );

  const world = await loadWorld(client, input.tenantId, input.worldId, false);
  if (!world) {
    throw notFound();
  }
  if (input.effectiveAt > world.simulationTime) {
    throw conflict(
      "world.life_state_from_future",
      "Character life state cannot become effective after current simulation time",
    );
  }

  const values = [
    nullableText(input.availability, "availability", 1000),
    nullableText(input.narrativeState, "narrativeState", 4000),
    nullableText(input.activeGoal, "activeGoal", 4000),
    nullableText(input.storyArc, "storyArc", 4000),
    nullableText(input.coarseLocation, "coarseLocation", 1000),
  ] as const;

  const currentResult = await client.query<LifeStateRow>(
    `SELECT *
       FROM world.character_life_state
      WHERE tenant_id = $1
        AND world_id = $2
        AND character_id = $3
      FOR UPDATE`,
    [input.tenantId, input.worldId, input.characterId],
  );
  const current = currentResult.rows[0];

  if (input.expectedRevision === null) {
    if (current) {
      throw conflict(
        "world.life_state_revision_conflict",
        "Character life state already exists",
      );
    }

    const created = await client.query<LifeStateRow>(
      `INSERT INTO world.character_life_state (
         tenant_id,
         world_id,
         character_id,
         availability,
         narrative_state,
         active_goal,
         story_arc,
         coarse_location,
         revision,
         effective_at,
         updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10)
       RETURNING *`,
      [
        input.tenantId,
        input.worldId,
        input.characterId,
        ...values,
        input.effectiveAt,
        input.updatedAt,
      ],
    );
    return asLifeState(created.rows[0]!);
  }

  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    throw new RangeError("expectedRevision must be a positive safe integer");
  }
  if (
    !current ||
    integer(current.revision, "life-state revision") !== input.expectedRevision
  ) {
    throw conflict(
      "world.life_state_revision_conflict",
      "Character life state revision is stale",
    );
  }
  if (input.effectiveAt < toInstant(current.effective_at)) {
    throw conflict(
      "world.life_state_time_regression",
      "Character life-state effective time cannot move backward",
    );
  }

  const updated = await client.query<LifeStateRow>(
    `UPDATE world.character_life_state
        SET availability = $4,
            narrative_state = $5,
            active_goal = $6,
            story_arc = $7,
            coarse_location = $8,
            revision = revision + 1,
            effective_at = $9,
            updated_at = $10
      WHERE tenant_id = $1
        AND world_id = $2
        AND character_id = $3
        AND revision = $11
      RETURNING *`,
    [
      input.tenantId,
      input.worldId,
      input.characterId,
      ...values,
      input.effectiveAt,
      input.updatedAt,
      input.expectedRevision,
    ],
  );
  if (!updated.rows[0]) {
    throw conflict(
      "world.life_state_revision_conflict",
      "Character life state revision is stale",
    );
  }
  return asLifeState(updated.rows[0]);
}

async function loadWorldEvent(
  client: PoolClient,
  tenantId: TenantId,
  worldEventId: WorldEventId,
  forUpdate: boolean,
): Promise<WorldEvent | null> {
  const result = await client.query<WorldEventRow>(
    `SELECT *
       FROM world.events
      WHERE tenant_id = $1
        AND world_event_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, worldEventId],
  );
  return result.rows[0] ? asWorldEvent(result.rows[0]) : null;
}

export async function appendWorldEvent(
  client: PoolClient,
  input: AppendWorldEventInput,
): Promise<WorldEvent> {
  const eventKind = boundedText(input.eventKind, "eventKind", 128);
  const occurrenceKey =
    input.occurrenceKey === null
      ? null
      : boundedText(input.occurrenceKey, "occurrenceKey", 256);

  if ((input.characterId === null) !== (input.characterVersionId === null)) {
    throw new TypeError(
      "characterId and characterVersionId must be supplied together",
    );
  }
  if (
    input.effectiveEnd !== null &&
    input.effectiveEnd < input.effectiveStart
  ) {
    throw new TypeError("effectiveEnd must not precede effectiveStart");
  }

  if (input.admission === "automatic-approved") {
    const world = await loadWorld(client, input.tenantId, input.worldId, false);
    if (!world) {
      throw notFound();
    }
    if (!world.policy.automaticCanonEnabled) {
      throw conflict(
        "world.automatic_canon_disabled",
        "World policy does not permit automatic canon admission",
      );
    }
    if (input.provenance !== "engine") {
      throw conflict(
        "world.automatic_canon_provenance_forbidden",
        "Only engine-produced evidence may use automatic canon admission",
      );
    }
    if (input.characterId !== null && input.characterVersionId !== null) {
      await assertActiveCharacterVersion(
        client,
        input.tenantId,
        input.characterId,
        input.characterVersionId,
      );
    }
  }

  const canonState =
    input.admission === "automatic-approved" ? "approved" : "draft";
  const approvedAt =
    input.admission === "automatic-approved" ? input.recordedAt : null;

  const parameters = [
    input.tenantId,
    input.worldEventId,
    input.worldId,
    input.characterId,
    input.characterVersionId,
    eventKind,
    JSON.stringify(input.payload),
    input.provenance,
    input.visibility,
    canonState,
    occurrenceKey,
    input.effectiveStart,
    input.effectiveEnd,
    input.recordedAt,
    approvedAt,
  ];

  const conflictClause =
    occurrenceKey === null
      ? ""
      : `ON CONFLICT (tenant_id, world_id, occurrence_key)
           WHERE occurrence_key IS NOT NULL
         DO UPDATE SET occurrence_key = EXCLUDED.occurrence_key
           WHERE world.events.character_id IS NOT DISTINCT FROM EXCLUDED.character_id
             AND world.events.character_version_id IS NOT DISTINCT FROM EXCLUDED.character_version_id
             AND world.events.event_kind = EXCLUDED.event_kind
             AND world.events.payload = EXCLUDED.payload
             AND world.events.provenance = EXCLUDED.provenance
             AND world.events.visibility = EXCLUDED.visibility
             AND world.events.canon_state = EXCLUDED.canon_state
             AND world.events.effective_start = EXCLUDED.effective_start
             AND world.events.effective_end IS NOT DISTINCT FROM EXCLUDED.effective_end`;

  const result = await client.query<WorldEventRow>(
    `INSERT INTO world.events (
       tenant_id,
       world_event_id,
       world_id,
       character_id,
       character_version_id,
       event_kind,
       payload,
       provenance,
       visibility,
       canon_state,
       occurrence_key,
       effective_start,
       effective_end,
       recorded_at,
       approved_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)
     ${conflictClause}
     RETURNING *`,
    parameters,
  );

  if (!result.rows[0]) {
    throw conflict(
      "world.event_occurrence_conflict",
      "World occurrence key was reused with different canon content",
    );
  }
  return asWorldEvent(result.rows[0]);
}

export async function approveWorldEvent(
  client: PoolClient,
  input: ApproveWorldEventInput,
): Promise<WorldEvent> {
  const existing = await loadWorldEvent(
    client,
    input.tenantId,
    input.worldEventId,
    true,
  );
  if (!existing) {
    throw new PlatformError({
      code: "world.event_not_found",
      category: "not-found",
      message: "World event does not exist in the requested tenant",
      retryable: false,
    });
  }
  if (existing.canonState === "approved") {
    return existing;
  }
  if (existing.canonState !== "draft") {
    throw conflict(
      "world.event_not_approvable",
      "Only draft world events can be approved",
    );
  }

  if (
    existing.characterId !== null &&
    existing.characterVersionId !== null
  ) {
    await assertActiveCharacterVersion(
      client,
      existing.tenantId,
      existing.characterId,
      existing.characterVersionId,
    );
  }

  const result = await client.query<WorldEventRow>(
    `UPDATE world.events
        SET canon_state = 'approved',
            approved_at = $3
      WHERE tenant_id = $1
        AND world_event_id = $2
        AND canon_state = 'draft'
      RETURNING *`,
    [input.tenantId, input.worldEventId, input.approvedAt],
  );
  if (!result.rows[0]) {
    throw conflict(
      "world.event_approval_conflict",
      "World event approval raced with another writer",
    );
  }
  return asWorldEvent(result.rows[0]);
}

export function createPostgresWorldRepository(
  client: PoolClient,
): GovernedWorldRepository {
  const repository: GovernedWorldRepository = {
    createWorld: (input: CreateWorldInput) => createWorld(client, input),
    getWorld: (tenantId: TenantId, worldId: WorldId) =>
      getWorld(client, tenantId, worldId),
    admitSimulationInput: (input: AdmitSimulationInput) =>
      admitSimulationInput(client, input),
    commitGeneration: (input: CommitWorldGenerationInput) =>
      commitWorldGeneration(client, input),
    putCharacterLifeState: (input: PutCharacterLifeStateInput) =>
      putCharacterLifeState(client, input),
    appendWorldEvent: (input: AppendWorldEventInput) =>
      appendWorldEvent(client, input),
    approveWorldEvent: (input: ApproveWorldEventInput) =>
      approveWorldEvent(client, input),
  };
  return Object.freeze(repository);
}
