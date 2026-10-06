import { describe, expect, it } from "vitest";
import {
  projectWorldEventTrigger,
  projectWorldRoutineTrigger,
} from "../../packages/proactivity/src/world-integration.js";

const scope = {
  tenantId: "tenant_00000000-0000-4000-8000-000000000001",
  userId: "user_00000000-0000-4000-8000-000000000002",
  relationshipId: "relationship_00000000-0000-4000-8000-000000000003",
  characterId: "character_00000000-0000-4000-8000-000000000004",
};

describe("Task 116 World -> Proactivity integration", () => {
  it("projects an enabled World routine into a scoped daily schedule trigger", () => {
    const trigger = projectWorldRoutineTrigger({
      routine: {
        tenantId: scope.tenantId,
        worldId: "world_00000000-0000-4000-8000-000000000005",
        routineKey: "morning-check-in",
        characterId: scope.characterId,
        timezone: "Africa/Lagos",
        localTime: "08:30",
        enabled: true,
        revision: 4,
      },
      scope,
      triggerId: "trigger-routine-001",
      purpose: "Morning check-in",
    });

    expect(trigger).toEqual({
      schemaVersion: 1,
      triggerId: "trigger-routine-001",
      revision: 4,
      enabled: true,
      scope,
      purpose: "morning check-in",
      dedupeKey:
        "world-routine:world_00000000-0000-4000-8000-000000000005:morning-check-in:4",
      kind: "schedule",
      schedule: {
        mode: "cron",
        cron: "30 8 * * *",
        timeZone: "Africa/Lagos",
      },
    });
  });

  it("never copies arbitrary World routine payload into the proactive trigger", () => {
    const routine = {
      tenantId: scope.tenantId,
      worldId: "world_00000000-0000-4000-8000-000000000005",
      routineKey: "private-routine",
      characterId: scope.characterId,
      timezone: "UTC",
      localTime: "09:00",
      enabled: true,
      revision: 1,
      inputPayload: {
        privateNarrative: "must not cross the integration boundary",
      },
    };

    const trigger = projectWorldRoutineTrigger({
      routine,
      scope,
      triggerId: "trigger-routine-002",
      purpose: "Routine follow up",
    });

    expect(JSON.stringify(trigger)).not.toContain("privateNarrative");
    expect(JSON.stringify(trigger)).not.toContain("inputPayload");
  });

  it("projects only approved user-visible character-scoped World events", () => {
    const trigger = projectWorldEventTrigger({
      event: {
        tenantId: scope.tenantId,
        worldEventId: "world-event_00000000-0000-4000-8000-000000000006",
        worldId: "world_00000000-0000-4000-8000-000000000005",
        characterId: scope.characterId,
        eventKind: "  Story_Arc.Advanced  ",
        visibility: "shared",
        canonState: "approved",
        occurrenceKey: "arc-step-42",
      },
      scope,
      triggerId: "trigger-world-event-001",
      triggerRevision: 2,
      purpose: "Follow up on world event",
    });

    expect(trigger.kind).toBe("event");
    expect(trigger.event).toEqual({
      eventType: "story_arc.advanced",
      source: "world",
    });
    expect(trigger.dedupeKey).toBe(
      "world-event:world_00000000-0000-4000-8000-000000000005:arc-step-42",
    );
  });

  it("uses immutable WorldEvent identity for dedupe when no occurrence key exists", () => {
    const trigger = projectWorldEventTrigger({
      event: {
        tenantId: scope.tenantId,
        worldEventId: "world-event_00000000-0000-4000-8000-000000000006",
        worldId: "world_00000000-0000-4000-8000-000000000005",
        characterId: scope.characterId,
        eventKind: "goal.completed",
        visibility: "public",
        canonState: "approved",
        occurrenceKey: null,
      },
      scope,
      triggerId: "trigger-world-event-002",
      triggerRevision: 1,
      purpose: "Acknowledge completed goal",
    });

    expect(trigger.dedupeKey).toContain(
      "world-event_00000000-0000-4000-8000-000000000006",
    );
  });

  it("fails closed for disabled routines or mismatched Tenant/Character scope", () => {
    const base = {
      tenantId: scope.tenantId,
      worldId: "world_00000000-0000-4000-8000-000000000005",
      routineKey: "daily",
      characterId: scope.characterId,
      timezone: "UTC",
      localTime: "09:00",
      enabled: true,
      revision: 1,
    };

    expect(() =>
      projectWorldRoutineTrigger({
        routine: { ...base, enabled: false },
        scope,
        triggerId: "trigger-routine-disabled",
        purpose: "Daily",
      }),
    ).toThrow("Disabled World routine");

    expect(() =>
      projectWorldRoutineTrigger({
        routine: {
          ...base,
          tenantId: "tenant_00000000-0000-4000-8000-000000000999",
        },
        scope,
        triggerId: "trigger-routine-wrong-tenant",
        purpose: "Daily",
      }),
    ).toThrow("another Tenant");

    expect(() =>
      projectWorldRoutineTrigger({
        routine: {
          ...base,
          characterId: "character_00000000-0000-4000-8000-000000000999",
        },
        scope,
        triggerId: "trigger-routine-wrong-character",
        purpose: "Daily",
      }),
    ).toThrow("another Character");
  });

  it.each([
    ["draft canon", { canonState: "draft" as const, visibility: "shared" as const }],
    ["retired canon", { canonState: "retired" as const, visibility: "shared" as const }],
    ["internal visibility", { canonState: "approved" as const, visibility: "internal" as const }],
    ["private visibility", { canonState: "approved" as const, visibility: "private" as const }],
  ])("rejects %s World events", (_label, override) => {
    expect(() =>
      projectWorldEventTrigger({
        event: {
          tenantId: scope.tenantId,
          worldEventId: "world-event_00000000-0000-4000-8000-000000000006",
          worldId: "world_00000000-0000-4000-8000-000000000005",
          characterId: scope.characterId,
          eventKind: "story.updated",
          occurrenceKey: null,
          ...override,
        },
        scope,
        triggerId: "trigger-world-event-rejected",
        triggerRevision: 1,
        purpose: "Rejected event",
      }),
    ).toThrow();
  });

  it("rejects world-wide event fan-out until a dedicated owner chooses recipients", () => {
    expect(() =>
      projectWorldEventTrigger({
        event: {
          tenantId: scope.tenantId,
          worldEventId: "world-event_00000000-0000-4000-8000-000000000006",
          worldId: "world_00000000-0000-4000-8000-000000000005",
          characterId: null,
          eventKind: "world.updated",
          visibility: "public",
          canonState: "approved",
          occurrenceKey: null,
        },
        scope,
        triggerId: "trigger-world-event-global",
        triggerRevision: 1,
        purpose: "Global event",
      }),
    ).toThrow("explicit fan-out owner");
  });
});
