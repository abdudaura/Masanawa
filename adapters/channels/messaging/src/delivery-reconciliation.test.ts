import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  createChannelDeliveryReconciler,
  type ChannelDeliveryBinding,
  type ChannelIngressRecord,
  type DurableChannelDeliveryStore,
} from "./index.js";

const accountId = createCanonicalId("channel-account");
const requestId = createCanonicalId("request");
const providerTimestamp = toInstant("2026-10-05T20:00:10.000Z");
const receivedAt = toInstant("2026-10-05T20:00:11.000Z");

function deliveryRecord(
  overrides: Partial<{
    messageId: string;
    recipientId: string;
    status: "sent" | "delivered" | "read" | "failed";
  }> = {},
): ChannelIngressRecord {
  return {
    schemaVersion: 1,
    channel: "whatsapp",
    accountId,
    externalEventId: "delivery:provider-message-1:delivered:1791230410",
    dedupeKey: "delivery-dedupe-1",
    evidenceHash: "delivery-evidence-1",
    receivedAt,
    event: {
      kind: "delivery",
      messageId: overrides.messageId ?? "provider-message-1",
      recipientId: overrides.recipientId ?? "2348012345678",
      status: overrides.status ?? "delivered",
      providerTimestamp,
    },
  };
}

function binding(
  overrides: Partial<ChannelDeliveryBinding> = {},
): ChannelDeliveryBinding {
  return {
    schemaVersion: 1,
    bindingKey: "outbound-binding-1",
    channel: "whatsapp",
    accountId,
    requestId,
    providerMessageId: "provider-message-1",
    recipientId: "2348012345678",
    revision: 2,
    ...overrides,
  };
}

function store(options: {
  binding?: ChannelDeliveryBinding | null;
  outcome?: "stored" | "duplicate";
} = {}) {
  const value = options.binding === undefined ? binding() : options.binding;
  return {
    load: vi.fn(async () => value),
    admitObservation: vi.fn(async () => ({
      outcome: options.outcome ?? "stored",
      binding: value!,
    })),
  } satisfies DurableChannelDeliveryStore;
}

describe("channel delivery reconciliation", () => {
  it("binds provider delivery evidence to the exact canonical outbound RequestId", async () => {
    const custody = store();
    const result = await createChannelDeliveryReconciler({
      store: custody,
    }).resolve(deliveryRecord());

    expect(result).toEqual({
      requestId,
      providerMessageId: "provider-message-1",
      status: "delivered",
      providerTimestamp,
      replay: false,
    });
    expect(custody.admitObservation).toHaveBeenCalledWith({
      bindingKey: "outbound-binding-1",
      bindingRevision: 2,
      requestId,
      status: "delivered",
      providerTimestamp,
      ingressDedupeKey: "delivery-dedupe-1",
      ingressEvidenceHash: "delivery-evidence-1",
    });
  });

  it("preserves duplicate provider webhook evidence as a replay", async () => {
    const result = await createChannelDeliveryReconciler({
      store: store({ outcome: "duplicate" }),
    }).resolve(deliveryRecord({ status: "read" }));

    expect(result).toMatchObject({
      requestId,
      status: "read",
      replay: true,
    });
  });

  it.each([
    ["provider message", deliveryRecord({ messageId: "other-message" })],
    ["recipient", deliveryRecord({ recipientId: "another-recipient" })],
  ])("rejects %s substitution before observation persistence", async (_name, record) => {
    const custody = store();
    await expect(
      createChannelDeliveryReconciler({ store: custody }).resolve(record),
    ).rejects.toMatchObject({
      code: "channels.delivery_scope_mismatch",
      category: "authorization",
    });
    expect(custody.admitObservation).not.toHaveBeenCalled();
  });

  it("rejects an unknown provider message rather than inventing outbox truth", async () => {
    await expect(
      createChannelDeliveryReconciler({
        store: store({ binding: null }),
      }).resolve(deliveryRecord()),
    ).rejects.toMatchObject({
      code: "channels.delivery_not_found",
      category: "not-found",
    });
  });

  it("detects an outbound binding revision race", async () => {
    const original = binding();
    const custody: DurableChannelDeliveryStore = {
      async load() {
        return original;
      },
      async admitObservation() {
        return {
          outcome: "stored",
          binding: { ...original, revision: 3 },
        };
      },
    };

    await expect(
      createChannelDeliveryReconciler({ store: custody }).resolve(
        deliveryRecord(),
      ),
    ).rejects.toMatchObject({
      code: "channels.delivery_binding_changed",
      category: "conflict",
    });
  });

  it("redacts durable-store failures and keeps them retryable", async () => {
    const custody: DurableChannelDeliveryStore = {
      async load() {
        throw new Error("private db details");
      },
      async admitObservation() {
        throw new Error("must not run");
      },
    };
    try {
      await createChannelDeliveryReconciler({ store: custody }).resolve(
        deliveryRecord(),
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: "channels.delivery_reconciliation_unavailable",
        category: "unavailable",
        retryable: true,
      });
      expect(JSON.stringify(error)).not.toContain("private db details");
    }
  });

  it("treats failed delivery as transport evidence, not payment/fulfillment truth", async () => {
    const result = await createChannelDeliveryReconciler({
      store: store(),
    }).resolve(deliveryRecord({ status: "failed" }));
    expect(result.status).toBe("failed");
    expect(result).not.toHaveProperty("operationId");
    expect(result).not.toHaveProperty("fulfillmentId");
    expect(result).not.toHaveProperty("payment");
  });
});
