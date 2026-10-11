# Continue Masanawa from this checkpoint

Owner instruction: this cloud workspace is the sole implementation and integration owner. Continue recommended connected customer milestones autonomously. Do not assume another window will finish missing work. The owner requested a pushed checkpoint for continuation from another ChatGPT account.

## Start here

Repository: `weavewellindustrieslimited/masanawa`. **Check out `continue-chat-reliability-20261011`, not main.** Read this file, `AGENTS.md`, `CONTINUE-HERE.md`, `docs/NEXT-WAVE-DELIVERY-20261010.md`, and `docs/REUSABLE-IMPLEMENTATION-PROMPT.md`. Follow the Software Factory linked by AGENTS. Preserve existing work; never reset, clean, or force-push.

```sh
git fetch origin
git switch continue-chat-reliability-20261011
git pull --ff-only
git log -5 --oneline
git status --short
```

If your environment has only main, create the local branch from `origin/continue-chat-reliability-20261011`. User credentials are not required for local tests. Do not invent credentials, make paid provider calls, deploy, or run destructive production migrations.

## Source and integration baseline

This branch deliberately preserves existing CHAT-P04 PR #612 head `46af99e50dedd5a1596ffb5795086410ef4ff859`. Main at initial inspection was `7c443966be97e9092cbc1fb98562c75253434326`. Source commits:

- `9c7c9769`: durable server acceptance before inference, preserved client retry keys, safe streamed error codes, best-effort auxiliary events.
- `93836297`: actual isolated PostgreSQL receipt/replay/account-boundary tests and canonical assistant `replyToKey` history provenance.
- `b114b7f7`: compiler prerequisite repairs, reproducible dependency declaration patches, gift/profile unknown-field rejection, stale test fixture repairs, environment registry and source scanner repairs.
- Later commits on this branch contain the mobile outbox/recovery/linkage implementation and this handoff; inspect `git log` for exact latest SHAs.
- `99e65faa`: mobile outbox, accepted-turn recovery, canonical reply linkage, focused regressions, localization lock reconciliation and generated-file exclusions.

This is a safe feature/integration checkpoint, **not a production release or a claim that the whole app is complete**. Main pushes trigger mobile/signing/foundation workflows. Do not merge to main or deploy without auditing production hooks and completing applicable gates. Existing PR #616 (`e33490013c54a9dc3a86c8fcb526a01634df3992`) contains substantial separate app rebuilding work (333 changed files at inspection). Review and reconcile it rather than discarding it or assuming another account integrated it. PR #600 was also fetched for read-only source comparison.

## Implemented behavior

CHAT-P02: gateway accepts only after durable authorized command claim; streamed `accepted` arrives before model completion; identical request keys replay/poll rather than executing twice. Auxiliary event failures cannot strand newly claimed turns. Telemetry keeps public correlation IDs server-issued while recognizing agent turn idempotency keys.

Mobile: outgoing bubble appears immediately; account-scoped atomic persistence precedes production text dispatch; stable request ID and private transport prompt survive restart; preview alone may run signed out without durable storage. Accepted/processing are distinct from human read receipts. Timeouts reconcile canonical status. Restored sending turns requeue only on authoritative `missing`, preserving the original key; stale streaming placeholders are removed. Account/provider changes fence in-flight completions and flush loops. Disk-write failure blocks dispatch.

CHAT-P03 partial: canonical assistant history carries `replyToKey=user:<requestId>`. Mobile resolves those keys to stable local IDs in two passes, including cold/out-of-order history. Unrelated explicit keys are refused. Broader tool/transaction/result provenance remains to implement.

Gift and profile routes now reject unexpected raw body fields before Fastify can strip them and execute an operation. Existing auth, financial, account-deletion and replay contracts remain authoritative.

## Executed validation and limits

Prior executed results (final broad rerun results are recorded below if available):

Final checkpoint verification: `pnpm typecheck` **PASS**; Gateway plus dependency build **PASS**; `pnpm test:ci` **1,250 passed,1 failed,145 skipped** (233 passed files,1 failed file,21 skipped files). The sole failure is `tests/contracts/public-api-lifecycle.test.ts` → `versions service contract routes while leaving only probes unversioned`, covering the73 legacy unversioned source routes described below. Do not describe the whole suite as passing. Focused mobile recovery/receipt/thread tests **38 passed**, exit0, on the explicitly limited Flutter3.44.0/Dart3.12.0 runner (`--no-pub` after3.12.2 resolution). Official supported-bundle and device qualification remain pending.

- Gateway chat service/route/app suites: **43 passed**.
- Real PostgreSQL18 receipt recovery and scope/provenance tests: **2 passed**, using an isolated disposable database and actual mobile-shell migration; no provider calls.
- Compiler prerequisite/domain repair suites: **122 passed** across21 suites, then **94 passed** across9 other domain suites. Fresh gift/profile route tests: **30 passed**. Avatar exact-byte fetch tests: **6 passed**. Environment registry tests: **4 passed**.
- Full `pnpm typecheck` passed after reproducible dependency repairs. `skipLibCheck` remains false. Gateway includes standard DOM declarations because isomorphic dependencies expose canvas, Fetch and WebAssembly types; this does not provide browser APIs at runtime. Two pinned pnpm patches fix a malformed ESM import and a missing `EncodingNode` declaration; `@types/ws` is pinned.
- Earlier broad suite before the final domain fixes:1,231 passed,17 failed,145 skipped. Most failures were subsequently repaired. **One remaining architectural issue is real:**73 legacy unversioned gateway source routes are absent from the API lifecycle compatibility/versioning policy. Source scanner now excludes dependencies/build artifacts; do not erase that test or blanket-allow routes merely to obtain green.
- Mobile Dart3.12.2 source analyzer:7/7 changed source/test files reported,0 errors,3 existing warnings and29 lint info diagnostics at initial check. Final changed diagnostics may be reduced; re-run.
- Flutter official bundle matching the repository requirements was unavailable from the allowed artifact hosts. Public OCI SDK layers were checksum verified. Flutter3.44.0's engine bundles Dart3.12.0; overlaying verified Dart3.12.2 successfully runs the tool/analyzer but Flutter tests fail before compilation with a Kernel SDK hash mismatch. Limited tests therefore use the original matching Flutter3.44.0/Dart3.12.0 engine, with package configuration resolved under3.12.2 and `--no-pub`. **Report those separately from supported release-bundle validation.** The SDK constraint `^3.12.2` has not been relaxed. No signed binary/device/release qualification has occurred.

## Reproduce in a fresh environment

Use the cloud-environment-onboarding:setup skill. Install Node24 and pnpm12, then `pnpm install --frozen-lockfile`. Pnpm verifies supply-chain policies and reapplies the checked-in patches. Run `pnpm typecheck`, `pnpm test:ci`, and `pnpm --filter @masanawa/gateway-service... build`.

For real database checks use local PostgreSQL18 with pgvector; set `MASANAWA_TEST_DATABASE_URL` to a **disposable local** test database. The receipt suite creates/drops its own database, so this test user needs CREATEDB. Run:

```sh
pnpm exec vitest run services/gateway/src/agent_conversation.test.ts services/gateway/src/agent_conversation_route.test.ts services/gateway/src/app.test.ts services/gateway/src/agent_receipt_postgres.integration.test.ts
```

For mobile install an official compatible Flutter bundle, verify `flutter --version` satisfies Dart`^3.12.2`, run `flutter pub get --enforce-lockfile`, `flutter analyze`, and `flutter test`. Localization Dart files are generated by pub/gen-l10n and ignored; ARB source remains tracked. The lock was previously inconsistent with declared `flutter_localizations`/`intl`; this branch resolves those dependencies. Review SDK-pinned versions against your official bundle; avoid silently changing SDK constraints to pass a check.

The old cloud workspace has pnpm at `/workspace/.onboarding-tools/node_modules/.bin/pnpm`, a local database container `masanawa-onboarding-postgres`, scripts under `/workspace/.onboarding-tools`, and detailed logs under `/tmp`. These paths/logs **will not transfer to a new account**. Only the repository, pushed commits, handoff and configuration draft are durable. No secrets are checked in.

## Next work, in order

1. Verify the pushed branch and fresh status, then finish the exact mobile tests/analyzer under an official compatible bundle. Keep limited-engine evidence clearly labeled. Diagnose genuine source failures instead of assuming another window handles them.
2. Repair the legacy route API lifecycle mismatch through a reviewed compatibility/versioning design. Preserve current clients and auth; if adding versioned aliases, normalize versioned agent route recognition so `x-request-id` idempotency does not regress. Add executable route tests, then rerun the full suite.
3. Complete remaining CHAT-P02/P03/P04/P05 checklist work: canonical linked tool/result/transaction provenance, bounded model/tool execution with ambiguity-safe recovery, bounded history/caches, and event-driven wallet refresh. Do not blindly fail and respend an already authorized ambiguous operation.
4. Reconcile the existing PR #616 rebuilt app/source into one tested safe integration baseline. Do not wholesale replace this branch without reviewing overlapping chat, auth, financial and migration authority.
5. Implement GWANI-P01 connected durable purchase collection, starting with airtime: authorized tenant/user/character/relationship-scoped draft, stable ID/revision, partially collected fields, corrections, explicit quote binding, and continuity across text/menu/voice/session rotation. Reuse canonical commerce validation, quote, consent, funding and ledger contracts. A corrected draft must invalidate old signed consent at every confirmation path; clearing a pointer alone leaves an old quote actionable. Never mutate processing spend. Existing MSN migration/settlement work in PR #576 needs reconciliation; do not relabel old NGN balances or claim paid completion.
6. Keep pushing source checkpoints and updating this handoff. End-to-end/device/provider/deployment evidence is separate from source completion.

## Copy into the next account

> Continue `weavewellindustrieslimited/masanawa` from branch `continue-chat-reliability-20261011`. Read `CONTINUE-CLOUD-20261011.md` first, then AGENTS and its linked current product/Factory instructions. You are the sole owner; no other window will finish missing source. Preserve all pushed changes and existing PR work, verify the latest branch head, finish the listed checks and recommended connected milestones autonomously, and push checkpoints with accurate handoffs. Do not deploy or invoke paid providers implicitly. Do not claim unrun tests passed.
