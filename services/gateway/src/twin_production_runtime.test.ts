import { createCanonicalId } from "@masanawa/contracts";
import { describe, expect, it, vi } from "vitest";
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
          characterVersionId: createCanonicalId("character-version"),
          relationshipId: createCanonicalId("relationship"),
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

function paidOrderingHarness(order: string[], options: {
  expired?: boolean;
  existing?: boolean;
  settled?: boolean;
} = {}) {
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
          quoteExpiresAt: options.expired ? "2020-10-05T16:10:00.000Z" : "2099-10-05T16:10:00.000Z",
          createdAt: "2026-10-05T16:00:00.000Z",
        };
      },
      async readVoiceAdmissionByQuote() {
        return options.existing ? { tenantId, userId: requesterUserId, ownerUserId, characterId,
          admissionId: "operation_existing_voice", quoteId: "quote_paid_123", chargeMode: "paid",
          admittedAt: "2020-10-05T16:00:00.000Z", expiresAt: "2020-10-05T16:20:00.000Z",
          spendCapCredits: 50, reservationLedgerEntryId: "ledger-entry_existing_reserve",
          settledAt: options.settled ? "2020-10-05T16:10:00.000Z" : null } : null;
      },
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
          modality: "text",
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
    | "active"
    | "completed"
    | "declined"
    | "expired"
    | "cancelled"
    | "no-show"
    | "refunded"
    | "settled"
    | "releasing"
    | "disputed";
  readonly chargeMode?: "trial" | "paid";
  readonly acceptBy?: string;
  readonly scheduledFor?: string | null;
  readonly startedAt?: string | null;
  readonly reservedCredits?: number;
  readonly conflictOnNextTransition?: boolean;
  readonly verifiedAttendance?: boolean;
  readonly completedAt?: string | null;
  readonly disputeBy?: string | null;
  readonly disputedAt?: string | null;
  readonly disputeReason?: "service-not-delivered" | "service-quality" | "other" | null;
  readonly earningsReleasedAt?: string | null;
  readonly admin?: boolean;
}) {
  const events: Array<Record<string, unknown>> = [];
  const transfers: Array<Record<string, unknown>> = [];
  const chargeMode = input.chargeMode ?? "paid";
  let conflictOnNextTransition = input.conflictOnNextTransition === true;
  const reservedCredits = input.reservedCredits ??
    (chargeMode === "paid" ? 100 : 0);
  let current: any = {
    requestId: "request_lifecycle_123",
    requesterUserId,
    ownerUserId,
    originatingCharacterId: characterId,
    modality: "text",
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
    completedAt: input.completedAt ?? null,
    disputeBy: input.disputeBy ?? null,
    disputedAt: input.disputedAt ?? null,
    disputeReason: input.disputeReason ?? null,
    earningsReleasedAt: input.earningsReleasedAt ?? null,
    reservationId: reservedCredits > 0
      ? "ledger-entry_reservation_lifecycle"
      : null,
    reservedCredits,
  };
  const presence: Array<Record<string, unknown>> =
    input.verifiedAttendance === true
      ? [
          {
            requestId: current.requestId,
            userId: requesterUserId,
            firstSeenAt: new Date(Date.now() - 75_000).toISOString(),
            lastSeenAt: new Date().toISOString(),
            heartbeatCount: 6,
          },
          {
            requestId: current.requestId,
            userId: ownerUserId,
            firstSeenAt: new Date(Date.now() - 75_000).toISOString(),
            lastSeenAt: new Date().toISOString(),
            heartbeatCount: 6,
          },
        ]
      : [];
  const messages: Array<Record<string, unknown>> = [];

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
      async transitionOwnerAccessRequest(update: {
        readonly expectedState: string;
        readonly request: Record<string, unknown>;
        readonly reservationId: string | null;
        readonly reservedCredits: number;
      }) {
        if (conflictOnNextTransition) {
          conflictOnNextTransition = false;
          current = { ...current, state: "cancelled" };
          return { applied: false, request: current };
        }
        if (current.state !== update.expectedState) {
          return { applied: false, request: current };
        }
        current = {
          ...update.request,
          reservationId: update.reservationId,
          reservedCredits: update.reservedCredits,
        };
        return { applied: true, request: current };
      },
      async listOwnerAccessLifecycleCandidates() {
        return [current];
      },
      async touchOwnerAccessPresence(update: {
        readonly requestId: string;
        readonly userId: string;
        readonly seenAt: string;
      }) {
        const existing = presence.find(
          (item) => item.userId === update.userId,
        );
        if (existing) {
          existing.lastSeenAt = update.seenAt;
          existing.heartbeatCount =
            Number(existing.heartbeatCount ?? 0) + 1;
          return existing;
        }
        const created = {
          requestId: update.requestId,
          userId: update.userId,
          firstSeenAt: update.seenAt,
          lastSeenAt: update.seenAt,
          heartbeatCount: 1,
        };
        presence.push(created);
        return created;
      },
      async listOwnerAccessPresence() {
        return presence;
      },
      async appendOwnerAccessMessage(update: {
        readonly message: Record<string, unknown>;
      }) {
        const existing = messages.find(
          (item) => item.messageId === update.message.messageId,
        );
        if (existing) return existing;
        messages.push({ ...update.message });
        return update.message;
      },
      async listOwnerAccessMessages() {
        return messages;
      },
      async purgeExpiredOwnerAccessMessages() {
        return 0;
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
    adminPrincipals: input.admin
      ? new Set<string>([String(input.actorUserId)])
      : new Set<string>(),
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
    presence,
    messages,
    current: () => current,
  };
}


function voiceLifecycleHarness(options: {
  readonly startedAt?: string | null;
  readonly platform?: boolean;
  readonly support?: boolean;
  readonly failRefundOnce?: boolean;
  readonly ownerShare?: number;
} = {}) {
  const transfers: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  let markStartedCalls = 0;
  let savedPlan: unknown = null;
  let refundFailed = false;
  let admission: any = {
    tenantId,
    userId: requesterUserId,
    ownerUserId: options.platform ? null : ownerUserId,
    admissionId: "operation_voice_lifecycle_123",
    quoteId: "quote_voice_lifecycle_123",
    characterId,
    chargeMode: "paid",
    admittedAt: new Date(Date.now() - 30_000).toISOString(),
    startedAt: options.startedAt ?? null,
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
    platformProfiles: {
      async readForCharacter() {
        return options.platform ? { tenantId, characterId, supportAgent: options.support === true,
          voiceProvider: "gemini", voiceName: "Kore" } : null;
      },
    } as never,
    economy: {
      async readTrialPolicy() { return null; },
      async readTrialUsage() { return { startedAt: null, consumedUnits: 0 }; },
      async putVoiceQuote(value: unknown) { return value; },
      async readOwnerForCharacter() {
        return options.platform ? null : ownerUserId;
      },
      async readVoiceAdmission() {
        return admission;
      },
      async readVoiceQuote() {
        return {
          tenantId,
          userId: requesterUserId,
          ownerUserId: options.platform ? null : ownerUserId,
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
          ownerShareBasisPoints: options.ownerShare ?? (options.platform ? 0 : 8000),
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
      async readLedgerPlan() { return savedPlan; },
      async putLedgerPlan(input: { readonly plan: unknown }) {
        savedPlan = input.plan;
        return savedPlan;
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
        if (options.failRefundOnce && input.reason === "refund" && !refundFailed) {
          refundFailed = true;
          throw new Error("injected refund interruption");
        }
        if (!transfers.some(t => t.ledgerEntryId === input.ledgerEntryId)) transfers.push(input);
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
      ownerShareBasisPoints: options.ownerShare ?? (options.platform ? 0 : 8000),
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
      "creditGift",
      "creditTransfer",
      "gifts",
      "monetization",
      "myTwin",
      "ownerAccess",
      "ownerAccessDisputes",
      "ownerAccessMaintenance",
      "ownerAccessOffering",
      "paidFeatureTrialAdmin",
      "paidVoice",
      "providerValuationAdmin",
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

    expect(request?.state).toBe("refunded");
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

    expect(request?.state).toBe("refunded");
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
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.accepted",
        status: "pending",
      }),
    );
  });

  it("periodic maintenance refunds an expired request without a participant read", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "requested",
      acceptBy: new Date(Date.now() - 60_000).toISOString(),
      reservedCredits: 100,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result).toEqual({
      scanned: 1,
      advanced: 1,
      failed: 0,
      messagesPurged: 0,
    });
    expect(harness.current().state).toBe("refunded");
    expect(harness.transfers).toHaveLength(1);
  });

  it("repairs an intermediate expired request after a crash before settlement", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "expired",
      reservedCredits: 100,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("refunded");
    expect(harness.transfers).toHaveLength(1);
  });

  it("rejects an owner action when another transition wins the CAS", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "requested",
      reservedCredits: 100,
      conflictOnNextTransition: true,
    });

    await expect(
      harness.runtime.ownerAccess.act({
        authorizationHeader: "Bearer owner",
        characterId,
        requestId: "request_lifecycle_123",
        action: "accept",
      }),
    ).rejects.toThrow("changed; refresh");

    expect(harness.current().state).toBe("cancelled");
    expect(harness.transfers).toHaveLength(0);
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

    expect(request.state).toBe("refunded");
    expect(harness.transfers).toHaveLength(0);
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.refunded",
        amountCredits: 0,
        status: "refunded",
      }),
    );
  });


  it("settles a paid human text session only after two-party attendance", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "active",
      startedAt: new Date(Date.now() - 75_000).toISOString(),
      reservedCredits: 100,
      verifiedAttendance: true,
    });

    const completed = await harness.runtime.ownerAccess.act({
      authorizationHeader: "Bearer owner",
      characterId,
      requestId: "request_lifecycle_123",
      action: "complete",
    });

    expect(completed.state).toBe("settled");
    expect(harness.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountCredits: 80,
          reason: "creator-earning",
        }),
        expect.objectContaining({
          amountCredits: 20,
          reason: "platform-margin",
        }),
      ]),
    );
    expect(harness.events.at(-1)).toEqual(
      expect.objectContaining({
        eventType: "twin.owner-access.completed",
        amountCredits: 80,
        status: "completed",
      }),
    );
  });

  it("keeps the human text room request-scoped and server-timestamped", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "active",
      startedAt: new Date(Date.now() - 10_000).toISOString(),
      reservedCredits: 0,
      chargeMode: "trial",
    });

    const status = await harness.runtime.ownerAccess.heartbeat({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
    });
    expect(status.attendanceVerified).toBe(false);
    expect(harness.presence).toHaveLength(1);

    const sent = await harness.runtime.ownerAccess.sendMessage({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
      messageId: "message-human-123",
      body: "Hello owner",
    });
    expect(sent).toEqual(
      expect.objectContaining({
        requestId: "request_lifecycle_123",
        senderUserId: requesterUserId,
        body: "Hello owner",
      }),
    );

    const messages = await harness.runtime.ownerAccess.messages({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
      limit: 100,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageId).toBe("message-human-123");
  });

  it("auto-settles an overdue human session when two-party attendance is verified", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "active",
      startedAt: new Date(Date.now() - 31 * 60_000).toISOString(),
      reservedCredits: 100,
      verifiedAttendance: true,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("settled");
    expect(harness.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountCredits: 80,
          reason: "creator-earning",
        }),
        expect.objectContaining({
          amountCredits: 20,
          reason: "platform-margin",
        }),
      ]),
    );
  });

  it("auto-refunds an overdue human session when attendance cannot be verified", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "active",
      startedAt: new Date(Date.now() - 31 * 60_000).toISOString(),
      reservedCredits: 100,
      verifiedAttendance: false,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("refunded");
    expect(harness.current().reconciliationReason).toBe("attendance-timeout");
    expect(harness.transfers).toEqual([
      expect.objectContaining({
        amountCredits: 100,
        reason: "refund",
      }),
    ]);
  });

  it("repairs an attendance-timeout dispute after a crash before refund", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "disputed",
      startedAt: new Date(Date.now() - 31 * 60_000).toISOString(),
      reservedCredits: 100,
    });
    harness.current().reconciliationReason = "attendance-timeout";

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("refunded");
    expect(harness.transfers).toHaveLength(1);
  });

  it("holds completed human-session earnings pending until the dispute deadline", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      state: "active",
      startedAt: new Date(Date.now() - 75_000).toISOString(),
      reservedCredits: 100,
      verifiedAttendance: true,
    });

    const completed = await harness.runtime.ownerAccess.act({
      authorizationHeader: "Bearer owner",
      characterId,
      requestId: "request_lifecycle_123",
      action: "complete",
    });

    expect(completed.state).toBe("settled");
    expect(completed.disputeBy).toBeTruthy();
    expect(Date.parse(completed.disputeBy!)).toBeGreaterThan(Date.now());
    expect(completed.earningsReleasedAt).toBeNull();
    expect(harness.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountCredits: 80,
          reason: "creator-earning",
          credit: expect.objectContaining({
            kind: "pending-earnings",
            userId: ownerUserId,
            characterId: null,
          }),
        }),
      ]),
    );
  });

  it("lets the requester freeze pending earnings during the dispute window", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "settled",
      completedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      disputeBy: new Date(Date.now() + 60 * 60_000).toISOString(),
      reservedCredits: 100,
    });

    const disputed = await harness.runtime.ownerAccess.act({
      authorizationHeader: "Bearer requester",
      characterId,
      requestId: "request_lifecycle_123",
      action: "dispute",
      disputeReason: "service-quality",
    });

    expect(disputed.state).toBe("disputed");
    expect(disputed.disputeReason).toBe("service-quality");
    expect(disputed.disputedAt).toBeTruthy();
    expect(harness.transfers).toHaveLength(0);
  });

  it("releases undisputed owner earnings from pending to available after the window", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "settled",
      completedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      disputeBy: new Date(Date.now() - 60_000).toISOString(),
      reservedCredits: 100,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("settled");
    expect(harness.current().earningsReleasedAt).toBeTruthy();
    expect(harness.transfers).toEqual([
      expect.objectContaining({
        amountCredits: 80,
        reason: "earning-settlement",
        debit: expect.objectContaining({
          kind: "pending-earnings",
          userId: ownerUserId,
          characterId: null,
        }),
        credit: expect.objectContaining({
          kind: "available-earnings",
          userId: ownerUserId,
          characterId: null,
        }),
      }),
    ]);
  });

  it("repairs a crash left in the releasing state without reopening disputes", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      state: "releasing",
      completedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      disputeBy: new Date(Date.now() - 60_000).toISOString(),
      reservedCredits: 100,
    });

    const result = await harness.runtime.ownerAccessMaintenance.sweep({
      tenantId,
      limit: 10,
    });

    expect(result.failed).toBe(0);
    expect(harness.current().state).toBe("settled");
    expect(harness.current().earningsReleasedAt).toBeTruthy();
    expect(harness.transfers).toHaveLength(1);
  });

  it("admin can resolve a requester dispute by refunding the full paid session", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: requesterUserId,
      admin: true,
      state: "disputed",
      completedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      disputedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      disputeReason: "service-not-delivered",
      reservedCredits: 100,
    });

    const resolved = await harness.runtime.ownerAccessDisputes.resolve({
      authorizationHeader: "Bearer admin",
      characterId,
      requestId: "request_lifecycle_123",
      resolution: "refund",
    });

    expect(resolved.state).toBe("refunded");
    expect(resolved.disputeResolution).toBe("refund");
    expect(harness.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountCredits: 80,
          reason: "refund",
          debit: expect.objectContaining({ kind: "pending-earnings" }),
          credit: expect.objectContaining({ kind: "customer-credit" }),
        }),
        expect.objectContaining({
          amountCredits: 20,
          reason: "refund",
          debit: expect.objectContaining({ kind: "platform-revenue" }),
          credit: expect.objectContaining({ kind: "customer-credit" }),
        }),
      ]),
    );
  });

  it("admin can resolve a requester dispute by releasing the owner earnings", async () => {
    const harness = ownerLifecycleHarness({
      actorUserId: ownerUserId,
      admin: true,
      state: "disputed",
      completedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      disputedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      disputeReason: "other",
      reservedCredits: 100,
    });

    const resolved = await harness.runtime.ownerAccessDisputes.resolve({
      authorizationHeader: "Bearer admin",
      characterId,
      requestId: "request_lifecycle_123",
      resolution: "release",
    });

    expect(resolved.state).toBe("settled");
    expect(resolved.disputeResolution).toBe("release");
    expect(resolved.earningsReleasedAt).toBeTruthy();
    expect(harness.transfers).toEqual([
      expect.objectContaining({
        amountCredits: 80,
        reason: "earning-settlement",
      }),
    ]);
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

  it("caps paid voice settlement to the accepted quote duration", async () => {
    const harness = voiceLifecycleHarness({
      startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    });

    const decision = await harness.runtime.voiceAdmissionGate.complete({
      authorizationHeader: "Bearer requester",
      admissionId: "operation_voice_lifecycle_123",
      outcome: "completed",
    });

    expect(decision.customerChargeCredits).toBe(50);
    expect(decision.refundCredits).toBe(0);
    expect(decision.disposition).toBe("settle");
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


describe("platform Masana canonical voice billing", () => {
  it("quotes platform voice without a human beneficiary", async () => {
    const h = voiceLifecycleHarness({ platform: true });
    const quote = await h.runtime.paidVoice.quote({ authorizationHeader: "Bearer test",
      characterId, expectedSeconds: 300 });
    expect(quote.ownerShareBasisPoints).toBe(0);
    expect(quote.estimatedSeconds).toBe(300);
  });

  it("requires and account/character fences admissions at both token gates", async () => {
    const h = voiceLifecycleHarness({ platform: true });
    const request = { tenantId, userId: requesterUserId, characterId,
      admissionId: h.admission().admissionId };
    for (const gate of [h.runtime.voiceAdmissionGate.validate, h.runtime.voiceAdmissionGate.tokenIssued]) {
      await expect(gate(request)).resolves.toBeUndefined();
      await expect(gate({ ...request, admissionId: null })).rejects.toThrow("required");
      await expect(gate({ ...request, admissionId: "forged_admission" })).rejects.toThrow("invalid");
      await expect(gate({ ...request, userId: ownerUserId })).rejects.toThrow("invalid");
      await expect(gate({ ...request, characterId: createCanonicalId("character") })).rejects.toThrow("invalid");
      await expect(gate({ ...request, tenantId: createCanonicalId("tenant") })).rejects.toThrow("invalid");
      h.admission().expiresAt = "invalid";
      await expect(gate(request)).rejects.toThrow("invalid");
      h.admission().expiresAt = new Date(Date.now() + 60_000).toISOString();
    }
    h.admission().settledAt = new Date().toISOString();
    await expect(h.runtime.voiceAdmissionGate.validate(request)).rejects.toThrow("invalid");
  });

  it("exempts only a matching canonical support profile", async () => {
    const h = voiceLifecycleHarness({ platform: true, support: true });
    const request = { tenantId, userId: requesterUserId, characterId, admissionId: null };
    await expect(h.runtime.voiceAdmissionGate.validate(request)).resolves.toBeUndefined();
    await expect(h.runtime.voiceAdmissionGate.tokenIssued(request)).resolves.toBeUndefined();
    await expect(h.runtime.voiceAdmissionGate.validate({ ...request,
      characterId: createCanonicalId("character") })).rejects.toThrow("required");
    const unknown = voiceLifecycleHarness();
    await expect(unknown.runtime.voiceAdmissionGate.validate(request)).rejects.toThrow("required");
  });

  it("settles platform usage to canonical platform revenue and refund only", async () => {
    const h = voiceLifecycleHarness({ platform: true,
      startedAt: new Date(Date.now() - 30_000).toISOString() });
    await h.runtime.voiceAdmissionGate.complete({ authorizationHeader: "Bearer test",
      admissionId: h.admission().admissionId, outcome: "completed" });
    expect(h.transfers.map(t => t.reason).sort()).toEqual(["platform-margin", "refund"]);
    expect(h.transfers.every(t => (t.credit as any).kind !== "pending-earnings")).toBe(true);
  });

  it("retries partial settlement across a billing unit boundary using frozen usage", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-12T10:00:30Z"));
      const h = voiceLifecycleHarness({ platform: true, failRefundOnce: true,
        startedAt: "2026-10-12T10:00:00Z" });
      const request = { authorizationHeader: "Bearer test", admissionId: h.admission().admissionId,
        outcome: "completed" as const };
      await expect(h.runtime.voiceAdmissionGate.complete(request)).rejects.toThrow("injected");
      expect(h.transfers).toHaveLength(1);
      expect(h.transfers[0]).toMatchObject({ reason: "platform-margin", amountCredits: 10 });
      vi.setSystemTime(new Date("2026-10-12T10:01:30Z"));
      await expect(h.runtime.voiceAdmissionGate.complete({ ...request, outcome: "interrupted" }))
        .resolves.toMatchObject({ verifiedSeconds: 30 });
      expect(h.transfers).toHaveLength(2);
      expect(h.transfers[1]).toMatchObject({ reason: "refund", amountCredits: 40 });
      expect(h.events).toEqual([]);
      await h.runtime.voiceAdmissionGate.complete(request);
      expect(h.transfers).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it("acknowledges a settled admission retry without posting again and fences other accounts", async () => {
    const h = voiceLifecycleHarness({ platform: true,
      startedAt: new Date(Date.now() - 30_000).toISOString() });
    const request = { authorizationHeader: "Bearer test", admissionId: h.admission().admissionId,
      outcome: "completed" as const };
    await h.runtime.voiceAdmissionGate.complete(request);
    const transfers = h.transfers.length;
    const events = h.events.length;
    await expect(h.runtime.voiceAdmissionGate.complete(request)).resolves.toMatchObject({
      admissionId: request.admissionId, settled: true, alreadySettled: true });
    expect(h.transfers).toHaveLength(transfers);
    expect(h.events).toHaveLength(events);
    h.admission().userId = ownerUserId;
    await expect(h.runtime.voiceAdmissionGate.complete(request)).rejects.toThrow("unavailable");
  });

  it("rejects an inconsistent ownerless quote before posting value", async () => {
    const h = voiceLifecycleHarness({ platform: true, ownerShare: 8000,
      startedAt: new Date(Date.now() - 30_000).toISOString() });
    await expect(h.runtime.voiceAdmissionGate.complete({ authorizationHeader: "Bearer test",
      admissionId: h.admission().admissionId, outcome: "completed" })).rejects.toThrow("inconsistent");
    expect(h.transfers).toEqual([]);
  });
});


describe("paid voice accepted quote recovery", () => {
  const request = { authorizationHeader: "Bearer test", characterId,
    quoteId: "quote_paid_123", accepted: true };
  it("returns the original admission after its accepted quote expires", async () => {
    const order: string[] = [];
    const runtime = paidOrderingHarness(order, { existing: true, expired: true });
    await expect(runtime.paidVoice.start(request)).resolves.toMatchObject({
      admissionId: "operation_existing_voice" });
    expect(order).toEqual(["reserve"]);
  });
  it("returns a settled admission without another reserve transfer", async () => {
    const order: string[] = [];
    const runtime = paidOrderingHarness(order, { existing: true, expired: true, settled: true });
    await expect(runtime.paidVoice.start(request)).resolves.toMatchObject({
      admissionId: "operation_existing_voice" });
    expect(order).toEqual([]);
  });
  it("rejects an expired quote that never obtained an admission", async () => {
    const order: string[] = [];
    const runtime = paidOrderingHarness(order, { expired: true });
    await expect(runtime.paidVoice.start(request)).rejects.toThrow("expired");
    await expect(runtime.paidVoice.start(request)).rejects.toMatchObject({
      statusCode: 410, code: "voice.quote_expired_without_admission" });
    expect(order).toEqual([]);
  });
});
