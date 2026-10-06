import { describe, expect, it } from "vitest";
import {
  beginStudioStageDispatch,
  completeStudioStage,
  createStudioProductionPlan,
  failStudioStageBeforeEffect,
  finalStudioVideo,
  markStudioStageUnknown,
  type StudioProductionPlan,
} from "./production-workflow.js";
import { studioArtifactProvenanceHash } from "./provenance.js";
import type { StudioArtifactRevision } from "./model.js";

const tenantId =
  "tenant_01890f4c-0000-7000-8000-000000000001" as never;
const characterId =
  "character_01890f4c-0000-7000-8000-000000000002" as never;
const projectId =
  "media-project_01890f4c-0000-7000-8000-000000000003" as never;

let artifactSeq = 10;
function artifact(input: {
  kind: StudioArtifactRevision["kind"];
  parents?: StudioArtifactRevision["parents"];
  revision?: number;
}): StudioArtifactRevision {
  const id =
    `media-artifact_01890f4c-0000-7000-8000-${String(artifactSeq++).padStart(12, "0")}` as never;
  const revision = input.revision ?? 1;
  const contentHash = "a".repeat(64);
  const sources = [{
    sourceType: "user-input" as const,
    reference: `fixture:${id}`,
    contentHash: "b".repeat(64),
    operationId: null,
  }];
  const parents = input.parents ?? [];
  const provenanceHash = studioArtifactProvenanceHash({
    tenantId,
    mediaProjectId: projectId,
    characterId,
    mediaArtifactId: id,
    revision,
    kind: input.kind,
    mediaType: input.kind === "audio" ? "audio/wav" : input.kind === "video" ? "video/mp4" : "application/json",
    contentHash,
    parents,
    sources,
  });
  return {
    schemaVersion: 1,
    tenantId,
    mediaProjectId: projectId,
    characterId,
    mediaArtifactId: id,
    revision,
    kind: input.kind,
    mediaType: input.kind === "audio" ? "audio/wav" : input.kind === "video" ? "video/mp4" : "application/json",
    contentRef: `artifact://${id}`,
    contentHash,
    parents,
    sources,
    provenanceHash,
    createdAt: "2026-10-06T10:00:00.000Z" as never,
  };
}

function op(n: number) {
  return `operation_01890f4c-0000-7000-8000-${String(n).padStart(12, "0")}` as never;
}

function stage(plan: StudioProductionPlan, kind: string) {
  return plan.stages.find((s) => s.kind === kind)!;
}

describe("Studio production workflow", () => {
  it("enforces script -> storyboard -> parallel render/voice -> lipsync", () => {
    const source = artifact({ kind: "other" });
    let plan = createStudioProductionPlan({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      sourceArtifact: source,
      createdAt: "2026-10-06T10:00:00.000Z" as never,
    });
    expect(stage(plan, "script").state).toBe("ready");
    expect(stage(plan, "storyboard").state).toBe("blocked");

    plan = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId: op(1),
      at: "2026-10-06T10:01:00.000Z" as never,
    });
    const script = artifact({
      kind: "script",
      parents: [{
        mediaArtifactId: source.mediaArtifactId,
        revision: source.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      outputArtifact: script,
      at: "2026-10-06T10:02:00.000Z" as never,
    });
    expect(stage(plan, "storyboard").state).toBe("ready");
    expect(stage(plan, "voice").state).toBe("ready");

    plan = beginStudioStageDispatch({
      plan,
      stage: "storyboard",
      expectedStageRevision: stage(plan, "storyboard").revision,
      operationId: op(2),
      at: "2026-10-06T10:03:00.000Z" as never,
    });
    const storyboard = artifact({
      kind: "storyboard",
      parents: [{
        mediaArtifactId: script.mediaArtifactId,
        revision: script.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "storyboard",
      expectedStageRevision: stage(plan, "storyboard").revision,
      outputArtifact: storyboard,
      at: "2026-10-06T10:04:00.000Z" as never,
    });
    expect(stage(plan, "visual-render").state).toBe("ready");

    plan = beginStudioStageDispatch({
      plan,
      stage: "voice",
      expectedStageRevision: stage(plan, "voice").revision,
      operationId: op(3),
      at: "2026-10-06T10:05:00.000Z" as never,
    });
    const voice = artifact({
      kind: "audio",
      parents: [{
        mediaArtifactId: script.mediaArtifactId,
        revision: script.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "voice",
      expectedStageRevision: stage(plan, "voice").revision,
      outputArtifact: voice,
      at: "2026-10-06T10:06:00.000Z" as never,
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "visual-render",
      expectedStageRevision: stage(plan, "visual-render").revision,
      operationId: op(4),
      at: "2026-10-06T10:07:00.000Z" as never,
    });
    const visual = artifact({
      kind: "video",
      parents: [{
        mediaArtifactId: storyboard.mediaArtifactId,
        revision: storyboard.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "visual-render",
      expectedStageRevision: stage(plan, "visual-render").revision,
      outputArtifact: visual,
      at: "2026-10-06T10:08:00.000Z" as never,
    });
    expect(stage(plan, "lipsync").state).toBe("ready");

    plan = beginStudioStageDispatch({
      plan,
      stage: "lipsync",
      expectedStageRevision: stage(plan, "lipsync").revision,
      operationId: op(5),
      at: "2026-10-06T10:09:00.000Z" as never,
    });
    const final = artifact({
      kind: "video",
      parents: [
        { mediaArtifactId: visual.mediaArtifactId, revision: visual.revision },
        { mediaArtifactId: voice.mediaArtifactId, revision: voice.revision },
      ],
    });
    plan = completeStudioStage({
      plan,
      stage: "lipsync",
      expectedStageRevision: stage(plan, "lipsync").revision,
      outputArtifact: final,
      at: "2026-10-06T10:10:00.000Z" as never,
    });
    expect(finalStudioVideo(plan)).toMatchObject({
      mediaArtifactId: final.mediaArtifactId,
      kind: "video",
    });
  });

  it("does not allow unmet stages or outputs missing exact input provenance", () => {
    const source = artifact({ kind: "other" });
    let plan = createStudioProductionPlan({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      sourceArtifact: source,
      createdAt: "2026-10-06T10:00:00.000Z" as never,
    });
    expect(() =>
      beginStudioStageDispatch({
        plan,
        stage: "storyboard",
        expectedStageRevision: stage(plan, "storyboard").revision,
        operationId: op(10),
        at: "2026-10-06T10:01:00.000Z" as never,
      }),
    ).toThrow("not dispatchable");

    plan = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId: op(11),
      at: "2026-10-06T10:01:00.000Z" as never,
    });
    expect(() =>
      completeStudioStage({
        plan,
        stage: "script",
        expectedStageRevision: stage(plan, "script").revision,
        outputArtifact: artifact({ kind: "script", parents: [] }),
        at: "2026-10-06T10:02:00.000Z" as never,
      }),
    ).toThrow("provenance");
  });

  it("permits failed-before-effect retry but fences unknown until reconciliation", () => {
    const source = artifact({ kind: "other" });
    let plan = createStudioProductionPlan({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      sourceArtifact: source,
      createdAt: "2026-10-06T10:00:00.000Z" as never,
    });
    plan = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId: op(20),
      at: "2026-10-06T10:01:00.000Z" as never,
    });
    plan = failStudioStageBeforeEffect({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      reason: "provider unavailable before request",
      at: "2026-10-06T10:02:00.000Z" as never,
    });
    expect(stage(plan, "script").state).toBe("failed-before-effect");

    plan = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId: op(21),
      at: "2026-10-06T10:03:00.000Z" as never,
    });
    plan = markStudioStageUnknown({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      at: "2026-10-06T10:04:00.000Z" as never,
    });
    expect(() =>
      beginStudioStageDispatch({
        plan,
        stage: "script",
        expectedStageRevision: stage(plan, "script").revision,
        operationId: op(22),
        at: "2026-10-06T10:05:00.000Z" as never,
      }),
    ).toThrow("not dispatchable");

    const recovered = artifact({
      kind: "script",
      parents: [{
        mediaArtifactId: source.mediaArtifactId,
        revision: source.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      outputArtifact: recovered,
      reconciledUnknown: true,
      at: "2026-10-06T10:06:00.000Z" as never,
    });
    expect(stage(plan, "script").state).toBe("completed");
  });

  it("uses deterministic dispatch keys bound to exact stage revision/input/operation", () => {
    const source = artifact({ kind: "other" });
    const plan = createStudioProductionPlan({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      sourceArtifact: source,
      createdAt: "2026-10-06T10:00:00.000Z" as never,
    });
    const operationId = op(30);
    const first = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId,
      at: "2026-10-06T10:01:00.000Z" as never,
    });
    const second = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId,
      at: "2026-10-06T10:01:30.000Z" as never,
    });
    expect(stage(first, "script").dispatchKey).toBe(
      stage(second, "script").dispatchKey,
    );
  });
});
