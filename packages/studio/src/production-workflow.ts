import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type Instant,
  type MediaArtifactId,
  type MediaProjectId,
  type OperationId,
  type TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeStudioArtifactRevision,
} from "./invariants.js";
import type {
  StudioArtifactKind,
  StudioArtifactRevision,
} from "./model.js";

export type StudioProductionStageKind =
  | "script"
  | "storyboard"
  | "visual-render"
  | "voice"
  | "lipsync";

export type StudioProductionStageState =
  | "blocked"
  | "ready"
  | "dispatching"
  | "unknown"
  | "completed"
  | "failed-before-effect";

export interface StudioArtifactPointer {
  readonly mediaArtifactId: MediaArtifactId;
  readonly revision: number;
  readonly kind: StudioArtifactKind;
  readonly contentHash: string;
}

export interface StudioProductionStage {
  readonly kind: StudioProductionStageKind;
  readonly state: StudioProductionStageState;
  readonly dependencies: readonly StudioProductionStageKind[];
  readonly expectedOutputKind: StudioArtifactKind;
  readonly inputs: readonly StudioArtifactPointer[];
  readonly operationId: OperationId | null;
  readonly dispatchKey: string | null;
  readonly output: StudioArtifactPointer | null;
  readonly failureReason: string | null;
  readonly revision: number;
  readonly updatedAt: Instant;
}

export interface StudioProductionPlan {
  readonly schemaVersion: 1;
  readonly tenantId: TenantId;
  readonly mediaProjectId: MediaProjectId;
  readonly characterId: CharacterId;
  readonly planRevision: number;
  readonly source: StudioArtifactPointer;
  readonly stages: readonly StudioProductionStage[];
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

const stageOrder: readonly StudioProductionStageKind[] = Object.freeze([
  "script",
  "storyboard",
  "visual-render",
  "voice",
  "lipsync",
]);

const stageConfig: Readonly<
  Record<
    StudioProductionStageKind,
    {
      readonly dependencies: readonly StudioProductionStageKind[];
      readonly expectedOutputKind: StudioArtifactKind;
    }
  >
> = Object.freeze({
  script: {
    dependencies: Object.freeze([]),
    expectedOutputKind: "script",
  },
  storyboard: {
    dependencies: Object.freeze(["script"]),
    expectedOutputKind: "storyboard",
  },
  "visual-render": {
    dependencies: Object.freeze(["storyboard"]),
    expectedOutputKind: "video",
  },
  voice: {
    dependencies: Object.freeze(["script"]),
    expectedOutputKind: "audio",
  },
  lipsync: {
    dependencies: Object.freeze(["visual-render", "voice"]),
    expectedOutputKind: "video",
  },
});

function positiveRevision(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function pointerFromArtifact(
  artifact: StudioArtifactRevision,
): StudioArtifactPointer {
  const normalized = normalizeStudioArtifactRevision(artifact);
  return Object.freeze({
    mediaArtifactId: normalized.mediaArtifactId,
    revision: normalized.revision,
    kind: normalized.kind,
    contentHash: normalized.contentHash,
  });
}

function stageByKind(
  plan: StudioProductionPlan,
  kind: StudioProductionStageKind,
): StudioProductionStage {
  const stage = plan.stages.find((candidate) => candidate.kind === kind);
  if (!stage) throw new Error(`Studio production stage is missing: ${kind}`);
  return stage;
}

function completedOutput(
  plan: StudioProductionPlan,
  kind: StudioProductionStageKind,
): StudioArtifactPointer {
  const stage = stageByKind(plan, kind);
  if (stage.state !== "completed" || stage.output === null) {
    throw new Error(`Studio production dependency is incomplete: ${kind}`);
  }
  return stage.output;
}

function stageInputs(
  plan: StudioProductionPlan,
  kind: StudioProductionStageKind,
): readonly StudioArtifactPointer[] {
  if (kind === "script") return Object.freeze([plan.source]);
  return Object.freeze(
    stageConfig[kind].dependencies.map((dependency) =>
      completedOutput(plan, dependency),
    ),
  );
}

function refreshReadiness(
  plan: StudioProductionPlan,
): StudioProductionPlan {
  const stages = plan.stages.map((stage) => {
    if (
      stage.state === "completed" ||
      stage.state === "dispatching" ||
      stage.state === "unknown" ||
      stage.state === "failed-before-effect"
    ) {
      return stage;
    }
    const dependenciesReady = stage.dependencies.every(
      (dependency) => stageByKind(plan, dependency).state === "completed",
    );
    const nextState = dependenciesReady ? "ready" : "blocked";
    if (nextState === stage.state) return stage;
    return Object.freeze({
      ...stage,
      state: nextState,
      revision: stage.revision + 1,
      inputs: dependenciesReady ? stageInputs(plan, stage.kind) : Object.freeze([]),
      updatedAt: plan.updatedAt,
    });
  });
  return Object.freeze({ ...plan, stages: Object.freeze(stages) });
}

export function createStudioProductionPlan(input: {
  readonly tenantId: TenantId;
  readonly mediaProjectId: MediaProjectId;
  readonly characterId: CharacterId;
  readonly sourceArtifact: StudioArtifactRevision;
  readonly createdAt: Instant;
}): StudioProductionPlan {
  const source = normalizeStudioArtifactRevision(input.sourceArtifact);
  const tenantId = parseCanonicalId("tenant", input.tenantId);
  const mediaProjectId = parseCanonicalId("media-project", input.mediaProjectId);
  const characterId = parseCanonicalId("character", input.characterId);

  if (
    source.tenantId !== tenantId ||
    source.mediaProjectId !== mediaProjectId ||
    source.characterId !== characterId
  ) {
    throw new Error("Studio production source scope does not match plan");
  }
  if (source.kind !== "other" && source.kind !== "script") {
    throw new Error("Studio production source must be an input or script artifact");
  }

  const createdAt = toInstant(input.createdAt);
  const plan: StudioProductionPlan = Object.freeze({
    schemaVersion: 1,
    tenantId,
    mediaProjectId,
    characterId,
    planRevision: 1,
    source: pointerFromArtifact(source),
    stages: Object.freeze(
      stageOrder.map((kind) =>
        Object.freeze({
          kind,
          state: kind === "script" ? ("ready" as const) : ("blocked" as const),
          dependencies: stageConfig[kind].dependencies,
          expectedOutputKind: stageConfig[kind].expectedOutputKind,
          inputs:
            kind === "script"
              ? Object.freeze([pointerFromArtifact(source)])
              : Object.freeze([]),
          operationId: null,
          dispatchKey: null,
          output: null,
          failureReason: null,
          revision: 1,
          updatedAt: createdAt,
        }),
      ),
    ),
    createdAt,
    updatedAt: createdAt,
  });
  return refreshReadiness(plan);
}

export function studioStageDispatchKey(input: {
  readonly plan: StudioProductionPlan;
  readonly stage: StudioProductionStageKind;
  readonly operationId: OperationId;
}): string {
  const stage = stageByKind(input.plan, input.stage);
  return fingerprintCanonicalJson({
    tenantId: input.plan.tenantId,
    mediaProjectId: input.plan.mediaProjectId,
    characterId: input.plan.characterId,
    planRevision: input.plan.planRevision,
    stage: stage.kind,
    stageRevision: stage.revision,
    operationId: parseCanonicalId("operation", input.operationId),
    inputs: stage.inputs,
    expectedOutputKind: stage.expectedOutputKind,
  });
}

function replaceStage(
  plan: StudioProductionPlan,
  replacement: StudioProductionStage,
  updatedAt: Instant,
): StudioProductionPlan {
  const next = Object.freeze({
    ...plan,
    planRevision: plan.planRevision + 1,
    stages: Object.freeze(
      plan.stages.map((stage) =>
        stage.kind === replacement.kind ? replacement : stage,
      ),
    ),
    updatedAt,
  });
  return refreshReadiness(next);
}

export function beginStudioStageDispatch(input: {
  readonly plan: StudioProductionPlan;
  readonly stage: StudioProductionStageKind;
  readonly expectedStageRevision: number;
  readonly operationId: OperationId;
  readonly at: Instant;
}): StudioProductionPlan {
  const stage = stageByKind(input.plan, input.stage);
  if (
    stage.revision !==
    positiveRevision(input.expectedStageRevision, "expectedStageRevision")
  ) {
    throw new Error("Studio production stage revision is stale");
  }
  if (stage.state !== "ready" && stage.state !== "failed-before-effect") {
    throw new Error("Studio production stage is not dispatchable");
  }
  const at = toInstant(input.at);
  if (at < input.plan.updatedAt) throw new Error("dispatch cannot move time backwards");
  const operationId = parseCanonicalId("operation", input.operationId);
  const dispatchKey = studioStageDispatchKey({
    plan: input.plan,
    stage: input.stage,
    operationId,
  });
  return replaceStage(
    input.plan,
    Object.freeze({
      ...stage,
      state: "dispatching",
      operationId,
      dispatchKey,
      output: null,
      failureReason: null,
      revision: stage.revision + 1,
      updatedAt: at,
    }),
    at,
  );
}

export function markStudioStageUnknown(input: {
  readonly plan: StudioProductionPlan;
  readonly stage: StudioProductionStageKind;
  readonly expectedStageRevision: number;
  readonly at: Instant;
}): StudioProductionPlan {
  const stage = stageByKind(input.plan, input.stage);
  if (stage.revision !== input.expectedStageRevision || stage.state !== "dispatching") {
    throw new Error("Studio production dispatch claim is stale");
  }
  const at = toInstant(input.at);
  return replaceStage(
    input.plan,
    Object.freeze({
      ...stage,
      state: "unknown",
      revision: stage.revision + 1,
      updatedAt: at,
    }),
    at,
  );
}

export function failStudioStageBeforeEffect(input: {
  readonly plan: StudioProductionPlan;
  readonly stage: StudioProductionStageKind;
  readonly expectedStageRevision: number;
  readonly reason: string;
  readonly at: Instant;
}): StudioProductionPlan {
  const stage = stageByKind(input.plan, input.stage);
  if (stage.revision !== input.expectedStageRevision || stage.state !== "dispatching") {
    throw new Error("Studio production dispatch claim is stale");
  }
  const at = toInstant(input.at);
  return replaceStage(
    input.plan,
    Object.freeze({
      ...stage,
      state: "failed-before-effect",
      failureReason: bounded(input.reason, "failureReason", 500),
      operationId: null,
      dispatchKey: null,
      revision: stage.revision + 1,
      updatedAt: at,
    }),
    at,
  );
}

export function completeStudioStage(input: {
  readonly plan: StudioProductionPlan;
  readonly stage: StudioProductionStageKind;
  readonly expectedStageRevision: number;
  readonly outputArtifact: StudioArtifactRevision;
  readonly at: Instant;
  readonly reconciledUnknown?: boolean;
}): StudioProductionPlan {
  const stage = stageByKind(input.plan, input.stage);
  if (stage.revision !== input.expectedStageRevision) {
    throw new Error("Studio production stage revision is stale");
  }
  if (
    stage.state !== "dispatching" &&
    !(stage.state === "unknown" && input.reconciledUnknown === true)
  ) {
    throw new Error("Studio production stage cannot be completed from current state");
  }
  const output = normalizeStudioArtifactRevision(input.outputArtifact);
  if (
    output.tenantId !== input.plan.tenantId ||
    output.mediaProjectId !== input.plan.mediaProjectId ||
    output.characterId !== input.plan.characterId
  ) {
    throw new Error("Studio production output scope does not match plan");
  }
  if (output.kind !== stage.expectedOutputKind) {
    throw new Error(
      `Studio production stage expected ${stage.expectedOutputKind} output`,
    );
  }
  if (
    !stage.inputs.every((required) =>
      output.parents.some(
        (parent) =>
          parent.mediaArtifactId === required.mediaArtifactId &&
          parent.revision === required.revision,
      ),
    )
  ) {
    throw new Error("Studio production output provenance omits required stage input");
  }

  const at = toInstant(input.at);
  return replaceStage(
    input.plan,
    Object.freeze({
      ...stage,
      state: "completed",
      output: pointerFromArtifact(output),
      failureReason: null,
      revision: stage.revision + 1,
      updatedAt: at,
    }),
    at,
  );
}

export function finalStudioVideo(
  plan: StudioProductionPlan,
): StudioArtifactPointer {
  return completedOutput(plan, "lipsync");
}
