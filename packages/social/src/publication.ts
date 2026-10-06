import {
  isCanonicalId,
  toInstant,
  type ApprovalId,
  type ExternalReceiptId,
  type ExternalReference,
  type Instant,
  type OutboxEventId,
  type PublicationId,
} from "@masanawa/contracts";
import type {
  SocialAccountBinding,
  SocialContent,
} from "./model.js";

export type SocialPublicationState =
  | "approval-required"
  | "approved"
  | "queued"
  | "dispatching"
  | "published"
  | "retryable-failure"
  | "failed"
  | "unknown"
  | "cancelled";

export interface SocialPublication {
  readonly tenantId: SocialContent["tenantId"];
  readonly publicationId: PublicationId;
  readonly socialContentId: SocialContent["socialContentId"];
  readonly socialContentRevision: number;
  readonly characterId: SocialContent["characterId"];
  readonly accountKey: string;
  readonly audience: SocialContent["audience"];
  readonly state: SocialPublicationState;
  readonly revision: number;
  readonly approvalId: ApprovalId | null;
  readonly attempt: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface VerifiedSocialPublicationApproval {
  readonly approvalId: ApprovalId;
  readonly publicationId: PublicationId;
  readonly socialContentId: SocialContent["socialContentId"];
  readonly socialContentRevision: number;
  readonly accountKey: string;
  readonly policyRevision: string;
  readonly decision: "allow";
  readonly approvedAt: Instant;
}

export interface SocialPublicationOutboxItem {
  readonly outboxEventId: OutboxEventId;
  readonly publicationId: PublicationId;
  readonly socialContentId: SocialContent["socialContentId"];
  readonly socialContentRevision: number;
  readonly accountKey: string;
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly state: "pending" | "claimed";
  readonly queuedAt: Instant;
  readonly claimedAt: Instant | null;
}

export type SocialProviderDispatchResult =
  | {
      readonly outcome: "published";
      readonly receiptId: ExternalReceiptId;
      readonly providerPublication: ExternalReference;
      readonly observedAt: Instant;
    }
  | {
      readonly outcome: "rejected";
      readonly receiptId: ExternalReceiptId;
      readonly reasonCode: string;
      readonly retryable: boolean;
      readonly observedAt: Instant;
    }
  | {
      readonly outcome: "unknown";
      readonly receiptId: ExternalReceiptId;
      readonly reasonCode: string;
      readonly observedAt: Instant;
    };

export interface SocialPublicationReceipt {
  readonly receiptId: ExternalReceiptId;
  readonly publicationId: PublicationId;
  readonly attempt: number;
  readonly outcome: "published" | "rejected" | "unknown" | "not-published";
  readonly providerPublication: ExternalReference | null;
  readonly reasonCode: string | null;
  readonly observedAt: Instant;
}

function bounded(
  value: string,
  name: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (
    normalized.length < min ||
    normalized.length > max ||
    /[\0\r\n]/u.test(normalized)
  ) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function nonNegative(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} is invalid`);
  }
  return value;
}

function externalReference(input: ExternalReference): ExternalReference {
  const observedAt = toInstant(input.observedAt);
  const expiresAt =
    input.expiresAt === undefined ? undefined : toInstant(input.expiresAt);
  if (expiresAt !== undefined && expiresAt <= observedAt) {
    throw new Error("provider publication reference expiry must follow observation");
  }
  return Object.freeze({
    system: bounded(input.system, "provider publication system", 1, 100).toLowerCase(),
    namespace: bounded(
      input.namespace,
      "provider publication namespace",
      1,
      160,
    ),
    value: bounded(input.value, "provider publication value", 1, 1024),
    observedAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    ...(input.provenance === undefined
      ? {}
      : {
          provenance: Object.freeze(
            Object.fromEntries(
              Object.entries(input.provenance).map(([key, value]) => [
                bounded(key, "provider provenance key", 1, 100),
                bounded(value, "provider provenance value", 1, 500),
              ]),
            ),
          ),
        }),
  });
}

function assertBinding(
  content: SocialContent,
  binding: SocialAccountBinding,
): void {
  if (
    binding.state !== "active" ||
    binding.tenantId !== content.tenantId ||
    binding.characterId !== content.characterId ||
    binding.accountKey !== content.accountKey
  ) {
    throw new Error("social publication content/account binding scope mismatch");
  }
}

function publicationId(value: PublicationId): PublicationId {
  if (!isCanonicalId("publication", value)) {
    throw new TypeError("publicationId is invalid");
  }
  return value;
}

function outboxEventId(value: OutboxEventId): OutboxEventId {
  if (!isCanonicalId("outbox-event", value)) {
    throw new TypeError("outboxEventId is invalid");
  }
  return value;
}

function receiptId(value: ExternalReceiptId): ExternalReceiptId {
  if (!isCanonicalId("external-receipt", value)) {
    throw new TypeError("receiptId is invalid");
  }
  return value;
}

function approvalId(value: ApprovalId): ApprovalId {
  if (!isCanonicalId("approval", value)) {
    throw new TypeError("approvalId is invalid");
  }
  return value;
}

function sameReceipt(
  left: SocialPublicationReceipt,
  right: SocialPublicationReceipt,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createSocialPublication(input: {
  readonly content: SocialContent;
  readonly binding: SocialAccountBinding;
  readonly publicationId: PublicationId;
  readonly requiresApproval: boolean;
  readonly createdAt: Instant;
}): SocialPublication {
  assertBinding(input.content, input.binding);
  if (input.content.state !== "ready") {
    throw new Error("social publication requires ready content");
  }
  const createdAt = toInstant(input.createdAt);
  if (createdAt < input.content.updatedAt) {
    throw new Error("publication cannot predate content readiness");
  }
  return Object.freeze({
    tenantId: input.content.tenantId,
    publicationId: publicationId(input.publicationId),
    socialContentId: input.content.socialContentId,
    socialContentRevision: positive(input.content.revision, "content revision"),
    characterId: input.content.characterId,
    accountKey: input.content.accountKey,
    audience: input.content.audience,
    state: input.requiresApproval ? "approval-required" : "approved",
    revision: 1,
    approvalId: null,
    attempt: 0,
    createdAt,
    updatedAt: createdAt,
  });
}

export function approveSocialPublication(input: {
  readonly publication: SocialPublication;
  readonly expectedRevision: number;
  readonly approval: VerifiedSocialPublicationApproval;
}): SocialPublication {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (input.publication.state !== "approval-required") {
    throw new Error("social publication is not awaiting approval");
  }
  const approval = input.approval;
  if (
    approval.decision !== "allow" ||
    approval.publicationId !== input.publication.publicationId ||
    approval.socialContentId !== input.publication.socialContentId ||
    approval.socialContentRevision !== input.publication.socialContentRevision ||
    approval.accountKey !== input.publication.accountKey
  ) {
    throw new Error("social publication approval binding mismatch");
  }
  const approvedAt = toInstant(approval.approvedAt);
  if (approvedAt < input.publication.updatedAt) {
    throw new Error("social publication approval predates request");
  }
  bounded(approval.policyRevision, "approval policyRevision", 1, 160);
  return Object.freeze({
    ...input.publication,
    state: "approved" as const,
    revision: input.publication.revision + 1,
    approvalId: approvalId(approval.approvalId),
    updatedAt: approvedAt,
  });
}

export function queueSocialPublication(input: {
  readonly publication: SocialPublication;
  readonly expectedRevision: number;
  readonly outboxEventId: OutboxEventId;
  readonly queuedAt: Instant;
}): {
  readonly publication: SocialPublication;
  readonly outbox: SocialPublicationOutboxItem;
} {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (
    input.publication.state !== "approved" &&
    input.publication.state !== "retryable-failure"
  ) {
    throw new Error("social publication is not retryable/approved for queueing");
  }
  const queuedAt = toInstant(input.queuedAt);
  if (queuedAt < input.publication.updatedAt) {
    throw new Error("social publication queue time cannot move backwards");
  }
  const attempt = input.publication.attempt + 1;
  const outbox: SocialPublicationOutboxItem = Object.freeze({
    outboxEventId: outboxEventId(input.outboxEventId),
    publicationId: input.publication.publicationId,
    socialContentId: input.publication.socialContentId,
    socialContentRevision: input.publication.socialContentRevision,
    accountKey: input.publication.accountKey,
    attempt,
    idempotencyKey: `social-publication:${input.publication.publicationId}:attempt:${attempt}`,
    state: "pending",
    queuedAt,
    claimedAt: null,
  });
  return Object.freeze({
    publication: Object.freeze({
      ...input.publication,
      state: "queued" as const,
      revision: input.publication.revision + 1,
      attempt,
      updatedAt: queuedAt,
    }),
    outbox,
  });
}

export function claimSocialPublicationDispatch(input: {
  readonly publication: SocialPublication;
  readonly outbox: SocialPublicationOutboxItem;
  readonly expectedRevision: number;
  readonly expectedAttempt: number;
  readonly claimedAt: Instant;
}): {
  readonly publication: SocialPublication;
  readonly outbox: SocialPublicationOutboxItem;
} {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (
    input.publication.state !== "queued" ||
    input.outbox.state !== "pending" ||
    input.outbox.publicationId !== input.publication.publicationId ||
    input.outbox.attempt !== input.publication.attempt ||
    positive(input.expectedAttempt, "expectedAttempt") !== input.publication.attempt
  ) {
    throw new Error("social publication outbox claim is stale or mismatched");
  }
  const claimedAt = toInstant(input.claimedAt);
  if (claimedAt < input.publication.updatedAt || claimedAt < input.outbox.queuedAt) {
    throw new Error("social publication claim time cannot move backwards");
  }
  return Object.freeze({
    publication: Object.freeze({
      ...input.publication,
      state: "dispatching" as const,
      revision: input.publication.revision + 1,
      updatedAt: claimedAt,
    }),
    outbox: Object.freeze({
      ...input.outbox,
      state: "claimed" as const,
      claimedAt,
    }),
  });
}

export function settleSocialPublicationDispatch(input: {
  readonly publication: SocialPublication;
  readonly outbox: SocialPublicationOutboxItem;
  readonly expectedRevision: number;
  readonly result: SocialProviderDispatchResult;
}): {
  readonly publication: SocialPublication;
  readonly receipt: SocialPublicationReceipt;
} {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (
    input.publication.state !== "dispatching" ||
    input.outbox.state !== "claimed" ||
    input.outbox.publicationId !== input.publication.publicationId ||
    input.outbox.attempt !== input.publication.attempt
  ) {
    throw new Error("social publication dispatch settlement is stale or mismatched");
  }

  const observedAt = toInstant(input.result.observedAt);
  if (
    observedAt < input.publication.updatedAt ||
    (input.outbox.claimedAt !== null && observedAt < input.outbox.claimedAt)
  ) {
    throw new Error("social publication receipt predates dispatch");
  }

  let state: SocialPublicationState;
  let receipt: SocialPublicationReceipt;
  if (input.result.outcome === "published") {
    state = "published";
    receipt = Object.freeze({
      receiptId: receiptId(input.result.receiptId),
      publicationId: input.publication.publicationId,
      attempt: input.publication.attempt,
      outcome: "published",
      providerPublication: externalReference(input.result.providerPublication),
      reasonCode: null,
      observedAt,
    });
  } else if (input.result.outcome === "rejected") {
    const reasonCode = bounded(input.result.reasonCode, "reasonCode", 1, 160);
    state = input.result.retryable ? "retryable-failure" : "failed";
    receipt = Object.freeze({
      receiptId: receiptId(input.result.receiptId),
      publicationId: input.publication.publicationId,
      attempt: input.publication.attempt,
      outcome: "rejected",
      providerPublication: null,
      reasonCode,
      observedAt,
    });
  } else {
    state = "unknown";
    receipt = Object.freeze({
      receiptId: receiptId(input.result.receiptId),
      publicationId: input.publication.publicationId,
      attempt: input.publication.attempt,
      outcome: "unknown",
      providerPublication: null,
      reasonCode: bounded(input.result.reasonCode, "reasonCode", 1, 160),
      observedAt,
    });
  }

  return Object.freeze({
    publication: Object.freeze({
      ...input.publication,
      state,
      revision: input.publication.revision + 1,
      updatedAt: observedAt,
    }),
    receipt,
  });
}

export function reconcileUnknownSocialPublication(input: {
  readonly publication: SocialPublication;
  readonly expectedRevision: number;
  readonly receiptId: ExternalReceiptId;
  readonly resolution:
    | {
        readonly outcome: "published";
        readonly providerPublication: ExternalReference;
      }
    | {
        readonly outcome: "not-published";
        readonly reasonCode: string;
      };
  readonly observedAt: Instant;
}): {
  readonly publication: SocialPublication;
  readonly receipt: SocialPublicationReceipt;
} {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (input.publication.state !== "unknown") {
    throw new Error("only unknown social publication may be reconciled");
  }
  const observedAt = toInstant(input.observedAt);
  if (observedAt < input.publication.updatedAt) {
    throw new Error("social publication reconciliation cannot move time backwards");
  }

  if (input.resolution.outcome === "published") {
    const receipt: SocialPublicationReceipt = Object.freeze({
      receiptId: receiptId(input.receiptId),
      publicationId: input.publication.publicationId,
      attempt: input.publication.attempt,
      outcome: "published",
      providerPublication: externalReference(
        input.resolution.providerPublication,
      ),
      reasonCode: null,
      observedAt,
    });
    return Object.freeze({
      publication: Object.freeze({
        ...input.publication,
        state: "published" as const,
        revision: input.publication.revision + 1,
        updatedAt: observedAt,
      }),
      receipt,
    });
  }

  const receipt: SocialPublicationReceipt = Object.freeze({
    receiptId: receiptId(input.receiptId),
    publicationId: input.publication.publicationId,
    attempt: input.publication.attempt,
    outcome: "not-published",
    providerPublication: null,
    reasonCode: bounded(input.resolution.reasonCode, "reasonCode", 1, 160),
    observedAt,
  });
  return Object.freeze({
    publication: Object.freeze({
      ...input.publication,
      state: "retryable-failure" as const,
      revision: input.publication.revision + 1,
      updatedAt: observedAt,
    }),
    receipt,
  });
}

export function assertSocialPublicationReceiptReplay(input: {
  readonly existing: SocialPublicationReceipt;
  readonly incoming: SocialPublicationReceipt;
}): SocialPublicationReceipt {
  receiptId(input.existing.receiptId);
  receiptId(input.incoming.receiptId);
  if (
    input.existing.receiptId !== input.incoming.receiptId ||
    !sameReceipt(input.existing, input.incoming)
  ) {
    throw new Error("social publication receipt replay changed evidence");
  }
  return input.existing;
}

export function cancelSocialPublication(input: {
  readonly publication: SocialPublication;
  readonly expectedRevision: number;
  readonly cancelledAt: Instant;
}): SocialPublication {
  if (positive(input.expectedRevision, "expectedRevision") !== input.publication.revision) {
    throw new Error("social publication revision is stale");
  }
  if (
    input.publication.state === "dispatching" ||
    input.publication.state === "unknown" ||
    input.publication.state === "published" ||
    input.publication.state === "cancelled"
  ) {
    throw new Error("social publication cannot be cancelled in current state");
  }
  const cancelledAt = toInstant(input.cancelledAt);
  if (cancelledAt < input.publication.updatedAt) {
    throw new Error("social publication cancellation cannot move time backwards");
  }
  return Object.freeze({
    ...input.publication,
    state: "cancelled" as const,
    revision: input.publication.revision + 1,
    updatedAt: cancelledAt,
  });
}

export function publicationAttempt(value: number): number {
  return nonNegative(value, "publication attempt");
}
