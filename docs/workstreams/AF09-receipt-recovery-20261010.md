# AF09 — read back a published-Talk receipt before uncertain replay (2026-10-10)

**Parent customer milestone:** Published audio Talks (UX-A08/UX-A09), existing [PR #609](https://github.com/Baatiku/masanawa/pull/609) and `work/af09-published-audio-20261010-gpt6`. Continue this PR; do not create another helper or integrator branch. Main inspected at `7c443966be97e9092cbc1fb98562c75253434326`. Exact final PR head is the current branch SHA, not the stale original PR description. **Status: PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED for this increment, NOT INTEGRATED, NOT DEPLOYED.**

## Implemented customer increment

The existing composer securely saves a retry key before sending POST, but after a lost response it previously had no read-only server reconciliation before resubmitting. This change adds a server-authenticated `GET /audio-posts/requests/:requestId` with an explicit `{ "receipt": PublicAudioPost | null }` response. It uses the **existing** unique `(tenant_id, author_account_id, request_id)` repository lookup; tenant and account come solely from the AF08-authorized session. It creates no new ledger, upload, migration, database query authority or second post. Public projection excludes internal tenant, request, media and account fields; foreign-account/tenant requests return null.

`GatewayAudioPostTransport` implements optional `AudioPostReceiptLookup`, preserving existing audio transport fakes and older callers. A user-initiated *Retry publication* on a saved/uncertain attempt first reads the server: if a receipt exists, the composer keeps it, clears the matching secure retry key and shows processing/published/failed/removed status **without reposting**; if genuinely absent, the original request ID is replayed through the existing idempotent endpoint. When receipt lookup fails/offline, **no POST is sent** and the encrypted attempt remains retryable. First publish is unchanged; no automatic publish on cold start. Account-switch/disposal generation fences remain around the extra await. No source edit or completion claim for AF05/AF15 recording/upload/player, AF00 shared app/worker/root composition or migrations.

**Claim:** `af09-609-receipt-readback-20261010-gpt6-0428` acquired and read back on `factory/claims`, same #609 source branch, exact paths:
- `services/gateway/src/audio_posts/service.ts`
- `services/gateway/src/audio_posts/routes.ts`
- `services/gateway/src/audio_posts/service.test.mjs`
- `apps/mobile/lib/src/audio_posts/audio_post_transport.dart`
- `apps/mobile/lib/src/audio_posts/audio_post_composer_screen.dart`
- `apps/mobile/test/audio_first/af09/composer_test.dart`
- this handoff.

## Finite parent-milestone source closure

| ID | Required connected source / named owner | Current source state | Execution / integration |
| --- | --- | --- | --- |
| AF09-01 | Post, reactions, comments, remove, receipt and authenticated endpoints; AF09 `services/gateway/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED, receipt increment on #609 | Full source/Fastify/PG checks NOT_RUN; AF00 route imports MISSING |
| AF09-02 | PG feed/saved/counts/comments/Following/creator cursor, `adapters/storage/postgres/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED | PostgreSQL real concurrency, tenant/visibility/pagination NOT_RUN |
| AF09-03 | Real microphone, permission, preview/trim, verified account-owned upload and retry, `apps/mobile/lib/src/human_media/**` / canonical media; AF05/15 | MISSING connected production adapter | AF05/15 implement and test on Android |
| AF09-04 | Real composer/recovered receipt/feed/comments/saves/follows/My Talks/creator UI, `apps/mobile/lib/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED isolated UI; receipt recovery increment added | Flutter/analyzer/widgets NOT_RUN; AF00 shell mounting MISSING |
| AF09-05 | Authenticated Gateway actor/safety/privacy/media factories, `services/gateway/src/{app,main}.ts`; AF00 with AF08/15 | MISSING actual composition | AF00 acquire shared paths and source-wire AF09 routes |
| AF09-06 | Unique append-only social audio-post/reaction/comment/follow SQL migration in `database/migrations/**`; AF00 | MISSING allocated and executed migration | AF00 source-install; AF13 disposable PG up and 2-account checks |
| AF09-07 | Verified signed private media player, focus, range/revocation/retention; AF05/15 | MISSING real sign/read/focus; ticket + Flutter player isolated | Device/object provider NOT_RUN |
| AF09-08 | Durable processing queue, trusted moderation and scheduled worker registration, `services/gateway/src/audio_posts/processing_worker.ts` + AF00 `services/worker/src/main.ts`; AF09/AF00 | Worker/queue PARTIAL; runtime composition MISSING | Database restart/race/recovery NOT_RUN |
| AF09-09 | Two-account record→publish→process→feed→play/follow/comment/save/delete journey; AF09/13 | MISSING connected E2E | Requires AF00/05/15 integration and actual PG/Flutter tests |
| AF09-10 | One reviewed non-deploying integration baseline, shared five-tab shell, deployment audit, local #497/APK source reconciliation; AF00 | NOT INTEGRATED; no AF09 unified SHA published | Do not merge to auto-deploying main or request local pull |
| AF09-11 | Persist unknown-outcome attempt before send, account-isolate and restore same key; AF09 `audio_post_draft_store.dart` + composer | IMPLEMENTED_UNVERIFIED on existing #609; concurrent AF09 account-isolation owner edits only draft_store | Flutter NOT_RUN |
| AF09-12 | Read-only session-scoped receipt lookup + recovered composer retry/confirmed-state without duplicate POST; AF09 this claim | IMPLEMENTED_UNVERIFIED; same-PR source commits/checkpoint | Two backend and three widget tests authored; full workspace NOT_RUN |

**Execution evidence, exact commands and owners:** This sandbox has Node `v22.16.0`, global `tsc 5.8.3`, git/npm, **no pnpm, Dart, Flutter or PostgreSQL executable**, and no private checkout. `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed `Could not resolve host: github.com`. Source blob/readback and targeted structural invariants were checked, **not** counted as runtime compilation. Pin exact final PR HEAD and execute as **AF13 / qualified AF00 Node 24 + pnpm 12/TS 7 runner**: `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test` plus actual Fastify route/auth tests and disposable PG two-tenant receipt readback; **AF13/AF05 Flutter runner**: `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09/composer_test.dart`; **AF00** must verify actual Gateway/migration/worker/mobile shell composition and run unified-source checks at the single reviewed safe integration SHA. Zero-step CI or Vercel quota failure is BLOCKED, not a source test pass. Until that source is present, don't offload missing code to a local pull.

**Next implementation action:** AF00 allocate/install migration and inject authenticated actor, canonical visibility, verified private media and worker under their own exact-path claims; AF05/15 close verified recording/upload/signed playback. AF09 continues missing user-source against this same PR with non-overlapping claims. AF13 executes pinned source and files actual failures for repair. No production/config/financial/provider/device action was performed by this increment.
