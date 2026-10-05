import {
  createCanonicalId,
  nowInstant,
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
  transitionOwnerAccess,
  type CommerceRepository,
  type CommissionPolicy,
  type OwnerAccessPolicy,
  type PaidFeatureKey,
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
  readonly twinAttribution: TwinAttributionService;
  readonly commissionAdmin: ReturnType<typeof createCommissionPolicyAdminService>;
  readonly paidVoice: PaidVoiceService;
  readonly paidFeatureTrialAdmin: PaidFeatureTrialAdminService;
  readonly ownerAccess: OwnerAccessService;
  readonly ownerAccessOffering: ReturnType<typeof createOwnerAccessOfferingService>;
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
      createdAt: at(),
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
    store: profileStore,
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
        for (const row of rows) {
          if (row.kind === "visit") visitors += 1;
          if (row.kind === "conversation") conversations += 1;
          if (row.kind === "earning" && row.status === "completed") {
            earningsCredits += row.amountCredits ?? 0;
          }
          if (row.kind === "owner-request" && row.status === "pending") {
            pendingOwnerRequests += 1;
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
        if (!owner) throw new Error("Paid Twin voice requires a personal Twin");
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
          ownerShareBasisPoints: input.voice.ownerShareBasisPoints,
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
          !quote ||
          quote.userId !== request.userId ||
          quote.characterId !== request.characterId ||
          Date.parse(quote.quoteExpiresAt) <= Date.now()
        ) {
          throw new Error("Paid voice quote is unavailable or expired");
        }
        const existing = await input.economy.readVoiceAdmissionByQuote({
          tenantId: request.tenantId,
          quoteId: quote.quoteId,
        });
        if (existing) {
          if (
            existing.reservationLedgerEntryId &&
            existing.chargeMode === "paid" &&
            existing.spendCapCredits > 0
          ) {
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
              createdAt: existing.admittedAt as never,
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

  async function settleOwnerRequest(
    tenantId: TenantId,
    current: Awaited<ReturnType<TwinRuntimeRepository["readOwnerAccessRequest"]>>,
    nextState: import("@masanawa/commerce").OwnerAccessState,
  ) {
    if (!current) throw new Error("Owner access request not found");
    const startedMs = current.startedAt ? Date.parse(current.startedAt) : Number.NaN;
    const verified =
      Number.isFinite(startedMs) && Date.now() - startedMs >= 60_000;
    const decision = decideOwnerAccessSettlement({
      state: nextState,
      chargeMode: current.chargeMode,
      reservedCredits: current.reservedCredits,
      ownerEarningCredits: current.ownerEarningCredits,
      platformFeeCredits: current.platformFeeCredits,
      attendanceVerified: verified,
      completionVerified: nextState === "completed" && verified,
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
        createdAt: at() as never,
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
          credit: account(tenantId, "pending-earnings", current.ownerUserId as UserId, current.originatingCharacterId as CharacterId),
          amountCredits: decision.ownerEarningCredits,
          reason: "creator-earning",
          quoteId: null,
          fulfillmentId: null,
          createdAt: at() as never,
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
          createdAt: at() as never,
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
              createdAt: existing.requestedAt as never,
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
        return record;
      },

      async act(request) {
        const current = await input.economy.readOwnerAccessRequest({
          tenantId: request.tenantId,
          requestId: request.requestId,
        });
        if (!current || current.originatingCharacterId !== request.characterId) {
          throw new Error("Owner access request not found");
        }
        const ownerAction = ["accept", "decline", "schedule", "start", "complete"].includes(request.action);
        if (ownerAction && current.ownerUserId !== request.actorUserId) {
          throw Object.assign(new Error("Owner action required"), { statusCode: 403 });
        }
        if (request.action === "cancel" && current.requesterUserId !== request.actorUserId) {
          throw Object.assign(new Error("Requester action required"), { statusCode: 403 });
        }
        const next =
          request.action === "accept" ? "accepted" :
          request.action === "decline" ? "declined" :
          request.action === "schedule" ? "scheduled" :
          request.action === "start" ? "active" :
          request.action === "complete" ? "completed" : "cancelled";
        transitionOwnerAccess(current.state, next);
        if (
          request.action === "schedule" &&
          (!request.scheduledFor || Date.parse(request.scheduledFor) <= Date.now())
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
          completedAt: request.action === "complete" ? at() : current.completedAt,
        };
        const decision = await settleOwnerRequest(
          request.tenantId,
          changed,
          next,
        );
        const updated = await input.economy.updateOwnerAccessRequest({
          tenantId: request.tenantId,
          request: changed,
          reservationId: current.reservationId,
          reservedCredits: current.reservedCredits,
        });
        const eventType =
          next === "accepted" ? "twin.owner-access.accepted" :
          next === "scheduled" ? "twin.owner-access.scheduled" :
          next === "completed" ? "twin.owner-access.completed" :
          decision.disposition === "refund" ? "twin.owner-access.refunded" : null;
        if (eventType) {
          await input.events.append({
            tenantId: request.tenantId,
            payload: {
              eventType,
              ownerUserId: current.ownerUserId,
              characterId: current.originatingCharacterId,
              customerUserId: current.requesterUserId,
              referenceId: current.requestId,
              visibility: "participant",
              occurredAt: at(),
              amountCredits:
                eventType === "twin.owner-access.completed"
                  ? current.ownerEarningCredits
                  : eventType === "twin.owner-access.refunded"
                    ? current.reservedCredits
                    : null,
              status:
                eventType === "twin.owner-access.completed"
                  ? "completed"
                  : eventType === "twin.owner-access.refunded"
                    ? "refunded"
                    : "pending",
            },
          });
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
        if (
          (current.state === "requested" || current.state === "accepted") &&
          Date.parse(current.acceptBy) <= Date.now()
        ) {
          const expired = { ...current, state: transitionOwnerAccess(current.state, "expired") };
          await settleOwnerRequest(request.tenantId, expired, "expired");
          return input.economy.updateOwnerAccessRequest({
            tenantId: request.tenantId,
            request: expired,
            reservationId: current.reservationId,
            reservedCredits: current.reservedCredits,
          });
        }
        return current;
      },
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
      const owner = await input.economy.readOwnerForCharacter({
        tenantId: request.tenantId,
        characterId: request.characterId,
      });
      if (!owner || owner === request.userId) return;
      if (!request.admissionId) throw new Error("Paid Twin voice admission is required");
      const admission = await input.economy.readVoiceAdmission({
        tenantId: request.tenantId,
        admissionId: request.admissionId,
      });
      if (
        !admission ||
        admission.userId !== request.userId ||
        admission.characterId !== request.characterId ||
        admission.settledAt !== null ||
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
      const owner = await input.economy.readOwnerForCharacter({
        tenantId: request.tenantId,
        characterId: request.characterId,
      });
      if (!owner || owner === request.userId) return;
      if (!request.admissionId) throw new Error("Paid Twin voice admission is required");
      await input.economy.markVoiceStarted({
        tenantId: request.tenantId,
        admissionId: request.admissionId,
        startedAt: at(),
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
      if (!admission || admission.userId !== identity.userId || admission.settledAt !== null) {
        throw new Error("Paid Twin voice admission is unavailable");
      }
      const quote = await input.economy.readVoiceQuote({
        tenantId: identity.tenantId,
        quoteId: admission.quoteId,
      });
      if (!quote) throw new Error("Paid Twin voice quote is unavailable");
      const seconds =
        admission.startedAt === null
          ? 0
          : Math.max(0, Math.min(86_400, Math.ceil((Date.now() - Date.parse(admission.startedAt)) / 1000)));
      const decision = settleVerifiedTwinVoiceUsage({
        admissionId: admission.admissionId,
        outcome:
          admission.startedAt === null
            ? "failed-before-media"
            : request.outcome,
        verifiedSeconds: seconds,
        trialCovered: admission.chargeMode === "trial",
        unitSeconds: quote.unitSeconds,
        priceCreditsPerUnit: quote.priceCreditsPerUnit,
        ownerShareBasisPoints: quote.ownerShareBasisPoints,
        reservedCredits: admission.spendCapCredits,
      });
      if (decision.disposition === "reconcile") {
        throw new Error("Paid Twin voice requires reconciliation");
      }
      const plan = await ensurePlan(input.economy, {
        tenantId: identity.tenantId,
        planKey: `voice-settle:${admission.admissionId}`,
        roles: [
          { role: "owner", amountCredits: decision.ownerEarningCredits },
          { role: "platform", amountCredits: decision.platformRevenueCredits },
          { role: "refund", amountCredits: decision.refundCredits },
        ].filter((entry) => entry.amountCredits > 0),
      });
      if (admission.chargeMode === "paid") {
        if (decision.ownerEarningCredits > 0) {
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
            createdAt: at() as never,
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
            createdAt: at() as never,
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
            createdAt: at() as never,
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
        outcome: admission.startedAt === null ? "failed-before-media" : request.outcome,
        verifiedSeconds: seconds,
        settlement: decision,
        settledAt: at(),
      });
      await input.events.append({
        tenantId: identity.tenantId,
        payload: {
          eventType: "twin.voice.completed",
          ownerUserId: admission.ownerUserId,
          characterId: admission.characterId,
          customerUserId: identity.userId,
          referenceId: admission.admissionId,
          visibility: "owner",
          occurredAt: at(),
          amountCredits: decision.ownerEarningCredits,
          status: "completed",
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
        // Pre-plan settlements created by older builds are replayed through their
        // persisted ledger id. Canonical Commerce owns duplicate suppression.
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
          createdAt: at() as never,
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
    twinAttribution,
    commissionAdmin,
    paidVoice,
    paidFeatureTrialAdmin,
    ownerAccess,
    ownerAccessOffering,
    twinSafety,
    voiceAdmissionGate,
    monetization,
  });
}
