# F16 / C03 — single foreground human-DM poll lifecycle (2026-10-09)

**Disposition: PARTIAL_IMPLEMENTATION, DRAFT, UNMERGED, NOT DEPLOYED.** This is a bounded recovery of existing C03 source on [PR #483](https://github.com/Baatiku/masanawa/pull/483); F16 (C03+C05) and all real messaging journeys remain incomplete. Do **not** mistake unit-test source or a static code readback for a working two-device feature.

## Immutable source checkpoint and ownership

- Latest inspected `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing PR #483 predates this main; preserve its history and original C03 #473. **Do not rebase/merge automatically.**
- Continued branch `work/c03-reclaim-realtime-20261008-gpt6`, **existing draft PR #483**. Previous source HEAD: `bd2ecd7f375e23cd301b7d66b98c8b14ba666147`.
- Source/test checkpoint HEAD (prior to this documentation commit): **`2190ab39539e27589a5a3c713f99149a6c7c86fa`**.
- Pushed file blob SHAs: `apps/mobile/lib/src/messages/realtime/human_dm_realtime_sync.dart` **`4ba62978b39ebabe198f668a9987e3e45eee588d`**; `apps/mobile/test/messages/realtime/human_dm_realtime_test.dart` **`9405e01e554de0012bfab8aaf7995fd86fe24c19`**.
- Exact-path lease **`gpt6-f16-c03-foreground-singleflight-20261009`** was published to `factory/claims:.factory/leases.json` at commit `bd0009976ace294ecebe6b7db50bbc8e407d752d` **before** source edits; ownership covers only the two above Dart files and **this** handoff. No outstanding concurrent active claims at acquisition.
- All changes are in the existing C03 mobile sync implementation. No alternative cache, journal, database schema, API, payment, auth, Firebase integration, root router, Gateway composer or production deployment was created.

## Concrete fault and correction

Previously each `runWhileForeground()` entry started its own `while (active)` loop. A route's lifecycle listener and a foreground reconnect could enter simultaneously; `syncOnce` did serialize **individual** polls, but after each completion both outer loops kept independently scheduling poll cycles, status changes and backoff. This causes unnecessary private-message refresh traffic, repeated C05 cursor activity and low-end phone battery/data pressure.

Now `_foregroundRun` holds one shared foreground lifecycle Future: duplicate calls join the same loop; its Future is stored **before** the loop's microtask begins to prevent status-callback reentrancy; an immediate sign-out cancels startup without a network request; completion clears the slot only when the Future identity still matches. The canonical C03 `syncOnce`, auth-required stop, cursor-after-projection ACK, retry/backoff, C05 account/store binding and C02 authorization are unchanged.

### Auth, UI and recovery contract

This modification is behind the final Chats five-tab route (currently awaiting F12 integration). No new screen or route is introduced: authenticated **Chats → human DM** begins syncing on foreground entry; two concurrent foreground listeners should observe one connecting event/one poll; sign-out or account switch stops it. During network failure the existing retry UI remains accurate, 401/403 require authentication, lost/expired cursor requires C02 resnapshot before persistence, and no message or receipt can be represented as delivered merely because an event was polled. Backend and Postgres implementation remain the unmerged canonical C03 draft, not reimplemented here.

## Tests and evidence — truthfully separated

- **Executed static GitHub source/readback check, 9/9 assertions passed** against the exact pushed branch files: draft/unmerged PR; one new field; one public method; guarded concurrent reuse; early-stop condition; identity-checked Future cleanup; one private loop; all three test case names present; existing lease present. **This is static shape verification only, NOT Dart analyzer or executed Flutter tests**.
- **Authored, NOT RUN:** three Dart `flutter_test` regressions:
  1. two foreground callers get the same pending Future, one poll, no cursor save after stop;
  2. stop between foreground entry and microtask prevents all network calls;
  3. reentrant `connecting` callback reuses the Future, never creates an extra poll.
- Runtime/tool availability inspected here: Node 22 and `tsc` present; **Dart/Flutter SDK not available**. Private full checkout from the connected GitHub environment not mounted locally. **No Flutter test, analyzer, device, pnpm workspace, PostgreSQL, provider, CI, Firebase or two-user network check executed.** Actions #457 remains the known CI runner/quota impediment, not an application-test verdict.
- No data migration, privileged SQL, production release or destructive side effect performed.

## Conflicts, risk and next exact integrator actions

1. Preserve and review **C03 #483** plus stacked retention child **#486**, original #473; **C01 #468**, choose one C02 canonical migration/API (**#472 vs #475**) and one C05 protected offline cache/outbox (**#474 vs #476**). No speculative C02 DTO or second local store is permitted. Coordinate F12 (five-tab shell), R14/F10 (notifications), C04 (attachments), Work #497 and route composition with the protected owners.
2. From a fully installed, reviewed, combined checkout **at the final integration SHA**, execute `cd apps/mobile && flutter analyze && flutter test test/messages/realtime/human_dm_realtime_test.dart && flutter test test/messages/realtime/`. Ensure the microtask-scheduled startup has no lifecycle regression in widget teardown.
3. Then run Gateway C03 typecheck, focused Vitest and disposable PostgreSQL C01/C02/C03 migration+pruning tests, replay/offline/backoff/permission/revocation/tenant-switch tests, and two real Android accounts/devices for Chats read/send/unread/sync/resume with weak network. Confirm one poll per foreground owner and readback from the authoritative C02 backend; measure network, memory and battery on budget Android. Qualify Firebase and provider checks separately if relevant.
4. **Acceptance gate:** F16 remains PARTIAL until the one canonical C03/C05 implementation is actually wired through Gateway, auth, database, Flutter root and persisted readback. Do not merge or deploy #483 because of this bounded fix.

**Source/test commit `2190ab39539e27589a5a3c713f99149a6c7c86fa`; PR final HEAD after this handoff commit is published in the PR body (self-referential Git commit SHA cannot be prewritten into its own file).**
