import { createHash } from "node:crypto";
import {
  PlatformError,
  parseCanonicalId,
  toInstant,
  type ChannelAccountId,
  type Instant,
  type RequestId,
} from "@masanawa/contracts";
import type { MessagingChannel } from "./model.js";

export interface ChannelOutboundConversation {
  readonly system: string;
  readonly namespace: string;
  readonly value: string;
  readonly conversationKind: "direct" | "group" | "channel" | "thread" | "topic";
}

export type ChannelOutboundContent =
  | Readonly<{
      kind: "text";
      text: string;
    }>
  | Readonly<{
      kind: "audio";
      fileRef: string;
      mimeType: string;
      caption: string | null;
    }>
  | Readonly<{
      kind: "options";
      prompt: string;
      options: readonly Readonly<{
        label: string;
        selectionId: string;
      }>[];
    }>;

export interface ChannelOutboundRequest {
  readonly schemaVersion: 1;
  readonly requestId: RequestId;
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly conversation: ChannelOutboundConversation;
  readonly replyToMessageId: string | null;
  readonly content: ChannelOutboundContent;
}

export type ChannelOutboundState =
  | "pending"
  | "dispatching"
  | "sent"
  | "failed"
  | "unknown";

export interface ChannelOutboundRecord {
  readonly request: ChannelOutboundRequest;
  readonly payloadHash: string;
  readonly state: ChannelOutboundState;
  readonly revision: number;
  readonly providerMessageId: string | null;
  readonly providerAcceptedAt: Instant | null;
  readonly safeFailureCode: string | null;
  readonly reconciliationEvidenceRef: string | null;
}

export type ChannelProviderSendResult =
  | Readonly<{
      status: "accepted";
      providerMessageId: string;
      acceptedAt: Instant;
    }>
  | Readonly<{
      status: "rejected";
      safeCode: string;
    }>;

export interface ChannelOutboundMediaResolver {
  /**
   * Resolve an already-authorized opaque platform file reference to a provider
   * media/file id. Implementations own upload/fetch authorization and secrets.
   */
  resolve(input: {
    readonly channel: MessagingChannel;
    readonly accountId: ChannelAccountId;
    readonly fileRef: string;
    readonly mimeType: string;
  }): Promise<{ readonly providerFileId: string }>;
}

export interface ChannelProviderSender {
  send(request: ChannelOutboundRequest): Promise<ChannelProviderSendResult>;
}

export interface DurableChannelOutbox {
  /**
   * Admit one exact outbound request by canonical RequestId + payload hash.
   * Exact replay returns existing state; changed payload under the same RequestId
   * must fail closed.
   */
  admit(input: {
    readonly request: ChannelOutboundRequest;
    readonly payloadHash: string;
  }): Promise<ChannelOutboundRecord>;

  /** Atomic pending -> dispatching compare-and-set. */
  claimDispatch(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
  }): Promise<ChannelOutboundRecord>;

  /** Atomic dispatching -> sent. */
  markSent(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly providerMessageId: string;
    readonly acceptedAt: Instant;
  }): Promise<ChannelOutboundRecord>;

  /** Atomic dispatching -> failed for explicit provider rejection. */
  markFailed(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly safeCode: string;
  }): Promise<ChannelOutboundRecord>;

  /**
   * Atomic dispatching -> unknown when provider outcome cannot be proven.
   * A replay of unknown/dispatching must never call the provider again.
   */
  markUnknown(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
  }): Promise<ChannelOutboundRecord>;

  /**
   * Resolve unknown/dispatching from external receipt/operator/provider evidence.
   * resolution=sent requires providerMessageId; not-sent becomes terminal failed.
   * This method never redispatches.
   */
  resolveAmbiguous(input: {
    readonly requestId: RequestId;
    readonly payloadHash: string;
    readonly expectedRevision: number;
    readonly resolution: "sent" | "not-sent";
    readonly evidenceRef: string;
    readonly providerMessageId: string | null;
    readonly acceptedAt: Instant | null;
  }): Promise<ChannelOutboundRecord>;
}

export interface ChannelOutboundReceipt {
  readonly requestId: RequestId;
  readonly state: "sent";
  readonly providerMessageId: string;
  readonly acceptedAt: Instant;
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

function normalizeConversation(
  input: ChannelOutboundConversation,
): ChannelOutboundConversation {
  if (
    !(
      ["direct", "group", "channel", "thread", "topic"] as const
    ).includes(input.conversationKind)
  ) {
    throw new TypeError("Channel outbound conversation kind is invalid");
  }
  return Object.freeze({
    system: bounded(input.system, "conversation.system", 128),
    namespace: bounded(input.namespace, "conversation.namespace", 256),
    value: bounded(input.value, "conversation.value", 512),
    conversationKind: input.conversationKind,
  });
}

function normalizeContent(input: ChannelOutboundContent): ChannelOutboundContent {
  if (input.kind === "text") {
    return Object.freeze({
      kind: "text" as const,
      text: bounded(input.text, "outbound.text", 16_384),
    });
  }
  if (input.kind === "audio") {
    const mimeType = bounded(input.mimeType, "outbound.mimeType", 128).toLowerCase();
    if (!mimeType.startsWith("audio/")) {
      throw new TypeError("Channel outbound audio mimeType is invalid");
    }
    return Object.freeze({
      kind: "audio" as const,
      fileRef: bounded(input.fileRef, "outbound.fileRef", 2048),
      mimeType,
      caption:
        input.caption === null
          ? null
          : bounded(input.caption, "outbound.caption", 4096),
    });
  }
  if (input.kind !== "options") {
    throw new TypeError("Channel outbound content kind is invalid");
  }
  if (
    !Array.isArray(input.options) ||
    input.options.length < 1 ||
    input.options.length > 10
  ) {
    throw new TypeError("Channel outbound options are invalid");
  }
  const options = input.options.map((option) => {
    const selectionId = bounded(
      option.selectionId,
      "outbound.selectionId",
      64,
    );
    if (Buffer.byteLength(selectionId, "utf8") > 64) {
      throw new TypeError("Channel outbound selectionId exceeds 64 bytes");
    }
    return Object.freeze({
      label: bounded(option.label, "outbound.option.label", 80),
      selectionId,
    });
  });
  if (new Set(options.map((option) => option.selectionId)).size !== options.length) {
    throw new TypeError("Channel outbound selectionIds must be unique");
  }
  return Object.freeze({
    kind: "options" as const,
    prompt: bounded(input.prompt, "outbound.prompt", 4096),
    options: Object.freeze(options),
  });
}

export function normalizeChannelOutboundRequest(
  input: ChannelOutboundRequest,
): ChannelOutboundRequest {
  if (input.schemaVersion !== 1) {
    throw new TypeError("Channel outbound schema is invalid");
  }
  if (input.channel !== "whatsapp" && input.channel !== "telegram") {
    throw new TypeError("Channel outbound channel is invalid");
  }
  return Object.freeze({
    schemaVersion: 1,
    requestId: parseCanonicalId("request", input.requestId),
    channel: input.channel,
    accountId: parseCanonicalId("channel-account", input.accountId),
    conversation: normalizeConversation(input.conversation),
    replyToMessageId:
      input.replyToMessageId === null
        ? null
        : bounded(input.replyToMessageId, "replyToMessageId", 512),
    content: normalizeContent(input.content),
  });
}

export function fingerprintChannelOutboundRequest(
  input: ChannelOutboundRequest,
): string {
  const request = normalizeChannelOutboundRequest(input);
  return createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex");
}

function outboundError(
  code: string,
  category: "conflict" | "unavailable",
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

function normalizeRecord(
  record: ChannelOutboundRecord,
  expectedRequest: ChannelOutboundRequest,
  expectedHash: string,
): ChannelOutboundRecord {
  const request = normalizeChannelOutboundRequest(record.request);
  if (
    record.payloadHash !== expectedHash ||
    fingerprintChannelOutboundRequest(request) !== expectedHash ||
    request.requestId !== expectedRequest.requestId ||
    request.channel !== expectedRequest.channel ||
    request.accountId !== expectedRequest.accountId ||
    JSON.stringify(request) !== JSON.stringify(expectedRequest)
  ) {
    throw outboundError(
      "outbound_custody_conflict",
      "conflict",
      "Durable channel outbox returned different request custody",
    );
  }
  if (
    !(
      ["pending", "dispatching", "sent", "failed", "unknown"] as const
    ).includes(record.state) ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0
  ) {
    throw outboundError(
      "outbound_custody_conflict",
      "conflict",
      "Durable channel outbox returned invalid state",
    );
  }
  return Object.freeze({
    ...record,
    request,
  });
}

function sentReceipt(
  record: ChannelOutboundRecord,
  replay: boolean,
): ChannelOutboundReceipt {
  if (
    record.state !== "sent" ||
    record.providerMessageId === null ||
    record.providerAcceptedAt === null
  ) {
    throw outboundError(
      "outbound_custody_conflict",
      "conflict",
      "Sent channel outbox state lacks provider receipt evidence",
    );
  }
  return Object.freeze({
    requestId: record.request.requestId,
    state: "sent" as const,
    providerMessageId: bounded(
      record.providerMessageId,
      "providerMessageId",
      512,
    ),
    acceptedAt: toInstant(record.providerAcceptedAt),
    replay,
  });
}

export function createChannelOutboundDispatcher(input: {
  readonly outbox: DurableChannelOutbox;
  readonly sender: ChannelProviderSender;
}) {
  return Object.freeze({
    async send(requestInput: ChannelOutboundRequest): Promise<ChannelOutboundReceipt> {
      const request = normalizeChannelOutboundRequest(requestInput);
      const payloadHash = fingerprintChannelOutboundRequest(request);

      let admitted: ChannelOutboundRecord;
      try {
        admitted = normalizeRecord(
          await input.outbox.admit({ request, payloadHash }),
          request,
          payloadHash,
        );
      } catch (error) {
        if (error instanceof PlatformError) throw error;
        throw outboundError(
          "outbound_unavailable",
          "unavailable",
          "Channel outbox is unavailable",
          true,
        );
      }

      if (admitted.state === "sent") {
        return sentReceipt(admitted, true);
      }
      if (
        admitted.state === "dispatching" ||
        admitted.state === "unknown"
      ) {
        throw outboundError(
          "outbound_reconciliation_required",
          "conflict",
          "Channel send outcome is uncertain and must be reconciled before any resend",
        );
      }
      if (admitted.state === "failed") {
        throw outboundError(
          "outbound_failed",
          "conflict",
          "Channel send previously failed and will not be blindly retried",
        );
      }

      let dispatching: ChannelOutboundRecord;
      try {
        dispatching = normalizeRecord(
          await input.outbox.claimDispatch({
            requestId: request.requestId,
            payloadHash,
            expectedRevision: admitted.revision,
          }),
          request,
          payloadHash,
        );
      } catch (error) {
        if (error instanceof PlatformError) throw error;
        throw outboundError(
          "outbound_unavailable",
          "unavailable",
          "Channel outbox is unavailable",
          true,
        );
      }
      if (dispatching.state !== "dispatching") {
        throw outboundError(
          "outbound_custody_conflict",
          "conflict",
          "Channel outbox did not establish dispatch custody",
        );
      }

      let provider: ChannelProviderSendResult;
      try {
        provider = await input.sender.send(request);
      } catch {
        try {
          await input.outbox.markUnknown({
            requestId: request.requestId,
            payloadHash,
            expectedRevision: dispatching.revision,
          });
        } catch {
          // The provider call may already have been accepted. Never convert a
          // failed uncertainty write into a safe retry signal.
        }
        throw outboundError(
          "outbound_ambiguous",
          "conflict",
          "Channel provider outcome is ambiguous; reconcile before any resend",
        );
      }

      if (provider.status === "rejected") {
        const safeCode = bounded(provider.safeCode, "safeCode", 128);
        let failed: ChannelOutboundRecord;
        try {
          failed = normalizeRecord(
            await input.outbox.markFailed({
              requestId: request.requestId,
              payloadHash,
              expectedRevision: dispatching.revision,
              safeCode,
            }),
            request,
            payloadHash,
          );
        } catch {
          throw outboundError(
            "outbound_reconciliation_required",
            "conflict",
            "Channel rejection could not be durably recorded; reconcile before retry",
          );
        }
        if (failed.state !== "failed") {
          throw outboundError(
            "outbound_custody_conflict",
            "conflict",
            "Channel outbox failed to record provider rejection",
          );
        }
        throw outboundError(
          "outbound_failed",
          "conflict",
          "Channel provider rejected the send",
        );
      }

      const providerMessageId = bounded(
        provider.providerMessageId,
        "providerMessageId",
        512,
      );
      const acceptedAt = toInstant(provider.acceptedAt);
      let sent: ChannelOutboundRecord;
      try {
        sent = normalizeRecord(
          await input.outbox.markSent({
            requestId: request.requestId,
            payloadHash,
            expectedRevision: dispatching.revision,
            providerMessageId,
            acceptedAt,
          }),
          request,
          payloadHash,
        );
      } catch {
        throw outboundError(
          "outbound_reconciliation_required",
          "conflict",
          "Provider accepted the send but receipt persistence is uncertain; reconcile before resend",
        );
      }
      return sentReceipt(sent, false);
    },
  });
}

export async function resolveChannelOutboundAmbiguity(input: {
  readonly outbox: DurableChannelOutbox;
  readonly record: ChannelOutboundRecord;
  readonly resolution: "sent" | "not-sent";
  readonly evidenceRef: string;
  readonly providerMessageId?: string;
  readonly acceptedAt?: Instant;
}): Promise<ChannelOutboundRecord> {
  if (
    input.record.state !== "unknown" &&
    input.record.state !== "dispatching"
  ) {
    throw outboundError(
      "outbound_not_ambiguous",
      "conflict",
      "Channel outbound record is not awaiting reconciliation",
    );
  }
  const request = normalizeChannelOutboundRequest(input.record.request);
  const payloadHash = fingerprintChannelOutboundRequest(request);
  if (payloadHash !== input.record.payloadHash) {
    throw outboundError(
      "outbound_custody_conflict",
      "conflict",
      "Channel outbound payload hash does not match request",
    );
  }
  const evidenceRef = bounded(input.evidenceRef, "evidenceRef", 512);
  if (
    input.resolution === "sent" &&
    (!input.providerMessageId || !input.acceptedAt)
  ) {
    throw new TypeError(
      "Sent channel reconciliation requires provider receipt evidence",
    );
  }
  if (
    input.resolution === "not-sent" &&
    (input.providerMessageId !== undefined ||
      input.acceptedAt !== undefined)
  ) {
    throw new TypeError(
      "Not-sent channel reconciliation cannot claim provider receipt evidence",
    );
  }

  let resolved: ChannelOutboundRecord;
  try {
    resolved = normalizeRecord(
      await input.outbox.resolveAmbiguous({
        requestId: request.requestId,
        payloadHash,
        expectedRevision: input.record.revision,
        resolution: input.resolution,
        evidenceRef,
        providerMessageId:
          input.resolution === "sent"
            ? bounded(input.providerMessageId!, "providerMessageId", 512)
            : null,
        acceptedAt:
          input.resolution === "sent"
            ? toInstant(input.acceptedAt!)
            : null,
      }),
      request,
      payloadHash,
    );
  } catch (error) {
    if (error instanceof PlatformError) throw error;
    throw outboundError(
      "outbound_unavailable",
      "unavailable",
      "Channel outbound reconciliation is unavailable",
      true,
    );
  }
  const expectedState = input.resolution === "sent" ? "sent" : "failed";
  if (resolved.state !== expectedState) {
    throw outboundError(
      "outbound_custody_conflict",
      "conflict",
      "Channel outbox returned an invalid reconciliation state",
    );
  }
  return resolved;
}
