import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type ChannelAccountId,
  type Instant,
  type RequestId,
} from "@masanawa/contracts";
import type {
  ChannelIngressRecord,
  InboundDelivery,
  MessagingChannel,
} from "./model.js";

export interface ChannelDeliveryBinding {
  readonly schemaVersion: 1;
  readonly bindingKey: string;
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly requestId: RequestId;
  readonly providerMessageId: string;
  readonly recipientId: string;
  readonly revision: number;
}

export interface ChannelDeliveryObservation {
  readonly bindingKey: string;
  readonly bindingRevision: number;
  readonly requestId: RequestId;
  readonly status: InboundDelivery["status"];
  readonly providerTimestamp: Instant;
  readonly ingressDedupeKey: string;
  readonly ingressEvidenceHash: string;
}

export interface DurableChannelDeliveryStore {
  load(input: {
    readonly channel: MessagingChannel;
    readonly accountId: ChannelAccountId;
    readonly providerMessageId: string;
  }): Promise<ChannelDeliveryBinding | null>;

  /**
   * Persist one exact delivery observation while the provider-message binding
   * is still current. Exact ingress replay returns duplicate.
   */
  admitObservation(input: ChannelDeliveryObservation): Promise<{
    readonly outcome: "stored" | "duplicate";
    readonly binding: ChannelDeliveryBinding;
  }>;
}

export interface ResolvedChannelDelivery {
  readonly requestId: RequestId;
  readonly providerMessageId: string;
  readonly status: InboundDelivery["status"];
  readonly providerTimestamp: Instant;
  readonly replay: boolean;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > max ||
    normalized.includes("\u0000")
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function deliveryError(
  code: string,
  category: "validation" | "authorization" | "conflict" | "not-found" | "unavailable",
  message: string,
  retryable = false,
): PlatformError {
  return new PlatformError({
    code: `channels.${code}`,
    category,
    message,
    retryable,
  });
}

export function normalizeChannelDeliveryBinding(
  input: ChannelDeliveryBinding,
): ChannelDeliveryBinding {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Channel delivery binding schema is invalid");
  }
  if (input.channel !== "whatsapp" && input.channel !== "telegram") {
    throw new TypeError("Channel delivery binding channel is invalid");
  }
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    input.revision > 1_000_000_000
  ) {
    throw new TypeError("Channel delivery binding revision is invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    bindingKey: bounded(input.bindingKey, "bindingKey", 256),
    channel: input.channel,
    accountId: parseCanonicalId("channel-account", input.accountId),
    requestId: parseCanonicalId("request", input.requestId),
    providerMessageId: bounded(
      input.providerMessageId,
      "providerMessageId",
      512,
    ),
    recipientId: bounded(input.recipientId, "recipientId", 512),
    revision: input.revision,
  });
}

function sameBinding(
  left: ChannelDeliveryBinding,
  right: ChannelDeliveryBinding,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.bindingKey === right.bindingKey &&
    left.channel === right.channel &&
    left.accountId === right.accountId &&
    left.requestId === right.requestId &&
    left.providerMessageId === right.providerMessageId &&
    left.recipientId === right.recipientId &&
    left.revision === right.revision
  );
}

export function createChannelDeliveryReconciler(input: {
  readonly store: DurableChannelDeliveryStore;
}) {
  return Object.freeze({
    async resolve(record: ChannelIngressRecord): Promise<ResolvedChannelDelivery> {
      if (record.event.kind !== "delivery") {
        throw deliveryError(
          "delivery_not_status",
          "validation",
          "Channel event is not delivery evidence",
        );
      }
      const delivery = record.event;
      const providerMessageId = bounded(
        delivery.messageId,
        "providerMessageId",
        512,
      );

      let raw: ChannelDeliveryBinding | null;
      try {
        raw = await input.store.load({
          channel: record.channel,
          accountId: record.accountId,
          providerMessageId,
        });
      } catch {
        throw deliveryError(
          "delivery_reconciliation_unavailable",
          "unavailable",
          "Channel delivery reconciliation is unavailable",
          true,
        );
      }
      if (raw === null) {
        throw deliveryError(
          "delivery_not_found",
          "not-found",
          "Channel delivery does not match a known outbound message",
        );
      }

      let binding: ChannelDeliveryBinding;
      try {
        binding = normalizeChannelDeliveryBinding(raw);
      } catch {
        throw deliveryError(
          "delivery_reconciliation_unavailable",
          "unavailable",
          "Channel delivery reconciliation is unavailable",
          true,
        );
      }
      if (
        binding.channel !== record.channel ||
        binding.accountId !== record.accountId ||
        binding.providerMessageId !== providerMessageId ||
        binding.recipientId !== delivery.recipientId
      ) {
        throw deliveryError(
          "delivery_scope_mismatch",
          "authorization",
          "Channel delivery does not match its outbound message scope",
        );
      }

      let admitted;
      try {
        admitted = await input.store.admitObservation({
          bindingKey: binding.bindingKey,
          bindingRevision: binding.revision,
          requestId: binding.requestId,
          status: delivery.status,
          providerTimestamp: toInstant(delivery.providerTimestamp),
          ingressDedupeKey: bounded(
            record.dedupeKey,
            "ingressDedupeKey",
            256,
          ),
          ingressEvidenceHash: bounded(
            record.evidenceHash,
            "ingressEvidenceHash",
            256,
          ),
        });
      } catch {
        throw deliveryError(
          "delivery_reconciliation_unavailable",
          "unavailable",
          "Channel delivery reconciliation is unavailable",
          true,
        );
      }
      if (
        admitted?.outcome !== "stored" &&
        admitted?.outcome !== "duplicate"
      ) {
        throw deliveryError(
          "delivery_reconciliation_unavailable",
          "unavailable",
          "Channel delivery reconciliation is unavailable",
          true,
        );
      }

      let current: ChannelDeliveryBinding;
      try {
        current = normalizeChannelDeliveryBinding(admitted.binding);
      } catch {
        throw deliveryError(
          "delivery_reconciliation_unavailable",
          "unavailable",
          "Channel delivery reconciliation is unavailable",
          true,
        );
      }
      if (!sameBinding(current, binding)) {
        throw deliveryError(
          "delivery_binding_changed",
          "conflict",
          "Channel outbound binding changed during delivery reconciliation",
        );
      }

      return Object.freeze({
        requestId: current.requestId,
        providerMessageId: current.providerMessageId,
        status: delivery.status,
        providerTimestamp: toInstant(delivery.providerTimestamp),
        replay: admitted.outcome === "duplicate",
      });
    },
  });
}
