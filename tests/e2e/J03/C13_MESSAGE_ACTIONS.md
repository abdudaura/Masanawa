# C13 — Masana chat message actions (source/acceptance handoff)

Canonical sources: BLUEPRINT §3.2, SCREENS C13, J03 and L-CHAT. This is
a feature-local source checkpoint, **not** a live service claim.

- **Reply:** quote the selected sent Masana chat turn in the composer, then
  send through the existing idempotent FIFO agent conversation queue.
- **Copy:** copy text only on explicit tap; no clipboard background watcher.
- **Hide my sent turn:** confirm, invoke the authenticated owner-only hide
  endpoint with the existing character and request UUID. Never delete the
  shared agent journal, financial receipts, or moderation evidence. A hidden
  turn must be excluded from per-fan preview/unread readback.
- **Report:** the screen exposes a callback to the existing Gwani moderation
  case intake; no new reporter table, job, or case worker is created.
  C13 message-target evidence is not in the current J13 moderation target
  enum: AF00 and L-GWANI must agree an authorized target contract before
  exposing Report in production. Report is disabled if callback absent.

AF00 protected composition: register `registerMasanaMessageActionRoutes`
exactly once with the J03 canonical fan resolver, approval predicate, PG
repository and an explicit default-OFF gate; adopt
`0006_message_hides.sql` in immutable SQL registry after fresh/upgrade PG18
rehearsal; mount the C13 screen callbacks to the canonical Gwani case flow,
not an alternate report writer. Do not activate while report/read semantics
remain unverified.

Acceptance: signed-in own/foreign fan, archived/draft/non-platform Masana,
replayed hide, account switch mid-hide, offline and failed hide, report
permission denial, outbox send/reply FIFO, screen-reader affordances, low-end
Android, upgrade/checksum and restore. Run scoped Vitest, TS, PG18, Flutter
widget/analyze and Android as separate evidence on the exact unified SHA.
