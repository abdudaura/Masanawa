# C05 — protected, indexed human DM cache and durable retry journal (2026-10-08)

## Live repository-visible ownership claim

- Lane: **C05 communications-mobile-performance**; base `main` SHA `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Owner branch: `work/c05-protected-dm-cache-20261008` — refresh this claim through substantive commits. Five-minute activity lease applies.
- **Exact owned paths:** `apps/mobile/lib/src/human_sync/**`, `apps/mobile/test/human_sync/**`, this checkpoint; **proposed** `apps/mobile/pubspec.yaml` dependency additions (coordinate with any pubspec owner first).
- **Do not edit** active C02 `apps/mobile/lib/src/human_messages/**`, C01 `human_contacts/**`, R17/C08 router/nav, C03 events/FCM, shared Gateway or migrations, or CI workflow.
- Requirement trace: M02, M05, M06, M07, N09, Q04, Q05, Q08; acceptance J03/J10/J11.
- C02 draft PR #472 currently owns real HTTP and isolated widgets; C03 realtime and C08 navigation integration are **unmerged dependencies**, not opportunities for duplicate edits.

## Status / authority

Claim established, code not yet verified. Human DM messages, membership and delivery remain server-authoritative, not local SQLite. Never surface locally queued text as confirmed delivered. C01, C02, C03, C04 and C08 must remain distinguishable.
