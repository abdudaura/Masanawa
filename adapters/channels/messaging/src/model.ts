import type { ChannelAccountId, ChannelConversationRef, ExternalSubjectRef, Instant } from "@masanawa/contracts";

export type MessagingChannel = "whatsapp" | "telegram";

/** Transport evidence only. Selection IDs never grant execution authority. */
export type InboundContent =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "selection"; readonly selectionId: string }
  | { readonly kind: "media"; readonly mediaKind: "audio" | "image" | "video" | "document";
      readonly fileId: string; readonly mimeType?: string; readonly caption?: string }
  | { readonly kind: "unsupported"; readonly providerType: string };

export interface InboundMessage {
  readonly kind: "message";
  readonly subject: ExternalSubjectRef;
  readonly conversation: ChannelConversationRef;
  readonly messageId: string;
  readonly providerTimestamp?: Instant;
  readonly edited: boolean;
  readonly replyToMessageId?: string;
  readonly callbackQueryId?: string;
  readonly content: InboundContent;
}

/** Delivery evidence does not establish payment or fulfillment success. */
export interface InboundDelivery {
  readonly kind: "delivery";
  readonly messageId: string;
  readonly recipientId: string;
  readonly status: "sent" | "delivered" | "read" | "failed";
  readonly providerTimestamp: Instant;
}

export interface ChannelIngressRecord {
  readonly schemaVersion: 1;
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  /** Provider identity, never a canonical User, Request or Operation ID. */
  readonly externalEventId: string;
  readonly dedupeKey: string;
  /** Stable normalized evidence hash excludes local receipt time. */
  readonly evidenceHash: string;
  readonly receivedAt: Instant;
  readonly event: InboundMessage | InboundDelivery;
}

/** Gateway implements this with canonical durable custody. No in-memory default. */
export interface DurableChannelAdmission {
  admitBatch(records: readonly ChannelIngressRecord[]): Promise<{
    readonly outcome: "persisted" | "duplicate";
  }>;
}

export interface WebhookResult {
  readonly statusCode: 200;
  readonly admittedRecords: number;
  readonly ignoredEvents: number;
}

export interface ChannelIngressConfig {
  readonly accountId: ChannelAccountId;
  readonly admission: DurableChannelAdmission;
}
