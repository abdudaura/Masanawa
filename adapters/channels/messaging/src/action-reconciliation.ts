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
  MessagingChannel,
} from "./model.js";

export interface ChannelActionSubjectScope {
  readonly system: string;
  readonly namespace: string;
  readonly value: string;
  readonly subjectKind: "user" | "group" | "channel" | "service" | "device" | "unknown";
}

export interface ChannelActionConversationScope {
  readonly system: string;
  readonly namespace: string;
  readonly value: string;
  readonly conversationKind: "direct" | "group" | "channel" | "thread" | "topic";
}

export interface ChannelActionBinding {
  readonly schemaVersion: 1;
  readonly bindingKey: string;
  readonly channel: MessagingChannel;
  readonly accountId: ChannelAccountId;
  readonly selectionId: string;
  readonly actionKey: string;
  readonly requestId: RequestId;
  readonly revision: number;
  readonly expiresAt: Instant;
  readonly subject: ChannelActionSubjectScope;
  readonly conversation: ChannelActionConversationScope;
}

export interface ChannelActionObservation {
  readonly bindingKey: string;
  readonly bindingRevision: number;
  readonly ingressDedupeKey: string;
  readonly ingressEvidenceHash: string;
  readonly observedAt: Instant;
}

export interface DurableChannelActionStore {
  load(input: {
    readonly channel: MessagingChannel;
    readonly accountId: ChannelAccountId;
    readonly selectionId: string;
  }): Promise<ChannelActionBinding | null>;

  /**
   * Durably bind this exact ingress event to the still-current action binding.
   *
   * Implementations must compare bindingKey + bindingRevision with current
   * server action state in the same transaction:
   * - first exact observation -> stored
   * - exact ingress replay -> duplicate
   * - stale/changed binding -> conflict
   */
  admitObservation(input: ChannelActionObservation): Promise<{
    readonly outcome: "stored" | "duplicate";
    readonly binding: ChannelActionBinding;
  }>;
}

export interface ResolvedChannelAction {
  readonly actionKey: string;
  readonly requestId: RequestId;
  readonly revision: number;
  readonly bindingKey: string;
  readonly selectionId: string;
  readonly ingressDedupeKey: string;
  readonly callbackQueryId: string | null;
  readonly replay: boolean;
}

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
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

function actionError(
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

function normalizeScopeText(value: string, name: string): string {
  return bounded(value, name, 512);
}

export function normalizeChannelActionBinding(
  input: ChannelActionBinding,
): ChannelActionBinding {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Channel action binding is invalid");
  }
  if (input.schemaVersion !== 1) {
    throw new TypeError("Channel action binding schema is invalid");
  }
  if (input.channel !== "whatsapp" && input.channel !== "telegram") {
    throw new TypeError("Channel action binding channel is invalid");
  }
  const accountId = parseCanonicalId("channel-account", input.accountId);
  const requestId = parseCanonicalId("request", input.requestId);
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    input.revision > 1_000_000_000
  ) {
    throw new TypeError("Channel action binding revision is invalid");
  }

  const subjectKind = input.subject.subjectKind;
  if (
    !(
      ["user", "group", "channel", "service", "device", "unknown"] as const
    ).includes(subjectKind)
  ) {
    throw new TypeError("Channel action subject kind is invalid");
  }
  const conversationKind = input.conversation.conversationKind;
  if (
    !(
      ["direct", "group", "channel", "thread", "topic"] as const
    ).includes(conversationKind)
  ) {
    throw new TypeError("Channel action conversation kind is invalid");
  }

  return Object.freeze({
    schemaVersion: 1,
    bindingKey: bounded(input.bindingKey, "bindingKey", 256),
    channel: input.channel,
    accountId,
    selectionId: bounded(input.selectionId, "selectionId", 256),
    actionKey: bounded(input.actionKey, "actionKey", 512),
    requestId,
    revision: input.revision,
    expiresAt: toInstant(input.expiresAt),
    subject: Object.freeze({
      system: normalizeScopeText(input.subject.system, "subject.system"),
      namespace: normalizeScopeText(
        input.subject.namespace,
        "subject.namespace",
      ),
      value: normalizeScopeText(input.subject.value, "subject.value"),
      subjectKind,
    }),
    conversation: Object.freeze({
      system: normalizeScopeText(
        input.conversation.system,
        "conversation.system",
      ),
      namespace: normalizeScopeText(
        input.conversation.namespace,
        "conversation.namespace",
      ),
      value: normalizeScopeText(
        input.conversation.value,
        "conversation.value",
      ),
      conversationKind,
    }),
  });
}

function sameBinding(
  left: ChannelActionBinding,
  right: ChannelActionBinding,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.bindingKey === right.bindingKey &&
    left.channel === right.channel &&
    left.accountId === right.accountId &&
    left.selectionId === right.selectionId &&
    left.actionKey === right.actionKey &&
    left.requestId === right.requestId &&
    left.revision === right.revision &&
    left.expiresAt === right.expiresAt &&
    left.subject.system === right.subject.system &&
    left.subject.namespace === right.subject.namespace &&
    left.subject.value === right.subject.value &&
    left.subject.subjectKind === right.subject.subjectKind &&
    left.conversation.system === right.conversation.system &&
    left.conversation.namespace === right.conversation.namespace &&
    left.conversation.value === right.conversation.value &&
    left.conversation.conversationKind === right.conversation.conversationKind
  );
}

function exactTransportScope(
  record: ChannelIngressRecord,
  binding: ChannelActionBinding,
): boolean {
  if (record.event.kind !== "message") return false;
  const event = record.event;
  return (
    record.channel === binding.channel &&
    record.accountId === binding.accountId &&
    event.subject.system === binding.subject.system &&
    event.subject.namespace === binding.subject.namespace &&
    event.subject.value === binding.subject.value &&
    event.subject.subjectKind === binding.subject.subjectKind &&
    event.conversation.system === binding.conversation.system &&
    event.conversation.namespace === binding.conversation.namespace &&
    event.conversation.value === binding.conversation.value &&
    event.conversation.conversationKind ===
      binding.conversation.conversationKind
  );
}

export function createChannelActionReconciler(input: {
  readonly store: DurableChannelActionStore;
}) {
  return Object.freeze({
    async resolve(record: ChannelIngressRecord): Promise<ResolvedChannelAction> {
      if (
        record.event.kind !== "message" ||
        record.event.content.kind !== "selection"
      ) {
        throw actionError(
          "action_not_selection",
          "validation",
          "Channel event is not an actionable selection",
        );
      }

      const selectionId = bounded(
        record.event.content.selectionId,
        "selectionId",
        256,
      );

      let loadedRaw: ChannelActionBinding | null;
      try {
        loadedRaw = await input.store.load({
          channel: record.channel,
          accountId: record.accountId,
          selectionId,
        });
      } catch {
        throw actionError(
          "action_reconciliation_unavailable",
          "unavailable",
          "Channel action reconciliation is unavailable",
          true,
        );
      }
      if (loadedRaw === null) {
        throw actionError(
          "action_not_found",
          "not-found",
          "Channel action is unavailable or no longer current",
        );
      }

      let loaded: ChannelActionBinding;
      try {
        loaded = normalizeChannelActionBinding(loadedRaw);
      } catch {
        throw actionError(
          "action_reconciliation_unavailable",
          "unavailable",
          "Channel action reconciliation is unavailable",
          true,
        );
      }

      if (
        loaded.selectionId !== selectionId ||
        !exactTransportScope(record, loaded)
      ) {
        throw actionError(
          "action_scope_mismatch",
          "authorization",
          "Channel selection does not match its server action scope",
        );
      }
      if (
        Date.parse(record.receivedAt) >
        Date.parse(loaded.expiresAt)
      ) {
        throw actionError(
          "action_expired",
          "conflict",
          "Channel action has expired",
        );
      }

      let admitted;
      try {
        admitted = await input.store.admitObservation({
          bindingKey: loaded.bindingKey,
          bindingRevision: loaded.revision,
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
          observedAt: toInstant(record.receivedAt),
        });
      } catch {
        throw actionError(
          "action_reconciliation_unavailable",
          "unavailable",
          "Channel action reconciliation is unavailable",
          true,
        );
      }

      if (
        admitted?.outcome !== "stored" &&
        admitted?.outcome !== "duplicate"
      ) {
        throw actionError(
          "action_reconciliation_unavailable",
          "unavailable",
          "Channel action reconciliation is unavailable",
          true,
        );
      }

      let current: ChannelActionBinding;
      try {
        current = normalizeChannelActionBinding(admitted.binding);
      } catch {
        throw actionError(
          "action_reconciliation_unavailable",
          "unavailable",
          "Channel action reconciliation is unavailable",
          true,
        );
      }
      if (!sameBinding(current, loaded)) {
        throw actionError(
          "action_binding_changed",
          "conflict",
          "Channel action changed while the callback was being reconciled",
        );
      }

      return Object.freeze({
        actionKey: current.actionKey,
        requestId: current.requestId,
        revision: current.revision,
        bindingKey: current.bindingKey,
        selectionId: current.selectionId,
        ingressDedupeKey: record.dedupeKey,
        callbackQueryId: record.event.callbackQueryId ?? null,
        replay: admitted.outcome === "duplicate",
      });
    },
  });
}
