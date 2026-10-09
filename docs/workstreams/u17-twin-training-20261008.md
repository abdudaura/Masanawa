# U17 — owner Twin interview, private preview gate and revisioned publication

**2026-10-09 · PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED / NOT VERIFIED_E2E.** Source and authored tests exist; the app root and actual model-backed private-preview adapter are NOT connected. This report is a handoff, not release acceptance.

## Ownership, original claim and exact SHA

- Source base \`main\`: \`5e758673ae91082520b21b3153da53791ae2cbf3\` (ref rechecked during work).
- Scoped branch: \`work/u17-owner-twin-training-20261009-gpt6\`.
- Repository-visible claim made **before source writes**: \`708dfc6a80c6a07005bf9fc52753ab92ddff5d99\` on 2026-10-09 Africa/Lagos. Subsequent substantive commits refreshed the five-minute activity lease.
- Latest source/test checkpoint before this handoff: \`3b92dadb06d599d7c2a3991b7be4350075ca2edd\`.
- Unique paths: \`apps/mobile/lib/src/twin_training/{twin_training_flow,twin_training_screen}.dart\`; \`apps/mobile/test/twin_training/{twin_training_flow_test,twin_training_screen_test}.dart\`; this handoff only.
- GitHub comparison from \`main\` to source checkpoint showed exactly those five paths, 0 commits behind, no Gateway/shared router/Firebase/native/financial/schema/central auth changes.
- Checked current open PRs and search for U17 issue/branch before claim: no competing U17 implementation found. R03/R19/Twin foundation, C07, U01/U05/U07/U18, Work #497, Firebase #461, CI #457 and F12 protected files remain untouched.

## Source functionality

**Actual current backend reused:** \`CloneOnboardingService\` and \`CloneSetupRepository\` in Gateway and identity; \`/creator/onboarding\`, \`/creator/onboarding/profile\`, \`/creator/onboarding/preview\`, \`/creator/onboarding/confirm\`. Canonical personal-clone provisioning owns Character/version/relationship and core skills. Existing \`TwinProfileService\` and \`/agent/twin/profile/customize/preview\` + \`/agent/twin/profile/customize\` own owner identity, revision-CAS and publication. No new database, Character identity, inference, money ledger or unauthenticated control plane.

**Flutter source:**
- Conversational, bounded name/language/experience/expertise/style prompts with optional injected native-user-speech transcription. Actual reply remains a **draft** until explicit submission; no browser TTS or agent-generated audio mistaken for user input.
- Each answer writes through the existing \`CloneOnboardingController\` to the authenticated, PostgreSQL-backed server setup. Duplicate/overlong/control-text rejection; saved revision and genuine server status, reload after uncertain writes or crash; recovery uses the existing confirmed request ID.
- Explicit consent checkbox and canonical profile preview/confirmation. Server owns clone creation and idempotent, crash-recoverable confirmation, not a local fake Twin. The checkbox is a *local UX acknowledgement only*, not evidence of legal identity permission.
- Resulting Twin stays private until a **real private agent test** callback succeeds. No supplied preview callback => disabled test/publication UI, not a mocked successful conversation. Future integrator must implement that callback using canonical AgentConversation admission/turn and disclose real user/provider cost and owner Float eligibility.
- Separate reviewed public-directory toggle: fresh authenticated \`/v1/my-twin\` read, exact Character ID equality, canonical \`TwinProfile\` preview of discoverability, explicit confirmation, server CAS apply, and fresh readback before showing success. Stale, forged, uncertain or cross-account results fail closed and demand reload; no local fabricated publication.
- Screen placed only under the **existing Agents → My Twin** nested navigation contract. F12 alone owns root route injection and five tabs (Talks · Chats · Assistant · Wallet · Agents). Owner account invalidation purges the controller's previous profile and cancels stale response presentation.

## Auth, permission and other safety boundaries

- Backend's existing session authorizers verify user/tenant on every onboarding and profile operation. This branch neither weakens them nor accepts user-supplied owner IDs, tokens or role claims.
- The selected profile's Character must match the confirmed clone's Character before publication, including after an asynchronous refresh. The server must still enforce identity rights, impersonation policies and financial/skill admission; a client checkbox is **not** sufficient.
- **No personal files uploaded, no copied voices, no auto-post to Talks, no unilateral AI action and no purported free paid inference.**
- Publish verification cannot prove provider completion, eligible funds, real conversation quality or public directory distribution until full composed runtime and external tests execute.

## Authored tests vs executed evidence

**Authored Flutter tests (8 cases, NOT EXECUTED):**
1. Persisted multi-prompt interview + explicit preview consent and canonical confirm.
2. Verified private-test/explicit-publication gating and CAS readback.
3. Wrong Twin owner Character rejected before publication.
4. Unknown result after commit never acknowledged optimistically.
5. Duplicate-language and control-character rejection before network write.
6. Account invalidation revokes send/publication.
7. Crash/restart after durable confirm resumes the saved request ID.
8. Narrow 320px Flutter screen: missing real private preview disables publish and test action.

**Executed read-only structural checks:** connected GitHub file readback and \`main...head\` compare; all source files present, no conflict markers, correct \`package:masanawa/\` import prefix, all changed paths within lease; privacy/publication adapter required methods present. These are **NOT Dart compiler or widget test passes**.

**Unavailable toolchains/environment:** Dart executable NOT_AVAILABLE, Flutter executable NOT_AVAILABLE, repo checkout NOT_AVAILABLE, local GitHub DNS NOT_AVAILABLE. Node 22.16.0 exists but cannot run Flutter tests; do not substitute JS text tests for Dart execution. GitHub Actions #457 exhausted minutes in the latest repository CI handoff; no new CI pass is asserted. No paid Gemini, clone funding, production database, Android device or two-account service acceptance executed. Neither migrations nor production systems were touched.

**Required executable commands in a real checkout:**

\`\`\`sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/twin_training test/twin_training
flutter analyze lib/src/twin_training test/twin_training
flutter test test/twin_training/twin_training_flow_test.dart test/twin_training/twin_training_screen_test.dart
\`\`\`

After F12 adapter composition, run backend \`pnpm --filter @masanawa/gateway-service typecheck\`, Gateway onboarding/profile integration tests and a real two-account/tenant deny suite; test low-end Android Flutter voice, restart with pending confirmation, alternate credential switch, publish/unpublish readback, provider cost/Float refusal and truth of generated agent replies. A format/analyze/test failure must be fixed before merge; no PASS has been assumed.

## Remaining integration order and exact seams (not silently delivered)

1. **F12 (sole root owner)** mounts \`TwinTrainingScreen\` in Agents → My Twin, owns its lifecycle/account-scoped disposal, binds the existing \`HttpCloneOnboardingTransport(dio: api.dio, baseUrl: ...)\`, \`CloneOnboardingController\` and \`GatewayTwinProfileTransport(api: api)\`; no new bottom tab. Preserve login/logout and private transport tokens via the existing \`ApiClient\` interceptor. Wire refresh after successful publication into My Twin and public directory projections.
2. **Agent Conversation / R03/R19 and U18** supply \`onPrivateTest(characterId)\` using real scoped owner \`AgentConversationService.open/turn\` or a qualified dedicated preview, returning \`true\` **only after** authenticated, cost-disclosed, server-produced test reply and safe state readback. This cannot be a fake LLM string, offline canned reply or unaudited monetary operation. If insufficient creator Float, missing agent skill, denied runtime or unknown result, callback returns false; publication remains disabled. F03/finance owners validate allowed public disclosure and anti-impersonation boundaries.
3. **F02/U09 (voice authority)** supplies \`onVoiceAnswer\` only after approved native user-speech transcription, microphone permissions and Talk/DM focus fencing; typing/tap already work without voice, no fake voice fallback.
4. **F13/R18** coordinates versioned changes after creation, public profile revision correctness and updated Character constitution/knowledge safely; current on-boarding updates are **pre-provision only**. Consent-to-files/owner knowledge retrieval and a versioned rollback are NOT implemented here; keep file ingestion disabled until the U07/R19 owners provide actual authorized storage/knowledge scope.
5. **Work/CI/DB integrator** performs real Dart compile, server/postgres/permissions/auth, device, model, finance and publish acceptance. Confirm one Character owner path and provider cost against existing tenant policies before any public visibility. Do not merge or deploy this source-only PR on this handoff.

## Status

**PARTIAL_IMPLEMENTATION / AWAITING SHARED COMPOSITION + EXECUTABLE VERIFICATION.** U17 owner interview and fail-closed publication source is present; backend and UI APIs are individually real, but end-to-end private-test/cost, persistent post-creation training/rollback and native voice are absent/unverified. No claim of full U17 completion, production safety or device readiness.
