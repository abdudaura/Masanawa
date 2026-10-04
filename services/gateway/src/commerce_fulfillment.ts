import {
  createCanonicalId,
  nowInstant,
  parseCanonicalId,
} from "@masanawa/contracts";
import {
  planFulfillmentFunding,
  type CommerceFulfillmentAdmission,
  type CommerceRepository,
} from "@masanawa/commerce";
import type {
  CharacterSkillAssignmentRepository,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import type { CharacterOwnershipReader } from "@masanawa/identity";
import {
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillRepository,
} from "@masanawa/skills";
import type { CommerceUserAuthorizer } from "./commerce_catalog.js";

export interface CommerceFulfillmentService {
  admit(input: {
    readonly authorizationHeader: string | undefined;
    readonly quoteId: string;
  }): Promise<CommerceFulfillmentAdmission>;
}

export function createCommerceFulfillmentService(input: {
  readonly authorizer: CommerceUserAuthorizer;
  readonly commerce: CommerceRepository;
  readonly ownerships: CharacterOwnershipReader;
  readonly assignments: CharacterSkillAssignmentRepository;
  readonly platformProfiles: PlatformAgentProfileRepository;
  readonly skills: SkillRepository;
}): CommerceFulfillmentService {
  return Object.freeze({
    async admit(request) {
      const authority = await input.authorizer.authorize({
        authorizationHeader: request.authorizationHeader,
        capability: "commerce.fulfillment.write",
      });
      const quoteId = parseCanonicalId("quote", request.quoteId);
      const quote = await input.commerce.readQuote({
        tenantId: authority.tenantId,
        quoteId,
      });
      if (!quote || quote.customerUserId !== authority.userId) {
        throw new Error("Quote is not available to this user");
      }

      const existing = await input.commerce.readFulfillmentForQuote({
        tenantId: authority.tenantId,
        quoteId,
      });
      if (existing) return existing;

      if (Date.parse(quote.expiresAt) <= Date.now()) {
        throw new Error("Quote has expired");
      }

      const [offer, snapshot, originOwnership, originAssignment] =
        await Promise.all([
          input.commerce.readOfferRevision({
            tenantId: authority.tenantId,
            offerId: quote.offerId,
            revision: quote.offerRevision,
          }),
          input.skills.readSnapshot(),
          input.ownerships.readForCharacter({
            tenantId: authority.tenantId,
            characterId: quote.originatingCharacterId,
          }),
          input.assignments.readForCharacter({
            tenantId: authority.tenantId,
            characterId: quote.originatingCharacterId,
          }),
        ]);
      if (!offer || offer.skillVersionId === undefined) {
        throw new Error("Quoted Offer revision is unavailable");
      }

      const registry = restoreSkillRegistry(snapshot);
      const skill = registry.getVersion(offer.skillVersionId);
      const eligibility = evaluateSkillEligibility(
        registry,
        offer.skillVersionId,
      );
      if (
        !skill ||
        skill.billingMode !== "quoted" ||
        !eligibility.eligible ||
        !eligibility.advertisable
      ) {
        throw new Error("Quoted Skill is not currently eligible for fulfillment");
      }

      const originHasSkill =
        originAssignment?.skillVersionIds.includes(offer.skillVersionId) ??
        false;
      const creatorMatchesOrigin =
        quote.creatorUserId !== null &&
        originOwnership?.kind === "personal-clone" &&
        originOwnership.ownerUserId === quote.creatorUserId;

      let availableAgentFloatCredits = 0;
      if (creatorMatchesOrigin && originHasSkill) {
        availableAgentFloatCredits = await input.commerce.readBalance({
          tenantId: authority.tenantId,
          kind: "agent-float",
          userId: quote.creatorUserId,
          characterId: quote.originatingCharacterId,
        });
      }

      const creatorFunding = planFulfillmentFunding({
        offer,
        availableAgentFloatCredits,
      });
      const originCanExecute =
        originHasSkill &&
        (originOwnership?.kind === "platform" ||
          (creatorMatchesOrigin && !creatorFunding.usedFallback));

      let executorCharacterId = quote.originatingCharacterId;
      let fundingSource: "agent-float" | "platform" =
        originOwnership?.kind === "platform" ? "platform" : "agent-float";
      let creatorCommissionCredits = quote.creatorCommissionCredits;

      if (!originCanExecute) {
        const profiles = await input.platformProfiles.listSupportAgents({
          tenantId: authority.tenantId,
        });
        const candidates = [...profiles].sort((left, right) => {
          if (left.defaultForNewUsers !== right.defaultForNewUsers) {
            return left.defaultForNewUsers ? -1 : 1;
          }
          return left.characterId.localeCompare(right.characterId);
        });

        let fallback: (typeof candidates)[number] | null = null;
        for (const candidate of candidates) {
          const assignment = await input.assignments.readForCharacter({
            tenantId: authority.tenantId,
            characterId: candidate.characterId,
          });
          if (assignment?.skillVersionIds.includes(offer.skillVersionId)) {
            fallback = candidate;
            break;
          }
        }
        if (!fallback) {
          throw new Error("No eligible platform executor is available");
        }

        executorCharacterId = fallback.characterId;
        fundingSource = "platform";
        creatorCommissionCredits =
          quote.creatorUserId === null
            ? 0
            : Math.min(
                quote.creatorCommissionCredits,
                offer.fallbackCommissionCredits,
              );
      }

      const platformRevenueCredits =
        quote.priceCredits -
        quote.fulfillmentReserveCredits -
        creatorCommissionCredits;
      const fulfillmentId = createCanonicalId("fulfillment");
      const createdAt = nowInstant();

      const transfers = [
        {
          schemaVersion: 1 as const,
          ledgerEntryId: createCanonicalId("ledger-entry"),
          tenantId: authority.tenantId,
          debit: {
            tenantId: authority.tenantId,
            kind: "customer-credit" as const,
            userId: authority.userId,
            characterId: null,
          },
          credit: {
            tenantId: authority.tenantId,
            kind: "platform-float" as const,
            userId: null,
            characterId: null,
          },
          amountCredits: quote.priceCredits,
          reason: "customer-payment" as const,
          quoteId,
          fulfillmentId,
          createdAt,
        },
        ...(fundingSource === "agent-float" && quote.creatorUserId !== null
          ? [
              {
                schemaVersion: 1 as const,
                ledgerEntryId: createCanonicalId("ledger-entry"),
                tenantId: authority.tenantId,
                debit: {
                  tenantId: authority.tenantId,
                  kind: "agent-float" as const,
                  userId: quote.creatorUserId,
                  characterId: quote.originatingCharacterId,
                },
                credit: {
                  tenantId: authority.tenantId,
                  kind: "platform-float" as const,
                  userId: null,
                  characterId: null,
                },
                amountCredits: quote.fulfillmentReserveCredits,
                reason: "fulfillment-reserve" as const,
                quoteId,
                fulfillmentId,
                createdAt,
              },
            ]
          : []),
      ];

      return input.commerce.admitFulfillment({
        admission: {
          schemaVersion: 1,
          tenantId: authority.tenantId,
          fulfillmentId,
          quoteId,
          offerId: quote.offerId,
          offerRevision: quote.offerRevision,
          skillVersionId: offer.skillVersionId,
          originatingCharacterId: quote.originatingCharacterId,
          executorCharacterId,
          creatorUserId: quote.creatorUserId,
          fundingSource,
          reserveCredits: quote.fulfillmentReserveCredits,
          creatorCommissionCredits,
          platformRevenueCredits,
          state: "admitted",
          createdAt,
        },
        transfers,
      });
    },
  });
}
