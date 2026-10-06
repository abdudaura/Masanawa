import { describe, expect, it } from "vitest";
import {
  assertPerceptionPurpose,
  canPromotePerceptionToMemory,
  normalizePerceptionEvent,
  type PerceptionEvent,
} from "../../packages/perception/src/index.js";

function event(
  overrides: Partial<PerceptionEvent> = {},
): PerceptionEvent {
  return {
    schemaVersion: 1,
    perceptionEventId:
      "event_0199f0a0-0000-7000-8000-000000000001",
    tenantId:
      "tenant_0199f0a0-0000-7000-8000-000000000002",
    kind: "text",
    source: {
      kind: "app",
      sourceId: "mobile-chat",
      deviceId: null,
      channelAccountId: null,
    },
    subject: {
      userId:
        "user_0199f0a0-0000-7000-8000-000000000003",
      relationshipId:
        "relationship_0199f0a0-0000-7000-8000-000000000004",
      characterId:
        "character_0199f0a0-0000-7000-8000-000000000005",
    },
    permission: {
      authorityContextId:
        "authority-context_0199f0a0-0000-7000-8000-000000000006",
      basis: "user-action",
      revision: 3,
      purposes: ["conversation", "task-admission"],
    },
    privacy: {
      scope: "relationship",
      retention: "session",
      memoryPromotion: "forbidden",
    },
    payload: {
      mediaType: "text/plain",
      contentRef: null,
      inlineText: "Please explain this document.",
      attributes: { language: "en" },
    },
    dedupeKey: "mobile-message:msg-000001",
    observedAt: "2026-10-06T10:00:00.000Z",
    receivedAt: "2026-10-06T10:00:01.000Z",
    ...overrides,
  };
}

describe("canonical PerceptionEvent", () => {
  it("normalizes a permission-scoped relationship event", () => {
    const normalized = normalizePerceptionEvent(event());
    expect(normalized).toMatchObject({
      schemaVersion: 1,
      kind: "text",
      permission: {
        basis: "user-action",
        revision: 3,
        purposes: ["conversation", "task-admission"],
      },
      privacy: {
        scope: "relationship",
        retention: "session",
        memoryPromotion: "forbidden",
      },
    });
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it("requires relationship and character scope together", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          subject: {
            ...event().subject,
            characterId: null,
          },
        }),
      ),
    ).toThrow("requires both relationshipId and characterId");
  });

  it("requires device perception to carry a device locator and device permission", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          source: {
            kind: "device",
            sourceId: "android-camera",
            deviceId: null,
            channelAccountId: null,
          },
        }),
      ),
    ).toThrow("requires source.deviceId");

    const deviceEvent = event({
      kind: "camera",
      source: {
        kind: "device",
        sourceId: "camera:rear",
        deviceId:
          "device_0199f0a0-0000-7000-8000-000000000007",
        channelAccountId: null,
      },
      permission: {
        ...event().permission,
        basis: "device-permission",
        purposes: ["conversation"],
      },
      payload: {
        mediaType: "image/jpeg",
        contentRef: "media://capture/abc",
        inlineText: null,
        attributes: {},
      },
    });

    expect(normalizePerceptionEvent(deviceEvent).source.deviceId).toContain(
      "device_",
    );
  });

  it("requires channel perception to carry channel-consent or direct user-action evidence", () => {
    const base = event({
      source: {
        kind: "channel",
        sourceId: "telegram:update",
        deviceId: null,
        channelAccountId:
          "channel-account_0199f0a0-0000-7000-8000-000000000008",
      },
    });

    expect(() =>
      normalizePerceptionEvent({
        ...base,
        permission: {
          ...base.permission,
          basis: "relationship-policy",
        },
      }),
    ).toThrow("channel-consent or user-action");

    expect(
      normalizePerceptionEvent({
        ...base,
        permission: {
          ...base.permission,
          basis: "channel-consent",
        },
      }).permission.basis,
    ).toBe("channel-consent");
  });

  it("does not let system-originated perception masquerade as user consent", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          source: {
            kind: "system",
            sourceId: "scheduler",
            deviceId: null,
            channelAccountId: null,
          },
          permission: {
            ...event().permission,
            basis: "user-action",
          },
        }),
      ),
    ).toThrow("system-policy");
  });

  it("requires one bounded payload locator and never accepts both inline content and a content reference", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          payload: {
            mediaType: "text/plain",
            contentRef: null,
            inlineText: null,
            attributes: {},
          },
        }),
      ),
    ).toThrow("requires contentRef or inlineText");

    expect(() =>
      normalizePerceptionEvent(
        event({
          payload: {
            mediaType: "text/plain",
            contentRef: "media://document/1",
            inlineText: "duplicate body",
            attributes: {},
          },
        }),
      ),
    ).toThrow("must not contain both");
  });

  it("requires explicit purpose evidence before a consumer uses the event for that purpose", () => {
    expect(() =>
      assertPerceptionPurpose(event(), "conversation"),
    ).not.toThrow();

    expect(() =>
      assertPerceptionPurpose(event(), "memory-write"),
    ).toThrow("lacks required purpose");
  });

  it("forbids memory promotion for ephemeral/session perception and permits only durable review-required events", () => {
    expect(canPromotePerceptionToMemory(event())).toBe(false);

    const durable = event({
      privacy: {
        scope: "relationship",
        retention: "durable",
        memoryPromotion: "review-required",
      },
    });
    expect(canPromotePerceptionToMemory(durable)).toBe(true);

    expect(() =>
      normalizePerceptionEvent(
        event({
          privacy: {
            scope: "relationship",
            retention: "ephemeral",
            memoryPromotion: "review-required",
          },
        }),
      ),
    ).toThrow("ephemeral perception cannot be promoted");
  });

  it("rejects events whose observation time is after their admission time", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          observedAt: "2026-10-06T10:01:00.000Z",
          receivedAt: "2026-10-06T10:00:00.000Z",
        }),
      ),
    ).toThrow("observedAt cannot be after receivedAt");
  });

  it("rejects duplicate purposes so permission evidence remains deterministic", () => {
    expect(() =>
      normalizePerceptionEvent(
        event({
          permission: {
            ...event().permission,
            purposes: ["conversation", "Conversation"],
          },
        }),
      ),
    ).toThrow("must not contain duplicates");
  });
});
