# R16 — untrusted Android link admission handoff
Updated UTC: 2026-10-08; owner/window: GPT-6 Android link admission
Status: IMPLEMENTED_UNVERIFIED **for this isolated sub-scope only**; parent R16 remains OPEN.
Claim/lease: this file, activity evidenced by branch commits; owned paths `apps/mobile/lib/src/core/shell_deep_link.dart`, `apps/mobile/test/core/shell_deep_link_security_test.dart`, this document.
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`
Branch: `work/r16-untrusted-deeplink-validation-20261008`
Code commit SHA: `acb8877f072d54fb2f2084952d0be66e07ceb335`; handoff commit is subsequent branch HEAD (read GitHub PR head for exact final SHA).
PR: linked in GitHub branch PR after creation; DRAFT / UNMERGED.
Requirement IDs / journeys: R16 input security; R17/C08 typed route contract; privacy boundaries of J user entry/restart flows.
Ownership: R17/C08 owns shared app router and shell; this PR intentionally leaves them unchanged. Other R16 branches deal with signing, backups and schema—not these paths. No migrations or shared financial writes.
Changed layers: deep-link pure Dart URL parser and Flutter unit tests; unchanged existing PendingDeepLink prevents rejected URLs entering auth-delayed navigation.
Implemented: reject fragments, credentials, ports, dot segments, unsupported HTTPS queries, empty query delimiters, unknown and duplicate custom query keys, ambiguous characterId values; continue legacy valid AI/public Twin/Talk links. Link contents never authorize an API action.
Missing implementable source in this sub-scope: NONE identified; Android app-link verification and production association assetlinks, complete final five-tab route migration, two-device links and R16 release remain separate OPEN integration tasks.
Verification executed: none — only GitHub connector file operations available in this window; no Flutter executable runner or Android emulator available. GitHub connector accepted file commits; it did NOT run Dart checks.
Verification NOT executed: `cd apps/mobile && flutter test test/core/shell_deep_link_security_test.dart`; `flutter analyze`; `flutter test`; `flutter build apk --debug`; launch Android, verify cold/warm links before/after sign-in and logout, malicious intents, and link domain association with actual release signing identity. CI #457 exhausted Actions quota previously; do not retry until restored.
Security: no new trust grants, auth/session bypass, financial authority, DB, credentials or secrets. Reject malformed hints before opening routes; all authoritative reads and actions still require Gateway checks. Safe rollback: revert this parser change after assessing legacy links; malformed URLs that used to silently open /chats will now be rejected deliberately.
Cross-branch dependencies: R17/C08 final shell must explicitly map legacy /chats AI paths, /talk, /twin and /chat; do not repurpose as human DMs. No PR merges requested.
Next final Work actions: (1) diff against latest main and check lease collisions; (2) run test/analyze and full mobile suite; (3) exercise Android intents before/after authentication, including duplicate params, casing, encoding; (4) validate application link verification and release-signing fingerprint with owned HTTPS assetlinks; (5) merge only with executed evidence and regression checks.
Release gates: SOURCE_WRITTEN=yes (sub-scope); LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=N/A pure link admission; APP_INTEGRATED=source-only; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=N/A; DEPLOYED=no; MERGED=no.
