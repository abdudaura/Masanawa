# Reusable implementation prompt — end-to-end, test-and-merge (2026-10-10)

Copy this to **each continuing Masanawa development window**. Keep the original feature PR, current ownership and independent AF00 integrator. A window does not finish by writing a patch or preparing a handoff; the default outcome is a reviewed, executable, integrated and safely merged customer milestone.

```text
MASANAWA — FINISH THE CUSTOMER MILESTONE, RUN ALL TESTS, AND MERGE SAFELY

Repo: https://github.com/abdudaura/Masanawa
Factory: https://github.com/Baatiku/Software-Factory-starter-kit
Window ID: choose a unique ID; never impersonate another active owner.

OWNER'S TOP PRIORITY
Do not stop at a partial fix, standalone helper, written tests, passing
structural checker, draft PR or "waiting for integrator." Carry the accepted
end-to-end customer journey through implementation, execution, test repair,
canonical wiring, review, safe integration and merge whenever permitted.
Continue meaningful work until no implementable milestone source item remains.
No unrun or skipped check counts as PASS. Don't request a local pull until
remote feature source and shared integration are actually complete.

FIRST READ THE LIVE STATE (not an old handoff)
Fetch current main and AGENTS.md, CONTINUE-HERE.md,
docs/NEXT-WAVE-DELIVERY-20261010.md, docs/MULTI-WINDOW-WORK.md and this
prompt. Read the latest accessible Factory SKILL.md/AGENTS.md/references.
Check GitHub PRs (including #460, #497, #576, #600, #609, #612),
factory/claims current leases, file diffs, one AF00 root integrator, and
source-completion checklist. Read the current GitHub Actions job/step logs,
not cached conclusions; runners on transferred abdudaura repo have executed
Node24/pnpm12 and Flutter steps. Keep unresolved CHAT-P01–P05 and GWANI-P01.
Live PR source overrides template status. Preserve unseen local fixes.
Do not restart or duplicate existing implementations.

CLAIM ONE COMPLETE MILESTONE
Select highest priority unfinished customer journey already in your lane
and continue its existing coherent PR. If scope differs materially, claim
one coherent new feature PR, not a helper or a second integration branch.
Use the GitHub CAS registry to claim exact paths before changes; stale
leases still require reviewed transfer. Protect AF00 router/Gateway/worker/
migration/deployment composition, AF08 auth, AF01 ledger and AF05 native
audio. Request narrowly defined transfers and follow through to integrated
readback; don't leave missing imports/routes/migrations for the owner.
One feature may have collaborators, but each acceptance row has one
responsible implementation owner and an executable source/test destination.

DEFINE THE WHOLE JOURNEY BEFORE CODE
Maintain a FINITE checklist in the same PR:
ID | required source & exact path | owner | source state | commit SHA |
actual test command/result | AF00 handoff/composition | integrated SHA.
Cover UI navigation, loading/empty/error/offline/permission/retry,
accessibility, identity/privacy, server-authorized API, canonical DB/job/
object repository, durable idempotence, user-consent/payment boundaries,
receipts/readback, restart/reconciliation and failure/negative paths.
Use only applicable layers but never substitute mocks for production wiring.
Do not mark acceptance done if any required implementation is disconnected.

IMPLEMENT UNTIL SOURCE COMPLETE
Preserve previous fixes. Implement feature-owned code, migrations proposals,
real API/transport/state/UI wiring and meaningful regression tests; consume
canonical contracts rather than duplicate ledgers/accounts/escrow/jobs.
A local APK/Flutter/provider limitation defers only the specific runtime
qualification, not server/route/mobile source or conflict resolution.
Use one continuing PR; no additional generic validators, duplicate cleanup,
security abstraction or standalone evidence PR to appear busy.
Refresh main and other PR heads before resolving conflicts.

RUN → READ LOGS → FIX → RERUN (REPEAT)
Use the newly available hosted Actions, or a valid matching checkout:
- Node24 / pnpm12: pnpm install --frozen-lockfile
- pnpm typecheck && pnpm test:ci && pnpm build
- Targeted vitest/contract/negative/provider tooling tests for your changes
- PostgreSQL18 isolated migration/visibility/constraint/retry tests if relevant
- cd apps/mobile && flutter pub get && flutter analyze && flutter test
- flutter build apk --release (where app/release configuration permits)
- E2E account/device/provider/rollback checks where authorized/available.
For each current job record run/job URL, SHA, actual steps and exact failure.
Repair compile/analyzer/test/source errors under a proper claim and rerun.
A test skipped after Typecheck/Analyze fails is still NOT_RUN: do not call
a red workflow an infra outage when the real runner ran tests and failed.
The old Baatiku 2000-minute quota is historical; measure current runner
availability. Avoid exhausting new account with meaningless reruns or a
workflow per registry heartbeat. Run only after meaningful changes.
Do not alter financial safety tests, bypass checks, force-pass CI, enable
paid overage, touch production or run paid transactions without authority.
If another owner's path is at fault, publish exact file/line/PR and
transfer, then keep working other independent acceptance rows, and check
that blocker actually gets repaired rather than ending with a complaint.

INTEGRATE AND MERGE, NOT JUST HAND OFF
Use AF00's ONE reviewed, known non-deploying integration target and pinned SHA.
Audit GitHub Actions, Vercel/Railway Git integration, auto migration and
production hooks before *any* main merge. Review latest branch head, real
source conflict/dependency/security changes and passing appropriate tests.
Follow through on bounded shared-file transfer, incorporate tested source,
rerun affected combined checks against the MERGED integration SHA, then
MERGE compatible verified PRs promptly in dependency order. Authorize
reviewed non-overlapping merges when exact-path ownership permits; AF00
remains sole composition authority. If main has unsafe auto-deploy hooks,
merge only on proven non-deploying baseline until gates are fixed.
A device/provider release needs separately executed E2E, privacy, backup
and rollback proof; it does not block an otherwise safe non-deploying merge.
Never merge a real failing auth/money/privacy/security or compilation issue,
and never declare a draft "done" merely because source was written.

STAY ACCOUNTABLE FOR THE ENTIRE PENDING TEST QUEUE
AF13 + AF00 keep one exhaustive list of pending/failed/skipped Foundation,
Flutter, PostgreSQL, Android, provider/tool and E2E runs by PR & exact SHA.
Every source owner owns repairing its failures and rerunning checks. Prioritize
one tested integrated SHA to avoid N repeated full builds; inspect runner
quota. Close only checks that executed and passed; keep blocked checks with
exact capability, command, owner and when the action becomes executable.

FINISHING RULE — NO MORE WORK LEFT BEHIND UNACCOUNTED
Before ending report:
- Closed journey/acceptance IDs and exact source commits;
- Missing/partial items, files and named current owner/next code action;
- Tests PASS_REAL / PASS_SIMULATED / FAIL / NOT_RUN / BLOCKED, exact URLs;
- PR base/head and ONE reviewed integration target/actual merged SHA;
- Merge status and actual code/deployment safety reasoning;
- Provider/device/credential/local-source qualifications outstanding.
If tests failed or source still missing, continue correcting it here.
If a truly external blocker remains, keep the SAME milestone PR and exact
handoff so the next window continues it, not starts another helper.
Do not request local pull or declare complete until all implementable
source+composition is integrated and the remaining run-only gates are explicit.
```

**Policy:** The same source-closure rule is mandatory in [AGENTS.md](../AGENTS.md), [coordination](MULTI-WINDOW-WORK.md) and [delivery backlog](NEXT-WAVE-DELIVERY-20261010.md). A merge to a tested non-production baseline and final production release are separate gates; neither may be falsely claimed.
