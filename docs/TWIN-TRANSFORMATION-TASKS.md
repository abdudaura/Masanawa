# Masanawa Twin Transformation Task Ledger

Status: canonical supplemental transformation ledger, 2026-10-05.

This ledger does **not** renumber or replace the historical 150-task production ledger.
Use TWIN-xxx IDs for the digital-twin product transformation. A task is complete only
after implementation and relevant acceptance evidence are merged to `main`.

## Product truth and coordination

- [ ] **TWIN-001** Merge Product Twin Economy canonical overlay and cross-doc alignment.
- [ ] **TWIN-002** Merge master transformation plan, screen spec, economy contracts and
  multi-window ownership map.
- [ ] **TWIN-003** Remove contradictory user-facing reseller/paid-AI-work assumptions
  from active product docs while preserving internal commerce invariants.
- [ ] **TWIN-004** Add architecture tests/doc gates preventing a second wallet, clone
  runtime, marketplace service or social-post subsystem.

## Twin identity, customization and public profile

- [ ] **TWIN-010** Define canonical public twin profile projection and discoverability.
- [ ] **TWIN-011** Add stable public share/deep-link identity with privacy-safe lookup.
- [ ] **TWIN-012** Separate private owner memory from representational/public twin memory.
- [ ] **TWIN-013** Add conversational customization commands for low-risk profile/memory.
- [ ] **TWIN-014** Require explicit confirmation for consequential standing twin changes.
- [ ] **TWIN-015** Fold first-run clone setup and ongoing customization into My Twin.

## Explore and free text

- [ ] **TWIN-020** Add authorized public twin discovery/search contract.
- [ ] **TWIN-021** Build Explore mobile screen from public twin projections.
- [ ] **TWIN-022** Support public share/deep-link -> twin conversation.
- [ ] **TWIN-023** Ensure public twin text chat is free and cannot accidentally invoke
  paid voice charging.
- [ ] **TWIN-024** Clearly label AI representation vs real owner presence.

## Wallet, Credits and attribution

- [ ] **TWIN-030** Define simple Wallet projection over canonical Commerce/crypto/billing.
- [ ] **TWIN-031** Implement idempotent user-to-user Credit transfer.
- [ ] **TWIN-032** Preserve Credit value provenance and prohibit commission on internal
  transfers/circular movement.
- [ ] **TWIN-033** Add gift/blessing transaction reason, receipt and owner attribution.
- [ ] **TWIN-034** Define configurable creator/acquisition commission policy.
- [ ] **TWIN-035** Attach originating twin attribution to qualifying external funding.
- [ ] **TWIN-036** Attach originating twin attribution to eligible platform purchases.
- [ ] **TWIN-037** Implement refund/reversal/chargeback commission reversal.
- [ ] **TWIN-038** Build Wallet mobile screen and reusable Send/Gift sheet.

## Paid feature trials

- [ ] **TWIN-039** Implement reusable admin-configurable paid-feature trials;
  initial default is 7 days from first qualifying use, with versioned duration/enablement/
  optional usage-cap policy and zero-charge settlement while eligible.

## Paid twin voice

- [ ] **TWIN-040** Define voice product/pricing/metering contract.
- [ ] **TWIN-041** Add pre-use quote/consent and per-session spend cap.
- [ ] **TWIN-042** Meter native/Gemini Live paid usage through deterministic server truth.
- [ ] **TWIN-043** Settle configured owner revenue share and platform revenue.
- [ ] **TWIN-044** Add interrupted-call/ambiguous-usage reconciliation and refunds.
- [ ] **TWIN-045** Add paid voice entry points to existing chat without cluttering free text.

## Paid access to the real owner

- [ ] **TWIN-050** Define owner-access availability, duration and bounded pricing policy.
- [ ] **TWIN-051** Implement owner-chat request and quote.
- [ ] **TWIN-052** Implement payment hold/escrow-like reservation using canonical Commerce.
- [ ] **TWIN-053** Implement owner accept/decline/expiry state machine.
- [ ] **TWIN-054** Implement scheduling and requester/owner notifications.
- [ ] **TWIN-055** Implement attendance/completion evidence for text/voice session types.
- [ ] **TWIN-056** Settle completed owner sessions; refund failed/expired sessions.
- [ ] **TWIN-057** Add dispute/reconciliation handling.
- [ ] **TWIN-058** Add Request Owner sheet/status UI from twin conversation.

## Activity and creator insight

- [ ] **TWIN-060** Define privacy-safe twin activity event projection.
- [ ] **TWIN-061** Include visits, conversations, voice, purchases, gifts, owner requests
  and earnings events.
- [ ] **TWIN-062** Build Activity mobile screen.
- [ ] **TWIN-063** Add compact My Twin performance summary without addictive vanity metrics.

## Mobile simplification and navigation

- [ ] **TWIN-070** Create My Twin primary screen.
- [ ] **TWIN-071** Create four-tab navigation: My Twin, Explore, Activity, Wallet.
- [ ] **TWIN-072** Remove creator economy/Agent Float prominence from Settings.
- [ ] **TWIN-073** Remove user-facing Skill management from the ordinary journey.
- [ ] **TWIN-074** Preserve rich chat features while simplifying twin-specific actions.
- [ ] **TWIN-075** Keep Settings limited to account/privacy/security/language/help.
- [ ] **TWIN-076** Verify accessibility, narrow screens and low-end Android performance.

## Integration and migration

- [ ] **TWIN-080** Add append-only schema migrations for new Commerce/identity projections.
- [ ] **TWIN-081** Compose new routes/services through existing Gateway only.
- [ ] **TWIN-082** Wire mobile transports/providers without direct repository access.
- [ ] **TWIN-083** Reconcile active billing/crypto/auth branches before shared integration.
- [ ] **TWIN-084** Preserve existing migration checksums and deployed production state.
- [ ] **TWIN-085** Migrate existing personal clones/economy views without data loss.
- [ ] **TWIN-086** Remove/deprecate obsolete endpoints only after client compatibility gate.

## Abuse, finance and privacy

- [ ] **TWIN-090** Prevent self-referral/self-gift/circular-transfer commission farming.
- [ ] **TWIN-091** Add rate/spend limits for transfers, gifts and paid voice.
- [ ] **TWIN-092** Add chargeback/refund negative-balance/recovery policy.
- [ ] **TWIN-093** Protect private owner memory from public twin responses.
- [ ] **TWIN-094** Add blocking/reporting/discoverability controls.
- [ ] **TWIN-095** Add minor/identity/impersonation policy gates appropriate to launch.
- [ ] **TWIN-096** Audit human-owner session privacy and recordings policy.

## Production acceptance

- [ ] **TWIN-100** End-to-end: create twin -> share -> free public text chat.
- [ ] **TWIN-101** End-to-end: fund/purchase through twin -> correct attribution/commission.
- [ ] **TWIN-102** End-to-end: Credit transfer -> no commission duplication.
- [ ] **TWIN-103** End-to-end: gift -> correct owner receipt.
- [ ] **TWIN-104** End-to-end: paid voice -> quote -> usage -> settlement/refund.
- [ ] **TWIN-105** End-to-end: paid owner request -> hold -> completion -> settlement.
- [ ] **TWIN-106** Recovery: crashes/retries do not duplicate money or sessions.
- [ ] **TWIN-107** Privacy: public twin cannot expose private owner memory.
- [ ] **TWIN-108** APK/device acceptance on real Android.
- [ ] **TWIN-109** Production deployment/readiness/rollback evidence.
