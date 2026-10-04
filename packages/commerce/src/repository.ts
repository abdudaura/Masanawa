import type {
  CharacterId,
  OfferId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type {
  CommerceAccountRef,
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
  createQuote(input: CommerceQuote): Promise<CommerceQuote>;
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
