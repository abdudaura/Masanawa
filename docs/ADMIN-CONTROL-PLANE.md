# Masanawa Admin Control Plane

Status: implementation map for the separate `apps/admin_mobile` control application.

## Goal

The admin app is intended to replace the need for a desktop-only control surface for ordinary platform operations. It must remain a client of authorized server-side control-plane contracts; it must never bypass domain rules by talking directly to PostgreSQL/Supabase or exposing secret material.

## Implemented now

| Area | Mobile admin capability | Server authority |
| --- | --- | --- |
| Overview | Ops health/readiness and tenant-wide counts | `platform.summary.read` |
| Users & Identity | list users, identity/relationship counts, activate/disable/archive with optimistic revision | `identity.users.read/write` |
| Agents | list and edit presentation, visibility, sort order | existing Agent admin capabilities |
| Skills | catalog/readiness and per-Agent assignment | existing Skill admin capabilities |
| Runtime | recent AgentRuns, state, failure and correlation trace | `agents.runs.read` |
| Commerce | Offers, fulfillments and immutable ledger activity | `commerce.read` |
| Operations | consequential Operation state and provider outcome | `operations.read` |
| Reconciliation | unresolved/active reconciliation cases and safe-retry metadata | `reconciliation.read` |
| Providers | encrypted credential reference metadata only; never ciphertext/plaintext | `providers.credentials.read` |
| Audit | audit event identity, aggregate, correlation and sensitivity metadata | `audit.read` |
| Memory | record lifecycle and extraction queue health counts | `memory.admin.read` |
| Queues | inbox/outbox pending/retry/failure/dead-letter counts | `queues.admin.read` |
| Worlds | world status/generation/policy revision diagnostics | `world.admin.read` |
| Approvals | approval request/status metadata | `approvals.admin.read` |
| Modules | visible readiness map for domains still being implemented | local projection of canonical roadmap |

The UI uses a responsive NavigationRail on wide/tablet screens and a NavigationDrawer on narrow phones.

## Next safe write controls

These are legitimate admin features, but they require a canonical command/use-case contract rather than a direct SQL mutation:

- approval approve/deny/revoke, with a real operator Principal/approver identity;
- Offer create/revise/enable/disable through Commerce commands;
- reconciliation check/retry/resolve actions through Operation/Reconciliation APIs;
- provider credential rotate/revoke/health-test without exposing credential material;
- World pause/resume/restart and governed canon-event administration;
- Memory correction/tombstone/purge tools with scope/privacy authorization;
- external identity/account linking and relationship administration;
- policy revision, authority revocation and operator role/capability administration;
- searchable/paginated detail views for receipts, inbox/outbox items and correlations.

## Domains integrating from active workstreams

These must use their canonical contracts as they merge; the admin app must not duplicate their state machines:

- WhatsApp and Telegram channels: bindings, webhook health, message failures and receipts;
- Devices/Agent Phone: registration, pairing, capability health, Character assignment, credential revocation, OmniSIP/SMS/USSD;
- Workflows: definitions, runs, tasks, leases, retries, dead letters, schedules and human requests;
- Billing and crypto: provider qualification, catalog, balances, transaction/refund/custody/reconciliation administration;
- Social/Studio: account bindings, drafts, approvals, publication receipts and media operations;
- Plugins: catalog, installation/configuration, authority and health.

## Production prerequisites

1. Production admin identity/session contract. The bootstrap bearer credential screen is temporary.
2. Role/capability policy for multiple operators and least-privilege administration.
3. Public/reachable Ops deployment configured separately from customer Gateway traffic.
4. Audit evidence for every consequential admin mutation.
5. Pagination/search/filter contracts for high-volume collections.
6. Real Flutter analyze/build/device verification.
7. CI runner availability; current GitHub Foundation CI may terminate before checkout with zero steps.

## Completion rule

The admin app is considered a full platform control plane only when every production domain has one of:

- a live authorized read/write administration surface; or
- an explicit immutable/no-admin-action status where platform architecture intentionally forbids mutation.

A placeholder is not completion. A direct database shortcut is not completion. A feature on an unmerged workstream is not completion.
