# C02 — durable human-to-human private text (active lease)

- Window: GPT-6 / GitHub connector, 2026-10-08.
- Branch: `work/c02-private-text-core-20261008-gpt6` based on `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Task: C02, M02/M05, J03; human-to-human messages ONLY, distinct from AI chats and public Talks.
- Owned files: `packages/talks/migrations/0017_human_dm_text.sql`; `services/gateway/src/human_dm/**`; `apps/mobile/lib/src/messages/human_dm_*.dart`; `apps/mobile/test/human_dm_*.dart`; this claim, contract/handoff docs. Shared Gateway `app.ts` and `main.ts` only after refresh and explicit conflict/lease inspection. NO R17/C08 router, wallet, voice, notification or CI modifications.
- Dependencies: C01 draft #468 `0016_human_messaging_contacts.sql` (unmerged); contact consent and blocks re-evaluated on each send. C03 realtime and C05 local cache, R17/C08 shell integration deferred to respective owners. Shared Gateway composition requires semantic integration with #468 and R18 #435.
- Status 2026-10-08: CLAIMED, SOURCE_PENDING; LOCAL_TESTED=false, CI_EXECUTED=false, DB_INTEGRATED=false, APP_INTEGRATED=false, DEPLOYED=false, DEVICE_VERIFIED=false, MERGED=false.
- Blocker: Actions quota #457; this environment has GitHub repository write/read but no networked clone, Postgres/Flutter. Do not claim end-to-end verified.
## Implementation checkpoint — 2026-10-08

- SOURCE_WRITTEN (draft branch): C02 `0017` migration; SQL repository; authenticated Gateway composition; HTTP routes; Flutter typed transport, encrypted pending text, list/thread, edit/delete/read and retries; source and integration test cases.
- LOCAL_TESTED: **NO** (repository checkout/dependencies and Flutter/PostgreSQL runner unavailable in this connector-only environment).
- CI_EXECUTED: **NO** (#457 Actions quota exhausted; zero-step jobs do not verify code).
- DB_INTEGRATED: **NO** (C01 `0016` unmerged; real PostgreSQL migration/integration test not run).
- APP_INTEGRATED: **NO production integration** (new Gateway routes composed *in this draft branch*, not merged/deployed; R17/C08 Chats shell/profile routing owned by separate lane).
- DEPLOYED: **NO**. DEVICE_VERIFIED: **NO**. PROVIDER_QUALIFIED: **N/A**. MERGED: **NO**. Feature **NOT DONE**.
- Work tests and rollback: `docs/communications/C02-HUMAN-TEXT-CONTRACT-20261008.md`.
- Active coordination: C01 #468 on same `app.ts`/`main.ts` requires semantic merge; R18 #435 avatar overlaps the same files. C01 contact owner notified in PR #468. R17/C08 shell must install `HumanDmInboxScreen` and person `HumanDmOpenContactAction` once contacts/storage/CI qualified.
- Shared-file check: Main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762` unchanged at composition; inspected #468 latest branch commit `708506ca7e35b73b393401b570ccc8093f7ddd33` (2026-10-08 10:59:32Z), beyond five-minute lease at edit. No commits overwritten/rebased/merged.
- No next feature claimed until this draft's scope is responsibly handed off; rerun fresh lease/PR collision check first.
