import type {
  CharacterId,
  OfferId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type {
  CommerceAccountRef,
  CommerceFulfillmentAdmission,
  CommerceFulfillmentCompletion,
  CommerceLedgerTransfer,
  CommerceQuote,
  OfferRevision,
} from "./model.js";

export interface CommerceRepository {
  registerOfferRevision(input: OfferRevision): Promise<OfferRevision>;
  readOfferRevision(input: {
    readonly tenantId: TenantId;
    readonly offerId: OfferId;
    readonly revision: number;
  }): Promise<OfferRevision | null>;
  readActiveOfferByKey(input: {
    readonly tenantId: TenantId;
    readonly key: string;
  }): Promise<OfferRevision | null>;
  listActiveOffers(input: {
    readonly tenantId: TenantId;
  }): Promise<readonly OfferRevision[]>;
  createQuote(input: CommerceQuote): Promise<CommerceQuote>;
  readQuote(input: {
    readonly tenantId: TenantId;
    readonly quoteId: import("@masanawa/contracts").QuoteId;
  }): Promise<CommerceQuote | null>;
  admitFulfillment(input: {
    readonly admission: CommerceFulfillmentAdmission;
    readonly transfers: readonly CommerceLedgerTransfer[];
  }): Promise<CommerceFulfillmentAdmission>;
  readFulfillmentForQuote(input: {
    readonly tenantId: TenantId;
    readonly quoteId: import("@masanawa/contracts").QuoteId;
  }): Promise<CommerceFulfillmentAdmission | null>;
  readFulfillment(input: {
    readonly tenantId: TenantId;
    readonly fulfillmentId: import("@masanawa/contracts").FulfillmentId;
  }): Promise<CommerceFulfillmentAdmission | null>;
  completeFulfillment(input: {
    readonly completion: CommerceFulfillmentCompletion;
  }): Promise<CommerceFulfillmentCompletion>;
  readFulfillmentCompletion(input: {
    readonly tenantId: TenantId;
    readonly fulfillmentId: import("@masanawa/contracts").FulfillmentId;
  }): Promise<CommerceFulfillmentCompletion | null>;
  postTransfer(input: CommerceLedgerTransfer): Promise<CommerceLedgerTransfer>;
  readBalance(input: CommerceAccountRef): Promise<number>;
  readCreatorCommercialSnapshot(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
  }): Promise<{
    readonly agentFloatCredits: number;
    readonly pendingEarningsCredits: number;
    readonly availableEarningsCredits: number;
  }>;
}
