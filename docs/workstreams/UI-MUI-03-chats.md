# MUI-03 / AF06 — mounted Chats search and canonical inbox integration handoff

## Source identity, ownership and status

- Base fresh main: `eecea844349738b1e9a7227fa31d859f438503e9` (verified MUI-02 handoff #681).
- Implementation/test commit: `e4b0c533a086240d8f2c2671f3eac0ef82ef8cc5` (first implementation `8bc7a722e1e439250f3d3e3cd9cf11ae70f5841e`; corrected a test compilation error and analyzer diagnostics).
- Feature branch: `lane/af06-mui03-chats-search-20261012-gpt6`; [source PR #682](https://github.com/weavewellindustrieslimited/masanawa/pull/682). Source PR final head including this handoff: `190be801e739e42cd11f76d227a72fe96e304340`. **Merged main source SHA: `5b5bd26e7d5d62541652a2090bd32c9a90caa9fe`**. Safe normal GitHub merge, no bypass. This documentation-only follow-up records post-merge evidence.
- Ownership: `af06-mui03-mounted-chats-search-20261012-gpt6` on `factory/claims`, three exact paths below. Prior 2026-10-10 unreleased overlapping claim `af06-pr497-chat-list-async-action-lifecycle-20261010085813` was reviewed and narrowly transferred *only* this current Chats file: old branch `3c0e88489baa7b5ad99dff66e69325f23937f086` was divergent and its remaining paths/work preserved. AF05 owns `services/gateway/src/main.ts` until transferred; AF00 owns canonical root/router/composition.
- Implementation: **INTEGRATED_SCOPED_SOURCE / PARTIAL_MUI03_ACCEPTANCE** (local mounted authorized search only). Scoped verification: **PASS_SIMULATED_WIDGET**. Canonical server-wide inbox search/integration **OPEN**. Installed-app, live backend/provider, signed-device: **NOT_VERIFIED**.

## Exact files changed

1. `apps/mobile/lib/src/screens/chat/chat_list_screen.dart` — mounts MUI-01 `ConversationSearchField` above existing Chats list; matches current server-authorized directory names, account-owned local titles and canonical character identifiers case-insensitively and immediately. Clear, loading, empty, offline saved-only message, directory-error retry and keyed account-switch controller teardown. Existing pin/unpin, rename, read/unread, archive, opening and header/tab/actions remain in their existing implementations; no new ledger, contacts, router or backend.
2. `apps/mobile/test/ui/mui03_chats_search_test.dart` — four mounted widget tests: name/title/ID search and private excluded record; 320px offline and clear with pinned/unread row; account switch query reset; filtered conversation route opening.
3. `docs/workstreams/UI-MUI-03-chats.md` — this handoff.

## Actual executed checks

- **PASS**: [GitHub Actions focused run #38279529355](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38279529355), job `114913132285`, Flutter stable 3.47.7, on validation SHA `133d195fcf1e36943ef2bc2319cf7cda0d7c7a2e`. The two application/test blob SHAs are identical to feature source `e4b0c533...` (`868b742e971fc88d4522f8a5db5440613904a8c1` and `bf2013f86349797790d9a1eca95a57eb0c6c49ee`). Temporary workflow commit is isolated and not merged.
- `cd apps/mobile && flutter pub get`: PASS.
- `flutter test --reporter expanded test/ui/mui03_chats_search_test.dart`: **4 passed**.
- `flutter test --reporter expanded test/ui/mui01_presentation_test.dart test/app_shell_route_compatibility_test.dart`: **16 passed**.
- `dart analyze lib/src/screens/chat/chat_list_screen.dart test/ui/mui03_chats_search_test.dart`: **PASS, no issues found**.
- Earlier hosted run [#38279190576](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38279190576) **FAIL**: a test called `switchTo` on base `SessionController` instead of casting the overridden fixture, plus focused Dart analyzer diagnostics. Fixed and rerun above; not hidden.
- Full repository `flutter analyze`: **NOT_RERUN**; known 329 existing diagnostics. Known backend TalkId TS2459 and nine earlier whole Flutter-suite failures remain baseline **NOT_PASSED / NOT_WAIVED**. TypeScript, Vitest and PG18 E2E: **NOT_RUN** for unmounted C10 source. Signed APK, phone, live account/provider, RTL/IME and account/device qualification remain open. Tests use deliberately authored fake fixtures for authorized account boundaries; no real server proof claimed.

## Critical remaining MUI-03 source and acceptance

Current main mounts `screens/chat/chat_list_screen.dart` using `aiChatProvider` (account-keyed local ChatThreads + server-authorized directory). C10 [#641](https://github.com/weavewellindustrieslimited/masanawa/pull/641) was merged to an older `integration/rebuild`, **not main**. Its feature-local `/v1/chats` authenticated PG read, `MasanaInboxAccess.load(accountId, query: ...)`, pin/read operations, DTO/client and C10 feature screen are not mounted in current shell or Gateway. **This PR's search cannot find authorized conversations absent from the locally hydrated list**; it does not satisfy full canonical inbox search. Existing C10 SQL only searches approved displayName/profession, not fan-local titles or character identifiers. A 50-row bounded response may not give complete remote search.

AF00 bounded integration request on [#616 comment 6128601248](https://github.com/weavewellindustrieslimited/masanawa/pull/616#issuecomment-6128601248): reconcile C10 PostgreSQL migration, single trusted tenant/fan resolver and `GET /v1/chats` Gateway registration with current J03 session authority; do not introduce a second inbox/ledger. Build a signed-in account-keyed Dio bridge and harmonize existing local archive/title and server pin/read state without losing newer Calls. Add safe query-scoped server search for *actual supported* contact/title/identifier fields, bounded pagination if authorized inbox exceeds 50, debounced async stale query/account fencing, offline retry/denied and negative 401/403/cross-fan tests. Coordinate any protected `main.ts` changes with AF05 and AF00; no wholesale old-shell merge, production migration or unauthorized publishing. Verify connected backend, PG18 and Flutter on same SHA, then close MUI-03 only when acceptance truly passes.

Keep MUI-04 Status, MUI-05 Calls history, MUI-06 Rooms, MUI-07 Wallet, MUI-08 Crypto, MUI-09 320/360/390/430px keyboard/large-text/RTL/account combined verification, MUI-10 signed installed-app/source identity, AF11 incoming-call device/provider qualification **OPEN**. Do not claim a release from scoped widget tests.

## Smallest next action

After the safe source merge at `5b5bd26e7d5d62541652a2090bd32c9a90caa9fe`, AF00 should compose *the existing C10 authorized inbox* into current main in a new, narrowly claimed workstream, extending real query behavior without discarding current Chats/Calls. In parallel choose the earliest dependency-ready unclaimed MUI-04 / AF09 Status milestone if AF00's protected paths remain owned.

## Queue-aware continuation prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md and
docs/workstreams/UI-MUI-03-chats.md.

MUI-01 #678 merged 18bdd8140; MUI-02 #680 merged
8bc782c2659973f43c6e6e248540c6b16b2a3106;
handoff #681 main eecea844349738b1e9a7227fa31d859f438503e9.
MUI-03 scoped mounted Chats search source e4b0c533a086240d8f2c2671f3eac0ef82ef8cc5,
PR #682 merged at main 5b5bd26e7d5d62541652a2090bd32c9a90caa9fe.
Hosted run #38279529355 at app/test-identical validation 133d195fcf1e
passed 4 MUI-03 widget tests, 16 MUI-01/root tests and focused Dart
analysis with zero issues; first run #38279190576 failed fixture compilation,
fixed in delivered source. No real provider/device/backend proof.

MUI-03 is PARTIAL: current main's mounted Chats search filters only
locally hydrated account-owned and directory-authorized threads. Canonical
C10 /v1/chats PG/Gateway/Dio server-wide inbox was merged only on older
integration/rebuild (#641) and is not mounted on main. AF00 requested
exact composition via #616 comment 6128601248. Complete server-side
authorized name/title/identifier search, bounded history, debounced
stale query/account fencing, offline/error/denied, pin/read/archive/open,
integration tests, without replacing current Calls or duplicating inbox,
auth, ledger or routes. Reconcile claims and AF05 main.ts ownership.
If protected work is actively owned, move to dependency-ready unclaimed
MUI-04/AF09 Status and preserve C10 gap as a named blocked acceptance.

Preserve Chats · Status · Wallet · Calls · Rooms with Chats default,
Masana-only identities, all native/group/incoming/billing Calls,
Status/media, Rooms, auth and finance. No historical shell wholesale
merge, invented contacts/balances, Cr-to-MSN relabel, duplicated ledger,
unsupported publishing or Create Room.
Keep MUI-04…08 open, MUI-09 combined 320/360/390/430px keyboard,
large-text, RTL and account regression, MUI-10 source-to-signed-installed
app proof, AF11 real incoming-call/provider qualification.
329 existing whole analyzer diagnostics, TalkId TS2459 and previous
nine unrelated full Flutter failures are not passes or waivers.
Fresh main/PR heads/factory claims, exact-path ownership, connected
source and executable tests, review, commit, push, safe merge into main;
report exact source/main SHAs, PR, results and blockers. Release claims,
update selected handoff and print next queue-aware continuation prompt.
```
