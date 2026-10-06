import { describe, expect, it } from "vitest";
import {
  normalizeProactiveTrigger,
  proactiveTriggerIdentity,
  type ProactiveTrigger,
} from "../../packages/proactivity/src/index.js";

const base = {
  schemaVersion: 1 as const,
  triggerId: "trigger-000001",
  revision: 1,
  enabled: true,
  scope: {
    tenantId: "tenant_0199f0a0-0000-7000-8000-000000000401",
    userId: "user_0199f0a0-0000-7000-8000-000000000402",
    relationshipId:
      "relationship_0199f0a0-0000-7000-8000-000000000403",
    characterId:
      "character_0199f0a0-0000-7000-8000-000000000404",
  },
  purpose: "Follow Up",
  dedupeKey: "relationship:follow-up:1",
};

describe("proactive trigger model", () => {
  it("normalizes one-time schedule triggers without becoming a scheduler", () => {
    const trigger: ProactiveTrigger = {
      ...base,
      kind: "schedule",
      schedule: {
        mode: "at",
        at: "2026-10-07T09:00:00+01:00",
        timeZone: "Europe/Amsterdam",
      },
    };
    const normalized = normalizeProactiveTrigger(trigger);
    expect(normalized).toMatchObject({
      kind: "schedule",
      purpose: "follow up",
      schedule: {
        mode: "at",
        at: "2026-10-07T08:00:00.000Z",
        timeZone: "Europe/Amsterdam",
      },
    });
  });

  it("accepts bounded five-field cron syntax and rejects executable/unsupported syntax", () => {
    const trigger: ProactiveTrigger = {
      ...base,
      kind: "schedule",
      schedule: {
        mode: "cron",
        cron: "0 8 * * 1-5",
        timeZone: "Africa/Lagos",
      },
    };
    expect(normalizeProactiveTrigger(trigger).kind).toBe("schedule");

    expect(() =>
      normalizeProactiveTrigger({
        ...trigger,
        schedule: {
          ...trigger.schedule,
          cron: "0 8 * * 1-5 && rm -rf /",
        },
      }),
    ).toThrow();
  });

  it("normalizes event triggers from bounded canonical source classes", () => {
    expect(
      normalizeProactiveTrigger({
        ...base,
        kind: "event",
        event: {
          source: "perception",
          eventType: "Location.Entered",
        },
      }),
    ).toMatchObject({
      kind: "event",
      event: {
        source: "perception",
        eventType: "location.entered",
      },
    });
  });

  it("supports only bounded declarative condition operators", () => {
    expect(
      normalizeProactiveTrigger({
        ...base,
        kind: "condition",
        condition: {
          signalKey: "battery.percent",
          operator: "lte",
          expected: 15,
        },
      }),
    ).toMatchObject({
      kind: "condition",
      condition: {
        signalKey: "battery.percent",
        operator: "lte",
        expected: 15,
      },
    });

    expect(() =>
      normalizeProactiveTrigger({
        ...base,
        kind: "condition",
        condition: {
          signalKey: "battery.percent",
          operator: "lte",
          expected: "fifteen",
        },
      } as never),
    ).toThrow("requires numeric");
  });

  it("rejects invalid time zones instead of silently falling back", () => {
    expect(() =>
      normalizeProactiveTrigger({
        ...base,
        kind: "schedule",
        schedule: {
          mode: "at",
          at: "2026-10-07T09:00:00Z",
          timeZone: "Mars/Olympus",
        },
      }),
    ).toThrow("timeZone is invalid");
  });

  it("requires schedule modes to carry exactly one schedule expression", () => {
    expect(() =>
      normalizeProactiveTrigger({
        ...base,
        kind: "schedule",
        schedule: {
          mode: "at",
          at: "2026-10-07T09:00:00Z",
          cron: "0 9 * * *",
          timeZone: "UTC",
        },
      }),
    ).toThrow("requires only schedule.at");
  });

  it("produces stable scope/revision identity without using dedupe key as authority", () => {
    const trigger: ProactiveTrigger = {
      ...base,
      kind: "event",
      event: {
        source: "workflow",
        eventType: "workflow.completed",
      },
    };
    expect(proactiveTriggerIdentity(trigger)).toBe(
      [
        base.scope.tenantId,
        base.scope.relationshipId,
        base.scope.characterId,
        base.triggerId,
        "1",
      ].join(":"),
    );
  });
});
