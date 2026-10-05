# Masanawa Admin Control Plane

Status: implementation map for the separate `apps/admin_mobile` control application.

## Goal

The admin app is intended to replace the need for a desktop-only control surface for ordinary platform operations. It must remain a client of authorized server-side control-plane contracts; it must never bypass domain rules by talking directly to PostgreSQL/Supabase or exposing secret material.

## Implemented now

| Area | Mobile admin capability | Server authority |
| --- | --- | --- |
| Overview | Ops health/readiness and tenant-wide counts | `platform.summary.read` |
| Users & Identity | list users with bounded lifecycle filtering, identity/relationship counts, and privacy-safe canonical relationship drill-downs; lifecycle changes remain read-only until Identity exposes a canonical state-transition command | `identity.users.read` |
| Agents | list/configure/edit presentation, visibility and sort order; show canonical Character ownership kind without owner identity | existing Agent admin capabilities |
| Skills | catalog/readiness and per-Agent assignment | existing Skill admin capabilities |
| Runtime | recent AgentRuns, bounded state filtering, failure and correlation trace | `agents.runs.read` |
| Commerce | full Offer create/revise editor with SkillVersion binding, pricing/commission/region invariants and enable state; fulfillments and immutable ledger activity | `commerce.read/write` |
| Operations | consequential Operation state/provider outcome plus safe external-receipt drill-down with payload material excluded | `operations.read` |
| Reconciliation | unresolved/active reconciliation cases and safe-retry metadata | `reconciliation.read` |
| Providers | encrypted credential reference metadata plus canonical revocation; never ciphertext/plaintext | `providers.credentials.read/write` |
| Audit | audit event identity, aggregate, correlation and sensitivity metadata | `audit.read` |
| Memory | record lifecycle and extraction queue health counts | `memory.admin.read` |
| Queues | inbox/outbox pending/retry/failure/dead-letter counts | `queues.admin.read` |
| Worlds | world status/generation/policy revision diagnostics plus canonical pause/recover | `world.admin.read/write` |
| Approvals | approval request/status metadata | `approvals.admin.read` |
| Modules | visible readiness map for domains still being implemented | local projection of canonical roadmap |

The UI uses a responsive NavigationRail on wide/tablet screens and a NavigationDrawer on narrow phones.

Admin authentication now reuses canonical PlatformSession OTP/access/refresh tokens. Ops then applies a separate tenant-scoped capability grant keyed by canonical User ID or verified email/phone, so authenticating as a normal Masanawa customer never implies administrative authority.

### Conversational administration and Jev

Gwani is the conversational administrative Character. Other Characters may be delegated explicitly, but JEV is **not** an Agent/Character and must never be presented as one.

Jev (TypeSafe AI System One) is the decision-model layer for machine-readable judgments around proposed admin work. Its role is to consume structured platform state plus predefined questions and return typed decisions/probabilities used for routing, ambiguity detection, escalation, verification and confidence thresholds.

Jev never owns authority. Exact tenant/capability checks, immutable domain invariants, approval requirements, idempotency, reconciliation and execution remain enforced by Masanawa code. A Jev decision can recommend or gate a path, but cannot grant a capability that the operator/Character delegation does not already possess.

Initial decision flow:
1. operator tells Gwani what to do;
2. Gwani interprets and proposes one or more canonical admin actions;
3. Jev evaluates bounded questions such as intent match, ambiguity, escalation need and confidence;
4. deterministic policy code intersects operator authority, Character delegation and action risk;
5. read-only work may execute automatically when admitted;
6. writes require the configured approval path before canonical command execution;
7. results and evidence return to Gwani for explanation to the operator.

## Next safe write controls

These are legitimate admin features, but they require a canonical command/use-case contract rather than a direct SQL mutation:

- approval approve/deny/revoke, with a real operator Principal/approver identity;
- reconciliation check/retry/resolve actions through Operation/Reconciliation APIs;
- provider credential rotate/health-test without exposing credential material; revocation is already implemented canonically;
- World restart and governed canon-event administration; pause/recover is already implemented canonically;
- Memory correction/tombstone/purge tools with scope/privacy authorization;
- canonical User lifecycle transition command (activate/disable/archive), then external identity/account linking and relationship administration;
- policy revision, authority revocation and operator role/capability administration;
- cursor pagination/search for very large collections plus inbox/outbox/correlation drill-downs; bounded filters and safe Operation receipt drill-downs are already implemented.

## Domains integrating from active workstreams

These must use their canonical contracts as they merge; the admin app must not duplicate their state machines:

- WhatsApp and Telegram channels: bindings, webhook health, message failures and receipts;
- Devices/Agent Phone: registration, pairing, capability health, Character assignment, credential revocation, OmniSIP/SMS/USSD;
- Workflows: definitions, runs, tasks, leases, retries, dead letters, schedules and human requests;
- Billing and crypto: provider qualification, catalog, balances, transaction/refund/custody/reconciliation administration;
- Social/Studio: account bindings, drafts, approvals, publication receipts and media operations;
- Plugins: catalog, installation/configuration, authority and health.

## Production prerequisites

1. Persisted admin role/policy administration beyond the current explicit server-side `MASANAWA_OPS_ADMIN_GRANTS_JSON` mapping.
2. Operator Principal/AuthorityContext binding for approval decisions and other governed actions.
3. Public/reachable Ops deployment configured separately from customer Gateway traffic, with the Gateway retained for OTP/session issuance.
4. Audit evidence for every consequential admin mutation.
5. Cursor pagination/search contracts where bounded state/status filtering is insufficient for very large collections.
6. Real Flutter analyze/build/device verification.
7. CI runner availability; current GitHub Foundation CI may terminate before checkout with zero steps.

## Completion rule

The current-main admin surface is complete only when every currently implemented production domain has one of:

- a live authorized read/write administration surface; or
- an explicit immutable/no-admin-action status where platform architecture intentionally forbids mutation.

A placeholder is not completion. A direct database shortcut is not completion. A feature on an unmerged workstream is not completion.
