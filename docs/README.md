# Masanawa Documentation

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
