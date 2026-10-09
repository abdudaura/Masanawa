# AF13 — fail-closed audio-first qualification evidence

**Window:** MASANAWA-01 / AF13
**Claim:** 2026-10-09T21:45:04Z; coordination record `factory/claims:.factory/leases.json` at commit `d482077837661845eb0d7e7bed93d5098d4633aa`; GitHub readback confirmed before edits.
**Branch:** `work/af13-evidence-manifest-20261009-masanawa01`
**Base main:** `f381f077c485c04261459b77a42c215d3ce3a14b`
**Initial state:** claim established; feature source work not yet committed. No runtime/CI/provider/device/DB qualification or production deployment.

## Exact owned files
- `tools/audio-first-qualification/verify-evidence.mjs`
- `tools/audio-first-qualification/verify-evidence.test.mjs`
- `tools/audio-first-qualification/acceptance-matrix.json`
- `docs/workstreams/AF13-evidence-qualification-20261009.md`

## Authority/dependencies
Use current `docs/AUDIO-FIRST-*`, `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`, and `docs/BACKEND-STORAGE-OPERATIONS-20261009.md`. AF13 owns independent qualification, not app composition, finance, auth, database migrations, CI configuration or provider activation. AF00 is the continuing integrator; independent readiness evidence may be delivered without modifying shared source.

## Collision and recovery check
Current main and live open PRs examined; AF07 #593 is active, and AF00 #586, AF01 #590, AF05 #589/#591, AF08 #588, AF14 #587 own distinct source. Recovery references #527, #518, #559, #561, #554, #567, #570 retain their unique source; this slice adds no overlapping changes. Locally fixed owner APK/source remain unavailable and untouched.

## Next
Implement offline fail-closed evidence verifier, complete audio-first UX/WF/DB/PF/CR acceptance matrix, executable negative tests; run local Node tests, read back exact GitHub SHA, and hand off to AF00. A manifest is an attestation, **not cryptographic proof** of provider/device execution; real gate remains independent.
