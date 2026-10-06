import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  createProactiveTrigger,
  normalizeProactiveTriggerDefinition,
  reviseProactiveTrigger,
  transitionProactiveTrigger,
} from "./trigger.js";

const scope = {
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  characterId: createCanonicalId("character"),
  relationshipId: createCanonicalId("relationship"),
};

describe("Proactive trigger model", () => {
  it("creates a one-shot schedule with explicit IANA timezone", () => {
    const trigger = createProactiveTrigger({
      scope,
      triggerKey: "morning.followup",
      definition: {
        kind: "schedule",
        timezone: "Africa/Lagos",
        schedule: {
          kind: "once",
          at: toInstant("2026-10-07T07:00:00.000Z"),
        },
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    expect(trigger).toMatchObject({
      schemaVersion: 1,
      scope,
      triggerKey: "morning.followup",
      state: "active",
      revision: 1,
      definition: {
        kind: "schedule",
        timezone: "Africa/Lagos",
        schedule: { kind: "once" },
      },
    });
  });

  it("normalizes weekly schedules and rejects duplicate weekdays", () => {
    const normalized = normalizeProactiveTriggerDefinition({
      kind: "schedule",
      timezone: "Europe/Amsterdam",
      schedule: {
        kind: "weekly",
        localTime: "08:30",
        weekdays: [5, 1, 3],
      },
    });
    expect(normalized).toEqual({
      kind: "schedule",
      timezone: "Europe/Amsterdam",
      schedule: {
        kind: "weekly",
        localTime: "08:30",
        weekdays: [1, 3, 5],
      },
    });

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "schedule",
        timezone: "Europe/Amsterdam",
        schedule: {
          kind: "weekly",
          localTime: "08:30",
          weekdays: [1, 1],
        },
      }),
    ).toThrow(/unique/);
  });

  it("rejects invalid timezone, clock time and overly frequent interval schedules", () => {
    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "schedule",
        timezone: "Mars/Olympus",
        schedule: {
          kind: "daily",
          localTime: "08:00",
        },
      }),
    ).toThrow(/IANA timezone/);

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "schedule",
        timezone: "Africa/Lagos",
        schedule: {
          kind: "daily",
          localTime: "25:00",
        },
      }),
    ).toThrow(/HH:MM/);

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "schedule",
        timezone: "Africa/Lagos",
        schedule: {
          kind: "interval",
          everySeconds: 60,
          startAt: toInstant("2026-10-06T18:00:00.000Z"),
        },
      }),
    ).toThrow(/everySeconds/);
  });

  it("bounds canonical event match filters", () => {
    const event = normalizeProactiveTriggerDefinition({
      kind: "event",
      eventType: "payment.completed",
      sourceScope: "user",
      filters: {
        currency: "NGN",
        provider: "flutterwave",
      },
    });
    expect(event).toEqual({
      kind: "event",
      eventType: "payment.completed",
      sourceScope: "user",
      filters: {
        currency: "NGN",
        provider: "flutterwave",
      },
    });

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "event",
        eventType: "payment.completed",
        sourceScope: "user",
        filters: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => [`f${index}`, "x"]),
        ),
      }),
    ).toThrow(/filters exceed/);
  });

  it("requires typed condition operators and bounded watch cadence", () => {
    const condition = normalizeProactiveTriggerDefinition({
      kind: "condition",
      observationKey: "device.battery_percent",
      operator: "less-than",
      expectedValue: 20,
      evaluationCadenceSeconds: 900,
      requireConsecutiveMatches: 2,
      cooldownSeconds: 3600,
    });
    expect(condition).toMatchObject({
      observationKey: "device.battery_percent",
      operator: "less-than",
      expectedValue: 20,
      evaluationCadenceSeconds: 900,
      requireConsecutiveMatches: 2,
      cooldownSeconds: 3600,
    });

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "condition",
        observationKey: "device.battery_percent",
        operator: "less-than",
        expectedValue: "20",
        evaluationCadenceSeconds: 900,
        requireConsecutiveMatches: 1,
        cooldownSeconds: 0,
      }),
    ).toThrow(/numeric expectedValue/);

    expect(() =>
      normalizeProactiveTriggerDefinition({
        kind: "condition",
        observationKey: "device.battery_percent",
        operator: "equals",
        expectedValue: 20,
        evaluationCadenceSeconds: 30,
        requireConsecutiveMatches: 1,
        cooldownSeconds: 0,
      }),
    ).toThrow(/evaluationCadenceSeconds/);
  });

  it("revises definition only with exact observed revision", () => {
    const created = createProactiveTrigger({
      scope,
      triggerKey: "followup",
      definition: {
        kind: "event",
        eventType: "task.completed",
        sourceScope: "relationship",
        filters: {},
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const revised = reviseProactiveTrigger({
      trigger: created,
      expectedRevision: 1,
      definition: {
        kind: "event",
        eventType: "task.failed",
        sourceScope: "relationship",
        filters: {},
      },
      changedAt: toInstant("2026-10-06T18:01:00.000Z"),
    });

    expect(revised).toMatchObject({
      triggerKey: "followup",
      revision: 2,
      state: "active",
      definition: { eventType: "task.failed" },
    });

    expect(() =>
      reviseProactiveTrigger({
        trigger: revised,
        expectedRevision: 1,
        definition: revised.definition,
        changedAt: toInstant("2026-10-06T18:02:00.000Z"),
      }),
    ).toThrow(/revision is stale/);
  });

  it("supports pause/resume and terminal revocation", () => {
    const created = createProactiveTrigger({
      scope,
      triggerKey: "watch.balance",
      definition: {
        kind: "condition",
        observationKey: "wallet.balance",
        operator: "less-than",
        expectedValue: 100,
        evaluationCadenceSeconds: 900,
        requireConsecutiveMatches: 1,
        cooldownSeconds: 3600,
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });

    const paused = transitionProactiveTrigger({
      trigger: created,
      expectedRevision: 1,
      state: "paused",
      changedAt: toInstant("2026-10-06T18:01:00.000Z"),
    });
    expect(paused).toMatchObject({ state: "paused", revision: 2 });

    const resumed = transitionProactiveTrigger({
      trigger: paused,
      expectedRevision: 2,
      state: "active",
      changedAt: toInstant("2026-10-06T18:02:00.000Z"),
    });
    expect(resumed).toMatchObject({ state: "active", revision: 3 });

    const revoked = transitionProactiveTrigger({
      trigger: resumed,
      expectedRevision: 3,
      state: "revoked",
      changedAt: toInstant("2026-10-06T18:03:00.000Z"),
    });
    expect(revoked).toMatchObject({ state: "revoked", revision: 4 });

    expect(() =>
      transitionProactiveTrigger({
        trigger: revoked,
        expectedRevision: 4,
        state: "active",
        changedAt: toInstant("2026-10-06T18:04:00.000Z"),
      }),
    ).toThrow(/terminal/);
  });

  it("never carries Tool, Provider, credential or executable code authority", () => {
    const trigger = createProactiveTrigger({
      scope,
      triggerKey: "safe.event",
      definition: {
        kind: "event",
        eventType: "order.ready",
        sourceScope: "user",
        filters: { order: "123" },
      },
      createdAt: toInstant("2026-10-06T18:00:00.000Z"),
    });
    const json = JSON.stringify(trigger);

    expect(json).not.toContain("toolId");
    expect(json).not.toContain("providerId");
    expect(json).not.toContain("credential");
    expect(json).not.toContain("javascript");
    expect(json).not.toContain("http://");
    expect(json).not.toContain("https://");
  });
});
