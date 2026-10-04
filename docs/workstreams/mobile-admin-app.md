# Mobile admin control plane — 2026-10-05

Owner/window: ChatGPT mobile admin control-plane implementation, explicitly assigned by the user to make the separate admin app capable of replacing desktop administration for the platform.

Branch: `work/mobile-admin-app-20261005`
Base: `24c8ed783cc2b4797e2c915a698b69ee997f3995`

Owned paths:
- `apps/admin_mobile/**`
- additive admin-only changes under `services/ops/**`
- `docs/ADMIN-CONTROL-PLANE.md`
- `docs/workstreams/mobile-admin-app.md`

Read-only / coordinated dependencies:
- `apps/mobile/**` remains untouched.
- `apps/ops/**` remains untouched.
- Gateway/shared migrations and active billing, crypto, channel, workflow and Device branches remain owned by their existing workstreams.
- New admin controls for those domains must integrate their canonical contracts after merge rather than duplicate their state.

Implemented:
- separately installable Flutter admin app with application id `ng.masanawa.admin`;
- responsive desktop-style NavigationRail on wide screens and NavigationDrawer on phones;
- explicit Ops endpoint requirement; no accidental customer-Gateway default;
- secure bootstrap operator credential storage and protected-route validation;
- platform Overview/readiness;
- Users/Identity list and optimistic activate/disable/archive command;
- complete Character discovery including unconfigured Characters;
- first-time Agent presentation configuration plus presentation/visibility/order editing;
- per-Agent Skill assignment and Skill readiness catalog;
- AgentRun diagnostics;
- Offer, fulfillment and immutable ledger views;
- Operation and reconciliation diagnostics;
- provider credential reference metadata without ciphertext/plaintext;
- audit metadata;
- Memory lifecycle/extraction and inbox/outbox recovery health;
- World status/generation diagnostics;
- approval metadata;
- Modules readiness view for Channels, Devices, Workflows, Social/Studio, Plugins and Agent Phone;
- tenant/capability authorization on every new Ops projection;
- cross-capability same-tenant enforcement in System diagnostics;
- regression coverage for tenant-scoped reads, optimistic user state writes, authorization-before-storage and secret-safe credential projection.

Intentionally gated:
- approval approve/deny requires a real operator Principal/approver identity;
- provider rotation/revocation, Offer mutation, reconciliation commands, World mutation, Memory correction/purge and policy/role administration require canonical command/use-case contracts rather than direct SQL shortcuts;
- Channels, Devices, Workflows, billing/crypto administration and later Social/Studio/Plugins/Agent Phone controls integrate as their active platform contracts land.

Verification:
- current branch is isolated from customer `apps/mobile/**`;
- PR #129 Foundation CI is currently failing before checkout with zero steps and runner_id 0; this is runner allocation failure, not test evidence;
- Flutter/Dart SDK is unavailable in this execution environment, so physical Flutter analyze/APK build is not claimed;
- TypeScript/API source shapes were audited against current schemas and existing domain/storage semantics.

Canonical capability map: `docs/ADMIN-CONTROL-PLANE.md`.

Implementation status: all safely administrable current-main domains are represented; future-domain controls remain integration dependencies, not hidden omissions.
Deployment status: not deployed.
