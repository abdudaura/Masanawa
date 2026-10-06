import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  type Instant,
} from "@masanawa/contracts";
import type {
  CommerceFulfillmentCompletion,
  OfferRevision,
} from "../../packages/commerce/src/model.js";
import {
  createDeterministicCommerceQuote,
  planDeterministicCommerceAdmission,
  planDeterministicCommerceSettlement,
} from "../../packages/commerce/src/journey.js";
import {
  normalizeCommerceReconciliationReceipt,
  planCommerceLedgerReversals,
} from "../../packages/commerce/src/reconciliation.js";
import {
  createSocialAccountBinding,
  createSocialContent,
  markSocialContentReady,
} from "../../packages/social/src/social.js";
import {
  approveSocialPublication,
  claimSocialPublicationDispatch,
  createSocialPublication,
  queueSocialPublication,
  settleSocialPublicationDispatch,
} from "../../packages/social/src/publication.js";
import {
  beginStudioStageDispatch,
  completeStudioStage,
  createStudioProductionPlan,
  finalStudioVideo,
  type StudioProductionPlan,
} from "../../packages/studio/src/production-workflow.js";
import {
  studioArtifactProvenanceHash,
} from "../../packages/studio/src/provenance.js";
import type {
  StudioArtifactRevision,
} from "../../packages/studio/src/model.js";
import {
  assertCharacterSurfaceConsistency,
  assertCommerceExecutorCannotSubstituteOrigin,
} from "../../packages/identity/src/character-surface-consistency.js";

const at = (value: string) => value as Instant;

function ids() {
  return {
    tenantId: createCanonicalId("tenant"),
    ownerUserId: createCanonicalId("user"),
    customerUserId: createCanonicalId("user"),
    presentationCharacterId: createCanonicalId("character"),
    executorCharacterId: createCanonicalId("character"),
    socialContentId: createCanonicalId("social-content"),
    publicationId: createCanonicalId("publication"),
    approvalId: createCanonicalId("approval"),
    outboxEventId: createCanonicalId("outbox-event"),
    socialReceiptId: createCanonicalId("external-receipt"),
    offerId: createCanonicalId("offer"),
    skillVersionId: createCanonicalId("skill-version"),
    quoteId: createCanonicalId("quote"),
    fulfillmentId: createCanonicalId("fulfillment"),
    customerPaymentLedgerEntryId: createCanonicalId("ledger-entry"),
    creatorEarningLedgerEntryId: createCanonicalId("ledger-entry"),
    platformMarginLedgerEntryId: createCanonicalId("ledger-entry"),
    refundLedgerEntryId: createCanonicalId("ledger-entry"),
    reconciliationCaseId: createCanonicalId("reconciliation-case"),
    reconciliationReceiptId: createCanonicalId("external-receipt"),
    mediaProjectId: createCanonicalId("media-project"),
  };
}

function offer(
  x: ReturnType<typeof ids>,
  overrides: Partial<OfferRevision> = {},
): OfferRevision {
  return {
    schemaVersion: 1,
    tenantId: x.tenantId,
    offerId: x.offerId,
    revision: 1,
    key: "studio.social.launch",
    title: "Launch media package",
    description: "A bounded launch package",
    skillVersionId: x.skillVersionId,
    priceCredits: 1_000,
    fulfillmentReserveCredits: 600,
    creatorCommissionCredits: 200,
    fallbackCommissionCredits: 75,
    platformMarginCredits: 200,
    active: true,
    regions: ["NG"],
    createdAt: at("2026-10-06T12:00:00.000Z"),
    ...overrides,
  };
}

let artifactSequence = 1;
function artifact(input: {
  tenantId: ReturnType<typeof ids>["tenantId"];
  mediaProjectId: ReturnType<typeof ids>["mediaProjectId"];
  characterId: ReturnType<typeof ids>["presentationCharacterId"];
  kind: StudioArtifactRevision["kind"];
  parents?: StudioArtifactRevision["parents"];
}): StudioArtifactRevision {
  const mediaArtifactId = createCanonicalId("media-artifact");
  const revision = 1;
  const contentHash = "a".repeat(64);
  const sources = [{
    sourceType: "user-input" as const,
    reference: `fixture:task138:${artifactSequence++}`,
    contentHash: "b".repeat(64),
    operationId: null,
  }];
  const parents = input.parents ?? [];
  const mediaType =
    input.kind === "audio"
      ? "audio/wav"
      : input.kind === "video"
        ? "video/mp4"
        : "application/json";
  const provenanceHash = studioArtifactProvenanceHash({
    tenantId: input.tenantId,
    mediaProjectId: input.mediaProjectId,
    characterId: input.characterId,
    mediaArtifactId,
    revision,
    kind: input.kind,
    mediaType,
    contentHash,
    parents,
    sources,
  });
  return {
    schemaVersion: 1,
    tenantId: input.tenantId,
    mediaProjectId: input.mediaProjectId,
    characterId: input.characterId,
    mediaArtifactId,
    revision,
    kind: input.kind,
    mediaType,
    contentRef: `artifact://${mediaArtifactId}`,
    contentHash,
    parents,
    sources,
    provenanceHash,
    createdAt: at("2026-10-06T12:00:00.000Z"),
  };
}

function stage(plan: StudioProductionPlan, kind: string) {
  return plan.stages.find((candidate) => candidate.kind === kind)!;
}

describe("Production Task 138 social + commerce + studio golden journey", () => {
  it("keeps one presentation Character across published social, commerce origin and final studio media", () => {
    const x = ids();

    const socialBinding = createSocialAccountBinding({
      tenantId: x.tenantId,
      characterId: x.presentationCharacterId,
      linkedByUserId: x.ownerUserId,
      account: {
        system: "instagram",
        namespace: "account",
        value: "task138-account",
        subjectKind: "user",
        authenticationStrength: "strong",
        observedAt: at("2026-10-06T12:00:00.000Z"),
      },
      linkedAt: at("2026-10-06T12:01:00.000Z"),
    });
    const socialDraft = createSocialContent({
      binding: socialBinding,
      socialContentId: x.socialContentId,
      text: "Launch post generated from the approved Studio artifact.",
      media: [],
      audience: "public",
      createdAt: at("2026-10-06T12:02:00.000Z"),
    });
    const socialReady = markSocialContentReady({
      content: socialDraft,
      binding: socialBinding,
      expectedRevision: socialDraft.revision,
      readyAt: "2026-10-06T12:03:00.000Z",
    });
    const publicationPending = createSocialPublication({
      content: socialReady,
      binding: socialBinding,
      publicationId: x.publicationId,
      requiresApproval: true,
      createdAt: at("2026-10-06T12:04:00.000Z"),
    });
    const publicationApproved = approveSocialPublication({
      publication: publicationPending,
      expectedRevision: publicationPending.revision,
      approval: {
        approvalId: x.approvalId,
        publicationId: x.publicationId,
        socialContentId: x.socialContentId,
        socialContentRevision: socialReady.revision,
        accountKey: socialReady.accountKey,
        policyRevision: "task138-social-policy-v1",
        decision: "allow",
        approvedAt: at("2026-10-06T12:05:00.000Z"),
      },
    });
    const queued = queueSocialPublication({
      publication: publicationApproved,
      expectedRevision: publicationApproved.revision,
      outboxEventId: x.outboxEventId,
      queuedAt: at("2026-10-06T12:06:00.000Z"),
    });
    const claimed = claimSocialPublicationDispatch({
      publication: queued.publication,
      outbox: queued.outbox,
      expectedRevision: queued.publication.revision,
      expectedAttempt: 1,
      claimedAt: at("2026-10-06T12:07:00.000Z"),
    });
    const published = settleSocialPublicationDispatch({
      publication: claimed.publication,
      outbox: claimed.outbox,
      expectedRevision: claimed.publication.revision,
      result: {
        outcome: "published",
        receiptId: x.socialReceiptId,
        providerPublication: {
          system: "instagram",
          namespace: "post",
          value: "task138-post-1",
          observedAt: at("2026-10-06T12:08:00.000Z"),
        },
        observedAt: at("2026-10-06T12:08:00.000Z"),
      },
    });

    expect(published.publication).toMatchObject({
      state: "published",
      characterId: x.presentationCharacterId,
    });

    const commerceQuote = createDeterministicCommerceQuote({
      offer: offer(x),
      quoteId: x.quoteId,
      customerUserId: x.customerUserId,
      originatingCharacterId: x.presentationCharacterId,
      creatorUserId: x.ownerUserId,
      createdAt: at("2026-10-06T12:10:00.000Z"),
      expiresAt: at("2026-10-06T12:30:00.000Z"),
    });
    const commerceAdmission = planDeterministicCommerceAdmission({
      offer: offer(x),
      quote: commerceQuote,
      executorCharacterId: x.executorCharacterId,
      availableAgentFloatCredits: 10_000,
      ids: {
        fulfillmentId: x.fulfillmentId,
        customerPaymentLedgerEntryId: x.customerPaymentLedgerEntryId,
        creatorReserveLedgerEntryId: null,
      },
      createdAt: at("2026-10-06T12:11:00.000Z"),
    });

    expect(commerceAdmission.admission).toMatchObject({
      originatingCharacterId: x.presentationCharacterId,
      executorCharacterId: x.executorCharacterId,
      creatorUserId: x.ownerUserId,
      fundingSource: "platform",
      creatorCommissionCredits: 75,
    });

    const completion: CommerceFulfillmentCompletion = {
      schemaVersion: 1,
      tenantId: x.tenantId,
      fulfillmentId: x.fulfillmentId,
      state: "succeeded",
      resultReference: "artifact://task138-delivery",
      resultHash:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      completedAt: at("2026-10-06T12:15:00.000Z"),
    };
    const commerceSettlement = planDeterministicCommerceSettlement({
      quote: commerceAdmission.quote,
      admission: commerceAdmission.admission,
      completion,
      ids: {
        reserveReleaseLedgerEntryId: null,
        creatorEarningLedgerEntryId: x.creatorEarningLedgerEntryId,
        platformMarginLedgerEntryId: x.platformMarginLedgerEntryId,
      },
    });

    expect(
      commerceSettlement.transfers.map((entry) => entry.reason),
    ).toEqual(["creator-earning", "platform-margin"]);

    const reconciliation = normalizeCommerceReconciliationReceipt({
      schemaVersion: 1,
      tenantId: x.tenantId,
      reconciliationCaseId: x.reconciliationCaseId,
      externalReceiptId: x.reconciliationReceiptId,
      quoteId: x.quoteId,
      fulfillmentId: x.fulfillmentId,
      providerKey: "task138-provider",
      outcome: "reversed",
      evidenceReference: "provider://task138/reversal/1",
      evidenceHash:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      observedAt: at("2026-10-06T12:20:00.000Z"),
    });
    expect(reconciliation.outcome).toBe("reversed");

    const refund = planCommerceLedgerReversals({
      requests: [{
        original: commerceAdmission.transfers[0]!,
        reversalLedgerEntryId: x.refundLedgerEntryId,
      }],
      createdAt: at("2026-10-06T12:21:00.000Z"),
    });
    expect(refund[0]).toMatchObject({
      reason: "refund",
      quoteId: x.quoteId,
      fulfillmentId: x.fulfillmentId,
    });
    expect(commerceAdmission.admission.originatingCharacterId).toBe(
      x.presentationCharacterId,
    );

    const source = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "other",
    });
    let plan = createStudioProductionPlan({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      sourceArtifact: source,
      createdAt: at("2026-10-06T12:30:00.000Z"),
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      operationId: createCanonicalId("operation"),
      at: at("2026-10-06T12:31:00.000Z"),
    });
    const script = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "script",
      parents: [{
        mediaArtifactId: source.mediaArtifactId,
        revision: source.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "script",
      expectedStageRevision: stage(plan, "script").revision,
      outputArtifact: script,
      at: at("2026-10-06T12:32:00.000Z"),
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "storyboard",
      expectedStageRevision: stage(plan, "storyboard").revision,
      operationId: createCanonicalId("operation"),
      at: at("2026-10-06T12:33:00.000Z"),
    });
    const storyboard = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "storyboard",
      parents: [{
        mediaArtifactId: script.mediaArtifactId,
        revision: script.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "storyboard",
      expectedStageRevision: stage(plan, "storyboard").revision,
      outputArtifact: storyboard,
      at: at("2026-10-06T12:34:00.000Z"),
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "voice",
      expectedStageRevision: stage(plan, "voice").revision,
      operationId: createCanonicalId("operation"),
      at: at("2026-10-06T12:35:00.000Z"),
    });
    const voice = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "audio",
      parents: [{
        mediaArtifactId: script.mediaArtifactId,
        revision: script.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "voice",
      expectedStageRevision: stage(plan, "voice").revision,
      outputArtifact: voice,
      at: at("2026-10-06T12:36:00.000Z"),
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "visual-render",
      expectedStageRevision: stage(plan, "visual-render").revision,
      operationId: createCanonicalId("operation"),
      at: at("2026-10-06T12:37:00.000Z"),
    });
    const visual = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "video",
      parents: [{
        mediaArtifactId: storyboard.mediaArtifactId,
        revision: storyboard.revision,
      }],
    });
    plan = completeStudioStage({
      plan,
      stage: "visual-render",
      expectedStageRevision: stage(plan, "visual-render").revision,
      outputArtifact: visual,
      at: at("2026-10-06T12:38:00.000Z"),
    });

    plan = beginStudioStageDispatch({
      plan,
      stage: "lipsync",
      expectedStageRevision: stage(plan, "lipsync").revision,
      operationId: createCanonicalId("operation"),
      at: at("2026-10-06T12:39:00.000Z"),
    });
    const final = artifact({
      tenantId: x.tenantId,
      mediaProjectId: x.mediaProjectId,
      characterId: x.presentationCharacterId,
      kind: "video",
      parents: [
        {
          mediaArtifactId: visual.mediaArtifactId,
          revision: visual.revision,
        },
        {
          mediaArtifactId: voice.mediaArtifactId,
          revision: voice.revision,
        },
      ],
    });
    plan = completeStudioStage({
      plan,
      stage: "lipsync",
      expectedStageRevision: stage(plan, "lipsync").revision,
      outputArtifact: final,
      at: at("2026-10-06T12:40:00.000Z"),
    });

    const finalVideo = finalStudioVideo(plan);
    expect(finalVideo).toMatchObject({
      characterId: x.presentationCharacterId,
      mediaArtifactId: final.mediaArtifactId,
      kind: "video",
    });

    const consistency = assertCharacterSurfaceConsistency({
      tenantId: x.tenantId,
      presentationCharacterId: x.presentationCharacterId,
      evidence: [
        {
          tenantId: x.tenantId,
          role: "social-presentation",
          characterId: published.publication.characterId,
          sourceReference: `publication:${x.publicationId}`,
          sourceRevision: published.publication.revision,
        },
        {
          tenantId: x.tenantId,
          role: "studio-media",
          characterId: finalVideo.characterId,
          sourceReference: `media-artifact:${finalVideo.mediaArtifactId}`,
          sourceRevision: finalVideo.revision,
        },
        {
          tenantId: x.tenantId,
          role: "commerce-originating",
          characterId: commerceAdmission.admission.originatingCharacterId,
          sourceReference: `quote:${x.quoteId}`,
          sourceRevision: commerceQuote.offerRevision,
        },
        {
          tenantId: x.tenantId,
          role: "commerce-executor",
          characterId: commerceAdmission.admission.executorCharacterId,
          sourceReference: `fulfillment:${x.fulfillmentId}`,
          sourceRevision: 1,
        },
      ],
    });

    expect(consistency.presentationCharacterId).toBe(
      x.presentationCharacterId,
    );
    expect(consistency.executorCharacterIds).toEqual([
      x.executorCharacterId,
    ]);
    expect(() =>
      assertCommerceExecutorCannotSubstituteOrigin({
        consistency,
        executorCharacterId: x.executorCharacterId,
      }),
    ).not.toThrow();
  });

  it("fails closed when a surface tries to substitute a different presentation Character", () => {
    const x = ids();
    const impostor = createCanonicalId("character");

    expect(() =>
      assertCharacterSurfaceConsistency({
        tenantId: x.tenantId,
        presentationCharacterId: x.presentationCharacterId,
        evidence: [
          {
            tenantId: x.tenantId,
            role: "social-presentation",
            characterId: x.presentationCharacterId,
            sourceReference: "social:ok",
            sourceRevision: 1,
          },
          {
            tenantId: x.tenantId,
            role: "studio-media",
            characterId: impostor,
            sourceReference: "studio:forged",
            sourceRevision: 1,
          },
          {
            tenantId: x.tenantId,
            role: "commerce-originating",
            characterId: x.presentationCharacterId,
            sourceReference: "commerce:origin",
            sourceRevision: 1,
          },
        ],
      }),
    ).toThrow("does not match");
  });
});
