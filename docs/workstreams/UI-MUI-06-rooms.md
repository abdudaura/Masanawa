# MUI-06 / AF10 — canonical mounted Rooms source recovery

## Owner-facing scope — 2026-10-13

This development slice replaces the **mounted** legacy `TalkFeedKind.live` Rooms tab with the previously authored J07/J08/C38 **persistent Rooms** Flutter client and screens. It recovers the feature's source from the existing #625 / #655 Rooms branches, including discover/join, joined views, lesson/question detail, paid-entitlement handling, discussion and private saved lessons, without duplicating their backend or payment authority.

- Starting main: `3fcd910ebe905a52f8fe011ee13cf81993e46aa1`.
- Feature branch: `lane/af10-mui06-canonical-rooms-20261013`.
- Source recovery: #655 exact feature checkpoint `172b5bf9a8a1b94a475b5a053d42795e396182b3`; #625 parent `3951d976948cfba787a7a311d0cfecf5fff7da82`.
- Registry: `af10-mui06-main-rooms-20261013-gpt6` at `a62876278ac531ec7188c433e2532cb55a07e896`. Previously released C38 and MUI-01 path records moved from active to history with source/ownership evidence intact.
- Touched paths: mounted `apps/mobile/lib/src/screens/rooms/rooms_screen.dart`, `apps/mobile/test/rooms_screen_test.dart`, recovered `apps/mobile/lib/src/features/rooms/**`, `apps/mobile/test/features/rooms/**`, and this handoff. No shell/router, Gateway main/app, migration registry, ledger, auth transport or provider configuration changed.

## Behavior and safety

The five-tab shell already mounts this `RoomsScreen`. It now issues authenticated `GET /v1/rooms` discovery/joined queries through the existing `ApiClient` Dio, and exposes the recovered canonical Room detail, membership, lesson/question, discussion and saved-lesson journeys. It never maps a live Talk to a persistent Room or routes Room cards into old `/talk/:id` pages. A signed-out tab has no private data. Identity-bound transport checks before and after each call and keyed screen remount prevent stale account responses from repopulating the next fan's tab. The saved-lessons client retains C38's independent account fencing. The backend remains responsible for tenant authorization and paid subscription enforcement; no Google Play adapter or fake entitlement is invented.

Recovered Room discovery now debounces typed search and rejects out-of-order results. A failed query displays retry/unavailable, not empty data. White Room headers replace the old isolated blue header. A paid Room with no qualified subscription adapter has a disabled “Subscription unavailable” control, not a fake checkout.

**This is source integration, not active server deployment.** The J07/J08/C38 Gateway routes, PostgreSQL schema/migration sequence and worker wiring remain in existing #625/#655 branches and require an exact AF00 composition transfer. Until Gateway composition, a real server may return 404/410/503; the app must expose unavailable/retry. Neither successful Room purchases nor saved lesson persistence is claimed on real accounts. In-flight requests on shared mutable ApiClient still depend on AF08's separate request/401-refresh authorization fencing; this source scopes readback but does not replace that work.

## Relevant verification and remaining acceptance

Authored/recovered Flutter tests cover mounted discover/join/lessons, true outage and retry, account-switch late response, denied old-account join, and the pre-existing C38 saved-lessons, paid access and discussion tests. This tool session has no local authenticated Git checkout or installed Flutter/Android SDK; execution **NOT_RUN**. Do not reuse old synthetic test PASS as evidence for this SHA. Run `cd apps/mobile && flutter pub get && flutter test test/rooms_screen_test.dart test/features/rooms && dart analyze lib/src/screens/rooms/rooms_screen.dart lib/src/features/rooms test/rooms_screen_test.dart test/features/rooms`. Whole Flutter analyzer and TalkId CI debt remain separately open. No signed APK/provider/PG18 execution is claimed.

Next: AF00 compose the exact J07/J08/C38 PostgreSQL migrations (0001–0004), one tenant-safe Rooms resolver and Gateway module routes, with pnpm importer and protected app/worker coordination; verify old/new account read, join, lessons, questions, saved, paid denial on a disposable DB. Preserve #625/#655 branches and no production DB or Google Play activation. MUI-03 authenticated server inbox, MUI-04 Status, MUI-07 MSN/funding, MUI-08 quotedAt contract and MUI-09/10 device/release checks remain OPEN.

## Continuation prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md, docs/MULTI-WINDOW-WORK.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md and
docs/workstreams/UI-MUI-06-rooms.md; use latest Software Factory
skill and reconcile fresh PRs/claims. Integrate substantive missing
features rather than spending windows on isolated historical failures.

MUI-06 now mounts the existing canonical persistent Rooms Flutter
journey from #625/#655. Confirm exact merged main and restored
source identity from the MUI-06 handoff and the PR; local test and
live Gateway/PG/provider qualification still require execution.
AF00: transfer protected Gateway/auth/migrations composition and
complete J07/J08/C38 backend/worker wiring; no duplicate authority.
Otherwise continue a disjoint ready milestone such as MUI-03
canonical server inbox, MUI-04 Masana-authored Status, or AF01
MSN/funding reconciliation, preserving all current PR sources.

Do not allow pre-existing 317 Flutter diagnostics, 597/2 Talk
full-suite baseline or TalkId TS2459 to stop compatible feature
development merges. Fix introduced failures, run available focused
checks, retain protection/security, and report precisely what was
not tested. Keep five tabs, Chats default, native/group/incoming
Calls, auth, financial safeguards and server-only Masana status.
Never relabel Cr to MSN, create a second ledger, fake Rooms/status,
or activate unqualified provider operations. Commit, review, push
and merge scoped compatible source normally; release claims and
carry unfinished acceptance to the next window.
```
