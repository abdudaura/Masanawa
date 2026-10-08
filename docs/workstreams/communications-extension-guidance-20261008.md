# Communications extension guidance — documentation coordination claim

- Owner/window: ChatGPT voice-session documentation coordinator, 2026-10-08.
- Branch: `docs/communications-extension-multiwindow-20261008`
- Base `main` SHA: `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
- References: issues #462 (extension), #463 (human DMs/performance), #457 (shared CI); existing R01–R19.
- Workstream scope: **documentation coordination only**, no application implementation, no claim on financial, identity, mobile shell, Gateway or infrastructure code.
- Intended owned paths (documentation only): this claim; new `docs/COMMUNICATIONS-EXTENSION-PLAN.md`; bounded additive references in `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/MOBILE-READINESS-PLAN.md`, `docs/PRODUCT-NORTH-STAR.md`, `docs/APP-SHELL-CONTRACT.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md`, `docs/VOICE-FIRST-INTERACTIONS.md`, `docs/CONSUMER-SERVICES.md`.
- Current step: **documentation prepared and reviewed for integration**. Published complete C01–C08 ledger, independent workstream prompt, preservation contract, dependency/release matrix, and additive canonical links in draft PR #464. Remaining step is repository review/integration, not writing the plan.
- Boundaries: latest approved **Home · Agents · Wallet · Talk** remains shipping shell; **Home · Chats · Wallet · Talk** is a conditional future UI gate, not authorized early replacement. All existing Talk product, roster, creator economy and R01–R19 requirements remain intact. The new extension must not become a duplicate ledger/payment engine or destabilize the ongoing implementation branches.
- Shared dependencies: app routes/navigation, identity/privacy, migrations, session/auth, push, media storage, wallet/crypto ledger, assistant action gateway require integration coordination before dependent code changes. CI is owned by the designated Work window per #457.
- Source: inspected `main` canonical guidance, issues #462/#463, existing open PRs. Most open PRs target R tasks and own claim files; recheck shared paths before every write.
- Verification at claim: GitHub source inspections only. No application code changed/tested/deployed, no hardware/performance measurements, no claim that extension implementation exists.
- Lease: expires after five minutes of no **repository-visible** activity, per `docs/MULTI-WINDOW-WORK.md`. Stale claim doesn't reserve these files. Every future editor must inspect latest `main` and active claims.
- Handoff: Open a reviewable docs PR and preserve a complete cross-window implementation map. Avoid direct `main` writes.

## Documentation review checkpoint — 2026-10-08

- Checked the 10-file GitHub PR #464 diff against live `main`: branch 10 commits ahead and zero behind at review, with **Markdown-only** changes. No app, workflow, migration, financial or deployment code changed.
- Verified C01–C08 each have an explicit ownership/dependency/acceptance row in `docs/COMMUNICATIONS-EXTENSION-PLAN.md`; checked the 10 modified/added guiding files and found no missing linked documentation references in the inspected set.
- Preserved R01–R19 as separate implementation gates; kept **Home · Agents · Wallet · Talk** approved and later **Home · Chats · Wallet · Talk** conditional; defined voice/text/tap parity, cached history, privacy, media, transfer authority and non-overlap requirements.
- Verification scope: GitHub Markdown/source consistency review **only**; no executable app, DB, Flutter, provider, deployment or device tests run. This documentation change claims no C implementation acceptance and does not clear shared CI issue #457.
- This coordination claim ends with documentation integration. C01–C08 code owners must publish new, separately scoped claims; the docs branch is not their lease.
