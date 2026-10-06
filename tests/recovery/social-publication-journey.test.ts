import { describe, expect, it } from "vitest";
import {
  archiveSocialContent,
  createSocialAccountBinding,
  createSocialContent,
  markSocialContentReady,
  revokeSocialAccountBinding,
} from "../../packages/social/src/social.js";
import {
  approveSocialPublication,
  assertSocialPublicationReceiptReplay,
  claimSocialPublicationDispatch,
  createSocialPublication,
  queueSocialPublication,
  reconcileUnknownSocialPublication,
  settleSocialPublicationDispatch,
} from "../../packages/social/src/publication.js";

const tenantId = "tenant_018f6b2e-7c00-7101-8000-000000000001" as never;
const characterId =
  "character_018f6b2e-7c00-7102-8000-000000000002" as never;
const linkedByUserId =
  "user_018f6b2e-7c00-7103-8000-000000000003" as never;
const socialContentId =
  "social-content_018f6b2e-7c00-7104-8000-000000000004" as never;
const publicationId =
  "publication_018f6b2e-7c00-7105-8000-000000000005" as never;
const approvalId =
  "approval_018f6b2e-7c00-7106-8000-000000000006" as never;

function activeBinding() {
  return createSocialAccountBinding({
    tenantId,
    characterId,
    linkedByUserId,
    account: {
      system: "instagram",
      namespace: "account",
      value: "acct-123",
      subjectKind: "user",
      authenticationStrength: "linked",
      observedAt: "2026-10-06T12:00:00.000Z" as never,
    },
    linkedAt: "2026-10-06T12:01:00.000Z" as never,
  });
}

function readyContent(binding = activeBinding()) {
  const draft = createSocialContent({
    binding,
    socialContentId,
    text: "Approved launch message",
    media: [],
    audience: "public",
    createdAt: "2026-10-06T12:02:00.000Z" as never,
  });
  return markSocialContentReady({
    content: draft,
    binding,
    expectedRevision: 1,
    readyAt: "2026-10-06T12:03:00.000Z",
  });
}

function approvedPublication() {
  const binding = activeBinding();
  const content = readyContent(binding);
  const pending = createSocialPublication({
    content,
    binding,
    publicationId,
    requiresApproval: true,
    createdAt: "2026-10-06T12:04:00.000Z" as never,
  });
  const approved = approveSocialPublication({
    publication: pending,
    expectedRevision: 1,
    approval: {
      approvalId,
      publicationId,
      socialContentId,
      socialContentRevision: content.revision,
      accountKey: content.accountKey,
      policyRevision: "social-publish-v3",
      decision: "allow",
      approvedAt: "2026-10-06T12:05:00.000Z" as never,
    },
  });
  return { binding, content, approved };
}

describe("Task 132 Social approval and publish journey", () => {
  it("requires ready content and the exact active account binding", () => {
    const binding = activeBinding();
    const draft = createSocialContent({
      binding,
      socialContentId,
      text: "Still draft",
      media: [],
      audience: "public",
      createdAt: "2026-10-06T12:02:00.000Z" as never,
    });

    expect(() =>
      createSocialPublication({
        content: draft,
        binding,
        publicationId,
        requiresApproval: true,
        createdAt: "2026-10-06T12:03:00.000Z" as never,
      }),
    ).toThrow("requires ready content");

    const content = readyContent(binding);
    const revoked = revokeSocialAccountBinding({
      binding,
      expectedRevision: 1,
      revokedAt: "2026-10-06T12:04:00.000Z",
    });
    expect(() =>
      createSocialPublication({
        content,
        binding: revoked,
        publicationId,
        requiresApproval: true,
        createdAt: "2026-10-06T12:05:00.000Z" as never,
      }),
    ).toThrow("scope mismatch");
  });

  it("binds canonical approval to exact publication/content revision/account", () => {
    const binding = activeBinding();
    const content = readyContent(binding);
    const pending = createSocialPublication({
      content,
      binding,
      publicationId,
      requiresApproval: true,
      createdAt: "2026-10-06T12:04:00.000Z" as never,
    });

    expect(pending.state).toBe("approval-required");

    expect(() =>
      approveSocialPublication({
        publication: pending,
        expectedRevision: 1,
        approval: {
          approvalId,
          publicationId,
          socialContentId,
          socialContentRevision: content.revision + 1,
          accountKey: content.accountKey,
          policyRevision: "social-publish-v3",
          decision: "allow",
          approvedAt: "2026-10-06T12:05:00.000Z" as never,
        },
      }),
    ).toThrow("approval binding mismatch");

    const approved = approveSocialPublication({
      publication: pending,
      expectedRevision: 1,
      approval: {
        approvalId,
        publicationId,
        socialContentId,
        socialContentRevision: content.revision,
        accountKey: content.accountKey,
        policyRevision: "social-publish-v3",
        decision: "allow",
        approvedAt: "2026-10-06T12:05:00.000Z" as never,
      },
    });

    expect(approved).toMatchObject({
      state: "approved",
      approvalId,
      socialContentRevision: content.revision,
      accountKey: content.accountKey,
      revision: 2,
      attempt: 0,
    });
  });

  it("queues and claims one exact outbox attempt with deterministic idempotency identity", () => {
    const { approved } = approvedPublication();
    const queued = queueSocialPublication({
      publication: approved,
      expectedRevision: approved.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7110-8000-000000000010" as never,
      queuedAt: "2026-10-06T12:06:00.000Z" as never,
    });

    expect(queued.publication).toMatchObject({
      state: "queued",
      attempt: 1,
    });
    expect(queued.outbox).toMatchObject({
      attempt: 1,
      state: "pending",
      idempotencyKey: `social-publication:${publicationId}:attempt:1`,
    });

    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: "2026-10-06T12:07:00.000Z" as never,
    });

    expect(claimed.publication.state).toBe("dispatching");
    expect(claimed.outbox.state).toBe("claimed");

    expect(() =>
      claimSocialPublicationDispatch({
        publication: queued.publication,
        outbox: queued.outbox,
        expectedRevision: queued.publication.revision,
        expectedAttempt: 2,
        claimedAt: "2026-10-06T12:07:00.000Z" as never,
      }),
    ).toThrow("stale or mismatched");
  });

  it("settles explicit provider success with bounded receipt evidence and idempotent replay", () => {
    const { approved } = approvedPublication();
    const queued = queueSocialPublication({
      publication: approved,
      expectedRevision: approved.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7111-8000-000000000011" as never,
      queuedAt: "2026-10-06T12:06:00.000Z" as never,
    });
    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: "2026-10-06T12:07:00.000Z" as never,
    });

    const settled = settleSocialPublicationDispatch({
      publication: claimed.publication,
      outbox: claimed.outbox,
      expectedRevision: claimed.publication.revision,
      result: {
        outcome: "published",
        receiptId:
          "external-receipt_018f6b2e-7c00-7112-8000-000000000012" as never,
        providerPublication: {
          system: "instagram",
          namespace: "post",
          value: "post-9981",
          observedAt: "2026-10-06T12:08:00.000Z" as never,
        },
        observedAt: "2026-10-06T12:08:00.000Z" as never,
      },
    });

    expect(settled.publication.state).toBe("published");
    expect(settled.receipt).toMatchObject({
      outcome: "published",
      publicationId,
      attempt: 1,
      reasonCode: null,
    });
    expect(
      assertSocialPublicationReceiptReplay({
        existing: settled.receipt,
        incoming: { ...settled.receipt },
      }),
    ).toBe(settled.receipt);

    expect(() =>
      assertSocialPublicationReceiptReplay({
        existing: settled.receipt,
        incoming: {
          ...settled.receipt,
          providerPublication: {
            ...settled.receipt.providerPublication!,
            value: "different-post",
          },
        },
      }),
    ).toThrow("changed evidence");
  });

  it("uses a new outbox attempt for explicit retryable rejection", () => {
    const { approved } = approvedPublication();
    const queued = queueSocialPublication({
      publication: approved,
      expectedRevision: approved.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7120-8000-000000000020" as never,
      queuedAt: "2026-10-06T12:06:00.000Z" as never,
    });
    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: "2026-10-06T12:07:00.000Z" as never,
    });
    const rejected = settleSocialPublicationDispatch({
      publication: claimed.publication,
      outbox: claimed.outbox,
      expectedRevision: claimed.publication.revision,
      result: {
        outcome: "rejected",
        receiptId:
          "external-receipt_018f6b2e-7c00-7121-8000-000000000021" as never,
        reasonCode: "provider-rate-limited-before-publish",
        retryable: true,
        observedAt: "2026-10-06T12:08:00.000Z" as never,
      },
    });

    expect(rejected.publication.state).toBe("retryable-failure");

    const retried = queueSocialPublication({
      publication: rejected.publication,
      expectedRevision: rejected.publication.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7122-8000-000000000022" as never,
      queuedAt: "2026-10-06T12:09:00.000Z" as never,
    });

    expect(retried.publication.attempt).toBe(2);
    expect(retried.outbox.idempotencyKey).toBe(
      `social-publication:${publicationId}:attempt:2`,
    );
    expect(retried.outbox.idempotencyKey).not.toBe(
      queued.outbox.idempotencyKey,
    );
  });

  it("freezes ambiguous provider outcome until reconciliation proves published or not-published", () => {
    const { approved } = approvedPublication();
    const queued = queueSocialPublication({
      publication: approved,
      expectedRevision: approved.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7130-8000-000000000030" as never,
      queuedAt: "2026-10-06T12:06:00.000Z" as never,
    });
    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: "2026-10-06T12:07:00.000Z" as never,
    });
    const unknown = settleSocialPublicationDispatch({
      publication: claimed.publication,
      outbox: claimed.outbox,
      expectedRevision: claimed.publication.revision,
      result: {
        outcome: "unknown",
        receiptId:
          "external-receipt_018f6b2e-7c00-7131-8000-000000000031" as never,
        reasonCode: "connection-lost-after-provider-send",
        observedAt: "2026-10-06T12:08:00.000Z" as never,
      },
    });

    expect(unknown.publication.state).toBe("unknown");
    expect(() =>
      queueSocialPublication({
        publication: unknown.publication,
        expectedRevision: unknown.publication.revision,
        outboxEventId:
          "outbox-event_018f6b2e-7c00-7132-8000-000000000032" as never,
        queuedAt: "2026-10-06T12:09:00.000Z" as never,
      }),
    ).toThrow("not retryable/approved");

    const confirmedMissing = reconcileUnknownSocialPublication({
      publication: unknown.publication,
      expectedRevision: unknown.publication.revision,
      receiptId:
        "external-receipt_018f6b2e-7c00-7133-8000-000000000033" as never,
      resolution: {
        outcome: "not-published",
        reasonCode: "provider-query-confirmed-absent",
      },
      observedAt: "2026-10-06T12:10:00.000Z" as never,
    });

    expect(confirmedMissing.publication.state).toBe("retryable-failure");

    const retry = queueSocialPublication({
      publication: confirmedMissing.publication,
      expectedRevision: confirmedMissing.publication.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7134-8000-000000000034" as never,
      queuedAt: "2026-10-06T12:11:00.000Z" as never,
    });
    expect(retry.publication.attempt).toBe(2);
  });

  it("can reconcile an unknown outcome directly to published without another dispatch", () => {
    const { approved } = approvedPublication();
    const queued = queueSocialPublication({
      publication: approved,
      expectedRevision: approved.revision,
      outboxEventId:
        "outbox-event_018f6b2e-7c00-7140-8000-000000000040" as never,
      queuedAt: "2026-10-06T12:06:00.000Z" as never,
    });
    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: "2026-10-06T12:07:00.000Z" as never,
    });
    const unknown = settleSocialPublicationDispatch({
      publication: claimed.publication,
      outbox: claimed.outbox,
      expectedRevision: claimed.publication.revision,
      result: {
        outcome: "unknown",
        receiptId:
          "external-receipt_018f6b2e-7c00-7141-8000-000000000041" as never,
        reasonCode: "provider-timeout",
        observedAt: "2026-10-06T12:08:00.000Z" as never,
      },
    });

    const reconciled = reconcileUnknownSocialPublication({
      publication: unknown.publication,
      expectedRevision: unknown.publication.revision,
      receiptId:
        "external-receipt_018f6b2e-7c00-7142-8000-000000000042" as never,
      resolution: {
        outcome: "published",
        providerPublication: {
          system: "instagram",
          namespace: "post",
          value: "post-found-by-query",
          observedAt: "2026-10-06T12:10:00.000Z" as never,
        },
      },
      observedAt: "2026-10-06T12:10:00.000Z" as never,
    });

    expect(reconciled.publication.state).toBe("published");
    expect(reconciled.publication.attempt).toBe(1);
    expect(reconciled.receipt.outcome).toBe("published");
  });

  it("keeps Task 131 archive separate from publication execution state", () => {
    const binding = activeBinding();
    const content = readyContent(binding);
    const archived = archiveSocialContent({
      content,
      expectedRevision: content.revision,
      archivedAt: "2026-10-06T12:04:00.000Z",
    });
    expect(archived.state).toBe("archived");

    expect(() =>
      createSocialPublication({
        content: archived,
        binding,
        publicationId,
        requiresApproval: false,
        createdAt: "2026-10-06T12:05:00.000Z" as never,
      }),
    ).toThrow("requires ready content");
  });
});
