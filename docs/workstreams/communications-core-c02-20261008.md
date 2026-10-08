# C02 — durable human-to-human private text (active lease)

- Window: GPT-6 / GitHub connector, 2026-10-08.
- Branch: `work/c02-private-text-core-20261008-gpt6` based on `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Task: C02, M02/M05, J03; human-to-human messages ONLY, distinct from AI chats and public Talks.
- Owned files: `packages/talks/migrations/0017_human_dm_text.sql`; `services/gateway/src/human_dm/**`; `apps/mobile/lib/src/messages/human_dm_*.dart`; `apps/mobile/test/human_dm_*.dart`; this claim, contract/handoff docs. Shared Gateway `app.ts` and `main.ts` only after refresh and explicit conflict/lease inspection. NO R17/C08 router, wallet, voice, notification or CI modifications.
- Dependencies: C01 draft #468 `0016_human_messaging_contacts.sql` (unmerged); contact consent and blocks re-evaluated on each send. C03 realtime and C05 local cache, R17/C08 shell integration deferred to respective owners. Shared Gateway composition requires semantic integration with #468 and R18 #435.
- Status 2026-10-08: CLAIMED, SOURCE_PENDING; LOCAL_TESTED=false, CI_EXECUTED=false, DB_INTEGRATED=false, APP_INTEGRATED=false, DEPLOYED=false, DEVICE_VERIFIED=false, MERGED=false.
- Blocker: Actions quota #457; this environment has GitHub repository write/read but no networked clone, Postgres/Flutter. Do not claim end-to-end verified.
