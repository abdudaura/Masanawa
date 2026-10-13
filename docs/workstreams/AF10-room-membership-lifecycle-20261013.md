# AF10 — Rooms membership, invitations and moderation connected (2026-10-13)

## Authority and exact source
- Base: `main@8cc8086738cc682cbad84433c99ffcb69fee72b3` (includes the merged AF07 #723 portraits).
- Branch: `lane/af10-rooms-membership-connected-20261013-gpt6`.
- Claim: `af10-rooms-membership-connected-20261013-gpt6`, on `factory/claims@9ea7bcbf1744c0ff22f6c6bac0e0ce4ffa5514be`. Recovered five expired conflicting claims, preserving former authors' source and history. AF07 #723 claim is disjoint.
- Existing canonical authority: PostgreSQL `rooms.memberships` and `rooms.membership_invites`, `createPgRoomMembershipRepository`; existing Gateway authenticated RoomMembershipRoutes and canonical customer session; existing RoomsScreen/account fencing and saved lessons/AI teacher. No replacement auth, payments, room backend, or AI worker.

## Connected customer and moderator journey
- New `packages/rooms/migrations/0006_membership_invites.sql` promotes existing reviewed proposal (role column, hashed single-use 24-hour token, tenant/room/account constraints) into ordered, additive schema.
- Main Gateway membership composition is wired to `MASANAWA_ROOMS_MEMBERSHIP_ENABLED === 'true'`. **Default OFF** until real migration/service readiness and moderator two-account verification. Other free Rooms and workers keep their existing independent flags.
- Authenticated Flutter Room details link to one private invitation screen. Customer pastes a 43-character code into POST body only; success refreshes the mounted Room, errors are retryable and do not imply membership. Moderator explicitly loads roster/invitations, creates an ephemeral one-time code, copies it privately, revokes invitations and confirms ban/unban. Server roles, tenant and account admission remain authoritative, with 403/410/offline states exposed rather than false empty lists. No staff review for ordinary questions or new quota restrictions.
- Every async mobile member operation checks the current signed-in account before and after the request; detail is already protected by signed-in route. No secrets in links/logging/persistence.

## Verification map
- Scope CI: `.github/workflows/rooms-production-build.yml`: Gateway and Worker production builds, existing Calls/Rooms auth tests, new Room membership Gateway and PG unit checks, canonical forward-upgrade, disposable **real PG18** concurrency/tenant/ban/paid denial, Flutter mounted Rooms and new HTTP/widget journeys, focused Dart analyzer.
- At authoring, all new source checks are **NOT_RUN** until the PR workflow concludes. Old #721 finance and #722 profession-roster test passes are not evidence for this branch.
- Production membership gate remains disabled. This source merge **does not** prove applied production migration, operational Gateway/Worker/DB, real signed-phone account switch, provider voice, live invitation redemption, rollback or deployment. Real accounts and backup/restore must be verified separately before setting the gate.

## Concrete next verification/activation
1. Review PR exact head and scoped Actions logs, fix introduced failures, merge compatible passing code to main, release claim.
2. Confirm PostgreSQL migration ledger includes `rooms/0006_membership_invites.sql` and operators have verified backup+restore and health. Check Gateway has reached main deploy with separate flag default off.
3. On protected stage, enable only `MASANAWA_ROOMS_MEMBERSHIP_ENABLED` and verify two real accounts: staff/moderator invite, fan join, replay rejection, revoke, ban vs redemption concurrency, unban/rejoin, paid denial, account switch and offline retry; roll back by disabling flag on failure.
4. Continue MUI-09 combined, MUI-10 signed installed app and upstream MSN custody/provider qualification independently.

## Next-window prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md, docs/MULTI-WINDOW-WORK.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/AF10-room-membership-lifecycle-20261013.md,
and the latest Software Factory rules. Reconcile PRs, CI and exact-path claims.
Complete substantial unfinished customer integrations, merging scoped verified
work into main rather than leaving draft PRs. Preserve Chats · Status · Wallet ·
Calls · Rooms, Chats default, AI-answer Rooms worker, profile roster, account,
call and financial authority. Keep MSN financial activation and 0112 production
migration OFF until qualified live custody, exact price, global settlement
reservation, funding debit and chargeback/recovery prove actual backing.
Verify Rooms membership schema/default-OFF gate and full two-account
invite/moderation journey against real PG/Gateway/Flutter; do not revive
staff approval or artificial question limits. If environment blocks it,
continue an unclaimed dependency-ready customer feature end to end.
Report branch/PR/source+merge SHA, actual checks, release blockers and next prompt.
```
