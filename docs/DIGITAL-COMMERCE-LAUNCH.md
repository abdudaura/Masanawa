# Digital Commerce Launch and Scope Review

## Twin economy commerce overlay — 2026-10-05

`docs/PRODUCT-TWIN-ECONOMY.md` defines the consumer-facing product around one personal
twin per user. Billing and crypto remain platform capabilities but should appear through
the Wallet and any eligible twin conversation rather than as a competing product identity.

The originating twin may receive configurable attribution/commission on qualifying real
external funding or eligible purchases. Internal Credit transfers and gifts move existing
value and do not themselves generate acquisition commission. Public twin text is free;
paid twin voice and paid human-owner access use separate deterministic Commerce quotes,
holds/reservations, settlement and refund rules.

Older creator-funded-execution/Agent-Float requirements may remain internal where current
Commerce needs them, but Agent Float is no longer a primary ordinary-user concept.

Status: canonical launch-planning overlay, ratified provider/UX direction 2026-10-04.
This document narrows launch priority, not the architecture or completed foundations.
Broader scope decisions marked proposed require the user's decision; do not silently
delete roadmap tasks or claim implementation/verification because this plan exists.

## Confirmed direction

- Prioritize frequent everyday purchases with complete digital fulfillment.
- Data bundles and crypto buying/selling are required product families.
- App, WhatsApp and Telegram are mandatory launch interaction channels.
- Preserve already implemented features; broader admin/operations capabilities are
  documented for later implementation, not removed.
- Customer crypto holding/conversion/withdrawal and creator-funded execution are
  required directions; see the custody/funding section in CREATOR-CLONE-ECONOMY.md.
- Flutterwave is the selected billing provider, including bill fulfillment where
  account-enabled services support it. Do not substitute VTpass as the planned default.
- NOWPayments is the selected crypto provider. Do not substitute Quidax.
- Crypto eligibility is by exact asset/network/provider identifier, not ticker alone.
- Exclude Ethereum-mainnet ERC-20 routes. Other networks are eligible only after live
  availability, operation support, minimums and total fees pass platform policy.
- Do not hard-code a tiny token list or promise every provider-listed asset is tradable.
  Discover NOWPayments-supported eligible assets dynamically, intersected with
  low-fee network policy and account/region/operation availability.
- Keep default chat compact. Users name a token by text/voice or request a searchable,
  paginated list; resolve ambiguous asset/network choices before quoting.
- Voice and server-authorized selectable chat cards share the same transaction state.
- Voice transcription remains excluded from the current chat feature scope.
- Gwani/Bodi default and Gwana/Sulafat peer support remain; preserve approved Agent Blue logo/theme.

## Core Teaching Skill — required

Teaching is a required Core capability for every eligible Character, available through
the app, WhatsApp and Telegram. One canonical Teaching Skill supports broad topics,
with subject-specific exact-version resources/subskills loaded progressively.
Broad topic coverage is not a claim of universal expertise or guaranteed correctness.

The Skill must:
- establish topic, learner level, goals, language and accessibility preferences;
- propose an adaptive lesson sequence without forcing lengthy intake;
- teach in detailed manageable steps with examples, worked solutions and explanations;
- support voice/text, authorized diagrams/artifacts and selectable answer/exercise cards;
- check understanding, evaluate answers, explain mistakes and offer alternative explanations;
- distinguish practice/formative assessment from verified certification;
- preserve private Relationship-scoped learning progress, lesson checkpoints and next steps
  across sessions and verified linked channels;
- handle beginner through advanced material, with evidence checks for current/specialist
  claims and explicit uncertainty when sources or capability are insufficient;
- preserve curriculum/resource provenance and avoid fabricated quotes or references;
- rehearse language switching, misconception correction, failed understanding, continuity,
  source uncertainty and scope/privacy boundaries before production readiness.

Basic teaching belongs to Core. Paid structured courses, exam preparation and assessed
learning are future Offer proposals, not automatically approved prices/products.
Learning progress stays inside canonical Memory/Workflow boundaries; do not build
a second educational identity, memory or execution engine.
This is an implementation requirement, not a claim that these behaviors are complete.

## Proposed first catalog

| Family | Status | Fulfillment evidence |
| --- | --- | --- |
| Data bundles | Required | exact network/plan/recipient, provider terminal status, receipt |
| Crypto buy/sell | Required; operation-specific launch qualification | quote, confirmed payment/deposit, delivered asset or verified fiat payout |
| Airtime | Proposed companion launch product | recipient, amount, terminal delivery receipt |
| Electricity | Proposed next product | validated meter, prepaid token or postpaid receipt |
| TV subscription | Proposed next product | validated account/package and renewal receipt |

Bill inventory, validity, prices and recipient validation come from current provider
evidence. Each plan is an Offer/catalog item, not a separate Skill.
Business-plan/CV/research may remain useful capabilities; promoting them as launch
paid Offers is deferred pending user decision. Existing Business Plan Offer is alpha
scaffolding, not proof of a complete sellable service.

## Crypto operation boundaries

NOWPayments payment acceptance, crypto payout, conversion, fiat on-ramp and fiat
off-ramp are distinct capabilities. Verify the selected account's supported countries,
fiat currencies, customer-versus-merchant settlement, identity checks, API access and
per-asset/network buy/sell support. A merchant fiat withdrawal is not automatically
a customer NGN bank cash-out feature.

Keep unsupported operations unavailable with a useful explanation; never present a
redirect/manual operator handoff as autonomous completed fulfillment.
Keep fiat customer funds, crypto asset amounts, AI Credits, Agent Float and earnings
separate. Asset quantities use exact decimal/minor-unit representations with network,
precision and fee metadata; do not reuse integer AI Credits for token balances.
Never guess network fees or guarantee a network is always cheap. Quote total charges,
minimum order and expiry before confirmation. Require re-approval of changed terms.

## Selectable chat contract

Typed server projections: quick replies, product cards, recipient selectors,
amount/account controls, quote confirmation, transaction status and receipts.
Each action is bound to authenticated User/Relationship/conversation, transaction,
allowed transition, revision, expiry and idempotency identity.
The server derives product/price/authority; button labels and model text cannot.
Voice selects the same evidenced options (including numbered options); final execution
requires explicit confirmation tied to the displayed/read-back quote.
Do not place every token or bundle in the initial greeting. Support search, a short
relevant list, more options, edit, cancel and repeat with a fresh quote.
A timeout remains checking/unknown until requery/reconciliation establishes an outcome;
never dispatch a second purchase or provider fallback after an ambiguous dispatch.

## Required corrections before commercial launch

1. Explicit per-job reserves; distinguish locking, actual cost, unused release,
   creator commission, platform margin and refunds.
2. Canonically derived settlement, validated recipients/amounts/quote linkage;
   no arbitrary caller-defined settlement transfers.
3. Persistent request identities for Float allocation and financial commands.
4. Current executor authority/provider/device capacity, region and funding checks;
   bounded platform-funded fallback and privacy-minimal delegated context.
5. Paid admission must dispatch durable work and return verified delivery evidence
   before settlement; failure/cancel/refund/uncertain outcome paths are required.
6. Installed unavailable Skills remain visible with reason and can be disabled;
   enabling/execution revalidate readiness.
7. Core capability provisioning and resumable clone setup; conversational preview
   and confirmation, with a simple form fallback.
8. Real Skill rehearsals covering exact SkillVersion/Guide/resource hashes.
   Bootstrap synthetic passed cases are development fixtures, not production certification.
9. Server/cache semantics for edit/delete/clear; local edits must not misrepresent
   what context or durable records the server retains.
10. One product journey tested across restart, duplicate requests, lost webhook,
    expired quote, partial payment, provider outage and ambiguous fulfillment.

## Broader promises: proposed keep/defer review

| Capability | Current evidence category | Proposed launch treatment |
| --- | --- | --- |
| Voice/text chat, selectable cards, durable relationship | chat implementation exists; cards/phone acceptance incomplete | Keep |
| Personal clone, peer support, creator attribution | contracts/provisioning exist; complete journey unverified | Keep |
| Skills/Tools/provider registries and isolation | substantial verified foundations | Keep as shared infrastructure |
| Financial reserves, reconciliation, receipts | commerce contracts/admission/completion storage exist; full execution incomplete | Keep and finish |
| Research, writing, documents | guidance/model capability; external/artifact execution varies | Keep basic; defer paid promotion |
| WhatsApp and Telegram | adapters/journeys require qualification | Mandatory launch customer channels |
| Background work/scheduling | broader Workflow roadmap | Keep purchase recovery; defer general autonomous routines |
| Agent phone/OmniSIP, SMS/USSD/app automation | planned real-device qualification | Later implementation; preserve existing work |
| World simulation/social lives | foundations exist; broad product promise | Later implementation/exposure; preserve foundations |
| Avatars/video/Studio/social publishing | broader roadmap | Later implementation; preserve existing work |
| Plugins/MCP/A2A, self-improvement/delegation ecosystem | broader roadmap | Later implementation; preserve existing work |
| Multiple business Characters | future ownership class | Proposed defer |

Do not renumber or close Tasks 072-150 to make the launch appear complete.
Keep separate implemented / verified / deployed / launch-required status.
A proposed defer becomes policy only after user decision.

## Provider references checked 2026-10-04

- Flutterwave bills: https://developer.flutterwave.com/docs/bill-payment
- Flutterwave bill execution: https://developer.flutterwave.com/reference/create-a-bill-payment
- NOWPayments API families: https://nowpayments.io/api
- NOWPayments fiat on-ramp: https://nowpayments.io/fiat-on-ramp
- NOWPayments off-ramp: https://nowpayments.io/off-ramp

These references establish documented capabilities, not account access or a live
Masanawa integration. Provider eligibility and end-to-end evidence must still be verified.
