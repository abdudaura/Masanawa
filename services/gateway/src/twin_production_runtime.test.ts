import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it } from "vitest";
import { createTwinProductionRuntime } from "./twin_production_runtime.js";

const tenantId = createCanonicalId("tenant");
const ownerUserId = createCanonicalId("user");
const characterId = createCanonicalId("character");

const profile = Object.freeze({
  tenantId,
  ownerUserId,
  characterId,
  publicId: "amina-bello",
  displayName: "Amina Bello",
  bio: "Teacher and storyteller",
  interests: Object.freeze(["learning"]),
  languages: Object.freeze(["English", "Hausa"]),
  avatarUrl: null,
  discoverable: true,
  revision: 1,
  updatedAt: "2026-10-05T16:00:00.000Z" as never,
});

function harness() {
  const runtime = createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: ownerUserId,
          profile: {
            userId: ownerUserId,
            name: "Amina Bello",
            email: "amina@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() {
        return profile;
      },
      async update() {
        return profile;
      },
      async searchPublic() {
        return [profile];
      },
      async readPublicById() {
        return profile;
      },
    } as never,
    economy: {
      async isTwinBlocked() {
        return false;
      },
      async readOwnerAccessOffering() {
        return null;
      },
      async listCreditOperationsForUser() {
        return [];
      },
    } as never,
    events: {
      async append() {
        return "event-1";
      },
      async listForCharacter() {
        return [];
      },
      async listForUser() {
        return [];
      },
    },
    commerce: {
      async readBalance() {
        return 1200;
      },
      async readCreatorCommercialSnapshot() {
        return {
          agentFloatCredits: 9999,
          pendingEarningsCredits: 30,
          availableEarningsCredits: 70,
        };
      },
    } as never,
    personalClones: {
      async readPersonalClone() {
        return {
          characterId,
          characterVersionId:
            "character-version_00000000-0000-4000-8000-000000000004",
          relationshipId:
            "relationship_00000000-0000-4000-8000-000000000005",
        };
      },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 7000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 1000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });

  return runtime;
}


const requesterUserId = createCanonicalId("user");

function paidOrderingHarness(order: string[]) {
  const ledgerPlan = (input: { readonly plan: unknown }) => {
    order.push("plan");
    return input.plan;
  };

  return createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: requesterUserId,
          profile: {
            userId: requesterUserId,
            name: "Requester",
            email: "requester@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() { return null; },
      async update() { throw new Error("unused"); },
      async searchPublic() { return []; },
      async readPublicById() { return null; },
    } as never,
    economy: {
      async readVoiceQuote() {
        return {
          tenantId,
          userId: requesterUserId,
          ownerUserId,
          quoteId: "quote_paid_123",
          characterId,
          policyRevision: 1,
          trialPolicyRevision: 1,
          chargeMode: "paid",
          trialDurationDays: 7,
          trialStartsAt: null,
          trialExpiresAt: null,
          estimatedSeconds: 300,
          estimatedPriceCredits: 50,
          spendCapCredits: 50,
          ownerShareBasisPoints: 8000,
          unitSeconds: 60,
          priceCreditsPerUnit: 10,
          quoteExpiresAt: "2099-10-05T16:10:00.000Z",
          createdAt: "2026-10-05T16:00:00.000Z",
        };
      },
      async readVoiceAdmissionByQuote() { return null; },
      async readLedgerPlan() { return null; },
      async putLedgerPlan(input: { readonly plan: unknown }) {
        return ledgerPlan(input);
      },
      async putVoiceAdmission(input: unknown) {
        order.push("persist-voice");
        return input;
      },
      async readOwnerAccessQuote() {
        return {
          requestId: "request_paid_123",
          requesterUserId,
          ownerUserId,
          originatingCharacterId: characterId,
          modality: "voice",
          durationMinutes: 15,
          priceCredits: 150,
          platformFeeCredits: 30,
          ownerEarningCredits: 120,
          chargeMode: "paid",
          trialDurationDays: 7,
          policyRevision: 1,
          trialPolicyRevision: 1,
          quoteExpiresAt: "2099-10-05T16:10:00.000Z",
        };
      },
      async readOwnerAccessRequest() { return null; },
      async putOwnerAccessRequest(input: {
        readonly request: unknown;
        readonly reservationId: unknown;
        readonly reservedCredits: number;
      }) {
        order.push("persist-owner");
        return {
          ...(input.request as Record<string, unknown>),
          reservationId: input.reservationId,
          reservedCredits: input.reservedCredits,
        };
      },
    } as never,
    events: {
      async append() {
        order.push("event");
        return "event-1";
      },
      async listForCharacter() { return []; },
      async listForUser() { return []; },
    },
    commerce: {
      async postTransfer() {
        order.push("reserve");
      },
    } as never,
    personalClones: {
      async readPersonalClone() { return null; },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 8000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 2000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });
}


function commissionOrderingHarness(order: string[], options: {
  readonly recoveredReversal?: boolean;
} = {}) {
  let settlement: Record<string, unknown> | null = options.recoveredReversal
    ? {
        settlementId: "operation_settlement_123",
        ownerUserId,
        characterId,
        baseCredits: 1000,
        commissionCredits: 100,
        policyRevision: 1,
        ledgerEntryId: "ledger-entry_settlement_123",
        reversedCredits: 100,
      }
    : null;

  const reversalPlan = {
    planKey: "commission-reversal:reversal_full_123",
    entries: [{
      role: "reversal",
      amountCredits: 100,
      ledgerEntryId: "ledger-entry_reversal_123",
    }],
    createdAt: "2026-10-05T16:00:00.000Z",
  };

  return createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: requesterUserId,
          profile: {
            userId: requesterUserId,
            name: "Requester",
            email: "requester@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() { return null; },
      async update() { throw new Error("unused"); },
      async searchPublic() { return []; },
      async readPublicById() { return null; },
    } as never,
    economy: {
      async readAttributionForOperation() {
        return {
          attributionId: "operation_attribution_123",
          ownerUserId,
          characterId,
          customerUserId: requesterUserId,
          eventType: "commerce-purchase",
          operationId: "purchase_123",
          policyRevision: 1,
          attributedAt: "2026-10-05T16:00:00.000Z",
          expiresAt: "2099-10-05T16:00:00.000Z",
          selfAttribution: false,
        };
      },
      async readCommissionPolicy() {
        return {
          schemaVersion: 1,
          revision: 1,
          enabled: true,
          eventType: "commerce-purchase",
          rateBasisPoints: 1000,
          minimumCommissionCredits: 0,
          maximumCommissionCredits: 1000000,
          effectiveAt: "2026-10-05T00:00:00.000Z",
        };
      },
      async readCommissionForOperation() {
        return settlement;
      },
      async readLedgerPlan(input: { readonly planKey: string }) {
        if (options.recoveredReversal &&
            input.planKey === reversalPlan.planKey) {
          return reversalPlan;
        }
        return null;
      },
      async putLedgerPlan(input: { readonly plan: unknown }) {
        order.push("plan");
        return input.plan;
      },
      async recordCommissionSettlement(input: Record<string, unknown>) {
        order.push("persist-settlement");
        settlement = {
          settlementId: input.settlementId,
          ownerUserId: input.ownerUserId,
          characterId: input.characterId,
          baseCredits: input.baseCredits,
          commissionCredits: input.commissionCredits,
          policyRevision: input.policyRevision,
          ledgerEntryId: input.ledgerEntryId,
          reversedCredits: 0,
        };
        return { duplicate: false };
      },
      async recordCommissionReversal() {
        order.push("persist-reversal");
        return { duplicate: options.recoveredReversal === true };
      },
    } as never,
    events: {
      async append() {
        order.push("event");
        return "event-1";
      },
      async listForCharacter() { return []; },
      async listForUser() { return []; },
    },
    commerce: {
      async postTransfer() {
        order.push(options.recoveredReversal ? "reverse-ledger" : "settle-ledger");
      },
    } as never,
    personalClones: {
      async readPersonalClone() { return null; },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 8000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 2000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });
}


function ownerLifecycleHarness(input: {
  readonly actorUserId: typeof ownerUserId | typeof requesterUserId;
  readonly state:
    | "requested"
    | "accepted"
    | "scheduled"
    | "active";
  readonly chargeMode?: "trial" | "paid";
  readonly acceptBy?: string;
  readonly scheduledFor?: string | null;
  readonly startedAt?: string | null;
  readonly reservedCredits?: number;
}) {
  const events: Array<Record<string, unknown>> = [];
  const transfers: Array<Record<string, unknown>> = [];
  const chargeMode = input.chargeMode ?? "paid";
  const reservedCredits = input.reservedCredits ??
    (chargeMode === "paid" ? 100 : 0);
  let current: any = {
    requestId: "request_lifecycle_123",
    requesterUserId,
    ownerUserId,
    originatingCharacterId: characterId,
    modality: "voice",
    durationMinutes: 15,
    priceCredits: chargeMode === "paid" ? 100 : 0,
    platformFeeCredits: chargeMode === "paid" ? 20 : 0,
    ownerEarningCredits: chargeMode === "paid" ? 80 : 0,
    chargeMode,
    trialPolicyRevision: 1,
    state: input.state,
    requestedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    acceptBy: input.acceptBy ??
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scheduledFor: input.scheduledFor ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: null,
    reservationId: reservedCredits > 0
      ? "ledger-entry_reservation_lifecycle"
      : null,
    reservedCredits,
  };

  const runtime = createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: input.actorUserId,
          profile: {
            userId: input.actorUserId,
            name: "Lifecycle actor",
            email: "actor@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() { return null; },
      async update() { throw new Error("unused"); },
      async searchPublic() { return []; },
      async readPublicById() { return null; },
    } as never,
    economy: {
      async readOwnerAccessRequest() {
        return current;
      },
      async updateOwnerAccessRequest(update: {
        readonly request: Record<string, unknown>;
        readonly reservationId: string | null;
        readonly reservedCredits: number;
      }) {
        current = {
          ...update.request,
          reservationId: update.reservationId,
          reservedCredits: update.reservedCredits,
        };
        return current;
      },
      async readLedgerPlan() { return null; },
      async putLedgerPlan(plan: { readonly plan: unknown }) {
        return plan.plan;
      },
      async consumeTrialUsage() {},
    } as never,
    events: {
      async append(event: { readonly payload: Record<string, unknown> }) {
        events.push(event.payload);
        return `event-${events.length}`;
      },
      async listForCharacter() { return []; },
      async listForUser() { return []; },
    } as never,
    commerce: {
      async postTransfer(transfer: Record<string, unknown>) {
        transfers.push(transfer);
        return transfer;
      },
    } as never,
    personalClones: {
      async readPersonalClone() { return null; },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 8000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 2000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });

  return {
    runtime,
    events,
    transfers,
    current: () => current,
  };
}


function voiceLifecycleHarness() {
  const transfers: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  let markStartedCalls = 0;
  let admission: any = {
    tenantId,
    userId: requesterUserId,
    ownerUserId,
    admissionId: "operation_voice_lifecycle_123",
    quoteId: "quote_voice_lifecycle_123",
    characterId,
    chargeMode: "paid",
    admittedAt: new Date(Date.now() - 30_000).toISOString(),
    startedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    spendCapCredits: 50,
    reservationLedgerEntryId: "ledger-entry_voice_reserve_123",
    settledAt: null,
  };

  const runtime = createTwinProductionRuntime({
    sessions: {
      async authorize() {
        return {
          tenantId,
          userId: requesterUserId,
          profile: {
            userId: requesterUserId,
            name: "Requester",
            email: "requester@example.com",
            phone: null,
            locale: "en",
            createdAt: "2026-10-05T15:00:00.000Z",
          },
        } as never;
      },
    },
    profiles: {
      async ensureForOwner() { return null; },
      async update() { throw new Error("unused"); },
      async searchPublic() { return []; },
      async readPublicById() { return null; },
    } as never,
    economy: {
      async readOwnerForCharacter() {
        return ownerUserId;
      },
      async readVoiceAdmission() {
        return admission;
      },
      async readVoiceQuote() {
        return {
          tenantId,
          userId: requesterUserId,
          ownerUserId,
          quoteId: admission.quoteId,
          characterId,
          policyRevision: 1,
          trialPolicyRevision: 1,
          chargeMode: "paid",
          trialDurationDays: 7,
          trialStartsAt: null,
          trialExpiresAt: null,
          estimatedSeconds: 300,
          estimatedPriceCredits: 50,
          spendCapCredits: 50,
          ownerShareBasisPoints: 8000,
          unitSeconds: 60,
          priceCreditsPerUnit: 10,
          quoteExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        };
      },
      async markVoiceStarted(input: { readonly startedAt: string }) {
        markStartedCalls += 1;
        admission = { ...admission, startedAt: admission.startedAt ?? input.startedAt };
        return admission;
      },
      async readLedgerPlan() { return null; },
      async putLedgerPlan(input: { readonly plan: unknown }) {
        return input.plan;
      },
      async markVoiceSettled(input: { readonly settledAt: string }) {
        admission = { ...admission, settledAt: input.settledAt };
        return { duplicate: false };
      },
      async consumeTrialUsage() {},
    } as never,
    events: {
      async append(input: { readonly payload: Record<string, unknown> }) {
        events.push(input.payload);
        return `event-${events.length}`;
      },
      async listForCharacter() { return []; },
      async listForUser() { return []; },
    } as never,
    commerce: {
      async postTransfer(input: Record<string, unknown>) {
        transfers.push(input);
        return input;
      },
    } as never,
    personalClones: {
      async readPersonalClone() { return null; },
    } as never,
    publicTwinBaseUrl: "https://masanawa.com/twin",
    adminPrincipals: new Set<string>(),
    voice: {
      unitSeconds: 60,
      priceCreditsPerUnit: 10,
      ownerShareBasisPoints: 8000,
    },
    ownerAccess: {
      platformFeeBasisPoints: 2000,
      acceptWithinMinutes: 60,
      startGraceMinutes: 15,
    },
  });

  return {
    runtime,
    transfers,
    events,
    admission: () => admission,
    markStartedCalls: () => markStartedCalls,
  };
}

describe("Twin production runtime composition", () => {
  it("exposes the complete canonical Twin production surface as one frozen runtime", () => {
    const runtime = harness();

    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.keys(runtime).sort()).toEqual([
      "commissionAdmin",
      "creditTransfer",
      "gifts",
      "monetization",
      "myTwin",
      "ownerAccess",
      "ownerAccessOffering",
      "paidFeatureTrialAdmin",
      "paidVoice",
      "twinActivity",
      "twinAttribution",
      "twinDirectory",
      "twinProfile",
      "twinSafety",
      "voiceAdmissionGate",
      "wallet",
    ].sort());
  });


  it("reserves paid Twin voice before persisting the admission", async () => {
    const order: string[] = [];
    const runtime = paidOrderingHarness(order);

    await runtime.paidVoice.start({
      authorizationHeader: "Bearer requester",
      characterId,
      quoteId: "quote_paid_123",
      accepted: true,
    });

    expect(order.indexOf("reserve")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("persist-voice")).toBeGreaterThan(order.indexOf("reserve"));
  });

  it("reserves paid owner access before persisting the request and event", async () => {
    const order: string[] = [];
    const runtime = paidOrderingHarness(order);

    await runtime.ownerAccess.request({
      authorizationHeader: "Bearer requester",
      characterId,
      quoteId: "request_paid_123",
    });

    expect(order.indexOf("reserve")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("persist-owner")).toBeGreaterThan(order.indexOf("reserve"));
    expect(order.indexOf("event")).toBeGreaterThan(order.indexOf("persist-owner"));
  });


  it("posts commission value before persisting the settlement projection", async () => {
    const order: string[] = [];
    const runtime = commissionOrderingHarness(order);

    await runtime.monetization.settle({
      tenantId,
      eventType: "commerce-purchase",
      operationId: "purchase_123",
      baseCredits: 1000,
    });

    expect(order.indexOf("settle-ledger")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("persist-settlement"))
      .toBeGreaterThan(order.indexOf("settle-ledger"));
    expect(order.indexOf("event"))
      .toBeGreaterThan(order.indexOf("persist-settlement"));
  });

  it("repairs a recorded commission reversal whose ledger post was interrupted", async () => {
    const order: string[] = [];
    const runtime = commissionOrderingHarness(order, {
      recoveredReversal: true,
    });

    await runtime.monetization.reverse({
      tenantId,
      operationId: "purchase_123",
      reversalId: "reversal_full_123",
      reversalBaseCredits: 1000,
    });

    expect(order.indexOf("reverse-ledger")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("persist-reversal"))
      .toBeGreaterThan(order.indexOf("reverse-ledger"));
    expect(order.indexOf("event"))
      .toBeGreaterThan(order.indexOf("persist-reversal"));
  });


  it("does not persist completion before attendance evidence is verified", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "active",
      startedAt: new Date(Date.now() - 30_000).toISOString(),
    });

    await expect(
      harness.runtime.ownerAccess.act({
        authorizationHeader: "Bearer owner",
        characterId,
        requestId: "request_lifecycle_123",
        action: "complete",
      }),
    ).rejects.toThrow("verified attendance");

    expect(harness.current().state).toBe("active");
    expect(harness.transfers).toHaveLength(0);
    expect(harness.events).toHaveLength(0);
  });

  it("expires an unanswered owner request and releases held Credits", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "requested",
      acceptBy: new Date(Date.now() - 60_000).toISOString(),
      reservedCredits: 100,
    });

    const request = await harness.runtime.ownerAccess.read({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
    });

    expect(request?.state).toBe("expired");
    expect(harness.transfers).toHaveLength(1);
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.refunded",
        referenceId: "request_lifecycle_123",
        amountCredits: 100,
        status: "refunded",
      }),
    );
  });

  it("turns an unstarted scheduled session into a no-show refund after grace", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "scheduled",
      scheduledFor: new Date(Date.now() - 16 * 60_000).toISOString(),
      reservedCredits: 100,
    });

    const request = await harness.runtime.ownerAccess.read({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
    });

    expect(request?.state).toBe("no-show");
    expect(harness.transfers).toHaveLength(1);
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.refunded",
        amountCredits: 100,
      }),
    );
  });

  it("does not expire an already accepted request at the old acceptance deadline", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "accepted",
      acceptBy: new Date(Date.now() - 60_000).toISOString(),
      reservedCredits: 100,
    });

    const request = await harness.runtime.ownerAccess.read({
      authorizationHeader: "Bearer owner",
      characterId,
      requestId: "request_lifecycle_123",
    });

    expect(request?.state).toBe("accepted");
    expect(harness.transfers).toHaveLength(0);
    expect(harness.events).toHaveLength(0);
  });

  it("closes a declined trial request in Activity even when no Credits were held", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "requested",
      chargeMode: "trial",
      reservedCredits: 0,
    });

    const request = await harness.runtime.ownerAccess.act({
      authorizationHeader: "Bearer owner",
      characterId,
      requestId: "request_lifecycle_123",
      action: "decline",
    });

    expect(request.state).toBe("declined");
    expect(harness.transfers).toHaveLength(0);
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.refunded",
        amountCredits: 0,
        status: "refunded",
      }),
    );
  });


  it("does not start paid voice usage when only a Live token is issued", async () => {
    const harness = voiceLifecycleHarness();

    await harness.runtime.voiceAdmissionGate.tokenIssued({
      tenantId,
      userId: requesterUserId,
      characterId,
      admissionId: "operation_voice_lifecycle_123",
    });

    expect(harness.admission().startedAt).toBeNull();
    expect(harness.markStartedCalls()).toBe(0);
  });

  it("records paid voice media start exactly once after connected setup", async () => {
    const harness = voiceLifecycleHarness();

    const first = await harness.runtime.voiceAdmissionGate.mediaStarted({
      authorizationHeader: "Bearer requester",
      admissionId: "operation_voice_lifecycle_123",
    });
    const second = await harness.runtime.voiceAdmissionGate.mediaStarted({
      authorizationHeader: "Bearer requester",
      admissionId: "operation_voice_lifecycle_123",
    });

    expect(first.started).toBe(true);
    expect(second.startedAt).toBe(first.startedAt);
    expect(harness.markStartedCalls()).toBe(1);
  });

  it("fully refunds a paid voice reservation when media never started", async () => {
    const harness = voiceLifecycleHarness();

    const decision = await harness.runtime.voiceAdmissionGate.complete({
      authorizationHeader: "Bearer requester",
      admissionId: "operation_voice_lifecycle_123",
      outcome: "interrupted",
    });

    expect(decision.customerChargeCredits).toBe(0);
    expect(decision.refundCredits).toBe(50);
    expect(harness.transfers).toHaveLength(1);
    expect(harness.transfers[0]).toEqual(
      expect.objectContaining({
        amountCredits: 50,
        reason: "refund",
      }),
    );
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.voice.refunded",
        amountCredits: 50,
        status: "refunded",
      }),
    );
  });

  it("wires authenticated public discovery, My Twin and Wallet projections through canonical sources", async () => {
    const runtime = harness();

    const discovered = await runtime.twinDirectory.search({
      authorizationHeader: "Bearer owner",
      query: "amina",
    });
    expect(discovered).toEqual([
      expect.objectContaining({
        characterId,
        publicId: "amina-bello",
        representationLabel: "AI twin",
        textChatMode: "free",
      }),
    ]);

    const mine = await runtime.myTwin.read({
      authorizationHeader: "Bearer owner",
    });
    expect(mine).toEqual(expect.objectContaining({
      hasTwin: true,
      characterId,
      displayName: "Amina Bello",
      publicUrl: "https://masanawa.com/twin/amina-bello",
      discoverable: true,
      voiceEnabled: true,
      ownerAccessEnabled: false,
    }));

    const wallet = await runtime.wallet.read({
      authorizationHeader: "Bearer owner",
    });
    expect(wallet).toEqual({
      spendableCredits: 1200,
      pendingEarningsCredits: 30,
      availableEarningsCredits: 70,
      entries: [],
    });
    expect(JSON.stringify(wallet)).not.toContain("9999");
  });
});
