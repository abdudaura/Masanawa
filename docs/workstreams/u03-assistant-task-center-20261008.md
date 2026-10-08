# U03 — Assistant task center / operator task presentation handoff

Updated (UTC): 2026-10-08T23:59:00Z; window/owner: GPT-6 autonomous U03
**Status: PARTIAL_IMPLEMENTATION / UNVERIFIED / DRAFT / UNMERGED.**
Claim: this repository file; exact paths below only. Five-minute lease since latest push; other windows must check current branch/PR activity and source before reclaiming.

## Ownership, refs, collisions

- Base main SHA: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch: `work/u03-assistant-task-center-20261009-gpt6`.
- Source/test checkpoint SHA: `de860db6b7288c219aead98c8c4c2dc0803fadb4`.
- Final pushed HEAD: handoff commit associated with this file (the PR head SHA is authoritative).
- Draft, unmerged PR: https://github.com/Baatiku/masanawa/pull/521 (six changed files; no main merge).
- Requirement mapping: U03, U01/U02/C07 dependencies, M08–M09, A01–A02, N08, Q05/Q08/Q09/Q10, J02/J07/J11. No two-device journey has been executed.
- Reviewed current main, 71 initial open PRs and U01/U02 branch presence. No live U03 branch/PR existed at initial claim. Preserve U01 #519, U02 active isolated branch, C07 #480, R17/C08 #493, Work #497, Firebase #461, CI issue #457.
- Exclusive owned paths: `apps/mobile/lib/src/operator_workspace/**`, `apps/mobile/test/operator_workspace/**`, this handoff only. No shared files modified.

## Actual source committed

1. `apps/mobile/lib/src/operator_workspace/operator_task_contract.dart` — strict parsing of U02 server-owned task snapshot/receipt, phases/versions/timestamps/tenant/user, typed immutable event pages and canonical task IDs, bounded no-store readback and cancel transport injection, no invented endpoints or approval tokens.
2. `apps/mobile/lib/src/operator_workspace/operator_task_center_controller.dart` — server-authoritative list/history, U02 cursor-by-taskId pagination, monotonic revision merge, generation fences on refresh/logout/account switch (new authenticated transport required), explicit read-only uncertain-outcome recovery, optimistic-free server-version cancel, reload after restart, expiry guard and contiguous event timeline.
3. `apps/mobile/lib/src/operator_workspace/operator_task_center.dart` — nested Assistant task panel with Active / Needs approval / History, status/progress history, uncertainty messages, secure review callback only when genuine callback composed, edit-draft callback when available, receipt callback only for verified reference, cancel confirmation, explicit read-status/reconcile and return-to-origin action. No voice activation or new root tab.
4. `apps/mobile/test/operator_workspace/operator_task_center_controller_test.dart` — contract/no-fake-receipt, cross-user isolation, stale prior-account response, unknown readback not replayed, versioned cancellation, expired approval and event-gap tests.
5. `apps/mobile/test/operator_workspace/operator_task_center_widget_test.dart` — sections, no accidental approval, unknown status, user-confirmed cancellation, context return, older-history paging and 320px font-scaling coverage.

This is **real stateful production Flutter code** with a typed live-auth transport seam, but it is **not a live end-to-end feature**. The transport requires U02 routes; there is no shadow U02 task store, fake receipts, second Assistant controller, payment code or fabricated provider call.

## Missing source and integration, exact blockers

- **U02 Gateway / Work:** U02 currently publishes a task service on `work/u02-durable-operator-tasks-20261009-gpt6` but no qualified production HTTP task listing/read/events/cancel endpoint has been established in this U03 branch. Integrator must bind `OperatorTaskGatewayBinding` callbacks to authenticated, account-scoped and permission-checked U02 Gateway routes; server session/account is authoritative and callback payloads must never carry caller-supplied tenant/user authorization.
- **C07 / R17/C08:** #480 owns persona/chat, #493/#497 root Assistant/navigation. F12/Work must mount `OperatorTaskCenter` inside the one existing Assistant host, pass matching current authenticated U02 transport from session, refresh after logout/reconnect/persona change and preserve the five tabs. No new Assistant tab, chat store or microphone runtime may be created.
- **Secure approval / draft:** U02's `OperatorTaskView` intentionally excludes approval tokens and detailed exact terms. U03 intentionally does not implement a payment confirmation button: a canonical U01/U02/R05–R08 domain-owned exact-terms reauthenticated approval flow must be implemented and wired to `onSecureApprovalReview`. A similarly qualified prepared-draft editing endpoint should be wired to `onEditPreparedDraft`. Without them, action buttons remain absent, not falsely functional.
- **Context return and result:** host passes typed and reauthorized origin callback, receipt lookup through correct domain rather than opening arbitrary URLs; U07 work artifacts and U09 Gemini Live actions require their own integrations.
- No U03-specific SQL or backend migration is appropriate: U02 owns the real durable task journal and migration, U01 owns protocol, C07 owns Assistant. No native/mobile/root/financial/Firebase changes authorized.

## Verification evidence (strict separation)

**Executed:** connector retrieved all 5 committed Flutter files from U03 branch; 10 bounded static source assertions passed for task phases, account fencing, account transport swap, revisioned cancel, fresh approval readback, missing fake payment calls, untouched root/Firebase imports, authored suites, and pagination. This is source inspection ONLY, **not Dart compilation, test execution, server proof or device qualification**.

**NOT executed:** `cd apps/mobile && flutter pub get && flutter analyze lib/src/operator_workspace test/operator_workspace && flutter test test/operator_workspace`.
Reason: Flutter/Dart SDK absent in current runtime (`command -v dart` and `command -v flutter` yield no executable), direct GitHub clone network unavailable (DNS resolution failure). Repository Actions issue #457 reports quota/runner exhaustion; avoid blind reruns. Thus **all written tests remain UNVERIFIED**, including 320dp layout and compile; do not label passed.

**Deferred full Work gates:** run focused Flutter tests and analyzer after integrating against U02/C07; test real authenticated two-account and cross-device Gateway DB readbacks, event cursor, account switch, C07 Gwani/Gwana attribution, Host/Talk→Assistant→Talk contextual return, financial confirmation expiry, network timeout/unknown/reconnect, privacy, screen reader and voice/text/tap parity. No production/provider/device commands were executed.

## Security, migration, conflicts and roll-back

- Firebase #461, existing five-tab architecture, R05–R08 financial ledgers, shared Gateway composition, database migrations and production systems unchanged.
- Strict tenant/user readback guard; account generation fencing; monotonic task revisions; no local disk history, credential logging, sensitive answer memory or payload persistence in U03; server should apply its own auth and rate policy.
- Cancellation is server-authoritative/versioned, unknown outcome only checks status, client must not resurrect approvals or show generated financial receipts.
- Branch remains draft and unmerged, so rollback is omission from composition or branch abandonment after source preservation; not a runtime migration.
- U02, C07, F12/Work must reconcile exact input DTO shapes and display domain canonical receipt only with verified readback. Scope status stays **PARTIAL_IMPLEMENTATION** while source integration is absent.

## Final integration steps

1. Preserve and integrate U01 #519 and U02 task service in controlled order, register production authenticated read/list/events/cancel route on elected Gateway composer; retain real task CAS and owner guard.
2. Wire authenticated callback transport in one C07 host; no direct hardcoded API path in U03. Mount nested task center in R17/C08 five-tab root, bind persona/task continuity and origin refs.
3. Integrate exact domain quote/approval and actual draft mutation readback; remove or leave hidden unsupported options as appropriate.
4. Run commands above, fix all analyzer/test failures. Add authenticated database two-user/second-device tests and device accessibility/audio/field acceptance; then qualify before any merge.
5. Mark final checks only after executed proof; never upgrade this draft to DONE because code files or static checks exist.

## Release gates

SOURCE_WRITTEN=yes (isolated component); LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=no; APP_INTEGRATED=no; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no.
