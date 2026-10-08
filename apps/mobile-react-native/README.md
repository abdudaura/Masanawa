# Masanawa React Native — parallel consumer client

Status: PLANNING ONLY / NOT BOOTSTRAPPED / NO APK OR IPA / NOT DEPLOYED.
Audit date: 2026-10-08. Audited main: 226d0c58632b243661ab24904cca75700ed474d4.
Initiative: additional React Native consumer application, not Flutter migration, rewrite, or release approval.

## Non-negotiable boundaries

- Preserve apps/mobile (Flutter consumer) and apps/admin_mobile (Flutter administration). Continue maintenance and production work on both independently.
- Preserve apps/web (deferred Next.js consumer web foundation) and apps/ops. Do not create a second Gateway, database, authentication service, AI brain, wallet ledger, event bus, or provider credentials store.
- This directory deliberately has no package.json, Expo app config, React Native source entry point, Gradle/Xcode project, dependencies, or CI configuration yet. It is a reviewable project reservation and audit/implementation plan, NOT an installed app.
- No source, migration, build config, lockfile, server, Flutter, web, or release file outside this directory is changed.
- The 2026-10-08 repository-wide consolidation freeze remains in effect for actual feature implementation. Planning in an isolated directory does not claim R/C lane ownership or grant permission to merge unverified shared changes.
- Follow the existing approved product design: exactly five jobs Talks | Chats | Assistant | Wallet | Agents, Assistant centered on phones. Never reconstruct the old four-tab shell.
- All client interfaces follow the same authenticated tenant-scoped Gateway, authority and versioned contracts. Remote UI configuration cannot bypass server validation, permissions, payment approval or device capability checks.

## Files and reading order

1. docs/01-REPOSITORY-AUDIT.md — files inspected, actual main state vs targets/draft branches, backend and Flutter gaps.
2. docs/02-ARCHITECTURE-AND-CONTRACTS.md — module boundaries, React Native/desktop relationship, auth, events, media, voice and money.
3. docs/03-PARITY-MATRIX-AND-ROADMAP.md — user journeys, cross-client parity and implementation order P0-P6.
4. docs/04-TESTING-RELEASE-UPDATES.md — real device acceptance, security testing, builds, staged releases, rollback and eligible over-the-air (OTA) updates.
5. docs/05-DECISIONS-RISKS-AND-HANDOFF.md — dependency gates, unresolved decisions, adoption/replacement criteria, evidence and final Work integration handoff.

## Proposed code layout (not yet created)

Future implementation after kickoff gate: src/app, src/navigation, src/features/{auth,talks,chats,assistant,wallet,agents,profile,activity,settings}, src/core/{api,auth,events,storage,permissions,media,voice,push,updates,design,localization}, src/components, src/platform, assets, tests/{unit,integration,contract,e2e}, and native android/ios projects when the chosen runtime requires them.

Use these paths as organization guidance, not as permission to install dependencies or generate template screens prematurely. Do not add a package to the root workspace/lockfile before a reviewed RN toolchain/native-media spike.

## Canonical references

../../CONTINUE-HERE.md; ../../docs/IMPLEMENTATION-KICKOFF-20261008.md; ../../docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md; ../../docs/APP-SHELL-CONTRACT.md; ../../docs/END-TO-END-UX-ARCHITECTURE.md; ../../docs/PRODUCT-NORTH-STAR.md; ../../docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md; ../../docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md; ../../docs/MOBILE-READINESS-PLAN.md; ../../docs/COMMUNICATIONS-EXTENSION-PLAN.md; ../../docs/API-LIFECYCLE.md; ../../docs/SECURITY-AUTHORITY.md; ../../docs/MULTI-WINDOW-WORK.md. New planning text is subordinate to these canonical product/security contracts.

Review all active branch claims and newer main changes again before beginning implementation.