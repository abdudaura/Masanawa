import type {
  CharacterId,
  LedgerEntryId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type { OwnerAccessRequest } from "./owner-access.js";
import type { OwnerAccessOffering } from "./owner-access-offering.js";
import type { PaidFeatureKey, PaidFeatureTrialPolicy } from "./trial.js";
import type { TwinAttributionRecord, CommissionPolicy } from "./attribution.js";

export interface TwinCreditOperationReceipt {
  readonly tenantId: TenantId;
  readonly requestId: string;
  readonly kind: "transfer" | "gift";
  readonly senderUserId: UserId;
  readonly recipientUserId: UserId;
  readonly characterId: CharacterId | null;
  readonly amountCredits: number;
  readonly ledgerEntryId: LedgerEntryId;
  readonly completedAt: string;
}

export interface PersistedTwinVoiceQuote {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly ownerUserId: UserId;
  readonly quoteId: string;
  readonly characterId: CharacterId;
  readonly policyRevision: number;
  readonly trialPolicyRevision: number;
  readonly chargeMode: "trial" | "paid";
  readonly trialDurationDays: number;
  readonly trialStartsAt: string | null;
  readonly trialExpiresAt: string | null;
  readonly estimatedSeconds: number;
  readonly estimatedPriceCredits: number;
  readonly spendCapCredits: number;
  readonly ownerShareBasisPoints: number;
  readonly unitSeconds: number;
  readonly priceCreditsPerUnit: number;
  readonly quoteExpiresAt: string;
  readonly createdAt: string;
}

export interface PersistedTwinVoiceAdmission {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly ownerUserId: UserId;
  readonly admissionId: string;
  readonly quoteId: string;
  readonly characterId: CharacterId;
  readonly chargeMode: "trial" | "paid";
  readonly admittedAt: string;
  readonly startedAt: string | null;
  readonly expiresAt: string;
  readonly spendCapCredits: number;
  readonly reservationLedgerEntryId: LedgerEntryId | null;
  readonly settledAt: string | null;
}

export interface TwinSafetyBlock {
  readonly tenantId: TenantId;
  readonly actorUserId: UserId;
  readonly characterId: CharacterId;
  readonly blockedAt: string;
}

export interface TwinLedgerPlanEntry {
  readonly ledgerEntryId: LedgerEntryId;
  readonly role: string;
  readonly amountCredits: number;
}

export interface TwinLedgerPlan {
  readonly planKey: string;
  readonly entries: readonly TwinLedgerPlanEntry[];
  readonly createdAt: string;
}

export interface TwinRuntimeRepository {
  readLedgerPlan(input: {
    readonly tenantId: TenantId;
    readonly planKey: string;
  }): Promise<TwinLedgerPlan | null>;

  putLedgerPlan(input: {
    readonly tenantId: TenantId;
    readonly plan: TwinLedgerPlan;
  }): Promise<TwinLedgerPlan>;

  resolveUserByRecipient(input: {
    readonly tenantId: TenantId;
    readonly recipient: string;
  }): Promise<UserId | null>;

  readOwnerForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<UserId | null>;

  readCreditOperation(input: {
    readonly tenantId: TenantId;
    readonly requestId: string;
  }): Promise<TwinCreditOperationReceipt | null>;

  recordCreditOperation(input: TwinCreditOperationReceipt): Promise<TwinCreditOperationReceipt>;

  countOperations(input: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly operation: "credit-transfer" | "gift" | "paid-voice" | "owner-access";
    readonly since: string;
  }): Promise<number>;

  listRecentTransferEdges(input: {
    readonly tenantId: TenantId;
    readonly since: string;
    readonly limit: number;
  }): Promise<readonly {
    readonly fromUserId: string;
    readonly toUserId: string;
    readonly amountCredits: number;
    readonly kind: "transfer" | "gift";
    readonly occurredAt: string;
  }[]>;

  readCommissionPolicy(input: {
    readonly tenantId: TenantId;
    readonly eventType: "external-funding" | "commerce-purchase";
    readonly at: string;
  }): Promise<CommissionPolicy | null>;

  putCommissionPolicy(input: {
    readonly tenantId: TenantId;
    readonly policy: CommissionPolicy;
  }): Promise<CommissionPolicy>;

  putAttribution(input: {
    readonly tenantId: TenantId;
    readonly attribution: TwinAttributionRecord;
  }): Promise<TwinAttributionRecord>;

  readAttributionForOperation(input: {
    readonly tenantId: TenantId;
    readonly operationId: string;
    readonly eventType: "external-funding" | "commerce-purchase";
  }): Promise<TwinAttributionRecord | null>;

  recordCommissionSettlement(input: {
    readonly tenantId: TenantId;
    readonly settlementId: string;
    readonly attributionId: string;
    readonly operationId: string;
    readonly eventType: "external-funding" | "commerce-purchase";
    readonly ownerUserId: UserId;
    readonly characterId: CharacterId;
    readonly baseCredits: number;
    readonly commissionCredits: number;
    readonly policyRevision: number;
    readonly ledgerEntryId: LedgerEntryId;
    readonly settledAt: string;
  }): Promise<{ readonly duplicate: boolean }>;

  readCommissionForOperation(input: {
    readonly tenantId: TenantId;
    readonly operationId: string;
  }): Promise<{
    readonly settlementId: string;
    readonly ownerUserId: UserId;
    readonly characterId: CharacterId;
    readonly baseCredits: number;
    readonly commissionCredits: number;
    readonly policyRevision: number;
    readonly ledgerEntryId: LedgerEntryId;
    readonly reversedCredits: number;
  } | null>;

  recordCommissionReversal(input: {
    readonly tenantId: TenantId;
    readonly operationId: string;
    readonly reversalId: string;
    readonly amountCredits: number;
    readonly ledgerEntryId: LedgerEntryId;
    readonly reversedAt: string;
  }): Promise<{ readonly duplicate: boolean }>;

  readTrialPolicy(input: {
    readonly tenantId: TenantId;
    readonly feature: PaidFeatureKey;
    readonly at: string;
  }): Promise<PaidFeatureTrialPolicy | null>;

  putTrialPolicy(input: {
    readonly tenantId: TenantId;
    readonly policy: PaidFeatureTrialPolicy;
  }): Promise<PaidFeatureTrialPolicy>;

  readTrialUsage(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly feature: PaidFeatureKey;
  }): Promise<{ readonly startedAt: string | null; readonly consumedUnits: number }>;

  consumeTrialUsage(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly feature: PaidFeatureKey;
    readonly policyRevision: number;
    readonly idempotencyKey: string;
    readonly units: number;
    readonly consumedAt: string;
  }): Promise<void>;

  putVoiceQuote(input: PersistedTwinVoiceQuote): Promise<PersistedTwinVoiceQuote>;
  readVoiceQuote(input: {
    readonly tenantId: TenantId;
    readonly quoteId: string;
  }): Promise<PersistedTwinVoiceQuote | null>;

  putVoiceAdmission(input: PersistedTwinVoiceAdmission): Promise<PersistedTwinVoiceAdmission>;
  readVoiceAdmission(input: {
    readonly tenantId: TenantId;
    readonly admissionId: string;
  }): Promise<PersistedTwinVoiceAdmission | null>;

  markVoiceStarted(input: {
    readonly tenantId: TenantId;
    readonly admissionId: string;
    readonly startedAt: string;
  }): Promise<PersistedTwinVoiceAdmission>;

  markVoiceSettled(input: {
    readonly tenantId: TenantId;
    readonly admissionId: string;
    readonly outcome: "completed" | "interrupted" | "ambiguous" | "failed-before-media";
    readonly verifiedSeconds: number;
    readonly settlement: Readonly<Record<string, unknown>>;
    readonly settledAt: string;
  }): Promise<{ readonly duplicate: boolean }>;

  putOwnerAccessQuote(input: {
    readonly tenantId: TenantId;
    readonly requesterUserId: UserId;
    readonly quote: import("./owner-access.js").OwnerAccessQuote;
    readonly createdAt: string;
  }): Promise<import("./owner-access.js").OwnerAccessQuote>;

  readOwnerAccessQuote(input: {
    readonly tenantId: TenantId;
    readonly quoteId: string;
  }): Promise<(import("./owner-access.js").OwnerAccessQuote & {
    readonly requesterUserId: UserId;
  }) | null>;

  readOwnerAccessOffering(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
  }): Promise<OwnerAccessOffering | null>;

  putOwnerAccessOffering(input: {
    readonly tenantId: TenantId;
    readonly offering: OwnerAccessOffering;
  }): Promise<OwnerAccessOffering>;

  putOwnerAccessRequest(input: {
    readonly tenantId: TenantId;
    readonly request: OwnerAccessRequest;
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }): Promise<OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }>;

  readOwnerAccessRequest(input: {
    readonly tenantId: TenantId;
    readonly requestId: string;
  }): Promise<(OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }) | null>;

  updateOwnerAccessRequest(input: {
    readonly tenantId: TenantId;
    readonly request: OwnerAccessRequest;
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }): Promise<OwnerAccessRequest & {
    readonly reservationId: string | null;
    readonly reservedCredits: number;
  }>;

  blockTwin(input: TwinSafetyBlock): Promise<void>;
  unblockTwin(input: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly characterId: CharacterId;
  }): Promise<void>;
  isTwinBlocked(input: {
    readonly tenantId: TenantId;
    readonly actorUserId: UserId;
    readonly characterId: CharacterId;
  }): Promise<boolean>;
  reportTwin(input: {
    readonly tenantId: TenantId;
    readonly reportId: string;
    readonly reporterUserId: UserId;
    readonly characterId: CharacterId;
    readonly reason: string;
    readonly detail: string | null;
    readonly createdAt: string;
  }): Promise<void>;
}
