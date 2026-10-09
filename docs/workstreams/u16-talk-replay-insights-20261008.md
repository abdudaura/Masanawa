# U16 — permissioned post-Talk replay insights and Host review

**2026-10-09 · SOURCE IMPLEMENTED IN ISOLATION; PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED.**
**Claimed before code:** commit `394f6c62654274b7a4e54fcae748ad5e1279d440`; base `main@5e758673ae91082520b21b3153da53791ae2cbf3`. Feature branch `work/u16-talk-post-session-consent-20261009-gpt6`. Source implementation checkpoint (before this handoff): `e1fb3392ec93adfe3c5f9aebbed1c84577201a99`. See feature draft PR linked from repository (not merged).

## Claim and collision inventory

At first live claim the repository had 85 open PRs; U13, U14, U15 and U17 had separate branches. There was no matching U16 PR, issue or branch. Chose genuinely available U16 as an isolated source lane. Five-minute ownership rule: original GitHub-visible claim above; successive feature commits refresh implementation activity; any new shared-path change requires a **new exact-path claim**. Isolated owned paths:

- `services/gateway/src/talk_post_session/**` — model, authenticated service/transport routes, durable guarded Postgres repository, Gemini processor and tests, **proposed (unregistered) SQL**.
- `apps/mobile/lib/src/talk_post_session/**` — typed Gateway transport, account-fenced controller and explicit-Host-consent review panel.
- `apps/mobile/test/talk_post_session/**` — independent Flutter unit/widget tests.
- `docs/workstreams/u16-talk-replay-insights-20261008.md` — claim, source/test/blocker handoff.

**Protected and unchanged:** shared Gateway `app.ts` / `main.ts` and error handler, R13 replay pipeline, production migrations/registry, Flutter five-tab router and `pubspec.yaml`, U07 artifact authority, LiveKit, financial ledgers, Firebase/native configs, providers and live production. Key unmerged dependencies: R13 #453/#503, U07 #524, Work #497, F09 R13 consent/replay, F11 migrations/CI, F12 Flutter composition, F18 Gateway composition. No branch deletion, release, production mutation, merge, financial transfer, or client-account approval.

## Substantive source delivered

1. **Gateway owner admission and readback:** `ReplayInsightService` requires verified platform session, tenant and Talk Host through the injected canonical authorizer. The Postgres source gate checks current `talks.talks`, R13 finalized replay, original Host recording consent, `replay_media_jobs.status='ready'`, 64-hex media checksum, restricted/blocked safety status and **separately reviewed all-speaker processing clearance**. It denies absent/revoked/changed source. `GET` distinguishes eligible recording without insight from persisted processing/ready/failed; `POST` requires `processingConsent:true` even when service is called directly.
2. **Real durable consent-bounded storage:** `migration.proposed.sql` describes `talks.post_session_insights` and `talks.post_session_processing_clearances`, bounded summary/highlights, SQL uniqueness, compare-and-set 60-second worker lease, and consent audit fields. The source records no arbitrary public post, transfers, or imaginary file receipt. `complete` verifies unchanged checksum/recording and current R13 and speaker/privacy authorization, with late worker outcomes rejected. A 30-day visibility bound is in place pending proper physical cleanup.
3. **Actual provider adapter, not a fake generated result:** `createGeminiReplayInsightProcessor` consumes the existing R13 media-repository and SigV4 object-store interfaces. It rejects nonready/unauthorized media; accepts signed GET only from configured HTTPS origin, redirects denied; streams a maximum 8 MiB OGG with exact SHA-256 verification before sending to the configured Gemini generateContent model; response is bounded, strict JSON and normalized to short **Host-only draft** text, highlights and optional next-Talk title. Untrusted speech is explicitly treated as data, not instructions. A failed or unsafe response is never claimed as a generated artifact.
4. **Flutter private UX:** typed HTTP transport and source-matching DTO, an account-epoch-fenced controller, explicit opt-in checkbox bound to current owner revision, loading/eligible/processing/ready/unavailable/failed states, manual status refresh/retry and read-only review. No auto-share, auto-post, hidden microphone or new bottom tab.
5. **Regression source:** Vitest tests for Host/tenant denial, explicit consent, duplicate processing, invalid generated output, revocation during generation, provider-error redaction, SQL admission/lease/read fences, checksum/bounds and revocation against Gemini, and Fastify route contract; Flutter parser/account-switch tests and Host consent widget review.

## Execution evidence, exact limits

**Executed:** ten independent source-invariant checks over current branch fetched GitHub code: **10/10 passed**, covering exact isolated paths, tenant/Host SQL, all-speaker consent and revocation, SQL complete-time replay safety, origin/checksum/size protection, shared Gateway handler isolation, client explicit consent, account-epoch scrub and unregistered-migration warning. This is static source inspection **not** TypeScript/Flutter compilation, test execution, SQL integration or security acceptance.

**Authored, NOT EXECUTED:** 4 Vitest test modules and 2 Flutter test modules. Neither a pnpm dependency tree nor Flutter SDK/working checked-out repository and disposable PostgreSQL provider were available in this tool session; the repo was accessed via connected GitHub API and committed there. Repository issue #457 documents GitHub Actions runners failing with zero executed steps, not successful tests. No unit/integration/CI/device/provider result is claimed. Suggested deferred commands from a fully checked-out environment:

```bash
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/talk_post_session
cd apps/mobile && flutter analyze && flutter test test/talk_post_session
```

Review package workspace runner/command syntax before execution. Follow with SQL integration using disposable PostgreSQL 18 + canonical replay migrations; concurrent lease and revocation race; a two-device Host/guest consent lifecycle; 8 MiB/timeout/checksum/redirect/audio-injection/provider refusal tests; verify R13 LiveKit egress and real Gemini audio only with safe test accounts; Android/iOS slow/restart/login-switch; security and privacy review. No test has been labeled PASS merely because it was written.

## Incomplete / integration blockers (do not mark DONE)

- **Speaker consent is not yet attestable.** `talks.post_session_processing_clearances` has deliberately **no Host/model/client self-approval API**. F09/R13 must implement verified recording-specific consent for **all recorded speakers**, tie evidence to checksum and revocation, then permit audited clearance issuance. Until then all real audio inference is **fail-closed**. Publication of a public Talk is not speaker transcription consent.
- **Database deployment/retention:** the SQL is deliberately a proposed standalone script, **NOT** a live migration version or registry entry. F11 single migration sequencer must allocate a nonconflicting ID (C02/C05/C06 collision warnings), apply in PG18 test DB, review foreign keys/cascade and R12 deletion, physical 30-day sweep, restore and account erasure. No production schema touched.
- **Composition:** F18/Work alone wires routes, injected canonical authorizer, R13 media/object store and approved Gemini credentials to real Gateway; F12 alone wires the nested Flutter panel into the five-tab Talks/Host route. Nothing here proves API route availability in running Gateway or APK.
- **Audio processing/legal/cost:** qualify actual model audio and response format, recording length and 8 MiB cap, model/provider rate/region/privacy/retention, real signed-URL access, provider outage, timeout, billed token spend and creator constraints. The 8 MiB limit may reject many genuine Talk recordings safely; no chunked transcript/long-recording pipeline is implemented.
- **U07 file/receipts and share:** this lane stores only bounded private text insights; no U07 artifact reference or permissioned export/share, no publication/share/invitation action, no automated next-Talk creation, no cross-device/end-to-end acceptance. Future add-on must use canonical U07 and Host confirmation.
- **Privacy/safety:** separate expiry/deletion job, safety revocation events, session/account-switch signout and all-speaker attendance consent proof need executable tests. Check that replay metadata and talks.safety_enforcement rules match consolidated R13 source.
- **CI and release:** existing #457 Actions capacity/no-step blocker; no staging test fixtures, real Postgres execution, provider credentials, Android device, iOS toolchain or signed release qualification. Leave this PR DRAFT/UNMERGED.

## Required reconciliation order

1. F09/R13 + privacy owner establish durable evidence-backed, revocable recorded-speaker clearance (without any falsely assumed consent).
2. F11 migration owner sequence `migration.proposed.sql` safely, adapt exact SQL to qualified canonical schema, implement retention/erasure and run disposable PG concurrency/security tests.
3. F18/Work integrate Gateway route/service under shared auth/error handling and verified provider/object settings; run typecheck/Vitest and encrypted/revoked replay end-to-end.
4. F12 integrate Host-only panel into approved five-tab Flutter shell; run analyzer/widget and on-device login-switch/restart/consent, then U07 file/public sharing only after exact review.
5. Update this handoff with a *new* SHA, executed test/CI/PG/device/Gemini evidence and reviewer disposition before any merge/release.

**Status: PARTIAL_IMPLEMENTATION**, substantial source implemented and pushed but core shared registration, all-speaker clearance issuance, migration, real provider and physical acceptance remain unverified or absent. A draft PR is a review request, not release evidence.
