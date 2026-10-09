# F13 scoped claim — profile input integrity (2026-10-09)

**State:** five-minute exact-path activity lease, not blanket F13 ownership; GitHub commit timestamps establish freshness. Refresh with new commits while active.

**Base:** `main@5e758673ae91082520b21b3153da53791ae2cbf3`
**Branch:** `work/f13-profile-text-input-guard-20261009-gpt6`
**Owner:** independent F13 profile input-integrity recovery/verification window.

## Exclusive files
- `services/gateway/src/talk_profiles/service.ts`
- `services/gateway/src/talk_profiles/f13_profile_input_guard.test.ts`
- `docs/workstreams/f13-profile-input-integrity-20261009.md` (this claim + SHA-specific handoff)

**Safety:** Existing R18/F13 draft #435 owns avatar UI, `postgres_repository.ts`, `app.ts`, `main.ts` and migration; C01 #468 owns contacts; Work #497 owns central integration. Do not touch these areas. This recovery is only input validation on the already merged authenticated profile service and negative tests. Preserve valid Hausa, Arabic and ordinary RTL characters. No new endpoint, schema or financial/native change; no production write.

**Before-edit inventory:** PR #435 currently at `5bd0fcf7b761340b11721075b239cc74f1cb2d50`, its changed-files list does not include this service or new test. #468 and first 100 #497 changed files similarly avoid these paths. Main is unchanged at baseline. Claim expires five minutes after its last repository-visible activity; future writes require fresh collision check.

**Acceptance:** reject embedded unsafe NUL/control and bidi formatting overrides in public human displayName/bio before SQL; preserve accepted scripts, newlines in bio, and existing auth/tenant guarantees; execute focused tests when possible and record test limitations.
