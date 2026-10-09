# U08 — user-selected human DM AI assistance: mandatory Work handoff

**Status: PARTIAL_IMPLEMENTATION / SOURCE WRITTEN / RUNTIME & E2E UNVERIFIED / DRAFT UNMERGED / NOT DEPLOYED.** U08 work is source-complete for an isolated selected-text/consent/review bridge but **not connected** to the active Gateway, C02 routes or Flutter Chats context menu. Do not mark U08 DONE, enable by production flag or merge without composition and real tests.

**Claim:** 2026-10-09 01:19 Africa/Lagos; exact-path five-minute lease to `services/gateway/src/human_ai_assist/**`, `apps/mobile/lib/src/human_ai_assist/**`, `apps/mobile/test/human_ai_assist/**`, this handoff. An expired lease is not a permanent reservation. This branch did not edit shared Gateway app/main, global migration manifest, C02/C01, Flutter router, Firebase, finance, native files or production.

**Branch:** `work/u08-selected-dm-ai-assist-20261009-gpt6` — source/fixture checkpoint **`423b64d7123b35d8b01f5e6f47cf853923ee4c6a`**, additional schema security fix **`0a1b56faa96ea2ce884a8cb9a3677bff7520893b`** and static existence verification after source edits. **Additional Flutter review and regression test checkpoint:** `bb33e1ebb5f5312e8db298e3b9742238686c2f13`. **Main baseline:** `5e758673ae91082520b21b3153da53791ae2cbf3`. The latest PR HEAD must be read from the PR metadata after this handoff commit; never confuse a source checkpoint with final branch HEAD.

## Implemented source and actual limitations

- `services/gateway/src/human_ai_assist/service.ts`: strict 1–3 selected UUIDs, authenticated account and tenant, accepted consent before message read/model invocation, masked phone/financial identifier option, untrusted text as data not instructions, per-account model budget, max input/output sizes, signed five-minute HMAC SHA-256 review tokens bound to owner/tenant/recipient/thread/exact message revision and explicit reply purpose, stable replay idempotency nonce; no silent broadcast, no automatic send, no wallet/Talk side effect.
- `postgres_source.ts`: SQL read of **only exact selected C02 IDs** with active canonical actor/peer, C01 accepted/non-revoked contact, reciprocal block and moderation, deleted/tombstoned exclusion. Reauthorization occurs both before inference and before actual send; canonical C02 `HumanDmService.send` performs another transactionally authenticated send check. This is **not** a new DM schema.
- `postgres_budget.ts` and `migrations/0001_human_ai_assist_quota_isolated.sql`: atomic max 20 inferences per tenant/user/hour, active identity check, foreign-key removal on account deletion; quota row only, **no DM/model transcript**. Migration intentionally NOT in the shared migration registry; quota application/retention cleanup remain integration-owned. Missing quota table fails closed.
- `inference_adapter.ts`: real canonical `@masanawa/agents` bounded `generateAgentInference` boundary, injected preconfigured agent inference provider (e.g. existing Gateway provider), no additional API keys/client, explicit no tool access, no Agent Memory write; draft/translation/Talk-preparation text, no execution.
- `routes.ts`: Fastify `/messages/ai/prepare` and `/messages/ai/send-reviewed` contract, **NOT registered on main**. Existing Gateway customer authentication must be bound when integrating. Review token kept outside model payload.
- `apps/mobile/lib/src/human_ai_assist/**`: isolated nested bottom sheet with purpose picker, clear selected-only AI disclosure, number masking switch, deliberate review/edit, recipient and exact-message confirmation, Dio `ApiClient` authenticated transport, account-switch generation fences, token in-memory only, honest uncertain status and same-id resend; never adds sixth tab, never auto-opens Talk. A post-implementation UX security review fixed stale reviewed-text consent when users edit a draft or discard/start another suggestion; regression widget test authored at `bb33e1ebb5f5312e8db298e3b9742238686c2f13`.
- No voice-note transcription, multimodal media permission or future-granted Assistant memory. These remain explicit separate opt-in capabilities, not secretly supported.

## Auth/privacy, retry and financial boundaries

Selected IDs are not trusted as authorization; PostgreSQL fetches actual persisted text only with current C01/C02 checks. The assistant is not enrolled in the human conversation. Source message edits, deletion, contact revocation, reciprocal block, tenant/account change and 5-minute consent token expiration abort send. Failed model output cannot mark a sent DM. The sender is the **existing C02 service**, not a new message insert. Lost-send-ACK retries retain exactly the server-bound nonce/body while token valid. **After expiry, uncertain C02 message acceptance requires additional canonical request-id status/readback**; Flutter deliberately displays unconfirmed rather than fabricating success. Race conditions with revoked access still require a real PostgreSQL concurrency test; no provider-side data-retention claim without provider policy evidence.

## Tests and evidence (source vs execution)

**Source-authored tests**:
- `service.test.ts`: no consent→no message/model; bounded duplicate selection; masking; nonmember/block; tenant/user swap; edited selection revision; tamper/expiry; explicit recipient and reviewed words; same-ID retry; translation/Talk drafts never send.
- `postgres_source.test.ts`: parameterized exact UUIDs, tenant/user, active/consent/moderation SQL requirements and partial read denial.
- `postgres_budget.test.ts`: atomic quota SQL, 20/hour guard, exhausted/failing DB rejects.
- `inference_adapter.test.ts`: canonical provider data minimization, tool exclusion and limits.
- `apps/mobile/test/human_ai_assist/selected_message_assist_test.dart`: consent UI/controller, explicit sending, unknown-ACK repeat, account switching and translate-only.

**Executed here:** GitHub API source existence / nonempty / NUL-free integrity inspection **14/14 paths passed**; source-level safety assertions for key token/consent paths inspected. These are **STATIC INSPECTIONS ONLY, not a TypeScript build, test run, Flutter analyzer/widget execution, SQL migration or real-device test**. This environment has Node but lacks a mounted private repo and cannot resolve github.com through the shell; Dart/Flutter and Postgres provider test environments are not available. The known shared GitHub Actions issue #457 prevents ordinary CI execution. No live provider credential was used and no production systems touched.

**Unexecuted reviewer commands after checkout**:
```sh
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/human_ai_assist
pnpm --filter @masanawa/gateway-service typecheck
pnpm --filter @masanawa/gateway-service build
cd apps/mobile && flutter pub get && flutter analyze lib/src/human_ai_assist test/human_ai_assist
flutter test test/human_ai_assist
```
After single-owner C01/C02/Gateway migration composition, run isolated PG migration/SQL/route tests, two-authenticated-user edit/revoke/block race tests, actual configured Gemini provider transcript-minimization checks, 2 Android accounts and return-to-thread/deep-link/resume/signed-out checks. Do not infer PASS from test source or a pre-step CI failure.

## Dependency and conflict ledger

- C01 **#468** accepted contacts privacy schema `0016` and safety; C02 **#472** contains the selected canonical human DM service/table `0017_human_dm_core.sql`; duplicate C02 **#475** has a competing `0017`. F15/Work must elect one canonical schema/transport BEFORE U08 is registered; never apply both. C03/C04/C05 (#473/#478/#474/#476) offline/message voice rights are not bundled here.
- C07 **#480**, U01 **#519**, U02 **#520**, U03 **#521** and Work **#497** are unmerged; later operator-task/context continuity is a separate U08→C07/U03 connector. Do not quietly write into the shared Assistant and commit only the selected scoped bridge.
- Single R17/C08 owner **#493** integrates `SelectedMessageAssistSheet` into long-press selection under Chats, using actual C02 IDs, verified human recipient and user session key; F12 owns typed return route / logout purge, not U08.
- Gateway owner constructs `createPostgresHumanAiSource(existingPgPool)`, `createPostgresHumanAiBudget(existingPgPool)`, `createCanonicalHumanAiGenerator(existingAgentInferenceProvider)`, `createHumanAiAssistService({identity:existingPlatformSessionAuthorizer, source, budget, generator, sender:canonicalHumanDmService, reviewSecret:secretFromManager})`, and registers `registerHumanAiAssistRoutes` only after real auth/schema/quotas tests. Secret must be random >=32 bytes, stable across pods/restarts and rotated with review-token invalidation; never commit it to source.
- Migration owner places quota migration in the **one** canonical manifest AFTER C01/C02 with a globally unique ID, and schedules retention purge of quota metadata. Test disposable PG, not production bootstrap.
- For reliable unknown-send recovery beyond TTL, C02 owner should expose authorized per-user readback by canonical `clientRequestId`. Never issue a fresh ID on an uncertain send.
- No changes to Firebase, ledger, financial approvals, five-tab route, global Flutter dependencies or real production system.

## Next owner acceptance

1. Reconcile C01/C02 migrations and choose the single production human-message API. Compose/authenticate U08 with canonical agent inference and rate-budget table; finish route contract and real PostgreSQL/privacy/timeout/429/error envelope tests.
2. Integrate nested selected-message sheet into the canonical human-only C02 thread (long press, returning scroll/draft, session identity switch), and opt-in voice transcription only after distinct C04 consent authorization.
3. Run real test commands above plus two-device selected-message→preview→edited confirmed send→B receive, edit/revoke/block races, offline uncertain response, assistant unavailable, phone privacy masking and no memory retention.
4. Run reconciled strict build/Flutter checks, review unknown-result reconciliation and final release/CI gates; keep this PR **DRAFT and UNMERGED** meanwhile.
