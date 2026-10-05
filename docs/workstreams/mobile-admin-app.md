# Mobile admin control plane — 2026-10-05

Owner/window: ChatGPT mobile admin control-plane implementation, explicitly assigned by the user to make the separate admin app capable of replacing desktop administration for the platform.

Branch: `work/mobile-admin-app-20261005`
Original base: `24c8ed783cc2b4797e2c915a698b69ee997f3995`
Reconciled with current `main` through `a97df254ff04c717e940a7c86f4b5824dea7629d` via merge commit `c11e6bfd410580ec7afb500a5c4b305273c9aeaa`.

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
- canonical PlatformSession admin login via Gateway email/phone OTP, secure access/refresh storage, startup/automatic refresh and logout revocation; Ops requires separate tenant-scoped per-capability grants by User ID or verified email/phone; legacy bootstrap token is fallback only;
- conversational admin delegation foundation: Gwani/other explicitly delegated Characters can appear in the admin app and open real Gateway CharacterSessions, while Ops owns the delegation envelope and write-approval requirement;
- Jev architecture corrected: Jev is a TypeSafe System One decision model, not a Character. It belongs between Gwani's proposed admin actions and deterministic policy/execution as a typed probabilistic routing/verification/escalation layer; it never receives authority or bypasses capability/approval checks;
- platform Overview/readiness;
- Users/Identity list, bounded lifecycle filters, identity/relationship counts, and privacy-safe canonical relationship drill-downs; lifecycle state mutation is intentionally read-only because current Identity exposes no canonical state-transition command;
- complete Character discovery including unconfigured Characters and privacy-safe canonical ownership kind;
- first-time Agent presentation configuration plus presentation/visibility/order editing;
- per-Agent Skill assignment and Skill readiness catalog;
- AgentRun diagnostics with bounded state filtering;
- full canonical Offer create/revise/enable editor with SkillVersion and pricing invariants, plus fulfillment and immutable ledger views;
- Operation and reconciliation diagnostics, bounded filters, and canonical external-receipt drill-down with payload references/hashes omitted;
- provider credential reference metadata without ciphertext/plaintext plus canonical credential revocation;
- audit metadata;
- Memory lifecycle/extraction and inbox/outbox recovery health;
- World status/generation diagnostics plus canonical pause/recover;
- approval metadata; approval decisions remain gated on real operator Principal identity;
- Modules readiness view for Channels, Devices, Workflows, Social/Studio, Plugins and Agent Phone;
- tenant/capability authorization on every new Ops projection;
- cross-capability same-tenant enforcement in System diagnostics;
- regression coverage for tenant-scoped reads, rejection of direct-SQL user lifecycle mutation, authorization-before-storage and secret-safe credential projection.

Intentionally gated:
- approval approve/deny requires a real operator Principal/approver identity; PlatformSession proves the User but does not fabricate the governed approver Principal/AuthorityContext;
- User lifecycle transition, provider rotation, reconciliation commands, Memory correction/purge and policy/role administration require canonical command/use-case contracts rather than direct SQL shortcuts; provider revocation, Offer enable/disable and World pause/resume already bind canonical storage/domain commands;
- Channels, Devices, Workflows, billing/crypto administration and later Social/Studio/Plugins/Agent Phone controls integrate as their active platform contracts land.

Verification:
- branch was reconciled with current main after the canonical customer PlatformSession work landed; PR #129 returned to zero commits behind main and mergeable before this handoff update;
- current branch is isolated from customer `apps/mobile/**`;
- PR #129 Foundation CI is currently failing before checkout with zero steps and runner_id 0; this is runner allocation failure, not test evidence;
- Flutter/Dart SDK is unavailable in this execution environment, so physical Flutter analyze/APK build is not claimed;
- TypeScript/API source shapes were audited against current schemas and existing domain/storage semantics.

Canonical capability map: `docs/ADMIN-CONTROL-PLANE.md`.

Implementation status: all safely administrable current-main domains are represented; future-domain controls remain integration dependencies, not hidden omissions.
Deployment status: not deployed.
