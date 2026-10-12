import type { PlatformAgentProfileRepository } from "@masanawa/agents";
import {
  createCanonicalId,
  nowInstant,
  parseCanonicalId,
  type CharacterId,
  type LedgerEntryId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  decideOwnerAccessSettlement,
  decideTwinCommission,
  defaultCommissionPolicy,
  defaultPaidFeatureTrialPolicy,
  evaluatePaidFeatureTrial,
  quoteOwnerAccess,
  quoteTwinVoice,
  reverseCommission,
  settleVerifiedTwinVoiceUsage,
  valueProviderAmount,
  transitionOwnerAccess,
  type CommerceRepository,
  type CommissionPolicy,
  type OwnerAccessPolicy,
  type PaidFeatureKey,
  type ProviderValuationDecision,
  type ProviderValuationPolicy,
  type TwinRuntimeRepository,
  type TwinVoicePricingPolicy,
} from "@masanawa/commerce";
import type {
  PersonalCloneProvisioningRepository,
  TwinProfileRepository,
  TwinPublicProfile,
} from "@masanawa/identity";
import {
  detectCircularTwinEconomyValue,
  guardTwinEconomyOperation,
  normalizeTwinReport,
  type TwinEconomyLimitPolicy,
} from "@masanawa/security";
import type { PlatformCustomerSessionAuthorizer } from "./customer_auth.js";
import {
  createTwinProfileService,
  type TwinProfileService,
} from "./twin_profile.js";
import {
  createTwinDirectoryService,
  type TwinDirectoryService,
} from "./twin_directory.js";
import {
  createMyTwinProjectionService,
  type MyTwinProjectionService,
} from "./my_twin_projection.js";
import {
  createCanonicalMyTwinProfileSource,
} from "./my_twin_projection_sources.js";
import {
  createTwinActivityService,
  type TwinActivityService,
} from "./twin_activity.js";
import {
  createTwinEconomyActivitySource,
} from "./twin_activity_source.js";
import {
  createCanonicalWalletBalanceSource,
  createMergedWalletHistorySource,
  type WalletHistorySubsource,
} from "./wallet_projection_sources.js";
import {
  createTwinEconomyWalletHistorySource,
} from "./wallet_projection_twin_events.js";
import {
  createWalletProjectionService,
  type WalletProjectionService,
} from "./wallet_projection.js";
import {
  createCreditTransferService,
  type CreditTransferService,
} from "./credit_transfer.js";
import {
  createGiftService,
  type GiftService,
} from "./gifts.js";
import {
  createTwinAttributionService,
  createCommissionPolicyAdminService,
  type TwinAttributionService,
} from "./twin_attribution.js";
import {
  createProviderValuationPolicyAdminService,
} from "./provider_valuation_admin.js";
import {
  createPaidVoiceService,
  type PaidVoiceService,
} from "./paid_voice.js";
import {
  createPaidFeatureTrialAdminService,
  type PaidFeatureTrialAdminService,
} from "./paid_feature_trial_admin.js";
import {
  createOwnerAccessService,
  type OwnerAccessService,
} from "./owner_access.js";
import {
  createOwnerAccessOfferingService,
} from "./owner_access_offering.js";
import {
  createTwinSafetyService,
  type TwinSafetyService,
} from "./twin_safety.js";

type EnsuringTwinProfiles = TwinProfileRepository & {
  ensureForOwner(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
    readonly at?: string;
  }): Promise<TwinPublicProfile | null>;
};

export interface TwinProductionEventStore {
  append(input: {
    readonly tenantId: TenantId;
    readonly payload: {
      readonly eventType:
        | "twin.visited"
        | "twin.conversation.observed"
        | "twin.purchase.completed"
        | "twin.purchase.refunded"
        | "twin.gift.completed"
        | "twin.voice.completed"
        | "twin.voice.refunded"
        | "twin.owner-access.requested"
        | "twin.owner-access.accepted"
        | "twin.owner-access.scheduled"
        | "twin.owner-access.completed"
        | "twin.owner-access.refunded"
        | "twin.earning.settled"
        | "twin.earning.reversed";
      readonly ownerUserId: string;
      readonly characterId: string;
      readonly customerUserId: string | null;
      readonly referenceId: string;
      readonly visibility: "owner" | "participant" | "internal";
      readonly occurredAt: string;
      readonly amountCredits: number | null;
      readonly status: "observed" | "pending" | "completed" | "refunded" | "reversed";
    };
  }): Promise<string>;
  listForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly limit: number;
  }): Promise<readonly {
    readonly eventId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly customerUserId: string | null;
    readonly referenceId: string;
    readonly eventType: string;
    readonly occurredAt: string;
    readonly amountCredits: number | null;
    readonly status: "observed" | "pending" | "completed" | "refunded" | "reversed";
  }[]>;
  listForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly limit: number;
  }): Promise<readonly {
    readonly eventId: string;
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly customerUserId: string | null;
    readonly eventType: string;
    readonly occurredAt: string;
    readonly amountCredits: number | null;
  }[]>;
}

export interface TwinProductionRuntime {
  readonly twinProfile: TwinProfileService;
  readonly twinDirectory: TwinDirectoryService;
  readonly myTwin: MyTwinProjectionService;
  readonly twinActivity: TwinActivityService;
  readonly wallet: WalletProjectionService;
  readonly creditTransfer: CreditTransferService;
  readonly gifts: GiftService;
  readonly creditGift?: {
    execute(input: Readonly<{
      tenantId: string;
      requestId: string;
      senderUserId: string;
      recipientUserId: string;
      amountCredits: number;
    }>): Promise<Readonly<{
      giftId: string;
      amountCredits: number;
      status: "completed";
      completedAt: string;
      replayed: boolean;
    }>>;
  };
  readonly twinAttribution: TwinAttributionService;
  readonly commissionAdmin: ReturnType<typeof createCommissionPolicyAdminService>;
  readonly providerValuationAdmin: ReturnType<typeof createProviderValuationPolicyAdminService>;
  readonly paidVoice: PaidVoiceService;
  readonly paidFeatureTrialAdmin: PaidFeatureTrialAdminService;
  readonly ownerAccess: OwnerAccessService;
  readonly ownerAccessOffering: ReturnType<typeof createOwnerAccessOfferingService>;
  readonly ownerAccessDisputes: {
    resolve(input: {
      readonly authorizationHeader: string | undefined;
      readonly characterId: string;
      readonly requestId: string;
      readonly resolution: "release" | "refund";
    }): Promise<import("@masanawa/commerce").OwnerAccessRequest>;
  };
  readonly ownerAccessMaintenance: {
    sweep(input: {
      readonly tenantId: TenantId;
      readonly limit?: number;
    }): Promise<Readonly<{
      scanned: number;
      advanced: number;
      failed: number;
      messagesPurged: number;
    }>>;
  };
  readonly twinSafety: TwinSafetyService;
  readonly voiceAdmissionGate: {
    validate(input: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly characterId: CharacterId;
      readonly admissionId: string | null;
    }): Promise<void>;
    tokenIssued(input: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly characterId: CharacterId;
      readonly admissionId: string | null;
    }): Promise<void>;
    mediaStarted(input: {
      readonly authorizationHeader: string | undefined;
      readonly admissionId: string;
    }): Promise<Readonly<Record<string, unknown>>>;
    complete(input: {
      readonly authorizationHeader: string | undefined;
      readonly admissionId: string;
      readonly outcome: "completed" | "interrupted";
    }): Promise<Readonly<Record<string, unknown>>>;
  };
  readonly monetization: {
    attribute(input: {
      readonly tenantId: TenantId;
      readonly customerUserId: UserId;
      readonly characterId: CharacterId | null;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly expiresAt?: string | null;
    }): Promise<void>;
    settleProviderValue(input: {
      readonly tenantId: TenantId;
      readonly valuationKey: string;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly sourceUnits: number;
    }): Promise<ProviderValuationDecision>;
    settle(input: {
      readonly tenantId: TenantId;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly baseCredits: number;
    }): Promise<void>;
    reverse(input: {
      readonly tenantId: TenantId;
      readonly operationId: string;
      readonly reversalId: string;
      readonly reversalBaseCredits: number;
    }): Promise<void>;
    reverseFull(input: {
      readonly tenantId: TenantId;
      readonly operationId: string;
      readonly reversalId: string;
    }): Promise<void>;
  };
}

function at(): string {
  return new Date().toISOString();
}

function plusMs(value: string, ms: number): string {
  return new Date(Date.parse(value) + ms).toISOString();
}

function sessionAuthorizer(sessions: PlatformCustomerSessionAuthorizer) {
  return {
    async authorize(input: { readonly authorizationHeader: string | undefined }) {
      return sessions.authorize({ authorizationHeader: input.authorizationHeader });
    },
  };
}

function account(
  tenantId: TenantId,
  kind:
    | "customer-credit"
    | "fulfillment-reserve"
    | "pending-earnings"
    | "available-earnings"
    | "platform-revenue",
  userId: UserId | null,
  characterId: CharacterId | null,
) {
  return Object.freeze({ tenantId, kind, userId, characterId });
}

async function ensurePlan(
  repository: TwinRuntimeRepository,
  input: {
    readonly tenantId: TenantId;
    readonly planKey: string;
    readonly roles: readonly { readonly role: string; readonly amountCredits: number }[];
    readonly createdAt?: string;
    readonly voiceSettlement?: import("@masanawa/commerce").TwinLedgerPlan["voiceSettlement"];
  },
) {
  const existing = await repository.readLedgerPlan({
    tenantId: input.tenantId,
    planKey: input.planKey,
  });
  if (existing) return existing;
  return repository.putLedgerPlan({
    tenantId: input.tenantId,
    plan: Object.freeze({
      planKey: input.planKey,
      entries: Object.freeze(
        input.roles.map((entry) =>
          Object.freeze({
            ...entry,
            ledgerEntryId: createCanonicalId("ledger-entry"),
          }),
        ),
      ),
      createdAt: input.createdAt ?? at(),
      ...(input.voiceSettlement ? { voiceSettlement: input.voiceSettlement } : {}),
    }),
  });
}

function planEntry(
  plan: Awaited<ReturnType<typeof ensurePlan>>,
  role: string,
  amountCredits: number,
): LedgerEntryId | null {
  if (amountCredits === 0) return null;
  const entry = plan.entries.find((candidate) => candidate.role === role);
  if (!entry || entry.amountCredits !== amountCredits) {
    throw new Error(`Twin ledger plan mismatch for ${role}`);
  }
  return entry.ledgerEntryId;
}

function defaultLimitPolicy(
  operation: TwinEconomyLimitPolicy["operation"],
): TwinEconomyLimitPolicy {
  const maxAmount =
    operation === "paid-voice" || operation === "owner-access"
      ? 1_000_000
      : 100_000_000;
  return Object.freeze({
    revision: 1,
    operation,
    enabled: true,
    minAmountCredits: operation === "external-funding-attribution" ||
      operation === "purchase-attribution" ? 0 : 1,
    maxAmountCredits: maxAmount,
    maxOperationsPerHour: 30,
    maxOperationsPerDay: 200,
  });
}

export function createTwinProductionRuntime(input: {
  readonly sessions: PlatformCustomerSessionAuthorizer;
  readonly profiles: EnsuringTwinProfiles;
  readonly platformProfiles?: PlatformAgentProfileRepository;
  readonly economy: TwinRuntimeRepository;
  readonly events: TwinProductionEventStore;
  readonly commerce: CommerceRepository;
  readonly personalClones: PersonalCloneProvisioningRepository;
  readonly publicTwinBaseUrl: string;
  readonly adminPrincipals: ReadonlySet<string>;
  readonly voice: {
    readonly unitSeconds: number;
    readonly priceCreditsPerUnit: number;
    readonly ownerShareBasisPoints: number;
  };
  readonly ownerAccess: {
    readonly platformFeeBasisPoints: number;
    readonly acceptWithinMinutes: number;
    readonly startGraceMinutes: number;
    readonly completionGraceMinutes?: number;
    readonly messageRetentionDays?: number;
    readonly disputeWindowMinutes?: number;
  };
  readonly notifications?: {
    send(input: {
      readonly scope: {
        readonly tenantId: TenantId;
        readonly userId: UserId;
      };
      readonly title: string;
      readonly body: string;
      readonly data?: Readonly<Record<string, string>>;
    }): Promise<unknown>;
  };
}): TwinProductionRuntime {
  const customer = sessionAuthorizer(input.sessions);

  const customerAuthority = {
    async authorize(request: { readonly authorizationHeader: string | undefined }) {
      const identity = await customer.authorize(request);
      return Object.freeze({
        tenantId: identity.tenantId,
        userId: identity.userId,
      });
    },
  };

  async function notifyUser(
    tenantId: TenantId,
    userId: UserId,
    title: string,
    body: string,
    deepLink: string,
  ): Promise<void> {
    if (!input.notifications) return;
    await input.notifications.send({
      scope: { tenantId, userId },
      title,
      body,
      data: { deepLink },
    }).catch(() => undefined);
  }

  const adminAuthority = {
    async authorize(request: { readonly authorizationHeader: string | undefined }) {
      const identity = await customer.authorize(request);
      const principals = [
        String(identity.userId),
        identity.profile.email?.trim().toLowerCase() ?? "",
        identity.profile.phone?.trim() ?? "",
      ].filter(Boolean);
      if (!principals.some((value) => input.adminPrincipals.has(value))) {
        throw Object.assign(new Error("Admin capability required"), { statusCode: 403 });
      }
      return Object.freeze({ tenantId: identity.tenantId });
    },
  };

  const profileStore = {
    async readForOwner(request: {
      readonly tenantId: TenantId;
      readonly ownerUserId: UserId;
    }) {
      return input.profiles.ensureForOwner({ ...request, at: at() });
    },
    update: input.profiles.update.bind(input.profiles),
  };

  const twinProfile = createTwinProfileService({
    authorizer: customerAuthority,
    store: profileStore,
  });

  const twinDirectory = createTwinDirectoryService({
    authorizer: customerAuthority,
    source: {
      async search(request) {
        const records = await input.profiles.searchPublic(request);
        return Object.freeze(
          records.map((record) =>
            Object.freeze({
              tenantId: record.tenantId,
              characterId: record.characterId,
              publicId: record.publicId,
              displayName: record.displayName,
              headline: record.bio,
              avatarUrl: record.avatarUrl,
              discoverable: record.discoverable,
            }),
          ),
        );
      },
      async findByPublicId(request) {
        const record = await input.profiles.readPublicById(request);
        return record
          ? Object.freeze({
              tenantId: record.tenantId,
              characterId: record.characterId,
              publicId: record.publicId,
              displayName: record.displayName,
              headline: record.bio,
              avatarUrl: record.avatarUrl,
              discoverable: record.discoverable,
            })
          : null;
      },
    },
    visibility: {
      async canDiscover(request) {
        return !await input.economy.isTwinBlocked({
          tenantId: request.tenantId,
          actorUserId: request.userId,
          characterId: request.characterId,
        });
      },
    },
  });

  const activityEventReader = {
    async listForCharacter(request: {
      readonly tenantId: string;
      readonly characterId: string;
      readonly limit: number;
    }) {
      const rows = await input.events.listForCharacter({
        tenantId: request.tenantId as TenantId,
        characterId: request.characterId as CharacterId,
        limit: request.limit,
      });
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            eventId: row.eventId,
            referenceId: row.referenceId,
            tenantId: request.tenantId,
            characterId: row.characterId,
            eventType: row.eventType as never,
            occurredAt: row.occurredAt,
            amountCredits: row.amountCredits,
            status: row.status,
          }),
        ),
      );
    },
  };

  const activitySource = createTwinEconomyActivitySource({
    events: activityEventReader,
  });

  const twinActivity = createTwinActivityService({
    authorizer: customerAuthority,
    personalClones: input.personalClones,
    source: activitySource,
  });

  const myTwinProfile = createCanonicalMyTwinProfileSource({
    store: {
      async readForOwner(request) {
        return input.profiles.ensureForOwner({
          tenantId: request.tenantId as TenantId,
          ownerUserId: request.ownerUserId as UserId,
          at: at(),
        });
      },
      async update(request) {
        return input.profiles.update({
          tenantId: request.tenantId as TenantId,
          ownerUserId: request.ownerUserId as UserId,
          characterId: request.characterId as CharacterId,
          expectedRevision: request.expectedRevision,
          patch: request.patch,
          updatedAt: request.updatedAt as never,
        });
      },
    },
    now: at,
  });

  const myTwin = createMyTwinProjectionService({
    authorizer: customerAuthority,
    profiles: myTwinProfile,
    performance: {
      async read(request) {
        const rows = await activitySource.listForTwin({
          tenantId: request.tenantId as TenantId,
          characterId: request.characterId as CharacterId,
          limit: 200,
        });
        let visitors = 0;
        let conversations = 0;
        let earningsCredits = 0;
        let pendingOwnerRequests = 0;
        const seenOwnerRequests = new Set<string>();
        for (const row of rows) {
          if (row.kind === "visit") visitors += 1;
          if (row.kind === "conversation") conversations += 1;
          if (row.kind === "earning" && row.status === "completed") {
            earningsCredits += row.amountCredits ?? 0;
          }
          if (
            row.kind === "owner-request" &&
            !seenOwnerRequests.has(row.referenceId)
          ) {
            seenOwnerRequests.add(row.referenceId);
            if (row.status === "pending") pendingOwnerRequests += 1;
          }
        }
        return Object.freeze({
          visitors,
          conversations,
          earningsCredits,
          pendingOwnerRequests,
        });
      },
    },
    features: {
      async read(request) {
        const offering = await input.economy.readOwnerAccessOffering({
          tenantId: request.tenantId as TenantId,
          ownerUserId: request.ownerUserId as UserId,
        });
        return Object.freeze({
          voiceEnabled: true,
          ownerAccessEnabled:
            offering?.characterId === request.characterId &&
            offering.enabled === true,
        });
      },
    },
    publicTwinBaseUrl: input.publicTwinBaseUrl,
  });

  const twinEventWalletSource = createTwinEconomyWalletHistorySource({
    events: {
      async listForOwner(request) {
        const rows = await input.events.listForUser({
          tenantId: request.tenantId as TenantId,
          userId: request.userId as UserId,
          limit: request.limit,
        });
        return Object.freeze(
          rows
            .filter(
              (row) =>
                row.ownerUserId === request.userId &&
                row.amountCredits !== null &&
                [
                  "twin.purchase.completed",
                  "twin.purchase.refunded",
                  "twin.gift.completed",
                  "twin.voice.completed",
                  "twin.voice.refunded",
                  "twin.owner-access.completed",
                  "twin.owner-access.refunded",
                  "twin.earning.settled",
                  "twin.earning.reversed",
                ].includes(row.eventType),
            )
            .map((row) =>
              Object.freeze({
                eventId: row.eventId,
                tenantId: request.tenantId,
                ownerUserId: row.ownerUserId,
                eventType: row.eventType as never,
                occurredAt: row.occurredAt,
                amountCredits: row.amountCredits!,
              }),
            ),
        );
      },
    },
  });

  const creditHistory: WalletHistorySubsource = {
    async list(request) {
      const rows = await input.economy.listCreditOperationsForUser({
        tenantId: request.tenantId as TenantId,
        userId: request.userId as UserId,
        limit: request.limit,
      });
      return Object.freeze(
        rows.map((row) => {
          const incoming = row.recipientUserId === request.userId;
          const kind =
            row.kind === "gift"
              ? "gift" as const
              : incoming
                ? "transfer-received" as const
                : "transfer-sent" as const;
          return Object.freeze({
            id: row.requestId,
            kind,
            title:
              row.kind === "gift"
                ? incoming ? "Gift received" : "Gift sent"
                : incoming ? "Credits received" : "Credits sent",
            amountCredits: row.amountCredits,
            incoming,
            createdAt: row.completedAt,
          });
        }),
      );
    },
  };

  const wallet = createWalletProjectionService({
    authorizer: customerAuthority,
    balances: createCanonicalWalletBalanceSource({
      commerce: input.commerce,
      personalClones: input.personalClones,
    }),
    history: createMergedWalletHistorySource({
      sources: [creditHistory, twinEventWalletSource],
    }),
  });

  async function guardMoney(request: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly recipientUserId: UserId;
    readonly amountCredits: number;
    readonly operation: "credit-transfer" | "gift";
  }) {
    const now = new Date();
    const [hour, day, edges] = await Promise.all([
      input.economy.countOperations({
        tenantId: request.tenantId,
        actorUserId: request.actorUserId,
        operation: request.operation,
        since: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      }),
      input.economy.countOperations({
        tenantId: request.tenantId,
        actorUserId: request.actorUserId,
        operation: request.operation,
        since: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      }),
      input.economy.listRecentTransferEdges({
        tenantId: request.tenantId,
        since: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        limit: 1000,
      }),
    ]);
    const decision = guardTwinEconomyOperation({
      policy: defaultLimitPolicy(request.operation),
      attempt: {
        operation: request.operation,
        amountCredits: request.amountCredits,
        actor: {
          actorUserId: request.actorUserId,
          recipientUserId: request.recipientUserId,
        },
        operationsLastHour: hour,
        operationsLastDay: day,
      },
    });
    if (!decision.allowed) throw new Error(`Twin economy blocked: ${decision.reason}`);
    const cycle = detectCircularTwinEconomyValue({
      actorUserId: request.actorUserId,
      recipientUserId: request.recipientUserId,
      recentEdges: edges,
      now: now.toISOString(),
    });
    if (cycle.suspicious) {
      throw new Error(`Twin economy circular value blocked: ${cycle.reason}`);
    }
  }

  async function executeCreditMove(request: {
    readonly tenantId: TenantId;
    readonly requestId: string;
    readonly kind: "transfer" | "gift";
    readonly senderUserId: UserId;
    readonly recipientUserId: UserId;
    readonly characterId: CharacterId | null;
    readonly amountCredits: number;
  }) {
    const existing = await input.economy.readCreditOperation({
      tenantId: request.tenantId,
      requestId: request.requestId,
    });
    if (existing) {
      if (
        existing.kind !== request.kind ||
        existing.senderUserId !== request.senderUserId ||
        existing.recipientUserId !== request.recipientUserId ||
        existing.amountCredits !== request.amountCredits ||
        existing.characterId !== request.characterId
      ) {
        throw new Error("Credit operation idempotency conflict");
      }
      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: existing.ledgerEntryId,
        tenantId: request.tenantId,
        debit: account(request.tenantId, "customer-credit", request.senderUserId, null),
        credit: account(request.tenantId, "customer-credit", request.recipientUserId, null),
        amountCredits: request.amountCredits,
        reason: "adjustment",
        quoteId: null,
        fulfillmentId: null,
        createdAt: existing.completedAt as never,
      });
      return Object.freeze({ receipt: existing, replayed: true as const });
    }

    const planKey = `credit:${request.kind}:${request.requestId}`;
    let plan = await input.economy.readLedgerPlan({
      tenantId: request.tenantId,
      planKey,
    });
    if (!plan) {
      plan = await input.economy.putLedgerPlan({
        tenantId: request.tenantId,
        plan: Object.freeze({
          planKey,
          entries: Object.freeze([
            Object.freeze({
              ledgerEntryId: createCanonicalId("ledger-entry"),
              role: "credit-move",
              amountCredits: request.amountCredits,
            }),
          ]),
          createdAt: at(),
        }),
      });
    }
    const entry = plan.entries[0];
    if (
      !entry ||
      entry.role !== "credit-move" ||
      entry.amountCredits !== request.amountCredits
    ) {
      throw new Error("Credit operation ledger plan conflict");
    }

    await input.commerce.postTransfer({
      schemaVersion: 1,
      ledgerEntryId: entry.ledgerEntryId,
      tenantId: request.tenantId,
      debit: account(request.tenantId, "customer-credit", request.senderUserId, null),
      credit: account(request.tenantId, "customer-credit", request.recipientUserId, null),
      amountCredits: request.amountCredits,
      reason: "adjustment",
      quoteId: null,
      fulfillmentId: null,
      createdAt: plan.createdAt as never,
    });

    const receipt = await input.economy.recordCreditOperation({
      tenantId: request.tenantId,
      requestId: request.requestId,
      kind: request.kind,
      senderUserId: request.senderUserId,
      recipientUserId: request.recipientUserId,
      characterId: request.characterId,
      amountCredits: request.amountCredits,
      ledgerEntryId: entry.ledgerEntryId,
      completedAt: plan.createdAt,
    });
    return Object.freeze({ receipt, replayed: false as const });
  }

  const creditTransfer = createCreditTransferService({
    authorizer: customerAuthority,
    recipients: {
      async resolve(request) {
        const userId = await input.economy.resolveUserByRecipient({
          tenantId: request.tenantId as TenantId,
          recipient: request.recipient,
        });
        if (!userId) throw new Error("Credit recipient not found");
        return Object.freeze({ recipientUserId: userId });
      },
    },
    guard: {
      async assertAllowed(request) {
        await guardMoney({
          tenantId: request.tenantId as TenantId,
          actorUserId: request.senderUserId as UserId,
          recipientUserId: request.recipientUserId as UserId,
          amountCredits: request.amountCredits,
          operation: "credit-transfer",
        });
      },
    },
    executor: {
      async execute(request) {
        const { receipt } = await executeCreditMove({
          tenantId: request.tenantId as TenantId,
          requestId: request.requestId,
          kind: "transfer",
          senderUserId: request.senderUserId as UserId,
          recipientUserId: request.recipientUserId as UserId,
          characterId: null,
          amountCredits: request.amountCredits,
        });
        return Object.freeze({
          transferId: receipt.ledgerEntryId,
          amountCredits: receipt.amountCredits,
          status: "completed" as const,
          completedAt: receipt.completedAt,
        });
      },
    },
  });

  const gifts = createGiftService({
    authorizer: customerAuthority,
    recipients: {
      async resolveByCharacter(request) {
        const owner = await input.economy.readOwnerForCharacter({
          tenantId: request.tenantId as TenantId,
          characterId: request.characterId as CharacterId,
        });
        if (!owner) throw new Error("Twin owner not found");
        return Object.freeze({
          recipientUserId: owner,
          characterId: request.characterId,
        });
      },
    },
    guard: {
      async assertAllowed(request) {
        await guardMoney({
          tenantId: request.tenantId as TenantId,
          actorUserId: request.senderUserId as UserId,
          recipientUserId: request.recipientUserId as UserId,
          amountCredits: request.amountCredits,
          operation: "gift",
        });
      },
    },
    executor: {
      async execute(request) {
        const { receipt, replayed } = await executeCreditMove({
          tenantId: request.tenantId as TenantId,
          requestId: request.requestId,
          kind: "gift",
          senderUserId: request.senderUserId as UserId,
          recipientUserId: request.recipientUserId as UserId,
          characterId: request.recipientCharacterId as CharacterId,
          amountCredits: request.amountCredits,
        });
        if (!replayed) await input.events.append({
          tenantId: request.tenantId as TenantId,
          payload: {
            eventType: "twin.gift.completed",
            ownerUserId: request.recipientUserId,
            characterId: request.recipientCharacterId,
            customerUserId: request.senderUserId,
            referenceId: request.requestId,
            visibility: "owner",
            occurredAt: receipt.completedAt,
            amountCredits: receipt.amountCredits,
            status: "completed",
          },
        });
        return Object.freeze({
          giftId: receipt.ledgerEntryId,
          amountCredits: receipt.amountCredits,
          status: "completed" as const,
          completedAt: receipt.completedAt,
        });
      },
    },
  });

  const creditGift = Object.freeze({
    async execute(request: Readonly<{
      tenantId: string;
      requestId: string;
      senderUserId: string;
      recipientUserId: string;
      amountCredits: number;
    }>) {
      if (request.senderUserId === request.recipientUserId) {
        throw new Error("Cannot gift yourself");
      }
      const tenantId = request.tenantId as TenantId;
      const senderUserId = request.senderUserId as UserId;
      const recipientUserId = request.recipientUserId as UserId;
      await guardMoney({
        tenantId,
        actorUserId: senderUserId,
        recipientUserId,
        amountCredits: request.amountCredits,
        operation: "gift",
      });
      const { receipt, replayed } = await executeCreditMove({
        tenantId,
        requestId: request.requestId,
        kind: "gift",
        senderUserId,
        recipientUserId,
        characterId: null,
        amountCredits: request.amountCredits,
      });
      return Object.freeze({
        giftId: receipt.ledgerEntryId,
        amountCredits: receipt.amountCredits,
        status: "completed" as const,
        completedAt: receipt.completedAt,
        replayed,
      });
    },
  });

  async function activeCommissionPolicy(
    tenantId: TenantId,
    eventType: "external-funding" | "commerce-purchase",
    when = at(),
  ): Promise<CommissionPolicy> {
    return (
      (await input.economy.readCommissionPolicy({ tenantId, eventType, at: when })) ??
      defaultCommissionPolicy({ eventType, effectiveAt: when })
    );
  }

  const twinAttribution = createTwinAttributionService({
    authorizer: customerAuthority,
    quotes: {
      async quote(request) {
        const eventType = request.attribution.eventType;
        if (eventType !== "external-funding" && eventType !== "commerce-purchase") {
          return Object.freeze({
            eligible: false,
            reason: "event-not-eligible",
            policyRevision: 0,
            baseCredits: request.baseCredits,
            commissionCredits: 0,
          });
        }
        const policy = await activeCommissionPolicy(
          request.tenantId as TenantId,
          eventType,
          request.attribution.attributedAt,
        );
        return decideTwinCommission({
          attribution: {
            ...request.attribution,
            policyRevision: policy.revision,
          },
          policy,
          baseCredits: request.baseCredits,
          now: at(),
        });
      },
    },
  });

  const commissionAdmin = createCommissionPolicyAdminService({
    authorizer: adminAuthority,
    store: {
      async readActive(request) {
        const value = await input.economy.readCommissionPolicy({
          tenantId: request.tenantId as TenantId,
          eventType: request.eventType,
          at: at(),
        });
        return value
          ? Object.freeze({
              eventType: value.eventType,
              revision: value.revision,
              enabled: value.enabled,
              rateBasisPoints: value.rateBasisPoints,
              minimumCommissionCredits: value.minimumCommissionCredits,
              maximumCommissionCredits: value.maximumCommissionCredits,
              effectiveAt: value.effectiveAt,
            })
          : null;
      },
      async putRevision(request) {
        const current = await input.economy.readCommissionPolicy({
          tenantId: request.tenantId as TenantId,
          eventType: request.eventType,
          at: "9999-12-31T23:59:59.999Z",
        });
        const policy: CommissionPolicy = {
          schemaVersion: 1,
          revision: (current?.revision ?? 0) + 1,
          enabled: request.enabled,
          eventType: request.eventType,
          rateBasisPoints: request.rateBasisPoints,
          minimumCommissionCredits: request.minimumCommissionCredits,
          maximumCommissionCredits: request.maximumCommissionCredits,
          effectiveAt: request.effectiveAt,
        };
        const value = await input.economy.putCommissionPolicy({
          tenantId: request.tenantId as TenantId,
          policy,
        });
        return Object.freeze({
          eventType: value.eventType,
          revision: value.revision,
          enabled: value.enabled,
          rateBasisPoints: value.rateBasisPoints,
          minimumCommissionCredits: value.minimumCommissionCredits,
          maximumCommissionCredits: value.maximumCommissionCredits,
          effectiveAt: value.effectiveAt,
        });
      },
    },
  });

  const providerValuationAdmin = createProviderValuationPolicyAdminService({
    authorizer: adminAuthority,
    store: {
      async readActive(request) {
        const value = await input.economy.readProviderValuationPolicy({
          tenantId: request.tenantId as TenantId,
          valuationKey: request.valuationKey,
          eventType: request.eventType,
          at: at(),
        });
        return value
          ? Object.freeze({
              valuationKey: value.valuationKey,
              eventType: value.eventType,
              revision: value.revision,
              enabled: value.enabled,
              sourceUnit: value.sourceUnit,
              sourceUnitsPerStep: value.sourceUnitsPerStep,
              creditUnitsPerStep: value.creditUnitsPerStep,
              minimumSourceUnits: value.minimumSourceUnits,
              maximumBaseCredits: value.maximumBaseCredits,
              effectiveAt: value.effectiveAt,
            })
          : null;
      },
      async putRevision(request) {
        const current = await input.economy.readProviderValuationPolicy({
          tenantId: request.tenantId as TenantId,
          valuationKey: request.valuationKey,
          eventType: request.eventType,
          at: "9999-12-31T23:59:59.999Z",
        });
        const policy: ProviderValuationPolicy = {
          schemaVersion: 1,
          revision: (current?.revision ?? 0) + 1,
          enabled: request.enabled,
          valuationKey: request.valuationKey,
          eventType: request.eventType,
          sourceUnit: request.sourceUnit,
          sourceUnitsPerStep: request.sourceUnitsPerStep,
          creditUnitsPerStep: request.creditUnitsPerStep,
          minimumSourceUnits: request.minimumSourceUnits,
          maximumBaseCredits: request.maximumBaseCredits,
          effectiveAt: request.effectiveAt,
        };
        return input.economy.putProviderValuationPolicy({
          tenantId: request.tenantId as TenantId,
          policy,
        });
      },
    },
  });

  async function trialPolicy(tenantId: TenantId, feature: PaidFeatureKey) {
    return (
      (await input.economy.readTrialPolicy({ tenantId, feature, at: at() })) ??
      defaultPaidFeatureTrialPolicy(feature, at())
    );
  }

  const paidFeatureTrialAdmin = createPaidFeatureTrialAdminService({
    authorizer: adminAuthority,
    store: {
      async readActive(request) {
        const value = await input.economy.readTrialPolicy({
          tenantId: request.tenantId as TenantId,
          feature: request.feature,
          at: at(),
        });
        return value
          ? Object.freeze({
              feature: value.feature,
              revision: value.revision,
              enabled: value.enabled,
              durationDays: value.durationDays,
              maxUnits: value.maxUnits,
              effectiveAt: value.createdAt,
            })
          : null;
      },
      async putRevision(request) {
        const current = await input.economy.readTrialPolicy({
          tenantId: request.tenantId as TenantId,
          feature: request.feature,
          at: "9999-12-31T23:59:59.999Z",
        });
        const value = await input.economy.putTrialPolicy({
          tenantId: request.tenantId as TenantId,
          policy: {
            schemaVersion: 1,
            feature: request.feature,
            revision: (current?.revision ?? 0) + 1,
            enabled: request.enabled,
            durationDays: request.durationDays,
            maxUnits: request.maxUnits,
            createdAt: request.effectiveAt,
          },
        });
        return Object.freeze({
          feature: value.feature,
          revision: value.revision,
          enabled: value.enabled,
          durationDays: value.durationDays,
          maxUnits: value.maxUnits,
          effectiveAt: value.createdAt,
        });
      },
    },
  });

  const paidVoice = createPaidVoiceService({
    authorizer: customerAuthority,
    pricing: {
      async quote(request) {
        const owner = await input.economy.readOwnerForCharacter({
          tenantId: request.tenantId,
          characterId: request.characterId,
        });
        if (!owner) {
          const platform = await input.platformProfiles?.readForCharacter(request);
          if (!platform || platform.tenantId !== request.tenantId ||
              platform.characterId !== request.characterId ||
              platform.voiceProvider.toLowerCase() !== "gemini" || !platform.voiceName.trim()) {
            throw new Error("Masana voice is unavailable");
          }
        }
        const policy = await trialPolicy(request.tenantId, "twin-voice");
        const usage = await input.economy.readTrialUsage({
          tenantId: request.tenantId,
          userId: request.userId,
          feature: "twin-voice",
        });
        const voicePolicy: TwinVoicePricingPolicy = {
          schemaVersion: 1,
          revision: policy.revision,
          active: true,
          unitSeconds: input.voice.unitSeconds,
          priceCreditsPerUnit: input.voice.priceCreditsPerUnit,
          ownerShareBasisPoints: owner ? input.voice.ownerShareBasisPoints : 0,
          trial: policy,
        };
        const quote = quoteTwinVoice({
          policy: voicePolicy,
          usage: {
            trialStartedAt: usage.startedAt,
            trialConsumedUnits: usage.consumedUnits,
          },
          expectedSeconds: request.expectedSeconds,
          now: at(),
        });
        const quoteId = createCanonicalId("quote");
        const createdAt = at();
        const record = await input.economy.putVoiceQuote({
          tenantId: request.tenantId,
          userId: request.userId,
          ownerUserId: owner,
          quoteId,
          characterId: request.characterId,
          policyRevision: quote.policyRevision,
          trialPolicyRevision: quote.trial.policyRevision,
          chargeMode: quote.chargeMode,
          trialDurationDays: quote.trialDurationDays,
          trialStartsAt: quote.trial.startsAt,
          trialExpiresAt: quote.trial.expiresAt,
          estimatedSeconds: request.expectedSeconds,
          estimatedPriceCredits: quote.estimatedPriceCredits,
          spendCapCredits: quote.estimatedPriceCredits,
          ownerShareBasisPoints: quote.ownerShareBasisPoints,
          unitSeconds: voicePolicy.unitSeconds,
          priceCreditsPerUnit: voicePolicy.priceCreditsPerUnit,
          quoteExpiresAt: plusMs(createdAt, 10 * 60 * 1000),
          createdAt,
        });
        return Object.freeze({
          quoteId: record.quoteId,
          characterId: record.characterId,
          policyRevision: record.policyRevision,
          trialPolicyRevision: record.trialPolicyRevision,
          chargeMode: record.chargeMode,
          trialDurationDays: record.trialDurationDays,
          trialStartsAt: record.trialStartsAt,
          trialExpiresAt: record.trialExpiresAt,
          estimatedSeconds: record.estimatedSeconds,
          estimatedPriceCredits: record.estimatedPriceCredits,
          spendCapCredits: record.spendCapCredits,
          ownerShareBasisPoints: record.ownerShareBasisPoints,
          quoteExpiresAt: record.quoteExpiresAt,
        });
      },
    },
    admissions: {
      async admit(request) {
        const quote = await input.economy.readVoiceQuote({
          tenantId: request.tenantId,
          quoteId: request.quoteId,
        });
        if (
          !quote || quote.tenantId !== request.tenantId || quote.quoteId !== request.quoteId ||
          quote.userId !== request.userId ||
          quote.characterId !== request.characterId
        ) {
          throw new Error("Paid voice quote is unavailable or expired");
        }
        const existing = await input.economy.readVoiceAdmissionByQuote({
          tenantId: request.tenantId,
          quoteId: quote.quoteId,
        });
        if (existing) {
          if (existing.tenantId !== request.tenantId || existing.userId !== request.userId ||
              existing.characterId !== request.characterId || existing.quoteId !== quote.quoteId) {
            throw new Error("Paid voice admission is unavailable");
          }
          if (
            existing.settledAt === null && existing.reservationLedgerEntryId &&
            existing.chargeMode === "paid" &&
            existing.spendCapCredits > 0
          ) {
            const reservePlan = await input.economy.readLedgerPlan({
              tenantId: request.tenantId,
              planKey: `voice-reserve:${quote.quoteId}`,
            });
            if (
              reservePlan &&
              planEntry(reservePlan, "reserve", existing.spendCapCredits) !==
                existing.reservationLedgerEntryId
            ) {
              throw new Error("Voice reservation ledger plan conflict");
            }
            await input.commerce.postTransfer({
              schemaVersion: 1,
              ledgerEntryId: existing.reservationLedgerEntryId,
              tenantId: request.tenantId,
              debit: account(request.tenantId, "customer-credit", request.userId, null),
              credit: account(request.tenantId, "fulfillment-reserve", request.userId, request.characterId),
              amountCredits: existing.spendCapCredits,
              reason: "fulfillment-reserve",
              quoteId: quote.quoteId as never,
              fulfillmentId: null,
              createdAt: (reservePlan?.createdAt ?? existing.admittedAt) as never,
            });
          }
          return Object.freeze({
            admissionId: existing.admissionId,
            quoteId: existing.quoteId,
            characterId: existing.characterId,
            chargeMode: existing.chargeMode,
            admittedAt: existing.admittedAt,
            expiresAt: existing.expiresAt,
            spendCapCredits: existing.spendCapCredits,
          });
        }
        if (!Number.isFinite(Date.parse(quote.quoteExpiresAt)) ||
            Date.parse(quote.quoteExpiresAt) <= Date.now()) {
          throw Object.assign(new Error("Paid voice quote is unavailable or expired"), {
            statusCode: 410, code: "voice.quote_expired_without_admission",
          });
        }
        const admissionId = createCanonicalId("operation");
        const admittedAt = at();
        let reservationLedgerEntryId: LedgerEntryId | null = null;
        if (quote.chargeMode === "paid" && quote.spendCapCredits > 0) {
          const reservePlan = await ensurePlan(input.economy, {
            tenantId: request.tenantId,
            planKey: `voice-reserve:${quote.quoteId}`,
            roles: [{ role: "reserve", amountCredits: quote.spendCapCredits }],
          });
          reservationLedgerEntryId = planEntry(
            reservePlan,
            "reserve",
            quote.spendCapCredits,
          );
          await input.commerce.postTransfer({
            schemaVersion: 1,
            ledgerEntryId: reservationLedgerEntryId!,
            tenantId: request.tenantId,
            debit: account(request.tenantId, "customer-credit", request.userId, null),
            credit: account(request.tenantId, "fulfillment-reserve", request.userId, request.characterId),
            amountCredits: quote.spendCapCredits,
            reason: "fulfillment-reserve",
            quoteId: quote.quoteId as never,
            fulfillmentId: null,
            createdAt: reservePlan.createdAt as never,
          });
        }
        const admission = await input.economy.putVoiceAdmission({
          tenantId: request.tenantId,
          userId: request.userId,
          ownerUserId: quote.ownerUserId,
          admissionId,
          quoteId: quote.quoteId,
          characterId: quote.characterId,
          chargeMode: quote.chargeMode,
          admittedAt,
          startedAt: null,
          expiresAt: plusMs(admittedAt, Math.max(60_000, quote.estimatedSeconds * 1000 + 120_000)),
          spendCapCredits: quote.spendCapCredits,
          reservationLedgerEntryId,
          settledAt: null,
        });
        return Object.freeze({
          admissionId: admission.admissionId,
          quoteId: admission.quoteId,
          characterId: admission.characterId,
          chargeMode: admission.chargeMode,
          admittedAt: admission.admittedAt,
          expiresAt: admission.expiresAt,
          spendCapCredits: admission.spendCapCredits,
        });
      },
    },
  });

  const ownerPolicy: OwnerAccessPolicy = {
    schemaVersion: 1,
    revision: 1,
    enabled: true,
    minDurationMinutes: 5,
    maxDurationMinutes: 240,
    minPriceCredits: 0,
    maxPriceCredits: 1_000_000_000,
    platformFeeBasisPoints: input.ownerAccess.platformFeeBasisPoints,
    acceptWithinMinutes: input.ownerAccess.acceptWithinMinutes,
    startGraceMinutes: input.ownerAccess.startGraceMinutes,
  };

  const ownerCompletionGraceMinutes =
    input.ownerAccess.completionGraceMinutes ??
    input.ownerAccess.startGraceMinutes;
  const ownerMessageRetentionDays =
    input.ownerAccess.messageRetentionDays ?? 30;
  const ownerDisputeWindowMinutes =
    input.ownerAccess.disputeWindowMinutes ?? 24 * 60;

  const ownerAccessOffering = createOwnerAccessOfferingService({
    authorizer: customerAuthority,
    bounds: {
      allowedDurationsMinutes: Object.freeze([5, 10, 15, 30, 45, 60, 90, 120]),
      minPriceCreditsPerMinute: 0,
      maxPriceCreditsPerMinute: 1_000_000,
    },
    store: {
      async read(request) {
        const value = await input.economy.readOwnerAccessOffering({
          tenantId: request.tenantId as TenantId,
          ownerUserId: request.ownerUserId as UserId,
        });
        return value
          ? Object.freeze({
              enabled: value.enabled,
              modalities: value.modalities,
              durationOptionsMinutes: value.durationOptionsMinutes,
              priceCreditsPerMinute: value.priceCreditsPerMinute,
              revision: value.revision,
            })
          : null;
      },
      async putRevision(request) {
        const clone = await input.personalClones.readPersonalClone({
          tenantId: request.tenantId as TenantId,
          userId: request.ownerUserId as UserId,
        });
        if (!clone) throw new Error("Personal Twin is required");
        const current = await input.economy.readOwnerAccessOffering({
          tenantId: request.tenantId as TenantId,
          ownerUserId: request.ownerUserId as UserId,
        });
        const value = await input.economy.putOwnerAccessOffering({
          tenantId: request.tenantId as TenantId,
          offering: {
            schemaVersion: 1,
            ownerUserId: request.ownerUserId,
            characterId: clone.characterId,
            revision: (current?.revision ?? 0) + 1,
            enabled: request.enabled,
            modalities: request.modalities,
            durationOptionsMinutes: request.durationOptionsMinutes,
            priceCreditsPerMinute: request.priceCreditsPerMinute,
          },
        });
        return Object.freeze({
          enabled: value.enabled,
          modalities: value.modalities,
          durationOptionsMinutes: value.durationOptionsMinutes,
          priceCreditsPerMinute: value.priceCreditsPerMinute,
          revision: value.revision,
        });
      },
    },
  });

  type PersistedOwnerAccessRequest = NonNullable<
    Awaited<ReturnType<TwinRuntimeRepository["readOwnerAccessRequest"]>>
  >;

  async function ownerAccessAttendance(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<Readonly<{
    attendanceVerified: boolean;
    verifiedSeconds: number;
    presence: readonly {
      readonly userId: UserId;
      readonly firstSeenAt: string;
      readonly lastSeenAt: string;
      readonly heartbeatCount: number;
    }[];
  }>> {
    if (current.modality !== "text") {
      return Object.freeze({
        attendanceVerified: false,
        verifiedSeconds: 0,
        presence: Object.freeze([]),
      });
    }
    const presence = await input.economy.listOwnerAccessPresence({
      tenantId,
      requestId: current.requestId,
    });
    const requester = presence.find(
      (item) => item.userId === current.requesterUserId,
    );
    const owner = presence.find(
      (item) => item.userId === current.ownerUserId,
    );
    if (
      !requester ||
      !owner ||
      requester.heartbeatCount < 2 ||
      owner.heartbeatCount < 2
    ) {
      return Object.freeze({
        attendanceVerified: false,
        verifiedSeconds: 0,
        presence,
      });
    }
    const overlapStart = Math.max(
      Date.parse(requester.firstSeenAt),
      Date.parse(owner.firstSeenAt),
    );
    const overlapEnd = Math.min(
      Date.parse(requester.lastSeenAt),
      Date.parse(owner.lastSeenAt),
    );
    const verifiedSeconds = Math.max(
      0,
      Math.floor((overlapEnd - overlapStart) / 1000),
    );
    return Object.freeze({
      attendanceVerified: verifiedSeconds >= 60,
      verifiedSeconds,
      presence,
    });
  }

  async function settleOwnerRequest(
    tenantId: TenantId,
    current: Awaited<ReturnType<TwinRuntimeRepository["readOwnerAccessRequest"]>>,
    nextState: import("@masanawa/commerce").OwnerAccessState,
  ) {
    if (!current) throw new Error("Owner access request not found");
    const attendance =
      nextState === "completed"
        ? await ownerAccessAttendance(tenantId, current)
        : {
            attendanceVerified: false,
            verifiedSeconds: 0,
            presence: [] as const,
          };
    const decision = decideOwnerAccessSettlement({
      state: nextState,
      chargeMode: current.chargeMode,
      reservedCredits: current.reservedCredits,
      ownerEarningCredits: current.ownerEarningCredits,
      platformFeeCredits: current.platformFeeCredits,
      attendanceVerified: attendance.attendanceVerified,
      completionVerified:
        nextState === "completed" && attendance.attendanceVerified,
    });
    if (decision.disposition === "reconcile") {
      throw new Error("Owner access requires reconciliation");
    }
    if (decision.disposition === "refund" && decision.refundCredits > 0) {
      const plan = await ensurePlan(input.economy, {
        tenantId,
        planKey: `owner-access-refund:${current.requestId}`,
        roles: [{ role: "refund", amountCredits: decision.refundCredits }],
      });
      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: planEntry(plan, "refund", decision.refundCredits)!,
        tenantId,
        debit: account(tenantId, "fulfillment-reserve", current.requesterUserId as UserId, current.originatingCharacterId as CharacterId),
        credit: account(tenantId, "customer-credit", current.requesterUserId as UserId, null),
        amountCredits: decision.refundCredits,
        reason: "refund",
        quoteId: null,
        fulfillmentId: null,
        createdAt: plan.createdAt as never,
      });
    }
    if (
      decision.disposition === "settle" &&
      current.chargeMode === "paid" &&
      current.reservedCredits > 0
    ) {
      const plan = await ensurePlan(input.economy, {
        tenantId,
        planKey: `owner-access-settle:${current.requestId}`,
        roles: [
          { role: "owner", amountCredits: decision.ownerEarningCredits },
          { role: "platform", amountCredits: decision.platformRevenueCredits },
        ].filter((entry) => entry.amountCredits > 0),
      });
      if (decision.ownerEarningCredits > 0) {
        await input.commerce.postTransfer({
          schemaVersion: 1,
          ledgerEntryId: planEntry(plan, "owner", decision.ownerEarningCredits)!,
          tenantId,
          debit: account(tenantId, "fulfillment-reserve", current.requesterUserId as UserId, current.originatingCharacterId as CharacterId),
          credit: account(tenantId, "pending-earnings", current.ownerUserId as UserId, null),
          amountCredits: decision.ownerEarningCredits,
          reason: "creator-earning",
          quoteId: null,
          fulfillmentId: null,
          createdAt: plan.createdAt as never,
        });
      }
      if (decision.platformRevenueCredits > 0) {
        await input.commerce.postTransfer({
          schemaVersion: 1,
          ledgerEntryId: planEntry(plan, "platform", decision.platformRevenueCredits)!,
          tenantId,
          debit: account(tenantId, "fulfillment-reserve", current.requesterUserId as UserId, current.originatingCharacterId as CharacterId),
          credit: account(tenantId, "platform-revenue", null, null),
          amountCredits: decision.platformRevenueCredits,
          reason: "platform-margin",
          quoteId: null,
          fulfillmentId: null,
          createdAt: plan.createdAt as never,
        });
      }
    }
    if (
      decision.disposition === "settle" &&
      current.chargeMode === "trial" &&
      decision.trialUnitsConsumed > 0
    ) {
      await input.economy.consumeTrialUsage({
        tenantId,
        userId: current.requesterUserId as UserId,
        feature: "owner-access",
        policyRevision: current.trialPolicyRevision,
        idempotencyKey: current.requestId,
        units: decision.trialUnitsConsumed,
        consumedAt: at(),
      });
    }
    return decision;
  }

  async function releaseOwnerAccessEarnings(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<PersistedOwnerAccessRequest> {
    if (
      current.chargeMode !== "paid" ||
      current.ownerEarningCredits <= 0 ||
      current.earningsReleasedAt
    ) {
      return current;
    }

    let releasing = current;
    if (current.state === "settled") {
      const claimedState = {
        ...current,
        state: transitionOwnerAccess(current.state, "releasing"),
      };
      const claimed = await input.economy.transitionOwnerAccessRequest({
        tenantId,
        expectedState: "settled",
        request: claimedState,
        reservationId: current.reservationId,
        reservedCredits: current.reservedCredits,
      });
      if (!claimed.applied) return claimed.request;
      releasing = claimed.request;
    } else if (current.state !== "releasing") {
      return current;
    }

    const plan = await ensurePlan(input.economy, {
      tenantId,
      planKey: `owner-access-earnings-release:${current.requestId}`,
      roles: [{ role: "release", amountCredits: current.ownerEarningCredits }],
    });
    await input.commerce.postTransfer({
      schemaVersion: 1,
      ledgerEntryId: planEntry(
        plan,
        "release",
        current.ownerEarningCredits,
      )!,
      tenantId,
      debit: account(
        tenantId,
        "pending-earnings",
        current.ownerUserId as UserId,
        null,
      ),
      credit: account(
        tenantId,
        "available-earnings",
        current.ownerUserId as UserId,
        null,
      ),
      amountCredits: current.ownerEarningCredits,
      reason: "earning-settlement",
      quoteId: null,
      fulfillmentId: null,
      createdAt: plan.createdAt as never,
    });
    const changed = {
      ...releasing,
      state: transitionOwnerAccess(releasing.state, "settled"),
      earningsReleasedAt: plan.createdAt,
    };
    const finalized = await input.economy.transitionOwnerAccessRequest({
      tenantId,
      expectedState: "releasing",
      request: changed,
      reservationId: releasing.reservationId,
      reservedCredits: releasing.reservedCredits,
    });
    if (!finalized.applied) return finalized.request;
    await input.events.append({
      tenantId,
      payload: {
        eventType: "twin.earning.settled",
        ownerUserId: current.ownerUserId,
        characterId: current.originatingCharacterId,
        customerUserId: current.requesterUserId,
        referenceId: current.requestId,
        visibility: "owner",
        occurredAt: plan.createdAt,
        amountCredits: current.ownerEarningCredits,
        status: "completed",
      },
    });
    await notifyUser(
      tenantId,
      current.ownerUserId as UserId,
      "Earnings available",
      `${current.ownerEarningCredits} Credits from a completed human session are now available.`,
      "masanawa://activity",
    );
    return finalized.request;
  }

  async function refundDisputedOwnerAccess(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<PersistedOwnerAccessRequest> {
    if (current.state !== "disputed" || current.chargeMode !== "paid") {
      throw new Error("Owner access dispute is not refundable");
    }
    const roles = [
      { role: "owner-refund", amountCredits: current.ownerEarningCredits },
      { role: "platform-refund", amountCredits: current.platformFeeCredits },
    ].filter((entry) => entry.amountCredits > 0);
    const plan = await ensurePlan(input.economy, {
      tenantId,
      planKey: `owner-access-dispute-refund:${current.requestId}`,
      roles,
    });
    if (current.ownerEarningCredits > 0) {
      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: planEntry(
          plan,
          "owner-refund",
          current.ownerEarningCredits,
        )!,
        tenantId,
        debit: account(
          tenantId,
          "pending-earnings",
          current.ownerUserId as UserId,
          null,
        ),
        credit: account(
          tenantId,
          "customer-credit",
          current.requesterUserId as UserId,
          null,
        ),
        amountCredits: current.ownerEarningCredits,
        reason: "refund",
        quoteId: null,
        fulfillmentId: null,
        createdAt: plan.createdAt as never,
      });
    }
    if (current.platformFeeCredits > 0) {
      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: planEntry(
          plan,
          "platform-refund",
          current.platformFeeCredits,
        )!,
        tenantId,
        debit: account(tenantId, "platform-revenue", null, null),
        credit: account(
          tenantId,
          "customer-credit",
          current.requesterUserId as UserId,
          null,
        ),
        amountCredits: current.platformFeeCredits,
        reason: "refund",
        quoteId: null,
        fulfillmentId: null,
        createdAt: plan.createdAt as never,
      });
    }
    const changed = {
      ...current,
      state: transitionOwnerAccess(current.state, "refunded"),
      disputeResolvedAt: plan.createdAt,
      disputeResolution: "refund" as const,
    };
    const claimed = await input.economy.transitionOwnerAccessRequest({
      tenantId,
      expectedState: "disputed",
      request: changed,
      reservationId: current.reservationId,
      reservedCredits: current.reservedCredits,
    });
    if (!claimed.applied) return claimed.request;
    await input.events.append({
      tenantId,
      payload: {
        eventType: "twin.owner-access.refunded",
        ownerUserId: current.ownerUserId,
        characterId: current.originatingCharacterId,
        customerUserId: current.requesterUserId,
        referenceId: current.requestId,
        visibility: "participant",
        occurredAt: plan.createdAt,
        amountCredits: current.priceCredits,
        status: "refunded",
      },
    });
    return claimed.request;
  }

  async function appendOwnerAccessProjectionEvent(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<void> {
    const event =
      current.state === "accepted"
        ? {
            eventType: "twin.owner-access.accepted" as const,
            amountCredits: null,
            status: "pending" as const,
          }
        : current.state === "scheduled"
          ? {
              eventType: "twin.owner-access.scheduled" as const,
              amountCredits: null,
              status: "pending" as const,
            }
          : current.state === "settled"
            ? {
                eventType: "twin.owner-access.completed" as const,
                amountCredits: current.ownerEarningCredits,
                status: "completed" as const,
              }
            : current.state === "refunded"
              ? {
                  eventType: "twin.owner-access.refunded" as const,
                  amountCredits: current.reservedCredits,
                  status: "refunded" as const,
                }
              : null;
    if (!event) return;
    await input.events.append({
      tenantId,
      payload: {
        eventType: event.eventType,
        ownerUserId: current.ownerUserId,
        characterId: current.originatingCharacterId,
        customerUserId: current.requesterUserId,
        referenceId: current.requestId,
        visibility: "participant",
        occurredAt: at(),
        amountCredits: event.amountCredits,
        status: event.status,
      },
    });
  }

  async function finalizeOwnerAccessState(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<PersistedOwnerAccessRequest> {
    const attendanceTimeoutRefund =
      current.state === "disputed" &&
      current.reconciliationReason === "attendance-timeout";
    const refundable = new Set([
      "declined",
      "expired",
      "cancelled",
      "no-show",
    ]);
    const isRefund =
      refundable.has(current.state) || attendanceTimeoutRefund;
    const isSettlement = current.state === "completed";
    if (!isRefund && !isSettlement) {
      await appendOwnerAccessProjectionEvent(tenantId, current);
      return current;
    }

    await settleOwnerRequest(
      tenantId,
      current,
      attendanceTimeoutRefund ? "no-show" : current.state,
    );
    const finalState = isSettlement ? "settled" : "refunded";
    const completedAt =
      isSettlement ? current.completedAt ?? at() : current.completedAt;
    const finalized = {
      ...current,
      state: transitionOwnerAccess(current.state, finalState),
      completedAt,
      disputeBy:
        isSettlement &&
        current.chargeMode === "paid" &&
        current.ownerEarningCredits > 0
          ? plusMs(
              completedAt!,
              ownerDisputeWindowMinutes * 60_000,
            )
          : null,
      disputedAt: current.disputedAt ?? null,
      disputeReason: current.disputeReason ?? null,
      earningsReleasedAt: current.earningsReleasedAt ?? null,
      disputeResolvedAt: current.disputeResolvedAt ?? null,
      disputeResolution: current.disputeResolution ?? null,
    };
    // Append before the final CAS. The event store is idempotent by
    // eventType/reference/Character, so a crash can safely retry this step.
    await input.events.append({
      tenantId,
      payload: {
        eventType: isSettlement
          ? "twin.owner-access.completed"
          : "twin.owner-access.refunded",
        ownerUserId: current.ownerUserId,
        characterId: current.originatingCharacterId,
        customerUserId: current.requesterUserId,
        referenceId: current.requestId,
        visibility: "participant",
        occurredAt: at(),
        amountCredits: isSettlement
          ? current.ownerEarningCredits
          : current.reservedCredits,
        status: isSettlement ? "completed" : "refunded",
      },
    });
    const result = await input.economy.transitionOwnerAccessRequest({
      tenantId,
      expectedState: current.state,
      request: finalized,
      reservationId: current.reservationId,
      reservedCredits: current.reservedCredits,
    });
    return result.request;
  }

  async function refreshOwnerAccessLifecycle(
    tenantId: TenantId,
    current: PersistedOwnerAccessRequest,
  ): Promise<PersistedOwnerAccessRequest> {
    if (current.state === "releasing") {
      return releaseOwnerAccessEarnings(tenantId, current);
    }

    if (
      current.state === "declined" ||
      current.state === "expired" ||
      current.state === "cancelled" ||
      current.state === "no-show" ||
      current.state === "completed" ||
      (current.state === "disputed" &&
        current.reconciliationReason === "attendance-timeout")
    ) {
      return finalizeOwnerAccessState(tenantId, current);
    }

    const nowMs = Date.now();

    if (
      current.state === "settled" &&
      current.chargeMode === "paid" &&
      current.ownerEarningCredits > 0 &&
      !current.earningsReleasedAt
    ) {
      let settled = current;
      if (!settled.disputeBy) {
        const base = settled.completedAt ?? settled.requestedAt;
        const changed = {
          ...settled,
          disputeBy: plusMs(
            base,
            ownerDisputeWindowMinutes * 60_000,
          ),
        };
        const claimed = await input.economy.transitionOwnerAccessRequest({
          tenantId,
          expectedState: "settled",
          request: changed,
          reservationId: settled.reservationId,
          reservedCredits: settled.reservedCredits,
        });
        if (!claimed.applied) {
          return refreshOwnerAccessLifecycle(tenantId, claimed.request);
        }
        settled = claimed.request;
      }
      if (
        settled.disputeBy &&
        Date.parse(settled.disputeBy) <= nowMs
      ) {
        return releaseOwnerAccessEarnings(tenantId, settled);
      }
      return settled;
    }

    const activeTimedOut =
      current.state === "active" &&
      current.startedAt !== null &&
      Date.parse(current.startedAt) +
          (current.durationMinutes + ownerCompletionGraceMinutes) * 60_000 <=
        nowMs;

    if (activeTimedOut) {
      const attendance = await ownerAccessAttendance(tenantId, current);
      const nextState = attendance.attendanceVerified
        ? "completed"
        : "disputed";
      const intermediate = {
        ...current,
        state: transitionOwnerAccess(current.state, nextState),
        completedAt:
          nextState === "completed" ? at() : current.completedAt,
        ...(nextState === "disputed"
          ? { reconciliationReason: "attendance-timeout" as const }
          : {}),
      };
      const claimed = await input.economy.transitionOwnerAccessRequest({
        tenantId,
        expectedState: current.state,
        request: intermediate,
        reservationId: current.reservationId,
        reservedCredits: current.reservedCredits,
      });
      if (!claimed.applied) {
        return refreshOwnerAccessLifecycle(tenantId, claimed.request);
      }
      const finalized = await finalizeOwnerAccessState(
        tenantId,
        claimed.request,
      );
      await notifyUser(
        tenantId,
        current.requesterUserId as UserId,
        attendance.attendanceVerified
          ? "Human session completed"
          : "Human session refunded",
        attendance.attendanceVerified
          ? "Verified attendance was recorded and the session was completed."
          : "Attendance could not be verified before the session window ended. Any eligible held Credits were returned.",
        `masanawa://chat/${encodeURIComponent(current.originatingCharacterId)}`,
      );
      return finalized;
    }

    const requestedExpired =
      current.state === "requested" &&
      Date.parse(current.acceptBy) <= nowMs;
    const scheduledNoShow =
      current.state === "scheduled" &&
      current.scheduledFor !== null &&
      Date.parse(current.scheduledFor) +
          ownerPolicy.startGraceMinutes * 60_000 <=
        nowMs;

    if (!requestedExpired && !scheduledNoShow) {
      await appendOwnerAccessProjectionEvent(tenantId, current);
      return current;
    }

    const terminalState = requestedExpired ? "expired" : "no-show";
    const intermediate = {
      ...current,
      state: transitionOwnerAccess(current.state, terminalState),
    };
    const claimed = await input.economy.transitionOwnerAccessRequest({
      tenantId,
      expectedState: current.state,
      request: intermediate,
      reservationId: current.reservationId,
      reservedCredits: current.reservedCredits,
    });
    if (!claimed.applied) {
      return refreshOwnerAccessLifecycle(tenantId, claimed.request);
    }

    const finalized = await finalizeOwnerAccessState(
      tenantId,
      claimed.request,
    );
    await notifyUser(
      tenantId,
      current.requesterUserId as UserId,
      requestedExpired ? "Talk request expired" : "Talk session missed",
      requestedExpired
        ? "The owner did not accept in time. Any eligible held Credits were released."
        : "The scheduled session did not start in time. Any eligible held Credits were released.",
      `masanawa://chat/${encodeURIComponent(current.originatingCharacterId)}`,
    );
    return finalized;
  }

  const ownerAccessMaintenance = Object.freeze({
    async sweep(request: {
      readonly tenantId: TenantId;
      readonly limit?: number;
    }) {
      const limit = Math.max(1, Math.min(200, request.limit ?? 100));
      const candidates =
        await input.economy.listOwnerAccessLifecycleCandidates({
          tenantId: request.tenantId,
          at: at(),
          startGraceMinutes: ownerPolicy.startGraceMinutes,
          completionGraceMinutes: ownerCompletionGraceMinutes,
          limit,
        });
      let advanced = 0;
      let failed = 0;
      for (const candidate of candidates) {
        try {
          const before = candidate.state;
          const after = await refreshOwnerAccessLifecycle(
            request.tenantId,
            candidate,
          );
          if (after.state !== before) advanced += 1;
        } catch {
          // One malformed/reconciling request must not starve the bounded batch.
          failed += 1;
        }
      }
      let messagesPurged = 0;
      try {
        messagesPurged =
          await input.economy.purgeExpiredOwnerAccessMessages({
            tenantId: request.tenantId,
            at: at(),
            limit: 500,
          });
      } catch {
        failed += 1;
      }
      return Object.freeze({
        scanned: candidates.length,
        advanced,
        failed,
        messagesPurged,
      });
    },
  });


  const ownerAccess = createOwnerAccessService({
    authorizer: customerAuthority,
    quotes: {
      async quote(request) {
        const owner = await input.economy.readOwnerForCharacter({
          tenantId: request.tenantId,
          characterId: request.characterId,
        });
        if (!owner || owner === request.requesterUserId) {
          throw new Error("Owner access is unavailable");
        }
        const offering = await input.economy.readOwnerAccessOffering({
          tenantId: request.tenantId,
          ownerUserId: owner,
        });
        if (
          !offering ||
          offering.characterId !== request.characterId ||
          !offering.enabled ||
          !offering.modalities.includes(request.modality) ||
          !offering.durationOptionsMinutes.includes(request.durationMinutes)
        ) {
          throw new Error("Owner access offering is unavailable");
        }
        const trial = await trialPolicy(request.tenantId, "owner-access");
        const usage = await input.economy.readTrialUsage({
          tenantId: request.tenantId,
          userId: request.requesterUserId,
          feature: "owner-access",
        });
        const decision = evaluatePaidFeatureTrial({
          policy: trial,
          usage,
          requestedUnits: 1,
          now: at(),
        });
        const requestId = createCanonicalId("request");
        const quote = quoteOwnerAccess({
          policy: ownerPolicy,
          requestId,
          ownerUserId: owner,
          originatingCharacterId: request.characterId,
          modality: request.modality,
          durationMinutes: request.durationMinutes,
          requestedPriceCredits:
            request.durationMinutes * offering.priceCreditsPerMinute,
          chargeMode: decision.eligible ? "trial" : "paid",
          trialDurationDays: trial.durationDays,
          trialPolicyRevision: trial.revision,
          quoteExpiresAt: plusMs(at(), 10 * 60 * 1000),
        });
        await input.economy.putOwnerAccessQuote({
          tenantId: request.tenantId,
          requesterUserId: request.requesterUserId,
          quote,
          createdAt: at(),
        });
        return quote;
      },
    },
    requests: {
      async createFromQuote(request) {
        const stored = await input.economy.readOwnerAccessQuote({
          tenantId: request.tenantId,
          quoteId: request.quoteId,
        });
        if (
          !stored ||
          stored.requesterUserId !== request.requesterUserId ||
          stored.originatingCharacterId !== request.characterId ||
          stored.modality !== "text" ||
          Date.parse(stored.quoteExpiresAt) <= Date.now()
        ) {
          throw new Error("Owner access quote is unavailable or expired");
        }
        const existing = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: stored.requestId,
        });
        if (existing) {
          if (
            existing.reservationId &&
            existing.chargeMode === "paid" &&
            existing.reservedCredits > 0
          ) {
            const reservePlan = await input.economy.readLedgerPlan({
              tenantId: request.tenantId,
              planKey: `owner-access-reserve:${existing.requestId}`,
            });
            if (
              reservePlan &&
              planEntry(reservePlan, "reserve", existing.reservedCredits) !==
                existing.reservationId
            ) {
              throw new Error("Owner access reservation ledger plan conflict");
            }
            await input.commerce.postTransfer({
              schemaVersion: 1,
              ledgerEntryId: existing.reservationId as LedgerEntryId,
              tenantId: request.tenantId,
              debit: account(request.tenantId, "customer-credit", request.requesterUserId, null),
              credit: account(request.tenantId, "fulfillment-reserve", request.requesterUserId, request.characterId),
              amountCredits: existing.reservedCredits,
              reason: "fulfillment-reserve",
              quoteId: null,
              fulfillmentId: null,
              createdAt: (reservePlan?.createdAt ?? existing.requestedAt) as never,
            });
          }
          await input.events.append({
            tenantId: request.tenantId,
            payload: {
              eventType: "twin.owner-access.requested",
              ownerUserId: existing.ownerUserId,
              characterId: existing.originatingCharacterId,
              customerUserId: existing.requesterUserId,
              referenceId: existing.requestId,
              visibility: "owner",
              occurredAt: existing.requestedAt,
              amountCredits: null,
              status: "pending",
            },
          });
          return existing;
        }
        const requestedAt = at();
        const reservedCredits =
          stored.chargeMode === "paid" ? stored.priceCredits : 0;
        let reservationId: LedgerEntryId | null = null;
        if (reservedCredits > 0) {
          const reservePlan = await ensurePlan(input.economy, {
            tenantId: request.tenantId,
            planKey: `owner-access-reserve:${stored.requestId}`,
            roles: [{ role: "reserve", amountCredits: reservedCredits }],
          });
          reservationId = planEntry(reservePlan, "reserve", reservedCredits);
          await input.commerce.postTransfer({
            schemaVersion: 1,
            ledgerEntryId: reservationId!,
            tenantId: request.tenantId,
            debit: account(request.tenantId, "customer-credit", request.requesterUserId, null),
            credit: account(request.tenantId, "fulfillment-reserve", request.requesterUserId, request.characterId),
            amountCredits: reservedCredits,
            reason: "fulfillment-reserve",
            quoteId: null,
            fulfillmentId: null,
            createdAt: reservePlan.createdAt as never,
          });
        }
        const record = await input.economy.putOwnerAccessRequest({
          tenantId: request.tenantId,
          request: {
            requestId: stored.requestId,
            requesterUserId: request.requesterUserId,
            ownerUserId: stored.ownerUserId,
            originatingCharacterId: stored.originatingCharacterId,
            modality: stored.modality,
            durationMinutes: stored.durationMinutes,
            priceCredits: stored.priceCredits,
            platformFeeCredits: stored.platformFeeCredits,
            ownerEarningCredits: stored.ownerEarningCredits,
            chargeMode: stored.chargeMode,
            trialPolicyRevision: stored.trialPolicyRevision,
            state: "requested",
            requestedAt,
            acceptBy: plusMs(requestedAt, ownerPolicy.acceptWithinMinutes * 60_000),
            scheduledFor: null,
            startedAt: null,
            completedAt: null,
          },
          reservationId,
          reservedCredits,
        });
        await input.events.append({
          tenantId: request.tenantId,
          payload: {
            eventType: "twin.owner-access.requested",
            ownerUserId: stored.ownerUserId,
            characterId: stored.originatingCharacterId,
            customerUserId: request.requesterUserId,
            referenceId: stored.requestId,
            visibility: "owner",
            occurredAt: requestedAt,
            amountCredits: null,
            status: "pending",
          },
        });
        await notifyUser(
          request.tenantId,
          stored.ownerUserId as UserId,
          "New talk request",
          `Someone wants to talk with you for ${stored.durationMinutes} minutes.`,
          "masanawa://activity",
        );
        return record;
      },

      async act(request) {
        let current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (!current || current.originatingCharacterId !== request.characterId) {
          throw new Error("Owner access request not found");
        }
        const ownerAction = [
          "accept",
          "decline",
          "schedule",
          "start",
          "complete",
        ].includes(request.action);
        if (ownerAction && current.ownerUserId !== request.actorUserId) {
          throw Object.assign(new Error("Owner action required"), {
            statusCode: 403,
          });
        }
        if (
          (request.action === "cancel" || request.action === "dispute") &&
          current.requesterUserId !== request.actorUserId
        ) {
          throw Object.assign(new Error("Requester action required"), {
            statusCode: 403,
          });
        }

        // Resolve any already-due lifecycle transition before accepting a user
        // action. This prevents an owner from accepting after the acceptance
        // deadline simply because the periodic sweep has not run yet.
        current = await refreshOwnerAccessLifecycle(
          request.tenantId,
          current,
        );

        if (
          request.action === "start" &&
          current.modality !== "text"
        ) {
          throw new Error(
            "Human voice/video sessions are not available in this build",
          );
        }
        if (request.action === "complete") {
          const attendance = await ownerAccessAttendance(
            request.tenantId,
            current,
          );
          if (!attendance.attendanceVerified) {
            throw new Error(
              "Owner access cannot complete before both participants have verified attendance",
            );
          }
        }
        if (request.action === "dispute") {
          if (
            current.state !== "settled" ||
            current.chargeMode !== "paid" ||
            current.earningsReleasedAt ||
            !current.disputeBy ||
            Date.parse(current.disputeBy) <= Date.now()
          ) {
            throw new Error("Owner access dispute window is closed");
          }
          if (!request.disputeReason) {
            throw new Error("Owner access dispute reason is required");
          }
        }
        const next: import("@masanawa/commerce").OwnerAccessRequest["state"] =
          request.action === "accept" ? "accepted" :
          request.action === "decline" ? "declined" :
          request.action === "schedule" ? "scheduled" :
          request.action === "start" ? "active" :
          request.action === "complete" ? "completed" :
          request.action === "dispute" ? "disputed" : "cancelled";
        transitionOwnerAccess(current.state, next);
        if (
          request.action === "schedule" &&
          (!request.scheduledFor ||
            Date.parse(request.scheduledFor) <= Date.now())
        ) {
          throw new Error("scheduledFor must be in the future");
        }

        const changed = {
          ...current,
          state: next,
          scheduledFor:
            request.action === "schedule"
              ? new Date(request.scheduledFor!).toISOString()
              : current.scheduledFor,
          startedAt: request.action === "start" ? at() : current.startedAt,
          completedAt:
            request.action === "complete" ? at() : current.completedAt,
          disputedAt:
            request.action === "dispute" ? at() : current.disputedAt ?? null,
          disputeReason:
            request.action === "dispute"
              ? request.disputeReason!
              : current.disputeReason ?? null,
        };
        const claimed = await input.economy.transitionOwnerAccessRequest({
          tenantId: request.tenantId,
          expectedState: current.state,
          request: changed,
          reservationId: current.reservationId,
          reservedCredits: current.reservedCredits,
        });
        if (!claimed.applied) {
          throw Object.assign(
            new Error("Owner access request changed; refresh and try again"),
            { statusCode: 409 },
          );
        }

        let updated = claimed.request;
        if (
          next === "declined" ||
          next === "cancelled" ||
          next === "completed"
        ) {
          updated = await finalizeOwnerAccessState(
            request.tenantId,
            claimed.request,
          );
        } else {
          await appendOwnerAccessProjectionEvent(
            request.tenantId,
            claimed.request,
          );
        }

        if (request.action === "cancel") {
          await notifyUser(
            request.tenantId,
            current.ownerUserId as UserId,
            "Talk request cancelled",
            "The requester cancelled this talk request.",
            "masanawa://activity",
          );
        } else if (request.action === "dispute") {
          await notifyUser(
            request.tenantId,
            current.ownerUserId as UserId,
            "Human session disputed",
            "The requester opened a dispute. Earnings remain pending until an administrator resolves it.",
            "masanawa://activity",
          );
        } else {
          const message =
            next === "accepted"
              ? "Your request was accepted."
              : next === "scheduled"
                ? `Your session was scheduled for ${changed.scheduledFor ?? "the agreed time"}.`
                : next === "active"
                  ? "Your talk session has started."
                  : next === "completed"
                    ? "Your talk session was completed."
                    : "Your request ended and any eligible held Credits were released.";
          await notifyUser(
            request.tenantId,
            current.requesterUserId as UserId,
            "Talk request update",
            message,
            next === "active"
              ? `masanawa://owner-session/${encodeURIComponent(current.originatingCharacterId)}/${encodeURIComponent(current.requestId)}`
              : `masanawa://chat/${encodeURIComponent(current.originatingCharacterId)}`,
          );
        }
        return updated;
      },

      async get(request) {
        const current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (!current || current.originatingCharacterId !== request.characterId) return null;
        if (
          current.requesterUserId !== request.actorUserId &&
          current.ownerUserId !== request.actorUserId
        ) {
          throw Object.assign(new Error("Owner access request is private"), { statusCode: 403 });
        }
        return refreshOwnerAccessLifecycle(request.tenantId, current);
      },

      async latestForRequester(request) {
        const current =
          await input.economy.readLatestOwnerAccessRequestForRequester({
            tenantId: request.tenantId,
            requesterUserId: request.requesterUserId,
            characterId: request.characterId,
          });
        if (!current) return null;
        if (
          current.requesterUserId !== request.requesterUserId ||
          current.originatingCharacterId !== request.characterId
        ) {
          throw new Error("Owner access latest-request scope violation");
        }
        return refreshOwnerAccessLifecycle(request.tenantId, current);
      },

      async heartbeat(request) {
        const current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (
          !current ||
          current.originatingCharacterId !== request.characterId ||
          (current.requesterUserId !== request.actorUserId &&
            current.ownerUserId !== request.actorUserId)
        ) {
          throw Object.assign(
            new Error("Owner access room is private"),
            { statusCode: 403 },
          );
        }
        if (current.modality !== "text" || current.state !== "active") {
          throw new Error("Owner access room is not active");
        }
        await input.economy.touchOwnerAccessPresence({
          tenantId: request.tenantId,
          requestId: current.requestId,
          userId: request.actorUserId,
          seenAt: at(),
        });
        const attendance = await ownerAccessAttendance(
          request.tenantId,
          current,
        );
        return Object.freeze({
          attendanceVerified: attendance.attendanceVerified,
          verifiedSeconds: attendance.verifiedSeconds,
          sessionEndsAt: current.startedAt
            ? plusMs(
                current.startedAt,
                (current.durationMinutes + ownerCompletionGraceMinutes) *
                  60_000,
              )
            : null,
          realPersonSession: true as const,
          recordingAllowed: false as const,
          messageRetentionDays: ownerMessageRetentionDays,
          presence: Object.freeze(
            attendance.presence.map((item) =>
              Object.freeze({
                userId: item.userId,
                firstSeenAt: item.firstSeenAt,
                lastSeenAt: item.lastSeenAt,
                heartbeatCount: item.heartbeatCount,
              }),
            ),
          ),
        });
      },

      async listMessages(request) {
        const current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (
          !current ||
          current.originatingCharacterId !== request.characterId ||
          (current.requesterUserId !== request.actorUserId &&
            current.ownerUserId !== request.actorUserId)
        ) {
          throw Object.assign(
            new Error("Owner access room is private"),
            { statusCode: 403 },
          );
        }
        if (
          current.modality !== "text" ||
          ![
            "active",
            "completed",
            "settled",
            "releasing",
            "disputed",
            "refunded",
          ].includes(current.state)
        ) {
          throw new Error("Owner access room is unavailable");
        }
        return input.economy.listOwnerAccessMessages({
          tenantId: request.tenantId,
          requestId: current.requestId,
          limit: request.limit,
        });
      },

      async sendMessage(request) {
        const current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (
          !current ||
          current.originatingCharacterId !== request.characterId ||
          (current.requesterUserId !== request.actorUserId &&
            current.ownerUserId !== request.actorUserId)
        ) {
          throw Object.assign(
            new Error("Owner access room is private"),
            { statusCode: 403 },
          );
        }
        if (current.modality !== "text" || current.state !== "active") {
          throw new Error("Owner access room is not active");
        }
        const sentAt = at();
        return input.economy.appendOwnerAccessMessage({
          tenantId: request.tenantId,
          message: {
            requestId: current.requestId,
            messageId: request.messageId,
            senderUserId: request.actorUserId,
            body: request.body,
            sentAt,
          },
          expiresAt: plusMs(
            sentAt,
            ownerMessageRetentionDays * 24 * 60 * 60 * 1000,
          ),
        });
      },
    },
  });

  const ownerAccessDisputes = Object.freeze({
    async resolve(request: {
      readonly authorizationHeader: string | undefined;
      readonly characterId: string;
      readonly requestId: string;
      readonly resolution: "release" | "refund";
    }) {
      const authority = await adminAuthority.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const characterId = parseCanonicalId("character", request.characterId);
      const current = await input.economy.readOwnerAccessRequest({
        tenantId: authority.tenantId,
        requestId: request.requestId,
      });
      if (
        !current ||
        current.originatingCharacterId !== characterId ||
        current.state !== "disputed" ||
        current.reconciliationReason === "attendance-timeout"
      ) {
        throw new Error("Owner access dispute is unavailable");
      }

      let resolved: PersistedOwnerAccessRequest;
      if (request.resolution === "refund") {
        resolved = await refundDisputedOwnerAccess(
          authority.tenantId,
          current,
        );
      } else {
        const resolvedAt = at();
        const changed = {
          ...current,
          state: transitionOwnerAccess(current.state, "settled"),
          disputeResolvedAt: resolvedAt,
          disputeResolution: "release" as const,
          disputeBy: resolvedAt,
        };
        const claimed = await input.economy.transitionOwnerAccessRequest({
          tenantId: authority.tenantId,
          expectedState: "disputed",
          request: changed,
          reservationId: current.reservationId,
          reservedCredits: current.reservedCredits,
        });
        if (!claimed.applied) {
          throw Object.assign(
            new Error("Owner access dispute changed; refresh and try again"),
            { statusCode: 409 },
          );
        }
        resolved = await releaseOwnerAccessEarnings(
          authority.tenantId,
          claimed.request,
        );
      }

      await notifyUser(
        authority.tenantId,
        current.requesterUserId as UserId,
        request.resolution === "refund"
          ? "Human session refunded"
          : "Human session dispute resolved",
        request.resolution === "refund"
          ? "Your disputed human session was refunded."
          : "Your dispute was reviewed and the session payment was released.",
        "masanawa://chat/" + encodeURIComponent(current.originatingCharacterId),
      );
      await notifyUser(
        authority.tenantId,
        current.ownerUserId as UserId,
        request.resolution === "refund"
          ? "Human session refunded"
          : "Earnings released",
        request.resolution === "refund"
          ? "The disputed session was refunded to the requester."
          : "The dispute was resolved and your session earnings are available.",
        "masanawa://activity",
      );
      return resolved;
    },
  });

  const twinSafety = createTwinSafetyService({
    authorizer: customerAuthority,
    repository: {
      async block(request) {
        await input.economy.blockTwin({
          tenantId: request.tenantId as TenantId,
          actorUserId: request.actorUserId as UserId,
          characterId: request.characterId as CharacterId,
          blockedAt: at(),
        });
        return Object.freeze({ blocked: true as const });
      },
      async unblock(request) {
        await input.economy.unblockTwin({
          tenantId: request.tenantId as TenantId,
          actorUserId: request.actorUserId as UserId,
          characterId: request.characterId as CharacterId,
        });
        return Object.freeze({ blocked: false as const });
      },
      async report(request) {
        const report = normalizeTwinReport({
          reporterUserId: request.reporterUserId,
          characterId: request.characterId,
          reason: request.reason,
          detail: request.detail,
          createdAt: at(),
        });
        const reportId = createCanonicalId("operation");
        await input.economy.reportTwin({
          tenantId: request.tenantId as TenantId,
          reportId,
          reporterUserId: request.reporterUserId as UserId,
          characterId: request.characterId as CharacterId,
          reason: report.reason,
          detail: report.detail,
          createdAt: report.createdAt,
        });
        return Object.freeze({ reportId, status: "submitted" as const });
      },
    },
  });

  const voiceAdmissionGate = {
    async validate(request: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly characterId: CharacterId;
      readonly admissionId: string | null;
    }) {
      const platform = await input.platformProfiles?.readForCharacter(request);
      if (platform?.tenantId === request.tenantId &&
          platform.characterId === request.characterId && platform.supportAgent === true) return;
      if (!request.admissionId) throw new Error("Paid Twin voice admission is required");
      const admission = await input.economy.readVoiceAdmission({
        tenantId: request.tenantId,
        admissionId: request.admissionId,
      });
      if (
        !admission ||
        admission.tenantId !== request.tenantId ||
        admission.admissionId !== request.admissionId ||
        admission.userId !== request.userId ||
        admission.characterId !== request.characterId ||
        admission.settledAt !== null ||
        !Number.isFinite(Date.parse(admission.expiresAt)) ||
        Date.parse(admission.expiresAt) <= Date.now()
      ) {
        throw new Error("Paid Twin voice admission is invalid");
      }
    },

    async tokenIssued(request: {
      readonly tenantId: TenantId;
      readonly userId: UserId;
      readonly characterId: CharacterId;
      readonly admissionId: string | null;
    }) {
      // Minting a Live token proves authorization, not media usage. Billing
      // starts only after the connected client reports Gemini setup complete
      // through mediaStarted below.
      await voiceAdmissionGate.validate(request);
    },

    async mediaStarted(request: {
      readonly authorizationHeader: string | undefined;
      readonly admissionId: string;
    }) {
      const identity = await customer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const admission = await input.economy.readVoiceAdmission({
        tenantId: identity.tenantId,
        admissionId: request.admissionId,
      });
      if (
        !admission ||
        admission.userId !== identity.userId ||
        admission.settledAt !== null ||
        Date.parse(admission.expiresAt) <= Date.now()
      ) {
        throw new Error("Paid Twin voice admission is unavailable");
      }
      const started =
        admission.startedAt === null
          ? await input.economy.markVoiceStarted({
              tenantId: identity.tenantId,
              admissionId: admission.admissionId,
              startedAt: at(),
            })
          : admission;
      return Object.freeze({
        started: true,
        admissionId: started.admissionId,
        startedAt: started.startedAt,
      });
    },

    async complete(request: {
      readonly authorizationHeader: string | undefined;
      readonly admissionId: string;
      readonly outcome: "completed" | "interrupted";
    }) {
      const identity = await customer.authorize({
        authorizationHeader: request.authorizationHeader,
      });
      const admission = await input.economy.readVoiceAdmission({
        tenantId: identity.tenantId,
        admissionId: request.admissionId,
      });
      if (!admission || admission.tenantId !== identity.tenantId ||
          admission.admissionId !== request.admissionId || admission.userId !== identity.userId) {
        throw new Error("Paid Twin voice admission is unavailable");
      }
      if (admission.settledAt !== null) {
        return Object.freeze({ admissionId: admission.admissionId, settled: true,
          alreadySettled: true, settledAt: admission.settledAt });
      }
      const quote = await input.economy.readVoiceQuote({
        tenantId: identity.tenantId,
        quoteId: admission.quoteId,
      });
      if (!quote || quote.tenantId !== identity.tenantId ||
          quote.userId !== admission.userId || quote.characterId !== admission.characterId ||
          quote.ownerUserId !== admission.ownerUserId ||
          (admission.ownerUserId === null && quote.ownerShareBasisPoints !== 0)) {
        throw new Error("Paid Twin voice quote is unavailable or inconsistent");
      }
      const priorPlan = await input.economy.readLedgerPlan({ tenantId: identity.tenantId,
        planKey: `voice-settle:${admission.admissionId}` });
      const stoppedAt = priorPlan?.createdAt ?? at();
      const measuredSeconds =
        admission.startedAt === null
          ? 0
          : Math.max(
              0,
              Math.min(
                quote.estimatedSeconds,
                Math.ceil(
                  (Date.parse(stoppedAt) - Date.parse(admission.startedAt)) / 1000,
                ),
              ),
            );
      const proposedUsage = priorPlan?.voiceSettlement ?? {
        verifiedSeconds: measuredSeconds,
        outcome: admission.startedAt === null ? "failed-before-media" as const : request.outcome,
      };
      const decide = (usage: typeof proposedUsage) => settleVerifiedTwinVoiceUsage({
        admissionId: admission.admissionId,
        outcome: usage.outcome,
        verifiedSeconds: usage.verifiedSeconds,
        trialCovered: admission.chargeMode === "trial",
        unitSeconds: quote.unitSeconds,
        priceCreditsPerUnit: quote.priceCreditsPerUnit,
        ownerShareBasisPoints: quote.ownerShareBasisPoints,
        reservedCredits: admission.spendCapCredits,
      });
      const proposedDecision = decide(proposedUsage);
      if (proposedDecision.disposition === "reconcile") {
        throw new Error("Paid Twin voice requires reconciliation");
      }
      const plan = await ensurePlan(input.economy, {
        tenantId: identity.tenantId,
        planKey: `voice-settle:${admission.admissionId}`,
        createdAt: stoppedAt,
        voiceSettlement: proposedUsage,
        roles: [
          { role: "owner", amountCredits: proposedDecision.ownerEarningCredits },
          { role: "platform", amountCredits: proposedDecision.platformRevenueCredits },
          { role: "refund", amountCredits: proposedDecision.refundCredits },
        ].filter((entry) => entry.amountCredits > 0),
      });
      // Concurrent first attempts reuse the winning persisted plan's usage.
      const usage = plan.voiceSettlement ?? proposedUsage;
      const seconds = usage.verifiedSeconds;
      const decision = decide(usage);
      if (admission.chargeMode === "paid") {
        if (decision.ownerEarningCredits > 0 && admission.ownerUserId !== null) {
          await input.commerce.postTransfer({
            schemaVersion: 1,
            ledgerEntryId: planEntry(plan, "owner", decision.ownerEarningCredits)!,
            tenantId: identity.tenantId,
            debit: account(identity.tenantId, "fulfillment-reserve", identity.userId, admission.characterId),
            credit: account(identity.tenantId, "pending-earnings", admission.ownerUserId, admission.characterId),
            amountCredits: decision.ownerEarningCredits,
            reason: "creator-earning",
            quoteId: null,
            fulfillmentId: null,
            createdAt: plan.createdAt as never,
          });
        }
        if (decision.platformRevenueCredits > 0) {
          await input.commerce.postTransfer({
            schemaVersion: 1,
            ledgerEntryId: planEntry(plan, "platform", decision.platformRevenueCredits)!,
            tenantId: identity.tenantId,
            debit: account(identity.tenantId, "fulfillment-reserve", identity.userId, admission.characterId),
            credit: account(identity.tenantId, "platform-revenue", null, null),
            amountCredits: decision.platformRevenueCredits,
            reason: "platform-margin",
            quoteId: null,
            fulfillmentId: null,
            createdAt: plan.createdAt as never,
          });
        }
        if (decision.refundCredits > 0) {
          await input.commerce.postTransfer({
            schemaVersion: 1,
            ledgerEntryId: planEntry(plan, "refund", decision.refundCredits)!,
            tenantId: identity.tenantId,
            debit: account(identity.tenantId, "fulfillment-reserve", identity.userId, admission.characterId),
            credit: account(identity.tenantId, "customer-credit", identity.userId, null),
            amountCredits: decision.refundCredits,
            reason: "refund",
            quoteId: null,
            fulfillmentId: null,
            createdAt: plan.createdAt as never,
          });
        }
      } else if (decision.trialUnitsConsumed > 0) {
        await input.economy.consumeTrialUsage({
          tenantId: identity.tenantId,
          userId: identity.userId,
          feature: "twin-voice",
          policyRevision: admission.chargeMode === "trial" ? quote.trialPolicyRevision : 0,
          idempotencyKey: admission.admissionId,
          units: decision.trialUnitsConsumed,
          consumedAt: at(),
        });
      }
      await input.economy.markVoiceSettled({
        tenantId: identity.tenantId,
        admissionId: admission.admissionId,
        outcome: usage.outcome,
        verifiedSeconds: seconds,
        settlement: Object.freeze({ ...decision }),
        settledAt: at(),
      });
      const voiceFailedBeforeMedia = usage.outcome === "failed-before-media";
      if (admission.ownerUserId !== null) await input.events.append({
        tenantId: identity.tenantId,
        payload: {
          eventType: voiceFailedBeforeMedia
            ? "twin.voice.refunded"
            : "twin.voice.completed",
          ownerUserId: admission.ownerUserId,
          characterId: admission.characterId,
          customerUserId: identity.userId,
          referenceId: admission.admissionId,
          visibility: "owner",
          occurredAt: at(),
          amountCredits: voiceFailedBeforeMedia
            ? decision.refundCredits
            : decision.ownerEarningCredits,
          status: voiceFailedBeforeMedia ? "refunded" : "completed",
        },
      });
      return Object.freeze({ ...decision, verifiedSeconds: seconds });
    },
  };

  const monetization = {
    async attribute(request: {
      readonly tenantId: TenantId;
      readonly customerUserId: UserId;
      readonly characterId: CharacterId | null;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly expiresAt?: string | null;
    }) {
      if (request.characterId === null) return;
      const owner = await input.economy.readOwnerForCharacter({
        tenantId: request.tenantId,
        characterId: request.characterId,
      });
      if (!owner || owner === request.customerUserId) return;
      const policy = await activeCommissionPolicy(request.tenantId, request.eventType);
      await input.economy.putAttribution({
        tenantId: request.tenantId,
        attribution: {
          attributionId: createCanonicalId("operation"),
          ownerUserId: owner,
          characterId: request.characterId,
          customerUserId: request.customerUserId,
          eventType: request.eventType,
          operationId: request.operationId,
          policyRevision: policy.revision,
          attributedAt: at(),
          expiresAt: request.expiresAt ?? plusMs(at(), 30 * 24 * 60 * 60 * 1000),
          selfAttribution: false,
        },
      });
    },

    async settleProviderValue(request: {
      readonly tenantId: TenantId;
      readonly valuationKey: string;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly sourceUnits: number;
    }) {
      const policy = await input.economy.readProviderValuationPolicy({
        tenantId: request.tenantId,
        valuationKey: request.valuationKey,
        eventType: request.eventType,
        at: at(),
      });
      if (!policy) {
        throw Object.assign(
          new Error("Provider valuation policy is not configured"),
          { statusCode: 409 },
        );
      }
      const decision = valueProviderAmount({
        policy,
        valuationKey: request.valuationKey,
        eventType: request.eventType,
        sourceUnits: request.sourceUnits,
      });
      if (decision.eligible && decision.baseCredits > 0) {
        await monetization.settle({
          tenantId: request.tenantId,
          eventType: request.eventType,
          operationId: request.operationId,
          baseCredits: decision.baseCredits,
        });
      }
      return decision;
    },

    async settle(request: {
      readonly tenantId: TenantId;
      readonly eventType: "external-funding" | "commerce-purchase";
      readonly operationId: string;
      readonly baseCredits: number;
    }) {
      const attribution = await input.economy.readAttributionForOperation({
        tenantId: request.tenantId,
        eventType: request.eventType,
        operationId: request.operationId,
      });
      if (!attribution) return;
      const existing = await input.economy.readCommissionForOperation({
        tenantId: request.tenantId,
        operationId: request.operationId,
      });
      const policy = await activeCommissionPolicy(
        request.tenantId,
        request.eventType,
        attribution.attributedAt,
      );
      const decision = decideTwinCommission({
        attribution,
        policy,
        baseCredits: request.baseCredits,
        now: at(),
      });
      if (!decision.eligible || decision.commissionCredits === 0) return;
      let settlement = existing;
      if (!settlement) {
        const plan = await ensurePlan(input.economy, {
          tenantId: request.tenantId,
          planKey: `commission-settle:${request.operationId}`,
          roles: [{ role: "commission", amountCredits: decision.commissionCredits }],
        });
        const ledgerEntryId = planEntry(
          plan,
          "commission",
          decision.commissionCredits,
        )!;
        await input.commerce.postTransfer({
          schemaVersion: 1,
          ledgerEntryId,
          tenantId: request.tenantId,
          debit: account(request.tenantId, "platform-revenue", null, null),
          credit: account(
            request.tenantId,
            "pending-earnings",
            attribution.ownerUserId as UserId,
            attribution.characterId as CharacterId,
          ),
          amountCredits: decision.commissionCredits,
          reason: "creator-earning",
          quoteId: null,
          fulfillmentId: null,
          createdAt: plan.createdAt as never,
        });
        const settlementId = createCanonicalId("operation");
        await input.economy.recordCommissionSettlement({
          tenantId: request.tenantId,
          settlementId,
          attributionId: attribution.attributionId,
          operationId: request.operationId,
          eventType: request.eventType,
          ownerUserId: attribution.ownerUserId as UserId,
          characterId: attribution.characterId as CharacterId,
          baseCredits: decision.baseCredits,
          commissionCredits: decision.commissionCredits,
          policyRevision: decision.policyRevision,
          ledgerEntryId,
          settledAt: at(),
        });
        settlement = await input.economy.readCommissionForOperation({
          tenantId: request.tenantId,
          operationId: request.operationId,
        });
      }
      if (!settlement) throw new Error("Commission settlement persistence failed");
      if (
        settlement.baseCredits !== decision.baseCredits ||
        settlement.commissionCredits !== decision.commissionCredits
      ) {
        throw new Error("Commission settlement replay conflict");
      }
      if (existing) {
        // New builds retain a durable plan so a retry can reproduce the exact
        // transfer envelope. Legacy settlements fall back to their persisted
        // ledger id and canonical Commerce duplicate suppression.
        const plan = await input.economy.readLedgerPlan({
          tenantId: request.tenantId,
          planKey: `commission-settle:${request.operationId}`,
        });
        if (
          plan &&
          planEntry(plan, "commission", settlement.commissionCredits) !==
            settlement.ledgerEntryId
        ) {
          throw new Error("Commission settlement ledger plan conflict");
        }
        await input.commerce.postTransfer({
          schemaVersion: 1,
          ledgerEntryId: settlement.ledgerEntryId,
          tenantId: request.tenantId,
          debit: account(request.tenantId, "platform-revenue", null, null),
          credit: account(request.tenantId, "pending-earnings", settlement.ownerUserId, settlement.characterId),
          amountCredits: settlement.commissionCredits,
          reason: "creator-earning",
          quoteId: null,
          fulfillmentId: null,
          createdAt: (plan?.createdAt ?? at()) as never,
        });
      }
      await input.events.append({
        tenantId: request.tenantId,
        payload: {
          eventType: "twin.earning.settled",
          ownerUserId: settlement.ownerUserId,
          characterId: settlement.characterId,
          customerUserId: attribution.customerUserId,
          referenceId: request.operationId,
          visibility: "owner",
          occurredAt: at(),
          amountCredits: settlement.commissionCredits,
          status: "completed",
        },
      });
    },

    async reverseFull(request: {
      readonly tenantId: TenantId;
      readonly operationId: string;
      readonly reversalId: string;
    }) {
      const original = await input.economy.readCommissionForOperation({
        tenantId: request.tenantId,
        operationId: request.operationId,
      });
      if (!original) return;
      await monetization.reverse({
        tenantId: request.tenantId,
        operationId: request.operationId,
        reversalId: request.reversalId,
        reversalBaseCredits: original.baseCredits,
      });
    },

    async reverse(request: {
      readonly tenantId: TenantId;
      readonly operationId: string;
      readonly reversalId: string;
      readonly reversalBaseCredits: number;
    }) {
      const original = await input.economy.readCommissionForOperation({
        tenantId: request.tenantId,
        operationId: request.operationId,
      });
      if (!original) return;
      const signed = reverseCommission({
        originalBaseCredits: original.baseCredits,
        originalCommissionCredits: original.commissionCredits,
        reversalBaseCredits: request.reversalBaseCredits,
      });
      const requestedAmount = Math.max(0, -signed);
      const planKey = `commission-reversal:${request.reversalId}`;
      const existingPlan = await input.economy.readLedgerPlan({
        tenantId: request.tenantId,
        planKey,
      });
      let plan = existingPlan;
      let amount: number;
      if (plan) {
        const planned = plan.entries.find((entry) => entry.role === "reversal");
        if (
          !planned ||
          !Number.isSafeInteger(planned.amountCredits) ||
          planned.amountCredits <= 0 ||
          planned.amountCredits > original.commissionCredits
        ) {
          throw new Error("Commission reversal ledger plan conflict");
        }
        amount = planned.amountCredits;
      } else {
        amount = Math.min(
          requestedAmount,
          original.commissionCredits - original.reversedCredits,
        );
        if (amount <= 0) return;
        plan = await ensurePlan(input.economy, {
          tenantId: request.tenantId,
          planKey,
          roles: [{ role: "reversal", amountCredits: amount }],
        });
      }
      const stableLedger = planEntry(plan, "reversal", amount)!;
      await input.commerce.postTransfer({
        schemaVersion: 1,
        ledgerEntryId: stableLedger,
        tenantId: request.tenantId,
        debit: account(request.tenantId, "pending-earnings", original.ownerUserId, original.characterId),
        credit: account(request.tenantId, "platform-revenue", null, null),
        amountCredits: amount,
        reason: "adjustment",
        quoteId: null,
        fulfillmentId: null,
        createdAt: plan.createdAt as never,
      });
      await input.economy.recordCommissionReversal({
        tenantId: request.tenantId,
        operationId: request.operationId,
        reversalId: request.reversalId,
        amountCredits: amount,
        ledgerEntryId: stableLedger,
        reversedAt: at(),
      });
      await input.events.append({
        tenantId: request.tenantId,
        payload: {
          eventType: "twin.earning.reversed",
          ownerUserId: original.ownerUserId,
          characterId: original.characterId,
          customerUserId: null,
          referenceId: request.reversalId,
          visibility: "owner",
          occurredAt: at(),
          amountCredits: amount,
          status: "reversed",
        },
      });
    },
  };

  return Object.freeze({
    twinProfile,
    twinDirectory,
    myTwin,
    twinActivity,
    wallet,
    creditTransfer,
    gifts,
    creditGift,
    twinAttribution,
    commissionAdmin,
    providerValuationAdmin,
    paidVoice,
    paidFeatureTrialAdmin,
    ownerAccess,
    ownerAccessOffering,
    ownerAccessDisputes,
    ownerAccessMaintenance,
    twinSafety,
    voiceAdmissionGate,
    monetization,
  });
}
