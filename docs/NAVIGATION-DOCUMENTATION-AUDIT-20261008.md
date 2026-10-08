# Navigation Documentation Audit — 2026-10-08

## Outcome and truthfulness boundary

**Approved final consumer navigation:** **Talks · Chats · Assistant · Wallet · Agents**, exactly five bottom tabs with **Assistant in the middle**. **Talks** subsumes former Home Explore/Live/public audio, **Chats** contains real-person direct messages, **Assistant** is one private Gwani/Gwana voice/text/tap conversation with an in-chat switch, **Wallet** owns qualified money/services, **Agents** retains full Expert/Twin discovery and management.

The target is **design-approved, not Flutter-, backend-, CI-, provider-, deployed- or handset-verified**. This documentation audit must not be mistaken for R17/C08 or C01–C08 completion.

## Inventory and checking method

From the live PR branch Git tree, **296 Markdown files** were inventoried by path (including ROOT/doc entrypoints; directory sizes can evolve). Categories at inventory time: **62 top-level docs files**, **130 docs/workstreams**, **65 docs/migration**, **12 docs/adr**, **5 apps**, **6 packages**, **16 root/other**. The counted top-level docs include a later-added authoritative `docs/README.md`; subsequent archive READMEs may increase the count.

- **All 61 pre-existing top-level `docs/*.md` documents** were read through the connected GitHub integration and scanned for obsolete four-tab routes, Home/Agents/Wallet/private Talk instructions, bottom-tab language and deprecated primary-nav variants; operative findings were corrected in the same PR.
- **Root `README.md`, `CONTINUE-HERE.md`, `apps/mobile/README.md` and selected historical R17/communications handoffs** were also inspected and updated to provide precedence. `docs/README.md` establishes a single authoritative hierarchy.
- **The Git tree inventory was checked across historical directories**, but historical `docs/workstreams`, migration donor records and ADRs were **not individually audited for every old sentence**. They are explicitly classified as dated, non-authoritative for consumer navigation in their new directory `README.md` files and the central documentation index. Their original text/commits are retained as evidence instead of falsifying history.
- A second pass re-read operative `CONTINUE-HERE`, root README, `docs/README`, shell, end-to-end UX, screen architecture, communications, multi-window, R readiness, North Star and voice contracts. Every checked operative document contains the approved five-tab target. Surviving references to former four-tab structures in current contracts are **explicitly phrased as superseded or historical**, not current instructions.
- This is a **textual policy/consistency audit**. It did **not** execute Flutter/widget/app/server tests, check running deployment, perform device tests, or prove all relative Markdown links and historic legal/compliance claims.

## Canonical hierarchy for implementation windows

1. `CONTINUE-HERE.md` — latest product/repository handoff and outstanding issues.
2. `docs/APP-SHELL-CONTRACT.md` and `docs/END-TO-END-UX-ARCHITECTURE.md` — final five-tab destinations, routes, controls and action/return boundaries.
3. `docs/PRODUCT-NORTH-STAR.md`, `docs/TALKS-PRODUCT.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md`, `docs/MOBILE-AGENT-EXPERIENCE.md`, `docs/VOICE-FIRST-INTERACTIONS.md` — product/screen/interaction semantics, subordinated to the final bottom-nav decision.
4. `docs/MOBILE-READINESS-PLAN.md` (R01–R19), `docs/COMMUNICATIONS-EXTENSION-PLAN.md` (C01–C08), and `docs/MULTI-WINDOW-WORK.md` (exact path claims, 5-minute lease) — acceptance and implementation coordination.
5. Dated `docs/workstreams/`, `docs/migration/`, `docs/adr/`, old phase/closure records, screenshots and stale PRs — history/technical evidence **only**, never a competing final navigation design.

## Actual conflicts resolved in PR #465

- Four-tab `Home · Agents · Wallet · Talk`, optional `Home · Chats · Wallet · Talk`, old `For You · Live · Create · Activity · You`, and an initial proposed `Home · Chats · Wallet · Assistant` are **not current navigation targets**.
- The public **Talks** destination absorbs Home Explore/Live and the sole **Start Talk** FAB; there is no separate Home tab, duplicate public Talks tab, sixth root or a public Start Talk FAB on Agents/Chats.
- **Human Chats** use `/messages` namespace; historical `/chats` is a **private AI** alias and `/chat/:characterId` an AI persona thread. Typed ID, auth, notification and back-state compatibility must be implemented/tested before migration.
- The **Assistant center chat** switches Gwani/Gwana **inside one user-scoped chat**, preserving only authorized history/drafts, persona attribution, pending tasks, voice/text/tap parity and fresh money consent; Agents remains distinct Expert/Twin browsing.
- **DM Transfer** is not a message Send arrow; Wallet/DM/Assistant reuse one authenticated ledger quotation, explicit confirmation, once-only settlement and receipts.
- Public audio, human voice notes, private Assistant mic/DM content and financial details are isolated; no automatic recording or charge on entering a tab.
- Deferred consumer Web navigation was realigned to the same five functional areas without authorizing web launch.
- Existing R01–R19, C01–C08, product economics, WhatsApp/Telegram links, security and CI incident #457 remain intact and **unverified where previously unverified**.

## Non-goals and remaining evidence

No functionality was implemented by this documentation change. The dedicated shared R17/C08 integration owner must implement and qualify the **one** final shell migration, not rebuild a temporary predecessor; C01–C07 and R owners coordinate nonoverlapping backend/Flutter/auth/commerce/audio contracts. Documentation QA and normal GitHub mergeability are not substitute evidence for executable CI, real Android, production provider qualification or funds transfer authority.
