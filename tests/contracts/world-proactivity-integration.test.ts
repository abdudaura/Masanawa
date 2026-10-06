import { describe, expect, it } from "vitest";
import {
  projectRoutineTrigger,
  projectWorldEventTrigger,
} from "../../packages/proactivity/src/world-integration.js";

const scope = {
  tenantId: "tenant_0199f0a0-0000-7000-8000-000000000601",
  userId: "user_0199f0a0-0000-7000-8000-000000000602",
  relationshipId: "relationship_0199f0a0-0000-7000-8000-000000000603",
  characterId: "character_0199f0a0-0000-7000-8000-000000000604",
  purpose: "daily check-in",
};

describe("World proactivity projection", () => {
  it("projects an enabled routine into a daily schedule trigger", () => {
    const trigger = projectRoutineTrigger({
      scope,
      routine: {
        tenantId: scope.tenantId,
        worldId: "world_0199f0a0-0000-7000-8000-000000000605",
        routineKey: "morning-check-in",
        characterId: scope.characterId,
        timezone: "Africa/Lagos",
        localTime: "08:30",
        enabled: true,
        revision: 4,
      },
    });

    expect(trigger).toMatchObject({
      kind: "schedule",
      revision: 4,
      schedule: {
        mode: "cron",
        cron: "30 8 * * *",
        timeZone: "Africa/Lagos",
      },
    });
  });

  it("does not project a disabled routine", () => {
    expect(
      projectRoutineTrigger({
        scope,
        routine: {
          tenantId: scope.tenantId,
          worldId: "world_0199f0a0-0000-7000-8000-000000000605",
          routineKey: "off",
          characterId: scope.characterId,
          timezone: "UTC",
          localTime: "09:00",
          enabled: false,
          revision: 1,
        },
      }),
    ).toBeNull();
  });

  it("projects only approved public/shared World events", () => {
    const base = {
      tenantId: scope.tenantId,
      worldEventId: "world-event_0199f0a0-0000-7000-8000-000000000606",
      worldId: "world_0199f0a0-0000-7000-8000-000000000607",
      characterId: scope.characterId,
      eventKind: "goal.completed",
      visibility: "shared" as const,
      canonState: "approved" as const,
      effectiveStart: "2026-10-06T10:00:00Z",
      occurrenceKey: "goal-42",
    };

    expect(projectWorldEventTrigger({ scope, event: base })).toMatchObject({
      kind: "event",
      event: { source: "world", eventType: "world.goal.completed" },
      dedupeKey: "world:world_0199f0a0-0000-7000-8000-000000000607:goal-42",
    });

    expect(
      projectWorldEventTrigger({
        scope,
        event: { ...base, visibility: "private" },
      }),
    ).toBeNull();

    expect(
      projectWorldEventTrigger({
        scope,
        event: { ...base, canonState: "draft" },
      }),
    ).toBeNull();
  });

  it("ignores a Character-specific event belonging to another Character", () => {
    expect(
      projectWorldEventTrigger({
        scope,
        event: {
          tenantId: scope.tenantId,
          worldEventId: "world-event_0199f0a0-0000-7000-8000-000000000608",
          worldId: "world_0199f0a0-0000-7000-8000-000000000607",
          characterId: "character_0199f0a0-0000-7000-8000-000000000999",
          eventKind: "availability.changed",
          visibility: "shared",
          canonState: "approved",
          effectiveStart: "2026-10-06T10:00:00Z",
          occurrenceKey: null,
        },
      }),
    ).toBeNull();
  });

  it("rejects cross-tenant routine/event projection", () => {
    expect(() =>
      projectRoutineTrigger({
        scope,
        routine: {
          tenantId: "tenant_0199f0a0-0000-7000-8000-000000000999",
          worldId: "world_0199f0a0-0000-7000-8000-000000000605",
          routineKey: "bad",
          characterId: scope.characterId,
          timezone: "UTC",
          localTime: "08:00",
          enabled: true,
          revision: 1,
        },
      }),
    ).toThrow("tenant does not match");
  });
});
