# Complete remote-branch inventory — 2026-10-09

**CURRENT STATUS: RETAIN ALL; THIS IS A GIT REF SNAPSHOT, NOT PERMISSION TO DELETE OR MERGE.**

Repository: `Baatiku/masanawa`. Retrieved all branches from seven pages of GitHub's authenticated REST branch listing (`GET /repos/Baatiku/masanawa/branches?per_page=100&page=N`), including commit SHAs and GitHub protection flags. Open-PR associations were matched against the four pages of the 70-open-PR REST listing collected in the same window. A branch with **No open PR match** may belong to a closed/merged PR, historical work, or unreviewed unique code; do not equate it with obsolete.

- **Total remote branches:** 583.
- **GitHub open pull requests:** 70; matching branch-name count: 70. Other branches **without an open-PR-head match:** 513.
- Prefix grouping: `work/` 417, `ci/` 30, `docs/` 21, `archive/` 2, other 113 (including `main`).
- Main at branch enumeration: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exact open-PR HEADs/title listing and source-overlap audit: [work-concurrent-verification-snapshot-20261009.md](work-concurrent-verification-snapshot-20261009.md).
- Live branches can advance independently after snapshot. Re-read all heads before any merge or deletion.

## Safe cleanup protocol

1. Do not delete any branch while windows are active or source remains unverified. Freeze the owner handoffs and new changes before computing final SHA relationships.
2. For **each** of the 583 refs, check exact current SHA, whether identical to main, merged ancestry, PR history (open, merged, closed unmerged, absent), protected/current deployment role and unique code/files.
3. Compare unique paths/blobs and document a disposition: `KEEP_ACTIVE`, `MERGED_AND_ACCOUNTED`, `SUPERSEDED_UNIQUE_CONTENT_PRESERVED`, `ARCHIVE_REQUIRED`, or `NEEDS_REVIEW`; record evidence and merge SHA/PR number. Do not infer safety from prefix, age, inactive worktree, or closed PR.
4. Retire only fully reviewed, non-protected, non-active refs after combined source validation and explicit branch-head recheck; never force-update main or delete Firebase #461's branch before device qualification.
5. Produce a post-cleanup listing and a before/after ledger proving every removed reference was accounted for. A clean codebase does not require deleting retained archival evidence unless it has been verified or archived.

## Branch reference snapshot

| Remote branch | Commit SHA (prefix) | Open PR HEAD match | Protected |
| --- | --- | --- | --- |
| `alpha1-deployment-readiness` | `d87d061ebe6f` | No open PR match | — |
| `alpha1-local-phone-test` | `66436884d035` | No open PR match | — |
| `archive/ci-billing-render-apk-20261005l-before-omnisip` | `e5bb5a366ad6` | No open PR match | — |
| `archive/news-v2-before-home-rebase-20261006` | `d476261dfeae` | No open PR match | — |
| `chat-shell-dynamic-renderer` | `fa576af91ddd` | No open PR match | — |
| `ci/backup-billing-render-20261005-7817f803` | `7817f8032a2c` | No open PR match | — |
| `ci/backup-billing-render-20261005b-6636a64b` | `6636a64bfed5` | No open PR match | — |
| `ci/backup-billing-render-apk-20261005j-81b84eb9` | `81b84eb9f61f` | No open PR match | — |
| `ci/backup-billing-render-apk-20261005k-305bc55f` | `305bc55ffb48` | No open PR match | — |
| `ci/backup-billing-render-apk-20261005l-1240854b` | `1240854b5b80` | No open PR match | — |
| `ci/backup-billing-render-apk-20261005l-f2095212` | `f20952127701` | No open PR match | — |
| `ci/billing-render-20261005b` | `9793ca1aa652` | No open PR match | — |
| `ci/billing-render-20261005` | `4515267e9eb6` | No open PR match | — |
| `ci/billing-render-apk-20261005c` | `aa1f3b42e7ac` | No open PR match | — |
| `ci/billing-render-apk-20261005d` | `a3597c941667` | No open PR match | — |
| `ci/billing-render-apk-20261005e` | `a6ca4ff1df9a` | No open PR match | — |
| `ci/billing-render-apk-20261005f` | `62f8e06a7b6a` | No open PR match | — |
| `ci/billing-render-apk-20261005g` | `349dc2189215` | No open PR match | — |
| `ci/billing-render-apk-20261005h` | `b8498f68e2d6` | No open PR match | — |
| `ci/billing-render-apk-20261005i` | `cf2198891562` | No open PR match | — |
| `ci/billing-render-apk-20261005j` | `fd0212ce94d7` | No open PR match | — |
| `ci/billing-render-apk-20261005k` | `4515267e9eb6` | No open PR match | — |
| `ci/billing-render-apk-20261005l` | `5b90222f60fd` | No open PR match | — |
| `ci/billing-render-apk-20261005m` | `5f7323ea8e1b` | No open PR match | — |
| `ci/billing-render-apk-20261005` | `52af63480f7c` | No open PR match | — |
| `ci/home-railway-apk-20261006` | `bce489bf6495` | No open PR match | — |
| `ci/production-apk-qualification-20261005` | `7c87e5608723` | No open PR match | — |
| `ci/production-apk-twin-20261006` | `08e8c4baefee` | No open PR match | — |
| `ci/production-final-verify-20261005` | `dae09e687c97` | No open PR match | — |
| `ci/production-integration-render-20261005` | `dd6b92ac2fbc` | No open PR match | — |
| `ci/story-radio-admin-railway-20261006` | `b006eb87ff90` | No open PR match | — |
| `ci/story-radio-railway-20261006` | `b161dd44b737` | No open PR match | — |
| `ci/story-radio-validation-20261006` | `c25d2c0a7cd8` | No open PR match | — |
| `ci/twin-production-revalidate-20261005` | `7e8dfb652a39` | No open PR match | — |
| `ci/twin-production-validate-20261005` | `f6b47d686155` | No open PR match | — |
| `codex/firebase-masanawa-mobile` | `11de4361eb79` | OPEN PR | — |
| `docs/backend-database-portability-audit-20261008` | `9714dc28cd1e` | No open PR match | — |
| `docs/chatgpt-work-ci-handoff-20261008` | `a2aa1d1ef2a2` | No open PR match | — |
| `docs/communications-extension-multiwindow-20261008` | `4ebbac05f8dd` | No open PR match | — |
| `docs/deferred-web-plan-20261008` | `b53a4887c8b1` | No open PR match | — |
| `docs/final-navigation-ux-architecture-20261008` | `1ec050802ece` | No open PR match | — |
| `docs/five-minute-stale-claim-policy-20261006` | `87a17573a3b5` | No open PR match | — |
| `docs/flutter-shorebird-release-governance-20261008` | `7e80b0071984` | No open PR match | — |
| `docs/full-vision-coverage-audit-20261008` | `ae6a08a1aeb1` | No open PR match | — |
| `docs/hausa-persona-roster-20261008` | `09046003d37f` | No open PR match | — |
| `docs/home-rooms-launch-20261006` | `424a09fe5627` | No open PR match | — |
| `docs/implementation-ready-handoff-20261008` | `356737ec33c6` | No open PR match | — |
| `docs/main-single-source-20261007` | `e0a2c40ea152` | No open PR match | — |
| `docs/messaging-ux-benchmark-20261008` | `2f9c8d5d1712` | OPEN PR | — |
| `docs/mobile-global-readiness-20261008` | `f3fdd6055b9f` | No open PR match | — |
| `docs/owner-access-trial-cap-20261005` | `7d4f51faf4f8` | No open PR match | — |
| `docs/paid-feature-trials-20261005` | `8d7396961971` | No open PR match | — |
| `docs/shell-profile-persona-depth-20261008` | `9383cd9cb1b3` | No open PR match | — |
| `docs/twin-integration-matrix-20261005` | `e01ce8570086` | No open PR match | — |
| `docs/twin-integration-matrix-refresh-20261005` | `4195dd11f574` | No open PR match | — |
| `docs/universal-window-handoff-consolidation-20261008` | `f6d67b17c7f6` | No open PR match | — |
| `docs/voice-first-services-20261008` | `caff0f975296` | No open PR match | — |
| `docs-mobile-admin-checkpoint` | `8adcac937b78` | No open PR match | — |
| `docs-product-north-star-agent-phone` | `c3e25da4cfd8` | No open PR match | — |
| `fix/export-twin-profile-20261005` | `42034da4101a` | No open PR match | — |
| `fix/gateway-missing-media-types-20261007` | `362b6df09643` | No open PR match | — |
| `fix/gateway-typescript-build-20261007` | `1190800d2e9e` | No open PR match | — |
| `fix/mobile-apk-build-20261007` | `ddc876933db3` | No open PR match | — |
| `fix/presence-livekit-version-20261007` | `2f2241fad440` | No open PR match | — |
| `fix/railway-talk-route-collision-20261007` | `dce6432518b3` | No open PR match | — |
| `foundation/architecture-blueprint` | `b19179f22e1f` | No open PR match | — |
| `hotfix-alpha-prepare-ts7` | `1209dd72c527` | No open PR match | — |
| `hotfix-gateway-ts7-alpha` | `9fa0b5e161da` | No open PR match | — |
| `main` | `5e758673ae91` | No open PR match | — |
| `mobile-dynamic-agent-experience` | `0d9a5e3d0d1f` | No open PR match | — |
| `ops/financial-relay-bootstrap-20261005` | `3cf0833a8382` | No open PR match | — |
| `phase0a-memory-architecture` | `a2d853179e86` | No open PR match | — |
| `phase0a-memory-architecture-v2` | `0faaef45a9a9` | No open PR match | — |
| `phase0a-runtime-skills-workflows` | `04759c8ed6ed` | No open PR match | — |
| `phase0/airi-deep-forensics` | `404ab955b5cd` | No open PR match | — |
| `phase0/airi-deep-forensics-v2` | `e6d0c59d6011` | No open PR match | — |
| `phase0/closure-overlaps-coverage` | `3f1e9b932f71` | No open PR match | — |
| `phase0/cws-remaining-forensics` | `4eb53765e711` | No open PR match | — |
| `phase0/cyberverse-deep-forensics` | `fbbc8c846407` | No open PR match | — |
| `phase0/memory-donor-comparison` | `28c5c1124597` | No open PR match | — |
| `phase0/neko-deep-forensics` | `d994ee94f2e7` | No open PR match | — |
| `phase0/openclaw-adoption-boundary` | `c74017553b45` | No open PR match | — |
| `phase0/openclaw-suitability` | `110d393b6662` | No open PR match | — |
| `phase0/openclaw-suitability-delta` | `3a40a3a93861` | No open PR match | — |
| `phase0/presence-donor-comparison` | `9070854464a2` | No open PR match | — |
| `phase0/presence-evidence-reconcile` | `bb95c7d212ab` | No open PR match | — |
| `phase0/reference-source-vault` | `652eaa18e65d` | No open PR match | — |
| `phase0/reference-source-vault-v2` | `98e9740e7b5e` | No open PR match | — |
| `phase0/source-forensics-pass1` | `1b2286822309` | No open PR match | — |
| `phase2-closure` | `14864e7d5a6e` | No open PR match | — |
| `phase2-fault-restart-foundation` | `268d9a0781b7` | No open PR match | — |
| `phase2-next-shells` | `7fa4dd5c7b79` | No open PR match | — |
| `phase3-identity-world` | `d26df96498a8` | No open PR match | — |
| `phase3-nonspatial-closure` | `46dffb5d7eb8` | No open PR match | — |
| `phase3-world-authority-governance` | `e7d770d0788f` | No open PR match | — |
| `phase3-world-canon` | `854822ea89d0` | No open PR match | — |
| `phase3-world-canon-hardening` | `1565c0e3de97` | No open PR match | — |
| `phase3-world-evidence-integrations` | `2a8a0e889c90` | No open PR match | — |
| `phase3-world-evidence-life-state` | `1d83a44602b0` | No open PR match | — |
| `phase3-world-foundation` | `4204035474e7` | No open PR match | — |
| `phase3-world-interactions` | `d03dcee2fc01` | No open PR match | — |
| `phase3-world-recovery-policy` | `8758e519e4e2` | No open PR match | — |
| `phase3-world-routines` | `6cf7a90f2472` | No open PR match | — |
| `phase3-world-routines-rebased` | `c473c96bfdf1` | No open PR match | — |
| `phase3-world-routines-reconciled` | `36c1e8562310` | No open PR match | — |
| `phase4-memory-acceptance-closure` | `d67c9332431a` | No open PR match | — |
| `phase4-memory-candidate-assessment` | `08d7685048ee` | No open PR match | — |
| `phase4-memory-deletion-context` | `dad3f5fe36a3` | No open PR match | — |
| `phase4-memory-extraction-liveness` | `a4a9872763b9` | No open PR match | — |
| `phase4-memory-lifecycle` | `061ab25d85b5` | No open PR match | — |
| `phase4-memory-multisignal-retrieval` | `0b61670a5a95` | No open PR match | — |
| `phase4-memory-reflection-compaction` | `aeec21641f68` | No open PR match | — |
| `phase4-memory-retrieval-projections` | `608e7c86ea36` | No open PR match | — |
| `phase5-credential-custody` | `b6e5e1cdfddc` | No open PR match | — |
| `phase5-credential-resolution` | `064f8017482d` | No open PR match | — |
| `phase5-provider-failures-telemetry` | `d316225858de` | No open PR match | — |
| `phase5-provider-telemetry-credentials` | `98da4f27c2f8` | No open PR match | — |
| `phase5-provider-telemetry-errors` | `0918233563c3` | No open PR match | — |
| `phase5-tool-effect-receipts` | `0ade53fe4032` | No open PR match | — |
| `phase5-tool-effect-receipts-v2` | `0ade53fe4032` | No open PR match | — |
| `phase5-tool-execution-reconciliation` | `8502b302aaee` | No open PR match | — |
| `phase5-tool-receipts-replay` | `e8e9e5f06b09` | No open PR match | — |
| `phase5-tools-providers-foundation` | `c1fb07d15552` | No open PR match | — |
| `phase6-skills-foundation` | `778611828e6d` | No open PR match | — |
| `plan/completeness-audit-contacts-recovery-20261008` | `432f26a0597e` | No open PR match | — |
| `plan/react-native-parallel-20261008` | `226d0c58632b` | No open PR match | — |
| `plan/20-windows-agent-chat-20261008` | `78d07fdce63a` | No open PR match | — |
| `release/mobile-apk-ready-20261006` | `eeb128e27021` | No open PR match | — |
| `task054-implementation-templates` | `3a0a6251a551` | No open PR match | — |
| `task055-adapter-topology` | `931fef83ae1a` | No open PR match | — |
| `task056-test-taxonomy` | `baeba829e34d` | No open PR match | — |
| `task056-test-taxonomy-hardening` | `6d5b6ad93c0d` | No open PR match | — |
| `task057-api-lifecycle` | `fbdd51b0b113` | No open PR match | — |
| `task058-close` | `47932b5792b1` | No open PR match | — |
| `task058-close-task059-skills` | `0f8b24b2c4e3` | No open PR match | — |
| `task058-env-deployment-contracts` | `bc6fb045a577` | No open PR match | — |
| `task059-close` | `95f2a5daf406` | No open PR match | — |
| `task059-skill-schemas` | `3755dbf7b32f` | No open PR match | — |
| `task060-close` | `f2c7e2e73cf4` | No open PR match | — |
| `task060-skill-manifest-import` | `f5f939f7fb69` | No open PR match | — |
| `task061-capability-tool-references` | `6072e2ca40ae` | No open PR match | — |
| `task061-close` | `7a0d87726ca7` | No open PR match | — |
| `task062-close` | `9aaa4174064f` | No open PR match | — |
| `task062-skill-dependency-graph` | `0610eccd5b58` | No open PR match | — |
| `task063-close` | `e39f7394e84a` | No open PR match | — |
| `task063-skill-execution-planning` | `1e1c15b40933` | No open PR match | — |
| `task064-close` | `9a8947045b23` | No open PR match | — |
| `task064-skilltool-subskill-boundaries` | `c72a10295faf` | No open PR match | — |
| `task065-close` | `123eff0645f2` | No open PR match | — |
| `task065-skill-provenance-trust-publisher` | `e17e444716c5` | No open PR match | — |
| `task066-close` | `e1b477fbfd5a` | No open PR match | — |
| `task066-risk-capability-classification` | `eb0ddef003bf` | No open PR match | — |
| `task067-close` | `43c3f4167d72` | No open PR match | — |
| `task067-rehearsal-certification-evidence` | `413fa1b929d5` | No open PR match | — |
| `task068-close` | `9feb193e0c26` | No open PR match | — |
| `task068-readiness-eligibility-revision-pinning` | `66b323703749` | No open PR match | — |
| `task069-close` | `7251c6e62615` | No open PR match | — |
| `task069-trace-failure-semantics` | `83ed96c693a3` | No open PR match | — |
| `task070-close-phase6` | `33c87b929ba5` | No open PR match | — |
| `task070-graceful-acceptance-cleanup` | `863d1b87917b` | No open PR match | — |
| `task070-skills-persistence-acceptance` | `68e8e4002bc7` | No open PR match | — |
| `task071-character-session` | `333030618c0d` | No open PR match | — |
| `task071-completion-handoff` | `d85775833775` | No open PR match | — |
| `task072-alpha1-agent-run` | `4df0575b9bce` | No open PR match | — |
| `task073-inference-hardening` | `98b293b20206` | No open PR match | — |
| `task073-strategy-boundary` | `bbf1bccb9b87` | No open PR match | — |
| `work/admin-publishing-target-revisions-20261006` | `cefd57776ceb` | No open PR match | — |
| `work/admin-whatsapp-linked-control-20261007` | `b1fc201c93a9` | No open PR match | — |
| `work/agent-directory-latency-20261005` | `c5f48eeeaf6a` | No open PR match | — |
| `work/agent-run-budgets-20261005` | `b0caba7903b7` | No open PR match | — |
| `work/android-agent-device-runtime-20261006` | `d9ef72c77127` | No open PR match | — |
| `work/android-approved-automation-20261006` | `6283ec280f29` | No open PR match | — |
| `work/android-device-operation-queue-20261006` | `481249d16240` | No open PR match | — |
| `work/android-device-operation-queue-rebased-20261006` | `7bb711ac7f75` | No open PR match | — |
| `work/avatar-provider-contract-20261006` | `d6998fcda359` | No open PR match | — |
| `work/billing-catalog-authority-20261004` | `89f5978bc0ed` | No open PR match | — |
| `work/billing-customer-journey-20261004` | `caa85d9ecf36` | No open PR match | — |
| `work/billing-funding-gate-20261004` | `605c6edd00d1` | No open PR match | — |
| `work/billing-main-integration-20261005` | `f2a73ac84edc` | No open PR match | — |
| `work/bills-flutterwave-catalog-20261004` | `5b304dad7671` | No open PR match | — |
| `work/c01-private-contact-admission-20261008` | `fefd2443dfd5` | OPEN PR | — |
| `work/c02-durable-human-dm-20261008` | `344c56fd5b55` | OPEN PR | — |
| `work/c02-durable-human-messages-20261008` | `f17f8606eceb` | No open PR match | — |
| `work/c02-private-text-core-20261008-gpt6` | `91973de51384` | OPEN PR | — |
| `work/c03-human-dm-realtime-20261008-gpt6` | `07f52032fc6c` | OPEN PR | — |
| `work/c03-reclaim-realtime-20261008-gpt6` | `65c91bb239f9` | OPEN PR | — |
| `work/c03-retention-operator-20261008-gpt6` | `f3d606e2ae04` | OPEN PR | — |
| `work/c03-retention-recovery-20261008-gpt6` | `0174d52368d1` | No open PR match | — |
| `work/c04-private-voice-notes-20261008` | `39cd76b1304d` | OPEN PR | — |
| `work/c05-protected-dm-cache-20261008` | `0567c829027d` | OPEN PR | — |
| `work/c05-protected-human-chat-cache-20261008` | `0ebf63c1d14b` | OPEN PR | — |
| `work/c06-internal-crypto-book-transfer-20261008` | `532b158e7790` | OPEN PR | — |
| `work/c06-internal-crypto-transfer-20261008-gpt6` | `0950b0ce091e` | OPEN PR | — |
| `work/c07-assistant-workspace-20261008` | `6a0f8e456168` | OPEN PR | — |
| `work/candidate-optimization-promotion-20261006` | `f53c41911d7b` | No open PR match | — |
| `work/canonical-customer-auth-reconcile-20261005` | `1cc34646af9e` | No open PR match | — |
| `work/cellular-call-routing-20261006` | `8dd7a12bf8fa` | No open PR match | — |
| `work/channel-aware-twin-routing-20261007` | `18c0ef48b25c` | No open PR match | — |
| `work/channel-binding-lifecycle-20261006` | `6acb897b02f4` | No open PR match | — |
| `work/channel-binding-postgres-20261006` | `3184aa49212c` | No open PR match | — |
| `work/channel-deterministic-routing-20261006` | `3a5594f41e88` | No open PR match | — |
| `work/channel-identity-resolution-20261006` | `c9b9dd77d4d7` | No open PR match | — |
| `work/channel-ingress-custody-20261006` | `31ea6679e5f5` | No open PR match | — |
| `work/channel-ingress-postgres-20261006` | `7f0846bd283d` | No open PR match | — |
| `work/channel-link-challenge-20261006` | `a19d999f4302` | No open PR match | — |
| `work/channel-link-challenge-postgres-20261006` | `30142daf0d08` | No open PR match | — |
| `work/channel-link-gateway-routes-20261006` | `8bae1c1ec8bf` | No open PR match | — |
| `work/channel-link-gateway-service-20261006` | `27607d5d35c6` | No open PR match | — |
| `work/channels-authorized-media-fetch-20261006` | `c855b2fa88a8` | No open PR match | — |
| `work/channels-provider-http-edges-20261006` | `f40ed7732887` | No open PR match | — |
| `work/channels-webhook-ingress-20261004` | `f6e8dbd1115e` | No open PR match | — |
| `work/character-surface-consistency-20261006` | `260cd98f8bed` | No open PR match | — |
| `work/chat-wallet-billing-20261006` | `4876d80a470a` | No open PR match | — |
| `work/commerce-core-float-commands-20261004` | `116ad6666e28` | No open PR match | — |
| `work/commerce-reconciliation-refund-20261006` | `2c862d9e14ac` | No open PR match | — |
| `work/core-teaching-adaptive-plan-20261006` | `12a071f0f435` | No open PR match | — |
| `work/creator-onboarding-20261004` | `bb11248b6558` | No open PR match | — |
| `work/cross-channel-device-replacement-acceptance-20261006` | `ad8b45276887` | No open PR match | — |
| `work/crypto-mobile-wallet-20261005` | `7c16aa600a9f` | No open PR match | — |
| `work/crypto-nowpayments-catalog-20261004` | `ab3c4a2ed6ae` | No open PR match | — |
| `work/crypto-payment-recovery-20261004` | `cb21805ea58e` | No open PR match | — |
| `work/crypto-production-integration-20261005` | `de9a0f442c6d` | No open PR match | — |
| `work/decision-jev-contracts-20261004` | `f296ddeb7311` | No open PR match | — |
| `work/deletion-optional-field-build-fix-20261008` | `658295e1ad4c` | No open PR match | — |
| `work/deterministic-commerce-journey-20261006` | `e9279476cbf6` | No open PR match | — |
| `work/device-assignment-persistence-20261006` | `b0a1ff95f4e2` | No open PR match | — |
| `work/device-capabilities-20261004` | `316a43a92235` | No open PR match | — |
| `work/device-capability-persistence-20261006` | `fcb4243b1184` | No open PR match | — |
| `work/device-character-assignment-20261006` | `d502fde82532` | No open PR match | — |
| `work/device-credential-persistence-20261006` | `181b73d02642` | No open PR match | — |
| `work/device-operational-credential-20261006` | `e2a8dd3f6ad6` | No open PR match | — |
| `work/device-operational-credentials-20261006` | `654f897c132c` | No open PR match | — |
| `work/device-perception-contracts-20261006` | `a5771c1db7e2` | No open PR match | — |
| `work/device-registration-pairing-20261004` | `81d3c006aeff` | No open PR match | — |
| `work/device-sensor-perception-20261006` | `3ba118ec7fd2` | No open PR match | — |
| `work/evaluation-regression-harness-20261006` | `873b89e4667a` | No open PR match | — |
| `work/flutterwave-relay-client-20261004` | `e5a164f22e9c` | No open PR match | — |
| `work/gateway-compile-contract-repair-20261008` | `54f94105c489` | No open PR match | — |
| `work/gateway-presence-cohost-20261007` | `c075e7625e36` | No open PR match | — |
| `work/governed-learning-promotion-20261006` | `f2e1d8964d32` | No open PR match | — |
| `work/group-room-identity-export-20261006` | `8d0e22e02d8e` | No open PR match | — |
| `work/gwani-session-diagnostics-20261008` | `a583f7a75bc7` | No open PR match | — |
| `work/harness-budgeted-subworkers-20261005` | `317bdb4d5f03` | No open PR match | — |
| `work/harness-canonical-workflow-admission-20261005` | `0fbd242c821c` | No open PR match | — |
| `work/harness-durable-work-20261005` | `44b549048d71` | No open PR match | — |
| `work/harness-execution-control-20261005` | `740dc8edfaea` | No open PR match | — |
| `work/harness-metered-inference-20261005` | `1edb31306c07` | No open PR match | — |
| `work/harness-signal-routing-20261005` | `cf3296b51aac` | No open PR match | — |
| `work/harness-subworkers-20261005` | `ff3ed30852ba` | No open PR match | — |
| `work/home-production-integration-20261006` | `764d179543fd` | No open PR match | — |
| `work/home-rooms-admin-publishing-20261006` | `344e9eb31516` | No open PR match | — |
| `work/home-rooms-billing-qualification-20261006` | `27b3318a0139` | No open PR match | — |
| `work/home-rooms-group-20261006` | `01e8a7996167` | No open PR match | — |
| `work/home-rooms-group-reconciled-20261006` | `0a5b7722eacc` | No open PR match | — |
| `work/home-rooms-internet-cafe-20261006` | `4c3ac73796af` | No open PR match | — |
| `work/home-rooms-news-20261006` | `6ea84ea23a62` | No open PR match | — |
| `work/home-rooms-ops-publishing-20261006` | `7ce071e2d135` | No open PR match | — |
| `work/home-rooms-study-center-20261006` | `e71111ab7ba6` | No open PR match | — |
| `work/home-rooms-work-research-20261006` | `14ef78f5acd2` | No open PR match | — |
| `work/home-shell-20261006` | `b74179d4f374` | No open PR match | — |
| `work/integration-agent-run-recovery-20261004` | `0dff0b2393a8` | No open PR match | — |
| `work/integration-billing-commerce-20261004` | `3632b506626f` | No open PR match | — |
| `work/integration-core-teaching-20261004` | `41370298c0bf` | No open PR match | — |
| `work/integration-current-main-financial-20261005` | `b1ad55a8b33e` | No open PR match | — |
| `work/integration-financial-ops-20261004` | `8ee819920604` | No open PR match | — |
| `work/integration-flutterwave-webhook-live-20261004` | `78b53596ad6a` | No open PR match | — |
| `work/integration-mobile-shell-completion-20261004` | `6fa3d8dea1ad` | No open PR match | — |
| `work/integration-nowpayments-live-20261004` | `39e893e58ef2` | No open PR match | — |
| `work/internet-cafe-gateway-projection-20261006` | `ada2ed3f08a9` | No open PR match | — |
| `work/launch-first10-completion-20261007` | `eeb128e27021` | No open PR match | — |
| `work/learning-promotion-gates-20261006` | `b78b25bf7a2a` | No open PR match | — |
| `work/live-talks-product-reset-20261007` | `3c0f5f527d86` | No open PR match | — |
| `work/livekit-presence-transport-20261006` | `287320b47ad0` | No open PR match | — |
| `work/load-idempotency-operation-pressure-20261006` | `0fff73317fa0` | No open PR match | — |
| `work/mobile-admin-app-20261005` | `5f9470de1f6c` | No open PR match | — |
| `work/mobile-build-validation-20261004` | `5e697261df35` | No open PR match | — |
| `work/mobile-cache-first-ux-20261005` | `8b06f7f2f909` | No open PR match | — |
| `work/mobile-chat-cache-fast-start-20261005` | `ba00cb017fad` | No open PR match | — |
| `work/mobile-chat-first-redesign-clean-20261006` | `956d00694e34` | No open PR match | — |
| `work/mobile-directory-fast-start-20261005` | `f005184f1e3c` | No open PR match | — |
| `work/mobile-first-frame-deferral-20261005` | `5a3e3bbf611e` | No open PR match | — |
| `work/mobile-inline-live-voice-20261006` | `26c185bff533` | No open PR match | — |
| `work/mobile-local-redesign-preserve-20261006` | `a67459d09fb7` | No open PR match | — |
| `work/mobile-local-redesign-propagation-20261006` | `4ebe6a23eec3` | No open PR match | — |
| `work/mobile-local-redesign-repair-20261006` | `13dd4214fb9d` | No open PR match | — |
| `work/mobile-locale-foundation-r11-20261008` | `e1e8d5e976f9` | No open PR match | — |
| `work/mobile-production-auth-20261005` | `738f97e83559` | No open PR match | — |
| `work/mobile-push-readiness-20261005` | `a95f968ecd79` | No open PR match | — |
| `work/mobile-session-first-launch-20261005` | `66e96d5da8b3` | No open PR match | — |
| `work/mobile-shell-pull-ready-20261004` | `36225f050fde` | No open PR match | — |
| `work/mobile-shell-recovery-20261004` | `ba498ce9ec0e` | No open PR match | — |
| `work/mobile-startup-harness-20261005` | `27377e2c564b` | No open PR match | — |
| `work/mobile-startup-production-reconcile-20261005` | `c5a419c41699` | No open PR match | — |
| `work/mobile-whatsapp-redesign-runtime-repair-20261007` | `f104558fbe50` | No open PR match | — |
| `work/my-twin-projection-20261005` | `1d08cfe404aa` | No open PR match | — |
| `work/my-twin-surface-20261005` | `cd570b1914bf` | No open PR match | — |
| `work/news-production-integration-20261006` | `c95db6711baf` | No open PR match | — |
| `work/news-production-integration-v2-20261006` | `6dd01868aa2b` | No open PR match | — |
| `work/observability-slo-runbook-20261006` | `e1b735a2f428` | No open PR match | — |
| `work/omnisip-device-provider-20261006` | `d59fb1d8fee1` | No open PR match | — |
| `work/omnisip-sms-ussd-20261006` | `2e56747269ac` | No open PR match | — |
| `work/omnisip-sms-ussd-capabilities-20261006` | `97c9fbec9a4b` | No open PR match | — |
| `work/ops-slo-incident-runbook-20261006` | `916596da7036` | No open PR match | — |
| `work/owner-session-privacy-policy-20261006` | `3e35462ad0e0` | No open PR match | — |
| `work/perception-content-admission-20261006` | `2e8a2efcbc8b` | No open PR match | — |
| `work/perception-event-contract-20261006` | `050b7249a1b7` | No open PR match | — |
| `work/perception-memory-promotion-20261006` | `8f50d8ed10f8` | No open PR match | — |
| `work/performance-capacity-evidence-20261006` | `63134b448a4e` | No open PR match | — |
| `work/platform-policy-bootstrap-20261008` | `67a275c3c2b6` | No open PR match | — |
| `work/platform-recovery-drills-20261006` | `e15231413999` | No open PR match | — |
| `work/plugin-isolation-acceptance-20261006` | `931442c8d5af` | No open PR match | — |
| `work/plugin-manifest-lifecycle-20261006` | `bf408aff1ca9` | No open PR match | — |
| `work/plugin-protocol-bridge-20261006` | `d1f4831beb2f` | No open PR match | — |
| `work/plugin-protocol-bridges-20261006` | `d68990a9c0f0` | No open PR match | — |
| `work/plugin-trust-permissions-20261006` | `3525df54e649` | No open PR match | — |
| `work/presence-character-session-bridge-20261006` | `23980903fe52` | No open PR match | — |
| `work/presence-railway-qualification-20261007` | `82c137b69bd9` | No open PR match | — |
| `work/presence-session-bridge-20261006` | `de86ba6326d0` | No open PR match | — |
| `work/proactive-commitments-20261006` | `9b3a81ac74a2` | No open PR match | — |
| `work/proactive-trigger-model-20261006` | `8bec8e759737` | No open PR match | — |
| `work/proactivity-commitments-20261006` | `a2ae8211a8ab` | No open PR match | — |
| `work/proactivity-policy-20261006` | `26cec448c0a6` | No open PR match | — |
| `work/proactivity-privacy-acceptance-20261006` | `45122510fadc` | No open PR match | — |
| `work/proactivity-trigger-model-20261006` | `f8387c2ee395` | No open PR match | — |
| `work/proactivity-world-integration-20261006` | `8c483b1e4004` | No open PR match | — |
| `work/product-twin-economy-simplification-20261005` | `8a6493375de8` | No open PR match | — |
| `work/production-apk-integration-20261005` | `a67459d09fb7` | No open PR match | — |
| `work/production-apk-readiness-20261005` | `92245da91846` | No open PR match | — |
| `work/production-main-convergence-20261005` | `30ebe85ae477` | No open PR match | — |
| `work/production-main-doc-reconcile-20261005` | `daece1d680b5` | No open PR match | — |
| `work/production-mobile-auth-20261004` | `da0a47a1d198` | No open PR match | — |
| `work/production-observability-slo-20261006` | `80a967315ce8` | No open PR match | — |
| `work/production-performance-validation-20261006` | `132b5383cbbd` | No open PR match | — |
| `work/production-pilot-cutover-readiness-20261006` | `8bd6404f647b` | No open PR match | — |
| `work/production-pilot-readiness-20261006` | `4427c2877a83` | No open PR match | — |
| `work/production-recovery-drills-20261006` | `24cb5052e7d2` | No open PR match | — |
| `work/production-release-acceptance-20261006` | `5b9d45351071` | No open PR match | — |
| `work/production-security-acceptance-20261006` | `fdf06c887184` | No open PR match | — |
| `work/production-security-hardening-20261006` | `56e1d2de1f7c` | No open PR match | — |
| `work/production-security-invariants-20261006` | `9a815c0d4924` | No open PR match | — |
| `work/proof-resolved-channel-routing-20261006` | `1619ae964677` | No open PR match | — |
| `work/r01-mobile-light-theme-20261008` | `cd4da3b5938f` | No open PR match | — |
| `work/r01-primary-action-accessibility-20261008` | `86ed75fd769a` | OPEN PR | — |
| `work/r01-theme-recovery-integration-20261008` | `cafe5a788b82` | No open PR match | — |
| `work/r02-live-audio-session-recovery-20261008` | `7a3bd211f93e` | No open PR match | — |
| `work/r02-livekit-dispatch-identity-fence-20261008` | `71186a009a69` | OPEN PR | — |
| `work/r02-mobile-audio-late-token-cleanup-20261008` | `20aef41f031b` | OPEN PR | — |
| `work/r02-r19-ai-turn-fencing-20261008` | `bc2dafe54beb` | OPEN PR | — |
| `work/r02-server-session-lease-20261008` | `62ec4ccfe2d2` | OPEN PR | — |
| `work/r03-agent-directory-readiness-20261008` | `cbd6285e6ebe` | No open PR match | — |
| `work/r03-protected-agent-directory-cache-20261008-gpt6` | `352fc8a7e814` | OPEN PR | — |
| `work/r03-support-preference-authorization-20261008` | `d2dc8982330c` | OPEN PR | — |
| `work/r03-support-seed-recovery-20261008` | `3a7465e6e4c4` | OPEN PR | — |
| `work/r04-ai-seat-catalog-confirm-safety-20261008` | `0078804dce82` | No open PR match | — |
| `work/r04-create-participant-intents-20261008` | `7a2778c82b78` | OPEN PR | — |
| `work/r05-funding-webhook-recovery-20261008` | `71545aff8fd8` | No open PR match | — |
| `work/r05-quote-funding-restoration-20261008` | `97936c102ee1` | OPEN PR | — |
| `work/r06-native-ngn-wallet-visibility-20261008` | `4b823ffd40e7` | OPEN PR | — |
| `work/r07-billing-chat-ambiguity-20261008` | `c5ece5920b0b` | OPEN PR | — |
| `work/r08-crypto-quote-consent-boundary-20261008` | `df4e4c72cbcc` | OPEN PR | — |
| `work/r08-crypto-session-isolation-20261008` | `9836854f5343` | OPEN PR | — |
| `work/r09-ai-bounded-stage-context-20261008` | `22c7d298ef46` | No open PR match | — |
| `work/r09-moderated-comments-stage-20261008` | `7a6a5092f14f` | OPEN PR | — |
| `work/r09-python-live-stage-context-20261008` | `e8523f64ecf1` | OPEN PR | — |
| `work/r10-gift-catalog-stage-feedback-20261008` | `28bccf1c62b3` | No open PR match | — |
| `work/r10-gift-sheet-uncertain-recovery-20261008` | `fc60bbd2c401` | OPEN PR | — |
| `work/r10-gift-transport-recovery-20261008` | `b6186eae6663` | OPEN PR | — |
| `work/r11-billing-localization-20261008-gpt6` | `6ad0f937737a` | OPEN PR | — |
| `work/r11-localization-main-integration-20261008` | `1a744b35df03` | No open PR match | — |
| `work/r11-settings-language-preference-20261008` | `ee3faff4b3fb` | OPEN PR | — |
| `work/r11-shell-localization-20261008` | `75cb6a3ae9c2` | OPEN PR | — |
| `work/r11-shell-localization-integration-20261008` | `e2ea2b1a5838` | No open PR match | — |
| `work/r12-account-deletion-entry-20261008` | `405ff94f119d` | No open PR match | — |
| `work/r12-atomic-intake-main-integration-20261008` | `183452808a55` | No open PR match | — |
| `work/r12-deletion-atomicity-recovery-20261008` | `e8fb1408a3d9` | No open PR match | — |
| `work/r12-disabled-account-write-guards-20261008` | `090e90c1b399` | No open PR match | — |
| `work/r12-disabled-guards-main-integration-20261008` | `5455e51f38bf` | No open PR match | — |
| `work/r12-financial-preflight-worker-20261008` | `df47cd8bbff6` | OPEN PR | — |
| `work/r13-replay-expiring-playback-20261008-gpt6` | `33cf9adb2309` | OPEN PR | — |
| `work/r13-replay-finalize-recovery-20261008` | `b624646dece4` | OPEN PR | — |
| `work/r14-fcm-delivery-resilience-20261008` | `f846004ca01a` | OPEN PR | — |
| `work/r14-talk-push-privacy-20261008-gpt6` | `4b0811502006` | OPEN PR | — |
| `work/r15-ai-seat-safety-authorization-20261008` | `287191c787ba` | OPEN PR | — |
| `work/r15-channel-webhook-boundaries-20261008` | `eb14419a5290` | OPEN PR | — |
| `work/r15-gift-safety-eligibility-20261008` | `dd2d75db3998` | OPEN PR | — |
| `work/r15-human-profile-safety-20261008-gpt6` | `fcfd820abf08` | OPEN PR | — |
| `work/r15-human-profile-safety-preferences-20261008-gpt6` | `84f516e14b61` | OPEN PR | — |
| `work/r15-persona-profile-report-20261008-gpt6` | `73a392342cfc` | OPEN PR | — |
| `work/r15-persona-reporting-20261008-gpt6` | `59b0ccc47ab7` | OPEN PR | — |
| `work/r15-provider-response-bounds-20261008-gpt6` | `0d56bd58d866` | OPEN PR | — |
| `work/r15-replay-comment-safety-20261008` | `a06b154893f5` | OPEN PR | — |
| `work/r16-android-private-data-security-20261008` | `26a19e603d38` | OPEN PR | — |
| `work/r16-android-store-signing-guard-20261008` | `4eacffb4332c` | No open PR match | — |
| `work/r16-disposable-bootstrap-freshness-20261008-gpt6` | `0873733191db` | OPEN PR | — |
| `work/r16-otp-auth-singleflight-20261008-gpt6` | `5c293078f970` | OPEN PR | — |
| `work/r16-schema-portability-20261008` | `65c53ecd9060` | OPEN PR | — |
| `work/r16-untrusted-deeplink-validation-20261008` | `7453199a6aff` | OPEN PR | — |
| `work/r17-c08-five-tab-shell-20261008-gpt6` | `050b101c3f70` | OPEN PR | — |
| `work/r17-root-shell-20261008` | `0b544806476f` | No open PR match | — |
| `work/r17-wallet-private-intent-handoff-20261008` | `37a1c190110f` | OPEN PR | — |
| `work/r18-avatar-end-to-end-20261008` | `145da2fedeee` | OPEN PR | — |
| `work/r18-avatar-media-20261008` | `aa27175e2519` | No open PR match | — |
| `work/r18-avatar-processing-20261008` | `b497795dc814` | No open PR match | — |
| `work/r18-avatar-s3-object-store-20261008` | `a78753fb559f` | No open PR match | — |
| `work/r18-header-avatar-integration-20261008` | `1914d661c511` | No open PR match | — |
| `work/r18-profile-edit-contract-20261008` | `f6eb0dc75156` | No open PR match | — |
| `work/r18-self-profile-edit-20261008` | `5c1897d9e96d` | No open PR match | — |
| `work/r19-role-guardrails-20261008-gpt6` | `9cff45ffa4cb` | OPEN PR | — |
| `work/realtime-provider-seams-20261006` | `aae05c99ce00` | No open PR match | — |
| `work/realtime-turn-control-20261006` | `d90e7c74f909` | No open PR match | — |
| `work/security-clone-provision-scope-20261006` | `e2349c7349bb` | No open PR match | — |
| `work/security-credit-recipient-scope-20261006` | `827d869e127e` | No open PR match | — |
| `work/security-gift-recipient-scope-20261006` | `1e648424128f` | No open PR match | — |
| `work/sensor-perception-contracts-20261006` | `4b02adb6fe7a` | No open PR match | — |
| `work/shared-ci-recovery-work-20261008` | `afb47ebdbced` | OPEN PR | — |
| `work/skills-clones-core-teaching-20261004` | `8d50f32cfa2d` | No open PR match | — |
| `work/social-commerce-studio-golden-journey-20261006` | `89e100224a56` | No open PR match | — |
| `work/social-identity-content-20261006` | `3e8c13a3aa3d` | No open PR match | — |
| `work/social-identity-content-state-20261006` | `a40c9468efb8` | No open PR match | — |
| `work/social-publication-journey-20261006` | `d6885ee3b144` | No open PR match | — |
| `work/story-radio-20261006` | `3445db59d2d1` | No open PR match | — |
| `work/story-radio-admin-mobile-20261006` | `86cc906bc1c2` | No open PR match | — |
| `work/story-radio-home-integration-20261006` | `fa103da1204b` | No open PR match | — |
| `work/story-radio-production-integration-20261006` | `9b3490c6fe1d` | No open PR match | — |
| `work/studio-production-workflow-20261006` | `f2ac1687246e` | No open PR match | — |
| `work/studio-project-artifact-provenance-20261006` | `64b7186c45c6` | No open PR match | — |
| `work/study-center-gateway-projection-20261006` | `2280531239f7` | No open PR match | — |
| `work/talk-card-timing-20261007` | `cd390aff3273` | No open PR match | — |
| `work/talk-follow-host-more-20261007` | `adf1b94d7a63` | No open PR match | — |
| `work/talk-follow-host-more-main-20261007` | `64e77b380337` | No open PR match | — |
| `work/talk-follow-participants-20261007` | `5baf752781f5` | No open PR match | — |
| `work/talk-host-participant-safety-20261007` | `06eaf5633885` | No open PR match | — |
| `work/talk-human-invitations-20261007` | `c328d63d02f6` | No open PR match | — |
| `work/talk-metadata-edit-20261007` | `7551d9440701` | No open PR match | — |
| `work/talk-metadata-edit-main-20261007` | `3975cc92f179` | No open PR match | — |
| `work/talk-mobile-safety-controls-20261007` | `4ab042a044f3` | No open PR match | — |
| `work/talk-mobile-safety-controls-main-20261007` | `236b3dda43d9` | No open PR match | — |
| `work/talk-participant-projection-20261007` | `56a497dec228` | No open PR match | — |
| `work/talk-share-deeplink-20261007` | `eb2070728662` | No open PR match | — |
| `work/talk-share-deeplink-main-20261007` | `398d1fb7077d` | No open PR match | — |
| `work/talk-speaker-leave-seat-20261007` | `6acb2a663d30` | No open PR match | — |
| `work/talk-speaker-self-mute-20261007` | `df90c45c45b5` | No open PR match | — |
| `work/talk-speaker-self-mute-main-20261007` | `4ee39b3a0a49` | No open PR match | — |
| `work/talks-activity-backend-20261007` | `ef02511190e8` | No open PR match | — |
| `work/talks-activity-mobile-20261007` | `84aefc844cad` | No open PR match | — |
| `work/talks-ai-seat-commerce-20261007` | `eb0ac5464eaf` | No open PR match | — |
| `work/talks-ai-seat-gateway-settlement-20261007` | `480abfc5fc64` | No open PR match | — |
| `work/talks-ai-seat-gateway-settlement-main-20261007` | `c42be920be06` | No open PR match | — |
| `work/talks-ai-seat-mobile-20261007` | `bd91a77eff09` | No open PR match | — |
| `work/talks-audience-questions-20261007` | `01c56d8eb12d` | No open PR match | — |
| `work/talks-backend-domain-api-20261007` | `860ba91641a3` | No open PR match | — |
| `work/talks-direct-twin-apk-completion-20261007` | `f5e8154546d7` | No open PR match | — |
| `work/talks-direct-twin-control-20261007` | `ad457481d181` | No open PR match | — |
| `work/talks-discovery-ranking-20261007` | `56ffc6984e67` | No open PR match | — |
| `work/talks-discovery-ranking-integration-20261007` | `6a28b7efc4ef` | No open PR match | — |
| `work/talks-explore-ranking-integration-20261007` | `814b01ef6a68` | No open PR match | — |
| `work/talks-explore-ranking-integration-main-20261007` | `4fb06c516c47` | No open PR match | — |
| `work/talks-global-search-backend-20261007` | `c7961857ef05` | No open PR match | — |
| `work/talks-global-search-mobile-20261007` | `c905c580aa21` | No open PR match | — |
| `work/talks-home-vertical-feed-20261007` | `f51499f4efdf` | No open PR match | — |
| `work/talks-host-controls-mobile-20261007` | `8b6f5dc39ab3` | No open PR match | — |
| `work/talks-host-gifts-20261007` | `90b3999746be` | No open PR match | — |
| `work/talks-host-gifts-integration-20261007` | `d62cde21fcca` | No open PR match | — |
| `work/talks-human-seats-mobile-20261007` | `849075a1de00` | No open PR match | — |
| `work/talks-library-backend-20261007` | `9ed76f0bb7b3` | No open PR match | — |
| `work/talks-library-integration-main-20261007` | `77ab166899d6` | No open PR match | — |
| `work/talks-live-ai-runtime-integration-20261007` | `86a76fee7727` | No open PR match | — |
| `work/talks-live-ai-seat-worker-20261007` | `e062dff8afb7` | No open PR match | — |
| `work/talks-live-ai-seat-worker-main-20261007` | `93d93ad2fd44` | No open PR match | — |
| `work/talks-live-audio-backend-20261007` | `7982c2f751b7` | No open PR match | — |
| `work/talks-live-audio-mobile-20261007` | `7aefc28ddf43` | No open PR match | — |
| `work/talks-live-audio-runtime-20261007` | `f73e299e3cda` | No open PR match | — |
| `work/talks-live-polls-20261007` | `4898b587379e` | No open PR match | — |
| `work/talks-mobile-safety-direct-twin-20261007` | `1c2109958d6a` | No open PR match | — |
| `work/talks-notification-dedupe-20261007` | `8cb74498c172` | No open PR match | — |
| `work/talks-notification-delivery-integration-20261007` | `08808d15ceab` | No open PR match | — |
| `work/talks-notification-policy-20261007` | `d53379c20c76` | No open PR match | — |
| `work/talks-notification-runtime-integration-20261007` | `cb1594a36199` | No open PR match | — |
| `work/talks-participation-host-backend-20261007` | `31a27eb5ad0f` | No open PR match | — |
| `work/talks-participation-host-moderation-backend-20261007` | `c33e78088663` | No open PR match | — |
| `work/talks-participation-mobile-20261007` | `560a7b5f4680` | No open PR match | — |
| `work/talks-replay-e2e-20261007` | `bc8d01181afc` | No open PR match | — |
| `work/talks-replay-egress-playback-20261007` | `2501a716a2ba` | No open PR match | — |
| `work/talks-replay-gateway-persistence-20261007` | `cf574317a645` | No open PR match | — |
| `work/talks-replay-playback-mobile-20261007` | `4a257e7c6669` | No open PR match | — |
| `work/talks-replay-recording-runtime-20261007` | `615a4bea28ff` | No open PR match | — |
| `work/talks-replay-recording-runtime-main-20261007` | `7dedea04ae68` | No open PR match | — |
| `work/talks-safety-composition-20261007` | `85fa569c0fa2` | No open PR match | — |
| `work/talks-safety-core-20261007` | `b9a09d1d1ee5` | No open PR match | — |
| `work/talks-safety-enforcement-integration-20261007` | `e349ab6ab7d6` | No open PR match | — |
| `work/talks-safety-mobile-20261007` | `95685f851097` | No open PR match | — |
| `work/talks-safety-persistence-20261007` | `77b430e017ac` | No open PR match | — |
| `work/talks-saved-bookmarks-20261007` | `30b7292127ae` | No open PR match | — |
| `work/talks-shared-gateway-composition-20261007` | `8f07c58a0293` | No open PR match | — |
| `work/talks-social-profiles-backend-20261007` | `3fc5c5f525b4` | No open PR match | — |
| `work/talks-social-profiles-mobile-20261007` | `8fe6970f37be` | No open PR match | — |
| `work/talks-you-library-e2e-20261007` | `8e56961301ac` | No open PR match | — |
| `work/talks-you-library-mobile-20261007` | `2a66c179c8f8` | No open PR match | — |
| `work/task082-agent-runtime-qualification-20261006` | `18098da84200` | No open PR match | — |
| `work/task096-workflow-restart-qualification-20261006` | `a5fd64ff1fe0` | No open PR match | — |
| `work/task130-agent-phone-qualification-20261006` | `a08abd886d48` | No open PR match | — |
| `work/task138-social-commerce-studio-qualification-20261006` | `0c4345816fe0` | No open PR match | — |
| `work/teaching-memory-persistence-20261006` | `7bc1b574f973` | No open PR match | — |
| `work/teaching-multiselect-scope-20261006` | `1fd9ff4c8dbe` | No open PR match | — |
| `work/telegram-webhook-autoregistration-20261007` | `f52473ac08d4` | No open PR match | — |
| `work/twin-activity-20261005` | `e4939d240068` | No open PR match | — |
| `work/twin-attribution-acceptance-20261006` | `6f450ea8add8` | No open PR match | — |
| `work/twin-attribution-commission-20261005` | `3f1616c10670` | No open PR match | — |
| `work/twin-block-report-controls-20261006` | `824b12d01629` | No open PR match | — |
| `work/twin-chat-admission-20261005` | `103b4742c6b0` | No open PR match | — |
| `work/twin-client-compatibility-gate-20261005` | `662a8465fe7d` | No open PR match | — |
| `work/twin-commission-retry-recovery-20261006` | `8d116a4ad412` | No open PR match | — |
| `work/twin-conversation-identity-20261005` | `5b3436248a7c` | No open PR match | — |
| `work/twin-create-share-chat-acceptance-20261006` | `06f3bd8bea2d` | No open PR match | — |
| `work/twin-create-share-chat-acceptance-v2-20261006` | `fabc07b17e4f` | No open PR match | — |
| `work/twin-credit-gifts-20261005` | `ee4c25da99a0` | No open PR match | — |
| `work/twin-credit-transfer-acceptance-20261006` | `22697b1a37d0` | No open PR match | — |
| `work/twin-credit-transfer-retry-recovery-20261006` | `c4ff9642414b` | No open PR match | — |
| `work/twin-economy-abuse-controls-20261005` | `6fd385898062` | No open PR match | — |
| `work/twin-economy-events-20261005` | `e199978c3d49` | No open PR match | — |
| `work/twin-explore-20261005` | `74fc82073e72` | No open PR match | — |
| `work/twin-explore-surface-20261005` | `9ab903a16f9c` | No open PR match | — |
| `work/twin-gateway-production-composition-20261005` | `3dee988efb69` | No open PR match | — |
| `work/twin-gift-owner-acceptance-20261006` | `ea9550a1bc07` | No open PR match | — |
| `work/twin-gift-retry-recovery-20261006` | `74b7008dbfd7` | No open PR match | — |
| `work/twin-launch-identity-policy-20261006` | `57d5e7550fd9` | No open PR match | — |
| `work/twin-ledger-reconcile-20261005` | `edffe48f8649` | No open PR match | — |
| `work/twin-legacy-compatibility-20261005` | `66010fbc01c2` | No open PR match | — |
| `work/twin-mobile-accessibility-20261006` | `92e5e9f913d5` | No open PR match | — |
| `work/twin-mobile-production-wiring-20261005` | `de61771458bb` | No open PR match | — |
| `work/twin-negative-balance-recovery-20261006` | `3b316a075244` | No open PR match | — |
| `work/twin-owner-access-20261005` | `b832a9318108` | No open PR match | — |
| `work/twin-owner-access-acceptance-20261006` | `7eb664f205ed` | No open PR match | — |
| `work/twin-paid-voice-acceptance-20261006` | `2bca6cdc95ec` | No open PR match | — |
| `work/twin-paid-voice-retry-recovery-20261006` | `c931b2c9e4f8` | No open PR match | — |
| `work/twin-paid-voice-trial-20261005` | `1401484cc0a5` | No open PR match | — |
| `work/twin-product-architecture-guard-20261005` | `4d66607d46a1` | No open PR match | — |
| `work/twin-product-language-cleanup-20261005` | `a5d0dfd73031` | No open PR match | — |
| `work/twin-profile-memory-20261005` | `255af163402e` | No open PR match | — |
| `work/twin-public-memory-privacy-acceptance-20261006` | `6c28a9e1c766` | No open PR match | — |
| `work/twin-public-memory-safety-20261006` | `e15d5690e7b1` | No open PR match | — |
| `work/twin-public-text-acceptance-20261006` | `42b636779e95` | No open PR match | — |
| `work/twin-recovery-acceptance-20261006` | `e7bc418d93bc` | No open PR match | — |
| `work/twin-voice-chat-first-20261006` | `74b24c6a452f` | No open PR match | — |
| `work/twin-voice-chat-first-prod-20261006` | `2880ce03e1b0` | No open PR match | — |
| `work/twin-wallet-projection-20261005` | `34c70d622996` | No open PR match | — |
| `work/twin-wallet-surface-20261005` | `15f1fc45541a` | No open PR match | — |
| `work/u21-human-contacts-hub-20261008-gpt6` | `3e2e78061f1b` | OPEN PR | — |
| `work/u22-local-phonebook-20261008-gpt6` | `36a51277a246` | OPEN PR | — |
| `work/u23-safe-invite-share-20261008-gpt6` | `be18b77cd4d2` | OPEN PR | — |
| `work/u24-message-requests-privacy-20261008-gpt6` | `7deb1dd40e6b` | OPEN PR | — |
| `work/u25-operator-scheduler-20261008-gpt6` | `a0d7e83f4f9d` | OPEN PR | — |
| `work/u26-safe-linked-assistant-channels-20261008-gpt6` | `4a7e66faeca3` | OPEN PR | — |
| `work/u27-agent-admin-control-20261008-gpt6` | `4e16c5957e8b` | OPEN PR | — |
| `work/u28-source-backed-research-20261008-gpt6` | `a7aad218d51c` | OPEN PR | — |
| `work/u29-real-customer-support-20261008-gpt6` | `ec460e99e295` | OPEN PR | — |
| `work/u30-public-discovery-20261008-isolated` | `b4ab386f74be` | OPEN PR | — |
| `work/work-lane-consolidation-20261008` | `d9e816881a07` | OPEN PR | — |
| `work/work-research-gateway-projection-20261006` | `27e45edc2b5b` | No open PR match | — |
| `work/workflow-checkpoints-20261004` | `4703606a8699` | No open PR match | — |
| `work/workflow-control-20261004` | `5b05a0023bce` | No open PR match | — |
| `work/workflow-execution-session-20261005` | `56aba42a04b6` | No open PR match | — |
| `work/workflow-executor-heartbeat-20261005` | `1e10c1426b51` | No open PR match | — |
| `work/workflow-executor-lease-20261005` | `5076dc1aba94` | No open PR match | — |
| `work/workflow-executor-lease-postgres-20261005` | `40d2d37b6baa` | No open PR match | — |
| `work/workflow-fenced-commit-20261005` | `cbb92b515c9a` | No open PR match | — |
| `work/workflow-human-requests-20261004` | `18016eebbd16` | No open PR match | — |
| `work/workflow-operation-truth-20261004` | `7c56d5e32968` | No open PR match | — |
| `work/workflow-operator-visibility-20261004` | `2f931a5dfa14` | No open PR match | — |
| `work/workflow-retries-20261004` | `3291ea8163af` | No open PR match | — |
| `work/workflow-run-task-state-20261004` | `5d939aca6f05` | No open PR match | — |
| `work/workflow-schedules-20261004` | `de7c9762b4f2` | No open PR match | — |
| `work/workflow-task-admission-20261004` | `833b86d8c8cc` | No open PR match | — |
| `work/workflow-task-leasing-20261004` | `b35e22489acc` | No open PR match | — |
| `work/workflow-task-recovery-20261004` | `2e4cb62ff052` | No open PR match | — |
| `work/workflow-task-retries-20261004` | `4f48888d543e` | No open PR match | — |
| `work/workflow-version-graph-20261004` | `3a688761b29b` | No open PR match | — |
| `work/workflows-canonical-runtime-20261005` | `19df8d448fb3` | No open PR match | — |
| `work/workflows-postgres-persistence-20261005` | `e76239cf8a7d` | No open PR match | — |
| `work/workflows-resume-executor-20261005` | `a02bd85b6cb3` | No open PR match | — |
| `work/workflows-resume-revalidation-20261005b` | `01cfaa970f01` | No open PR match | — |
| `work/workflows-resume-revalidation-20261005` | `2606afe3661d` | No open PR match | — |
| `work/world-proactivity-integration-20261006` | `178895a11ac3` | No open PR match | — |

**Snapshot is evidence only; no refs were deleted.**
