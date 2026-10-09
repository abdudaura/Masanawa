# U11 — Permissioned human DM search and organization

**Claimed:** 2026-10-09 01:20 Africa/Lagos (00:20 UTC), five-minute ownership lease; refresh claim through substantive updates. **Status:** CLAIMED / IN PROGRESS, draft only.

**Base:** `main` at `5e758673ae91082520b21b3153da53791ae2cbf3`. **Branch:** `work/u11-permissioned-dm-search-20261009-gpt6`.

**Owned exact paths:** `services/gateway/src/human_dm_search/**`, `apps/mobile/lib/src/human_chat_search/**`, `apps/mobile/test/human_chat_search/**`, this U11 handoff document. Never edit shared Gateway composer/routes, C01/C02/C03 migrations, global Flutter router/pubspec, finance, Firebase, or CI.

**Ownership audit:** No U11 PR, issue or U11 branch found before claiming; open #472/#475/#477 disagree on C02 schema/API, C01 #468 is unmerged, C03/C05 are unmerged; do not duplicate C02 or choose migration 0017. New U11 layer must adapt to the elected canonical C02 repository and C01 admission under F14/F15. Dependencies #472, #475, #468 reviewed in read-only mode.

**Deliverables:** account-and-tenant-fenced human message search with current membership/revocation authorization, bounded parameterized keyset pagination, explicit uncertainty, typed Flutter transport/controller/screen, tests and integration handoff. **No searches on main can be production-ready until C02/F15 composes the real canonical messages.**

**Five-minute claim:** this document is the live claim; competing windows must inspect this branch before taking `human_dm_search/**` or `human_chat_search/**`.
