# Creator Clone and Reseller Economy

Status: canonical product-direction document.

## Product decision

Masanawa owns the platform, catalog, pricing, execution standards, routing and settlement.
Ordinary users may create one personal digital twin (clone). The clone owns the customer
relationship and reseller attribution; fulfillment may be performed by the clone, a
platform agent, another eligible Character, a Tool/Provider or a Device without moving
the user out of the originating conversation.

There are three product ownership classes:
- **Platform Character** — owned/configured by Masanawa.
- **Personal clone** — one per ordinary User, user-controlled and Masanawa-hosted.
- **Business Character** — later, for organizations that legitimately require multiple Characters.

No separate licensed/public-agent class is required.

## Gwani and Gwana

Gwani and Gwana are peer Masanawa platform Characters with the same platform-support
role and the same eligible Skill surface. Neither is a privileged second control plane.

Both may:
- onboard users and creators;
- create/configure a personal clone conversationally;
- explain products, services, Credits, Agent Float and earnings;
- recommend and enable eligible Skills;
- provide support and troubleshoot product use;
- help users discover and purchase Masanawa offers;
- help creators improve customer relationships, conversion and clone configuration;
- coordinate or route work through canonical runtime/Workflow/commerce boundaries;
- communicate important platform information when authorized.

**Default selection:** Gwani is the default platform/support Character for new users.
Users may change their default platform/support Character in Settings, including
selecting Gwana.

**Voice presentation defaults:**
- Gwani -> Gemini voice **Bodi**.
- Gwana -> Gemini voice **Sulafat**.

Voice is presentation/provider configuration, not Character identity. A future inference
or realtime adapter maps these configured preferences to the provider-specific voice
identifier and may change provider without changing Gwani or Gwana.

## One-clone rule and creation experience

An ordinary User may own at most one personal clone. The invariant is enforced by the
canonical identity/product layer rather than only by UI.

Creating the clone must feel like creating a profile, not programming an agent.
Gwani or Gwana should be able to ask a short conversational sequence, derive a proposed
profile and ask the user to confirm it. The platform handles almost all technical
configuration.

The resulting clone may include:
- display name and avatar;
- voice preference;
- languages;
- communication style;
- biography/interests/expertise;
- public/private discoverability;
- a Masanawa Core capability bundle;
- optional commercial Skill enrollment.

Users do not configure prompts, model temperature, provider credentials, Tool schemas or
Workflow graphs.

## Core capabilities and commercial Skills

Every eligible Character receives a Masanawa Core capability bundle so new Characters
are useful before purchasing or enabling specialist Skills. Core covers ordinary
conversation and broadly useful capabilities such as writing, summarization, translation,
current-information research when available, document/image understanding, basic planning,
file/result handling and Masanawa product discovery.

Commercial Skills represent specialist or sellable capabilities. Creators opt into them
through simple product language; the platform resolves exact SkillVersion assignments,
certification/readiness and required Tools/Providers.

Skill definitions do not own retail pricing.

## Offers and pricing

A canonical **Offer** connects a sellable product/service to the Skill/runtime capability
required to fulfill it.

An Offer owns deterministic commercial terms such as:
- product/service identity and description;
- eligible SkillVersion or fulfillment capability;
- customer price;
- currency/Credit denomination;
- expected/maximum fulfillment reserve;
- creator/reseller commission;
- Masanawa margin;
- minimum Agent Float policy where applicable;
- availability, region and fulfillment/fallback policy;
- immutable/versioned commercial revision.

Masanawa sets Offer prices and margin rules. Creators do not undercut infrastructure
costs or invent incompatible prices. Later, trusted creators may receive bounded markup
or commission-tier controls, but the platform price floor remains authoritative.

## Credits, Agent Float and earnings

Commercial truth must not be a mutable balance field. Use append-only ledger entries and
explicit reservations/settlement.

Keep these economic concepts distinct:

1. **Customer Credits** — non-withdrawable value used to buy paid work/products.
2. **Agent Float** — non-withdrawable creator-funded execution capacity reserved to keep
   the creator's clone commercially available.
3. **Fulfillment Reserve** — temporarily locked capacity for admitted work.
4. **Pending Earnings** — creator revenue awaiting settlement.
5. **Available Earnings** — settled creator revenue eligible for withdrawal.
6. **Platform Revenue** — Masanawa-owned margin.

Purchased Credits/Float must never become withdrawable merely by routing self-generated
traffic through a creator's own clone.

## Relationship versus executor

The originating Character owns the customer relationship for the request.

Commercial attribution records at least:
- acquiring/originating Character;
- creator/User attribution where applicable;
- Relationship;
- Offer/revision;
- customer;
- selected fulfillment executor;
- settlement result.

The fulfillment executor may differ from the originating Character. Delegation/fallback
is hidden by default so the user remains in the same conversation.

## Agent Float fallback

A creator may add Agent Float so their clone can accept and finance eligible paid
fulfillment.

Before admission, the platform checks the Offer's reserve requirement and current
execution eligibility.

Preferred routing:
1. originating clone when eligible and sufficiently funded;
2. Masanawa-funded/platform fulfillment while preserving originating attribution;
3. another eligible Character/executor for the same Offer/Skill;
4. a designated platform Character/executor fallback.

Insufficient creator Float must not automatically fail a customer request when Masanawa
has an eligible fallback. The creator may receive a smaller acquisition/referral
commission when Masanawa or another executor finances/fulfills the job. Exact commission
policy is deterministic Offer/settlement data, never model discretion.

## Creator incentives

Creators compete primarily on customer relationship quality, marketing, repeat business,
helpfulness and clone optimization rather than uncontrolled price cutting.

Every public clone should receive a shareable profile/referral route. Referral attribution
is durable and separate from fulfillment identity.

Creator metrics may include:
- conversations and repeat customers;
- paid conversions;
- successful fulfillment;
- ratings;
- refunds/disputes;
- funded availability;
- revenue and settled earnings.

High-quality creators may later receive better commission tiers, lower reserve
requirements or promotional placement through explicit policy.

## Commercial request flow

The target paid path is:

`User -> originating Character -> Skill/intent -> Offer -> quote -> payment/Credit authorization -> attribution -> executor eligibility -> reserve -> AgentRun/Workflow -> Tool/Provider/Device -> receipt -> settlement`

The deterministic platform owns money, authorization, routing truth, receipts and
settlement. Models may recommend or explain but do not create financial truth.

## Initial product families

The launch overlay is `docs/DIGITAL-COMMERCE-LAUNCH.md`.
Data bundles and crypto buy/sell are required families. Airtime, electricity and TV
are proposed companion products awaiting approval. Flutterwave is the selected
billing provider; NOWPayments is the selected crypto provider.
Crypto catalogs are discovered by exact supported asset/network and operation,
filtered through low-fee policy; Ethereum-mainnet ERC-20 routes are excluded.
Users name an asset or request a short searchable list rather than seeing every token.
Crypto payment acceptance is not proof of customer fiat cash-out support; qualify
each buy/sell flow for our account and region before advertising it.
Fiat/crypto principal is separate from AI Credits/Agent Float and creator earnings.

Writing, CVs, business planning, research, websites, social content and bookings remain
capability candidates; they are not automatically launch paid products. The prior alpha
Business Plan Offer is scaffolding pending complete delivery and scope decision.
The overlay records financial/Skill corrections and broader keep/defer decisions.

## Implementation sequencing

This direction does not replace the production roadmap.

Near-term Agent runtime work remains prerequisite:
- Task 072 AgentRun completion;
- Task 073 provider-neutral AgentStrategy;
- Task 074 Character-aware context;
- Task 075 Tool/Skill selection;
- Task 076 budgets/guards;
- Tasks 077-079 conversational, research and delegated strategies.

Commercial-alpha contracts should then be introduced without creating parallel owners:
- Character ownership classification and one-clone invariant;
- creator profile/public clone projection;
- Masanawa Core bundle and simple creator Skill enrollment;
- Offer catalog/pricing revision model;
- Customer Credit, Agent Float, reserve and earnings ledgers;
- reseller attribution and quote model;
- fulfillment routing with insufficient-Float fallback;
- deterministic commission settlement/refund/reversal;
- referral/profile routes;
- Gwani/Gwana canonical platform Character provisioning;
- conversational clone creation and creator-facing balance/earnings UI.

Tasks 133-134 remain the production commerce ownership gates and should absorb these
contracts into the canonical quote/payment/ledger/fulfillment and reconciliation domain.
Do not create a temporary wallet/marketplace subsystem that later has to be replaced.
