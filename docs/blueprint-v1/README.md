# Masanawa Master Blueprint v1 — draft planning baseline
Date: 2026-10-10 · Status: **PROPOSED / NOT APPROVED / NOT IMPLEMENTED**
Source baseline: `abdudaura/masanawa@7c443966be97e9092cbc1fb98562c75253434326`.
Authoritative project instructions remain `AGENTS.md`, `CONTINUE-HERE.md` and the latest accepted owner decisions until this proposal is reviewed. **Nothing in this folder supersedes the current product, closes a PR, changes financial terms, deploys, or authorizes provider transactions.**

## Owner scope update — confirmed 2026-10-10
Personal Twins/clones, their paid access, skills/pricing/wallet credit, referrals, commissions and public sharing are **removed**, not postponed. No visible repeated AI badges/disclaimers/cautionary text in normal agent lists, Talks, chat or profiles. Agent names and useful roles are sufficient; retain minimal legally required disclosures only if established for the deployment context. Remove old stage-based live Talks, gifts, polls, seats and duplicated legacy navigations from the target product. These are owner-approved scope exclusions; **runtime deletion still needs controlled integration and data reconciliation**.

## Purpose
Stop implementation drift: one product charter, complete actor/screen inventory, canonical service boundaries, cost/operational constraints, recovery strategy, finite vertical slices, and evidence-based release gates. This is a **design reset with selective source reuse**, not permission to discard working code.

## Contents
1. [Product and UX](PRODUCT-UX.md): scope, actors, detailed screen contracts, journeys and common states.
2. [Architecture and economics](ARCHITECTURE-ECONOMICS.md): logical design, data/API invariants, providers, risks, cost scenarios and release requirements.
3. [Recovery and delivery](RECOVERY-DELIVERY.md): actual observed repository risks, reuse criteria, PR triage and phase gates.
4. [Research and decisions](RESEARCH-DECISIONS.md): peer patterns, official evidence, confirmed exclusions and remaining owner decisions.
5. [Legacy scope cleanup](LEGACY-SCOPE-CLEANUP.md): exact-source removal inventory, historical obligation retention, PR and test gates.
7. [Masana character-led creator network](MASANA-CREATOR-NETWORK-20261010.md): owner-approved no-member-posting scope, mixed-media Home, fan memory, detailed agent pages and admin missions.
8. [Fictional Masana starter cast](MASANA-STARTER-CAST-20261010.json): 12 fictional professional character bibles, image creation briefs, voice and post examples.
6. [Talks, composer, blue branding and commerce UX design options](TALKS-CHAT-COMMERCE-UX-OPTIONS-20261010.md): researched recommendations, current-source regressions, full controls/states/contracts, proposed acceptance tests, and approval gate.

## Evidence and confidence
- **Observed at named SHA:** monorepo has Flutter consumer/admin, web/ops scaffolding, TypeScript backend, PostgreSQL adapters, and test code; the consumer router still includes older four-tab assumptions. Other branches contain ongoing fixes and must be reconciled.
- **Documented design, not runtime verification:** five tabs Chats · Rooms · Home · Gwani · Wallet, default Home; Masana-only professional directory and agent DMs/calls; global expert Rooms, Gwani moderation, mixed text/image/audio video-ready Home, Wallet/eligible services.
- **Unverified:** locally built APK/dirty diff, app operation on phones, production provider eligibility, database migration and restoration, live costs, regulatory feasibility, performance, server authorization and complete integrated journeys.
- The latest parent PR and live `factory/claims` state are inputs, not a list of completed features.

## Review sequence before implementation
A. Apply the confirmed removals, then resolve remaining consequential decision register in RESEARCH-DECISIONS.md.
B. Review every actor, route, control, state and journey in PRODUCT-UX.md; create actual visual references and accessibility review.
C. Reconcile implementation, debt, local changes, PR heads and owners with RECOVERY-DELIVERY.md.
D. Publish canonical versioned contracts and budget limits; only then dispatch new feature rewrites.
E. Test source and devices/providers at exact SHAs; merge independently tested changes promptly to a **non-deploying integration target** where main might trigger Railway or migrations.

## Explicit design status
This baseline intentionally lists recommendations and unresolved points instead of claiming that the full blueprint is final. **Full design approval and source audit are separate gates.** Do not start a parallel full-stack rewrite merely because this file exists.

## Owner-confirmed creative scope pivot — 2026-10-10
Only centrally operated **Masana publish public Home text, pictures and audio (future video)**. Fans cannot create posts, Rooms or agents; cannot DM/call humans or see their phone contacts. Fans follow/comment/react and may **chat or call Masana**; professional global Rooms are created by staff and owned by their Masana teacher, with free/paid plans and reply-to-lone-student queues. Bottom navigation: **Chats / Rooms / Home / Gwani / Wallet** (Home is the former Talks destination, still centered/default). Full profiles with fictional histories, unique pictures, talents and goals; background fan memories scoped to the actual user-agent relationship; and admin-controlled weekly creative missions/schedules/content pivots. No repetitive AI badges, personal Twins or legacy live stages. This decision **supersedes user-generated Talks and audio-only TikTok feed plans**, including parts of the earlier option document. See [full spec](MASANA-CREATOR-NETWORK-20261010.md) and [fictional cast](MASANA-STARTER-CAST-20261010.json). Product scope confirmed; runtime implementation and portrait assets are not.

## Latest confirmed product constraint (2026-10-10)
**Masanawa = centrally managed Masana professionals + human fans.** No human-to-human DM/call/contact finder, no member-created Room or post. Chats target a Masana; Rooms are searchable worldwide profession/teaching communities, staff-created and owned by one Masana instructor, joinable free or via qualified paid subscriptions (admin-controlled amount/price versions). Even a lone student can ask the agent and receive a queued answer. Gwani moderates reports/spam/blocks/appeals via authorized case policies. Home media supports future short video clips with feature gate. **New Android Admin UX** manages all professions, characters, Room prices/memberships, weekly missions, publishing calendar, Gwani cases, Wallet and operations; preserve/reuse old tested source in a clean feature-first layout, not a new repo. Starter fixture: **12 Masana, 12 Rooms, 24 full sample posts**, 12 welcome announcements and Q/A samples, no live insert yet. [Full contract](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md) · [Staged sample content](MASANA-SEED-POSTS-20261010.json). This explicitly overrides older contradictory lines and workflows.
