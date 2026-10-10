# AF09 Published Talks — denied reactions and feed-cursor recovery

**Parent milestone:** [Published Audio Talks, PR #609](https://github.com/Baatiku/masanawa/pull/609), the same branch `work/af09-published-audio-20261010-gpt6`. Not a new helper, authority, integration branch or standalone milestone.

**Scope claim:** `af09-609-service-errors-20261010-gpt6` via `factory/claims`, read back before edits. Owned source:
- `services/gateway/src/audio_posts/service.ts`
- `services/gateway/src/audio_posts/service.test.mjs`
- This handoff document.

**Connected failure-state correction (not feature completion):** Existing PostgreSQL `setReaction` rejects unpublished, removed, hidden and foreign posts with `audio_posts.not_visible`. The service previously allowed that expected repository rejection to bubble into the generic Fastify error path as HTTP 500 instead of a neutral not-found result. The published feed's database cursor parser similarly returned raw `audio_posts.invalid_cursor` as HTTP 500 rather than a typed invalid cursor, breaking client retry/error presentation. Reused the existing error mapping authority for reactions and seek cursor while preserving existing comment conflict/denial behavior. Real database/provider failures remain genuine errors rather than being recoded as missing posts. The existing `routes.ts` Fastify mapper already maps typed `NOT_FOUND` to 404 and `VALIDATION` to 400; no root routing edits needed.

**Committed source:** `8fdd47336a1b380c72f40d751f28ffe7c85e8abe`, Git blob `3991eb710c4b00ee5f6ac80bbe5f49653e81748c`.
**Expanded canonical test suite:** `43f75c7f613a59e6453ca618c14fdf5e2dd411d7`, Git blob `653209b3a5905d82be7985eb8f0d80de81a52918`. Four added regression cases for processing/removed/blocked/foreign reactions, malformed stored cursor, real DB outage and spoofed lookalike errors. Updated fixture to use the actual `audio_posts.not_visible` error emitted by the PostgreSQL adapter.

## Executed evidence (actual scope)

- **Byte identity:** Local executed `service.ts` Git hash `3991eb710c4b00ee5f6ac80bbe5f49653e81748c` exactly matches the committed source; unmodified `contract.ts` Git hash `9255fac4282ad915b564cf7e4b87e571abeb017b` likewise matches.
- **PASS_ISOLATED:** `tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext service.ts contract.ts` exited zero on TypeScript 5.8.3; compiled the same exact sources with `tsc --outDir compiled`.
- **PASS_REAL focused source execution using fake canonical repository:** `node --test /tmp/af09service/focused_source.test.mjs` yielded **6/6 passing** on Node 22.16.0, exercising the compiled byte-matched service/contract modules: published projection, denied processing/revoked/blocked reactions, invalid cursor, genuine DB outage, unchanged comment conflict. The focused local harness is a separate smoke suite, **not** the committed `service.test.mjs` and **not** a real Fastify/PostgreSQL integration.
- **AUTHORED, NOT RUN:** the full existing 22-case `services/gateway/src/audio_posts/service.test.mjs` suite as committed. Exact required command on a capable checkout: `pnpm install --frozen-lockfile && pnpm -r typecheck && node --test services/gateway/src/audio_posts/service.test.mjs` after the normal TS build/runtime setup. Recheck actual package scripts and `.js` imports; do not substitute this isolated test for the full pinned Node24/pnpm12/TS7 suite.
- **BLOCKED:** this container has no authenticated Git checkout and GitHub DNS `git ls-remote` fails `Could not resolve host: github.com`; pnpm12, Node24, PostgreSQL and Flutter/Dart are absent. Prior CI jobs ran zero steps and Vercel preview hit its free-plan daily build cap. No database/provider/device production proof.

## Remaining parent milestone, exact owner and integration gate

Maintain the **finite whole-milestone checklist** in `docs/workstreams/AF09-processing-recovery-20261010.md` on this same PR; this fix changes the service-readback item from unhandled expected failures to isolated-source-checked, not to `INTEGRATED` or `VERIFIED_E2E`. **AF00** owns approved append-only social schema installation, real AF08 session/tenant/visibility/media authority composition, trusted worker scheduling, Flutter five-tab Talks mount, local source reconciliation and the single published non-deploying safe baseline. **AF05/AF15** own real recorder→verified object→private authorized player and retention. **AF13/capable runner** owns full exact-head Node24/pnpm12/Flutter/PostgreSQL negative and two-account media tests. All remaining source must be implemented remotely before local pull; toolchain-only checks may be deferred honestly.

**Integration status:** PR #609 still contains uncomposed source. Do not merge it wholesale into a potentially auto-deploying main on the strength of six focused tests. No merge, deployment, schema, provider or APK action performed. Existing other AF09 path claims remain unchanged.
