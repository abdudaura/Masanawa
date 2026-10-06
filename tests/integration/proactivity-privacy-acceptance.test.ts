import { describe, expect, it } from "vitest";
import {
  commitmentNeedsFollowUp,
  transitionCommitment,
  type ProactiveCommitment,
} from "../../packages/proactivity/src/commitments.js";
import {
  evaluateProactivityPolicy,
  type ProactivityPolicy,
} from "../../packages/proactivity/src/policy.js";
import {
  normalizeProactiveTrigger,
  proactiveTriggerIdentity,
} from "../../packages/proactivity/src/trigger-model.js";
import {
  projectRoutineTrigger,
  projectWorldEventTrigger,
} from "../../packages/proactivity/src/world-integration.js";

const scope = {
  tenantId: "tenant_0199f0a0-0000-7000-8000-000000000801",
  userId: "user_0199f0a0-0000-7000-8000-000000000802",
  relationshipId:
    "relationship_0199f0a0-0000-7000-8000-000000000803",
  characterId:
    "character_0199f0a0-0000-7000-8000-000000000804",
  purpose: "follow up",
};

const policy: ProactivityPolicy = {
  schemaVersion: 1,
  revision: 3,
  relationshipEnabled: true,
  allowedPrivacyScopes: ["relationship"],
  maxActionsPerHour: 2,
  maxActionsPerDay: 5,
  quietHours: {
    enabled: true,
    startLocalTime: "22:00",
    endLocalTime: "07:00",
    timeZone: "Africa/Lagos",
  },
};

describe("Task 118 governed proactivity privacy acceptance", () => {
  it("preserves trigger identity across an offline interval and re-evaluates policy at delivery time", () => {
    const projected = projectRoutineTrigger({
      scope,
      routine: {
        tenantId: scope.tenantId,
        worldId: "world_0199f0a0-0000-7000-8000-000000000805",
        routineKey: "morning-check-in",
        characterId: scope.characterId,
        timezone: "Africa/Lagos",
        localTime: "06:30",
        enabled: true,
        revision: 2,
      },
    });

    expect(projected).not.toBeNull();
    const beforeOffline = proactiveTriggerIdentity(projected!);

    // Simulate the same persisted trigger being reconstructed after reconnect.
    const afterReconnect = normalizeProactiveTrigger({
      ...projected!,
      dedupeKey: projected!.dedupeKey,
    });
    expect(proactiveTriggerIdentity(afterReconnect)).toBe(beforeOffline);
    expect(afterReconnect.dedupeKey).toBe(projected!.dedupeKey);

    // A trigger that became due while offline must not bypass current quiet-hours
    // policy merely because delivery is delayed until reconnect.
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T06:35:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "quiet-hours" });

    // Once quiet hours end, the same trigger may be admitted if frequency/privacy
    // checks still pass.
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T07:05:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("prevents reconnect catch-up from exceeding frequency ceilings", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T12:00:00+01:00",
          actionsLastHour: 2,
          actionsLastDay: 3,
        },
      }),
    ).toEqual({ allowed: false, reason: "hourly-limit" });

    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T12:00:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 5,
        },
      }),
    ).toEqual({ allowed: false, reason: "daily-limit" });
  });

  it("keeps commitment follow-up idempotent after completion", () => {
    const commitment: ProactiveCommitment = {
      schemaVersion: 1,
      commitmentId: "commitment-acceptance-001",
      revision: 1,
      scope: {
        tenantId: scope.tenantId,
        userId: scope.userId,
        relationshipId: scope.relationshipId,
        characterId: scope.characterId,
      },
      promise: "Send the promised summary after reconnect.",
      createdAt: "2026-10-06T09:00:00Z",
      dueAt: "2026-10-06T10:00:00Z",
      followUpTriggerId: "trigger-follow-up-acceptance",
      state: "open",
      completedAt: null,
      cancelledAt: null,
      expiredAt: null,
    };

    expect(
      commitmentNeedsFollowUp(commitment, "2026-10-06T10:30:00Z"),
    ).toBe(true);

    const completed = transitionCommitment({
      current: commitment,
      nextState: "completed",
      occurredAt: "2026-10-06T10:31:00Z",
    });

    expect(
      commitmentNeedsFollowUp(completed, "2026-10-06T11:00:00Z"),
    ).toBe(false);

    expect(() =>
      transitionCommitment({
        current: completed,
        nextState: "completed",
        occurredAt: "2026-10-06T11:01:00Z",
      }),
    ).toThrow("terminal commitment cannot transition again");
  });

  it("never projects draft/private World events into proactive triggers", () => {
    const baseEvent = {
      tenantId: scope.tenantId,
      worldEventId:
        "world-event_0199f0a0-0000-7000-8000-000000000806",
      worldId: "world_0199f0a0-0000-7000-8000-000000000807",
      characterId: scope.characterId,
      eventKind: "private.note",
      visibility: "shared" as const,
      canonState: "approved" as const,
      effectiveStart: "2026-10-06T10:00:00Z",
      occurrenceKey: "evt-private-1",
    };

    expect(
      projectWorldEventTrigger({
        scope,
        event: { ...baseEvent, visibility: "private" },
      }),
    ).toBeNull();

    expect(
      projectWorldEventTrigger({
        scope,
        event: { ...baseEvent, canonState: "draft" },
      }),
    ).toBeNull();
  });

  it("does not widen proactive delivery beyond the Relationship privacy policy", () => {
    expect(
      evaluateProactivityPolicy({
        policy,
        attempt: {
          privacyScope: "user-private",
          now: "2026-10-07T12:00:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "privacy-scope-denied" });

    expect(
      evaluateProactivityPolicy({
        policy: { ...policy, relationshipEnabled: false },
        attempt: {
          privacyScope: "relationship",
          now: "2026-10-07T12:00:00+01:00",
          actionsLastHour: 0,
          actionsLastDay: 0,
        },
      }),
    ).toEqual({ allowed: false, reason: "relationship-disabled" });
  });
});
