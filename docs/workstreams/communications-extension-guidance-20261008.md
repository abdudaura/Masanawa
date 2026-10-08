# Communications extension guidance — documentation coordination claim

- Owner/window: ChatGPT voice-session documentation coordinator, 2026-10-08.
- Branch: `docs/communications-extension-multiwindow-20261008`
- Base `main` SHA: `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
- References: issues #462 (extension), #463 (human DMs/performance), #457 (shared CI); existing R01–R19.
- Workstream scope: **documentation coordination only**, no application implementation, no claim on financial, identity, mobile shell, Gateway or infrastructure code.
- Intended owned paths (documentation only): this claim; new `docs/COMMUNICATIONS-EXTENSION-PLAN.md`; bounded additive references in `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/MOBILE-READINESS-PLAN.md`, `docs/PRODUCT-NORTH-STAR.md`, `docs/APP-SHELL-CONTRACT.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md`, `docs/VOICE-FIRST-INTERACTIONS.md`, `docs/CONSUMER-SERVICES.md`.
- Current step: publish visible claim in draft coordination PR, inspect any newer shared-doc edits immediately before updates, create canonical extension ledger and safe independent workstream prompts.
- Boundaries: latest approved **Home · Agents · Wallet · Talk** remains shipping shell; **Home · Chats · Wallet · Talk** is a conditional future UI gate, not authorized early replacement. All existing Talk product, roster, creator economy and R01–R19 requirements remain intact. The new extension must not become a duplicate ledger/payment engine or destabilize the ongoing implementation branches.
- Shared dependencies: app routes/navigation, identity/privacy, migrations, session/auth, push, media storage, wallet/crypto ledger, assistant action gateway require integration coordination before dependent code changes. CI is owned by the designated Work window per #457.
- Source: inspected `main` canonical guidance, issues #462/#463, existing open PRs. Most open PRs target R tasks and own claim files; recheck shared paths before every write.
- Verification at claim: GitHub source inspections only. No application code changed/tested/deployed, no hardware/performance measurements, no claim that extension implementation exists.
- Lease: expires after five minutes of no **repository-visible** activity, per `docs/MULTI-WINDOW-WORK.md`. Stale claim doesn't reserve these files. Every future editor must inspect latest `main` and active claims.
- Handoff: Open a reviewable docs PR and preserve a complete cross-window implementation map. Avoid direct `main` writes.
