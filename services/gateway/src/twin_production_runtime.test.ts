import { describe, expect, it } from "vitest";
import { createTwinProductionRuntime } from "./twin_production_runtime.js";

const tenantId = "tenant_00000000-0000-4000-8000-000000000001" as never;
const ownerUserId = "user_00000000-0000-4000-8000-000000000002" as never;
const characterId = "character_00000000-0000-4000-8000-000000000003" as never;

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


const requesterUserId = "user_00000000-0000-4000-8000-000000000006" as never;

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
