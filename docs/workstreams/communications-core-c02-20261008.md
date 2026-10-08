# C02 — Durable human direct messages: live ownership claim

- Window: GPT-6 C02 implementation / 2026-10-08
- Branch: `work/c02-durable-human-dm-20261008`; base `main` `573c8f4dbf4e04ebdc1d7a996ea285a44290b17d`
- Requirement: C02, J03/J04/J10/J11; person DMs only. No AI/public Talk/financial authority.
- Owned exact paths: `packages/talks/migrations/0017_human_dm_core.sql`; `services/gateway/src/human_messages/**`; `apps/mobile/lib/src/human_messages/**`; `apps/mobile/test/human_messages_*.dart`; `docs/workstreams/communications-core-c02-20261008.md`; `docs/contracts/HUMAN-DM-C02.md`.
- **Excluded/shared:** `services/gateway/src/app.ts` and `main.ts`, all shared Flutter router/root navigation, C01 `human_contacts/**` and migration `0016`, C03 push/events and C04 media; no shared edits without renewed ownership check and composition coordination.
- Dependencies: C01 contact consent in draft PR #468 and separate R18 Gateway edits #435; C08/R17 supplies final shell; CI verification incident #457. C02 must revalidate consent at transaction time, independently of cached contact lookup.
- Status: CLAIMED / IMPLEMENTING. No tests, real DB, gateway composition, Android or deployment evidence yet. Source-only commits must never be called DONE.
- Activity: 2026-10-08, first repository-visible ownership commit. Five-minute activity rule applies; stale claim may be reclaimed with diff preservation.
