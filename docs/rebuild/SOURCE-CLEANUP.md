# Source cleanup — code retirement and reuse plan 1.1
**Main source has not been rewritten yet.** This plan retires obsolete application code safely. The machine-readable inventory is [SOURCE-CLEANUP-MANIFEST.json](SOURCE-CLEANUP-MANIFEST.json), built from `main 7c443966…`. Paths are classified by name and path, so **every entry needs import, route and test proof before deletion.** The manifest's `todoOrder` is superseded by DELIVERY §2 (R0 → R1 → lanes → R-CLEAN → R-RELEASE).

## 1. Inventory summary (from the manifest)
- 1354 tracked source, build and test files were examined. **73 migration files are protected**: applied history, never deleted or edited.
- The families, each with the lane that retires it:

| Family (manifest disposition) | Files | Retiring lane |
|---|---|---|
| retire Twin, clone and owner economy | 157 | L-MASANA (identity), L-FIN (ledger) |
| extract reusable audio and comments, retire Talk stages | 177 | L-FEED (audio/comments), L-ROOMS (questions), L-CHAT (calls) |
| review `world` for character-canon reuse | 23 | L-MASANA |
| review financial, gift, voice and transfer boundaries | 22 | L-FIN |
| refactor profile, home and activity | 6 | L-SHELL |
| shared composition refactor (router, app.ts) | 10 | AF00 |
| retire human contacts | 1 | L-CHAT |
| WhatsApp and Telegram channels (`whatsapp_*`, `telegram_*`, `security` customer channels, admin channel screens) | to be enumerated in R0 | L-GWANI (D3) |

- `packages/{decisions,perception,proactivity,testing}` were empty `.gitkeep` placeholders and have already been removed. That is **not** application cleanup.

## 2. Retirement procedure (per family, in order)
1. **Deny** (R0): the server returns `410 feature_retired` on REST, WS and job enqueue behind a flag. Tests cover all three layers.
2. **Data:** export any user-owned data. Reconcile ledger obligations such as clone credits, gift balances and owner-access purchases into canonical receipts or refunds under finance approval. Add a migration that blocks new writes (revoke or check). **Never edit or delete an applied migration**, including `packages/talks/migrations/*`.
3. **Extract** reusable logic into the new feature module, with its tests (§3).
4. **Delete** the routes, services, workers, Dart screens, router entries, l10n keys, assets, tests and dependencies once a dependency scan shows zero inbound references. Update `pnpm-lock` and `pubspec.lock`.
5. **Verify:** typecheck, Vitest, PG18 fresh and upgrade, Flutter analyze and test for both apps, an APK build and J10. Record the SHA and evidence, then mark the manifest entry `done` (or `retained-migration`).

A family is not "removed" while any API path still responds with data. A skipped run is not a pass.

## 3. Reuse map (check before writing new code)
| Existing asset | Reuse in | Notes |
|---|---|---|
| `events` outbox, inbox, leases, idempotency, receipts, reconciliation | all jobs and webhooks | the only job journal; do not add a scheduler |
| `memory` records, revisions, evidence, tombstones, reflections | fan relationship memory, public continuity | add a scope and consent; reuse deletion |
| `identity.characters` and agents' platform-agent defaults | Masana identity, Gwani | add revisions in `masana` |
| `skills` teaching progress and guides | Room curriculum and progress | |
| Talk replay and published-audio (#609), audio player | Feed audio posts | strip Host and seat concepts |
| Talk comments, moderation and safety, visibility (#548) | Feed comments, Room discussion moderation | |
| Talk questions queue | Room question queue | single teacher, fair queue |
| Talk notifications (push dedupe) | notifications module | |
| Talk search | `/v1/search` | Masana, Rooms, posts, videos only |
| `services/presence` (LiveKit agent dispatcher) | fan↔Masana calls | remove Seat, Host and owner gating; keep the per-turn state re-check |
| Human chat composer and outbox (#529/#530), CHAT-P04 (#612) | shared composer | the recipient must be a Masana |
| `commerce` (ledger, NGN, billing, crypto) | Wallet, Bills, Crypto | unchanged authority |
| `security` sessions, approvals | auth, staff roles, dual approval | |
| Admin app skeleton | new drawer shell | rebuild the screens |
| F11 and R16 qualification scripts | release qualification suite | consolidate |

## 4. Ownership
AF00 sequences shared-file removals (router, `app.ts`, `main.ts`, migration roots). Lanes remove their families as part of their lane gate. L-PLATFORM runs J10 against the full route table at R-CLEAN. Use the existing PRs (DELIVERY §7) and avoid patch-only cleanup branches.
