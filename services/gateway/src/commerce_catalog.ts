import {
  createCanonicalId,
  parseCanonicalId,
  toInstant,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type { CommerceRepository, CommerceQuote } from "@masanawa/commerce";
import type {
  CharacterOwnershipReader,
  UserRelationshipReader,
} from "@masanawa/identity";
import {
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillRepository,
} from "@masanawa/skills";

export interface CommerceUserAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface CommerceUserAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly capability:
      | "commerce.offers.read"
      | "commerce.quote.write"
      | "commerce.fulfillment.write";
  }): Promise<CommerceUserAuthority>;
}

export interface CommerceOfferView {
  readonly offerId: string;
  readonly revision: number;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly skillVersionId: string;
  readonly priceCredits: number;
  readonly active: true;
}

export interface CommerceCatalogService {
  list(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly CommerceOfferView[]>;

  quote(input: {
    readonly authorizationHeader: string | undefined;
    readonly offerId: string;
    readonly originatingCharacterId: string;
  }): Promise<CommerceQuote>;
}

export function createCommerceCatalogService(input: {
  readonly authorizer: CommerceUserAuthorizer;
  readonly commerce: CommerceRepository;
  readonly relationships: UserRelationshipReader;
  readonly ownerships: CharacterOwnershipReader;
  readonly skills: SkillRepository;
}): CommerceCatalogService {
  async function eligibleOffers(authority: CommerceUserAuthority) {
    const [offers, snapshot] = await Promise.all([
      input.commerce.listActiveOffers({ tenantId: authority.tenantId }),
      input.skills.readSnapshot(),
    ]);
    const registry = restoreSkillRegistry(snapshot);

    return offers.filter((offer) => {
      const skill = registry.getVersion(offer.skillVersionId);
      if (!skill || skill.billingMode !== "quoted") return false;
      const eligibility = evaluateSkillEligibility(
        registry,
        offer.skillVersionId,
      );
      return eligibility.eligible && eligibility.advertisable;
    });
  }

  return Object.freeze({
    async list(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "commerce.offers.read",
      });
      const offers = await eligibleOffers(authority);
      return Object.freeze(
        offers.map((offer) =>
          Object.freeze({
            offerId: offer.offerId,
            revision: offer.revision,
            key: offer.key,
            title: offer.title,
            description: offer.description,
            skillVersionId: offer.skillVersionId,
            priceCredits: offer.priceCredits,
            active: true as const,
          }),
        ),
      );
    },

    async quote(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "commerce.quote.write",
      });
      const offerId = parseCanonicalId("offer", request.offerId);
      const originatingCharacterId = parseCanonicalId(
        "character",
        request.originatingCharacterId,
      );

      const relationship =
        await input.relationships.readForUserCharacter({
          tenantId: authority.tenantId,
          userId: authority.userId,
          characterId: originatingCharacterId,
        });
      if (!relationship) {
        throw new Error("Originating Character is not related to this user");
      }

      const offers = await eligibleOffers(authority);
      const offer = offers.find((candidate) => candidate.offerId === offerId);
      if (!offer) {
        throw new Error("Offer is unavailable or its Skill is not ready");
      }

      const ownership = await input.ownerships.readForCharacter({
        tenantId: authority.tenantId,
        characterId: originatingCharacterId,
      });
      const thirdPartyCreatorUserId =
        ownership?.kind === "personal-clone" &&
        ownership.ownerUserId !== null &&
        ownership.ownerUserId !== authority.userId
          ? ownership.ownerUserId
          : null;

      const creatorCommissionCredits =
        thirdPartyCreatorUserId === null
          ? 0
          : offer.creatorCommissionCredits;
      const platformMarginCredits =
        offer.platformMarginCredits +
        (offer.creatorCommissionCredits - creatorCommissionCredits);

      const createdAt = new Date().toISOString();
      const expiresAt = new Date(
        Date.parse(createdAt) + 15 * 60 * 1000,
      ).toISOString();

      return input.commerce.createQuote({
        schemaVersion: 1,
        tenantId: authority.tenantId,
        quoteId: createCanonicalId("quote"),
        offerId: offer.offerId,
        offerRevision: offer.revision,
        customerUserId: authority.userId,
        originatingCharacterId,
        creatorUserId: thirdPartyCreatorUserId,
        priceCredits: offer.priceCredits,
        creatorCommissionCredits,
        fulfillmentReserveCredits: offer.fulfillmentReserveCredits,
        platformMarginCredits,
        createdAt: toInstant(createdAt),
        expiresAt: toInstant(expiresAt),
      });
    },
  });
}
