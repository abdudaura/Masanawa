# U19 — Accessibility, multilingual entry, low-end instrumentation handoff

Updated UTC: 2026-10-09 00:43; window: isolated GPT-6 U19
Status: **PARTIAL_IMPLEMENTATION / SOURCE_WRITTEN / EXECUTION UNVERIFIED**
Claim: 2026-10-09 repository-visible, per-commit renewed five-minute claim.
Branch: work/u19-access-lowend-20261009-gpt6
Base main SHA: 5e758673ae91082520b21b3153da53791ae2cbf3
Source checkpoint before this handoff commit: f78337547aec2946bdc48e1beffc449e0dbe74c4
Final handoff HEAD: use draft PR head (hand-off commit is last source change).
PR: draft/unmerged linked in PR description; never merged/deployed.
Scope/trace: U19; R11/R16/R17/C05 dependencies; K07, R16/J01–J11 low-end, multilingual/text/tap usability.
Claims inspected: current live open/draft PR inventory and existing U16/U17 branches; U19 exact branch, PR, and issue searches empty before claim. Do not rewrite Work #497, Firebase #461, C05 #474/#476, R11 #426/#482/#501, R17/C08 #493. CI owner remains #457.

## Exact paths written (no others)
- `apps/mobile/lib/src/experience_quality/quick_start_copy.dart` — isolated Hausa/English destination/action/review copy and five target enum; unsupported locale deliberately falls back.
- `apps/mobile/lib/src/experience_quality/quick_start_guide.dart` — optional first-use Flutter screen: five exact target sections, tap-only no-mic flow, optional typed local note with 512-character bound, explicit review, bounded/touch-sized controls, compact scroll, skip/back, account-scope reset; only invokes a caller-supplied reviewed navigation callback.
- `apps/mobile/lib/src/experience_quality/digit_readback.dart` — review-only character-separated Unicode decimal digits (leading-zero preserving) plus exact caller-supplied amount/currency display. No parsing into financial amount/phone, no currency conversion, no new provider authority.
- `apps/mobile/lib/src/experience_quality/experience_metrics.dart` — opt-in volatile bounded per-journey Stopwatch timing with nearest-rank p50/p95 and explicit *measured* response byte totals; no fake zero evidence, no raw payload/log/PII.
- `apps/mobile/lib/src/experience_quality/entry_probe.dart` — generation-bound start/ready/fail lifecycle; stale readbacks ignored, failed loading not counted, metrics flushed at account transitions.
- `apps/mobile/test/experience_u19/{quick_start_guide,digit_readback,experience_metrics,entry_probe}_test.dart` — 4 focused Flutter test files: review before route, no automatic send/audio/payment, account fence and local-draft purge, skip, Hausa copy, 320×568 + large type, mixed Arabic numerals, invalid phone/amount input, bounded real-measurement API, stale async ready/cancel and reset.
- `docs/workstreams/u19-access-performance-20261008.md` — this repository-visible ownership and evidence record.

## Verified by source inspection ONLY
- `GitHub compare main...work/u19-access-lowend-20261009-gpt6` confirms branch ahead and the 10 exact path changes; every new Dart source/test file fetched from the branch after commit. This is *not* a compiler, security, backend, performance or handset test.
- No backend/API/DB/migration change applies to this isolated optional client guide/benchmark unit. Auth, session ID and route authority remain at canonical parent app; the widget is not permission enforcement. It cannot send/pay/start audio by itself.
- No palettes or global locale registries were changed. Hausa remains local guide copy only; app-wide Hausa delegate remains R11 work.

## Local executable checks — NOT RUN / no fake PASS
- `cd apps/mobile && flutter pub get && flutter analyze lib/src/experience_quality test/experience_u19 && flutter test test/experience_u19`
- `cd apps/mobile && flutter test && flutter build apk --release`
- Actual **tool discovery**: no `flutter` or `dart` available in the local container, which only exposes Node v22.16.0. No Flutter build was attempted or marked PASS.
- Shared GitHub Actions #457 is documented exhausted (2,000 / 2,000 minutes, $0 hard stop); do not fire repeated CI jobs or infer any test pass. No real Android, battery, low-data data plan, localization/voice, screen reader or backend credentials available in this window.
- No p50/p95/bytes, frame, RSS, CPU or battery numbers asserted: only instrumentation code and *synthetic unit fixtures*, not device measurements.

## Source gaps / integration dependencies (all remain OPEN)
1. **F12 R17/C08 owner**: Mount optional first-use guide on correct *authenticated* five-tab route after stable session restoration. Pass changing account/session-scoped key; only on confirmed selection review map target to the canonical typed route; preserve text as unsent local draft, do not auto-submit. Do not show again without user opt-in/first-use preference policy. Test Skip, Back and recovery.
2. **F12/C05/U03 client integrators**: Wrap real cached-Chats/Assistant/Talks **server-hydrated ready** lifecycle with `ExperienceEntryProbe.start` / `completeUsable` / `fail` and reset on auth changes. Pass actual measured response bytes or null (never estimated); no stopwatch completion on a loading skeleton.
3. **R11 language owner**: Decide app-wide Hausa delegate/ARB, proofread native Hausa text and digit pronunciation with language speakers. This isolated copy does not provide full translated Wallet/receipt/Arabic RTL. Local voice-first U09/Assist media has separate native path; no mic required for these guide taps.
4. **R16/U20 qualification owner**: Build signed APK in authorized staging after CI restore, run small-screen/screen reader/large-type scenarios on budget Android, capture actual median/p95 cold and warm time to genuine result, CPU/RAM/frame/battery/network bytes and bad-network retry. Implement proper frame/battery collection or label them UNKNOWN; reject fabricated metrics.
5. No false five-tab integration, real authenticated workflow, DB readback, vendor integration or production deployment evidence exists on this branch. Actual finance, messages and microphone work is entirely delegated to their named authorities.

## Data, security and recovery
No auth data sent, no HTTP requests, no extra permission requested, no storage of guide drafts, no voice recordings. Draft is kept in-memory and cleared on accountScope change/dispose; a parent MUST unmount/reset on logout. `onOpen` is a navigation intention, not C07/U01 payment approval or message send. Money display helper is review-only and intentionally refuses comma/negative/missing asset. Metrics never capture request content, and `resetForAccountChange` clears measurements; metrics are volatile and intentionally not uploaded. Failure/stale async events cannot count as ready. Root app must enforce actual auth/API permission independently.

No migration order, financial ledger, provider, signing, Firebase, R17 route or native file changes. Rollback: discard isolated guide/probe module and its future integration; no persisted data migration.

## Disposition / release gates
SOURCE_WRITTEN: yes (isolated module only). COMPILED: no. LOCAL_TESTED: no. CI_EXECUTED: no. DB_TESTED: N/A for module. DEVICE/LOW-DATA/RSS/BATTERY: no. K07/J ACCEPTANCE: no. INTEGRATED: no. VERIFIED_E2E: no. DEPLOYED: no.

**Leave draft/unmerged.** U19 has a working source design and authored tests but remains `PARTIAL_IMPLEMENTATION` because root mounting, actual accessibility/locale and performance evidence remain unimplemented/unverified outside its exact-path ownership. Integration must preserve old signed-in routes, all five tabs, Firebase and financial safeguards.
