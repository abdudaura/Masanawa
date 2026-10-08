# Masanawa Documentation

## Corrected completeness audit — Contacts plus all unfinished R/C requirements (2026-10-08)

The initial U01–U20 plan is preserved, but new docs now specify human Contacts and the optional consented phonebook as well as remaining R/C and old production debt: [audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [Contacts contract K13–K20](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [U21–U30 and F01–F18](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), [28 extra prompts](ADDITIONAL-WINDOW-LAUNCH-PROMPTS-20261008.md), [79 historic unchecked entries](LEGACY-150-TASK-RECONCILIATION-20261008.md). C01 #468 already contains a **draft** `HumanContactsScreen`, so do not create a competing contact backend. F lanes recover existing R/C PRs, not overwrite them. Keep shared Gateway/Flutter/ledger/Firebase ownership serialized and unverified feature PRs draft/unmerged.


## AI-first expansion and development reopened (2026-10-08)

The owner lifted the global pause for twenty separately assigned isolated windows. New canonical reading: [product outcomes](AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md), [one authorized action/task protocol](AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [human Chats and opt-in AI assistance](HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md), [twenty U01–U20 implementation assignments](20-WINDOW-AI-CHAT-EXECUTION-20261008.md), [K01–K12 integration acceptance](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md). R/C/J ledgers, Flutter, five-tab navigation and safety still govern. Work #497 remains draft; source can progress in scoped branches but verification/merges remain evidence-gated.


## Flutter-first mobile updates and Shorebird release governance — 2026-10-08

**Owner decision:** no React Native second app. Preserve `apps/mobile` Flutter consumer and its separate Flutter admin companion. [`FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md`](FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md) governs the three change classes (versioned server content, Shorebird signed compatible Dart patch, signed Android/iOS binary), patch signing, version/engine/asset/native compatibility, app-store rules, release/patch provenance, compatibility, incident control, staging and rollback. [`../apps/mobile/docs/SHOREBIRD-QUALIFICATION-RUNBOOK.md`](../apps/mobile/docs/SHOREBIRD-QUALIFICATION-RUNBOOK.md) gives the required proof and CLI sequence. **Planning and policy only: no Shorebird binary/patch, account or devices have been verified.** This does not override the active Work #497 consolidation freeze or CI #457 and does not mark any R/C lane done.


## Backend/database portability and full-stack acceptance audit (2026-10-08)

**All feature owners must read these along with the owner requirement trace and J journeys:** `BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md` (source + Railway evidence and exact unresolved portability/deployment risks), `DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md` (safe fresh-account encrypted backup, migration/restore and financial job-fencing rehearsal), and `BACKEND-FEATURE-TRACEABILITY-20261008.md` (every tab's Flutter→API→auth→repository→migration/media/outbox→readback test contract). They add evidence gates to existing R01–R19/C01–C08 owners, **not a new competing product plan**.

**Complete owned feature code despite an external blocker.** If GitHub Actions #457, provider secrets, hardware or live deployment prevent tests, write them, record the exact deferred commands/risks once and keep the implementation PR draft/unmerged as `IMPLEMENTED_UNVERIFIED`, not DONE. A partial code slice must be marked `PARTIAL_IMPLEMENTATION` and finished by its owner. The database audit did not query production customer rows or restore a backup; it is a read-only architecture/control-plane analysis.


## Implementation kickoff / documentation coverage sign-off (2026-10-08)

**Start independent implementation windows now; the navigation and owner-requirement design is documented.** Read `IMPLEMENTATION-KICKOFF-20261008.md` (definitive lane/dependency/integration handbook) and `REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md` (all 77 P/N/T/M/A/W/Q trace IDs and the 11 J release journeys) **in addition to** the shell and product contracts below. These do not replace `MOBILE-READINESS-PLAN.md` (R01–R19) or `COMMUNICATIONS-EXTENSION-PLAN.md` (C01–C08), and do not mark any code as production ready.

Separate unmerged reference PR #467 is advisory only until reviewed. C01 contact code is in draft #468; R18 #435 touches the same Gateway composition, and the owner-controlled CI recovery remains #457. Read live main/PRs/claims before any overlapping edit. Unapproved features inferred from WhatsApp resemblance are not implementation instructions.


## Owner-approved requirements crosswalk and integrated journeys (2026-10-08)

**Read `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` and `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` for a requirement-by-requirement map of the 7–8 October owner's discussions, the existing R01–R19 / C01–C08 implementation gates, explicitly unapproved comparisons/future ideas, and integrated real-user acceptance scenarios.** These are binding coverage overlays, not new products, a replacement backlog or implementation evidence. Implementation windows must link the exact requirement and journey IDs in their PR/test handoff; old documents never override the owner-approved final five-tab navigation.


## Source of truth — owner-approved five-tab mobile UX (2026-10-08)

**Exactly five bottom tabs, in order: Talks · Chats · Assistant · Wallet · Agents**, with **Assistant in the center**, two tabs on each side. Talks owns former Home Explore/Live public audio and the **Start Talk** FAB; Chats is **human-only** DMs; Assistant is **one** private Gwani/Gwana chat with an **in-chat persona switch**; Wallet owns eligible Billing/Crypto, transfers and distinct balances; Agents owns the Masanawa Expert/Twin roster and My Twin.

**Mandatory product/navigation precedence:** `../CONTINUE-HERE.md` → `APP-SHELL-CONTRACT.md` → `END-TO-END-UX-ARCHITECTURE.md` → `PRODUCT-NORTH-STAR.md` / `MOBILE-SCREEN-ARCHITECTURE.md` → `MOBILE-READINESS-PLAN.md` (R01–R19) and `COMMUNICATIONS-EXTENSION-PLAN.md` (C01–C08) → `MULTI-WINDOW-WORK.md` for current ownership. Every current implementation window must read the final shell contract, regardless of older README or dated links. The current Flutter APK has **not** yet implemented and qualified this complete target.

## Canonical product and acceptance documents

- `APP-SHELL-CONTRACT.md` — authoritative labels, exact placement, aliases, header/FAB rules.
- `END-TO-END-UX-ARCHITECTURE.md` — end-to-end routes, journeys and cross-feature privacy, money and voice UX.
- `PRODUCT-NORTH-STAR.md`, `TALKS-PRODUCT.md`, `MOBILE-SCREEN-ARCHITECTURE.md` — product semantics, stages and screens **as amended by the final shell contract**.
- `COMMUNICATIONS-EXTENSION-PLAN.md` — C01–C08 human messaging, sync/cache, internal crypto and Assistant actions.
- `MOBILE-READINESS-PLAN.md` — R01–R19 implemented/tested/deployed/handset evidence gates.
- `VOICE-FIRST-INTERACTIONS.md`, `MOBILE-AGENT-EXPERIENCE.md`, `DEFAULT-AI-PERSONAS.md`, `CONSUMER-SERVICES.md`, `GOLDEN-JOURNEYS.md` — specific interaction contracts and capabilities.
- `MULTI-WINDOW-WORK.md` — nonoverlapping ownership, five-minute lease and shared integration.

Read the scope and findings in `NAVIGATION-DOCUMENTATION-AUDIT-20261008.md` before claiming that old guidance was fully rewritten or application/device behavior verified.

## Historical/technical documents: preserve evidence, never override product direction

`docs/workstreams/`, previous closure audits, phase plans, `docs/migration/`, prior ADRs, old recovery/rollout handoffs and development snapshots record **what was planned or attempted when written**, not today's mobile navigation. They can describe former Home/Agents/Wallet/Talk, Home/Chats/Wallet/Talk, or For You/Live/Create/Activity/You; **none may authorize a new implementation of those retired root layouts**. Use their original commits/tests/status only as historical evidence. A saved screenshot or old instruction isn't current product sign-off.

Architecture/security/domain documents remain authoritative on existing internal invariants, but user-facing navigation, feature visibility and copy follow the explicit five-tab contract when older descriptions conflict. Never erase historical financial, security or testing evidence just to rename screens. Web implementation remains separately deferred, and its future responsive design must match the final five-way functional partition.

**Rule for conflicts:** follow owner-approved five-tab documents; note the stale file in handoff, fix the active guide rather than silently resurrecting an old UI; coordinate source edits with the R17/C08 integration owner. No document is evidence of Flutter tests, API deployment, native audio or provider qualification.
