# F13 scoped claim — profile input integrity (2026-10-09)

**State:** five-minute exact-path activity lease, not blanket F13 ownership; GitHub commit timestamps establish freshness. Refresh with new commits while active.

**Base:** `main@5e758673ae91082520b21b3153da53791ae2cbf3`
**Branch:** `work/f13-profile-text-input-guard-20261009-gpt6`
**Owner:** independent F13 profile input-integrity recovery/verification window.

## Exclusive files
- `services/gateway/src/talk_profiles/service.ts`
- `services/gateway/src/talk_profiles/profile_text_validation.ts`
- `services/gateway/src/talk_profiles/f13_profile_input_guard.test.ts`
- `services/gateway/src/talk_profiles/profile_text_validation.test.ts`
- `docs/workstreams/f13-profile-input-integrity-20261009.md` (this claim + SHA-specific handoff)

**Safety:** Existing R18/F13 draft #435 owns avatar UI, `postgres_repository.ts`, `app.ts`, `main.ts` and migration; C01 #468 owns contacts; Work #497 owns central integration. Do not touch these areas. This recovery is only input validation on the already merged authenticated profile service and negative tests. Preserve valid Hausa, Arabic and ordinary RTL characters. No new endpoint, schema or financial/native change; no production write.

**Before-edit inventory:** PR #435 currently at `5bd0fcf7b761340b11721075b239cc74f1cb2d50`, its changed-files list does not include this service or new test. #468 and first 100 #497 changed files similarly avoid these paths. Main is unchanged at baseline. Claim expires five minutes after its last repository-visible activity; future writes require fresh collision check.

**Acceptance:** reject embedded unsafe NUL/control and bidi formatting overrides in public human displayName/bio before SQL; preserve accepted scripts, newlines in bio, and existing auth/tenant guarantees; execute focused tests when possible and record test limitations.


## 2026-10-09 source checkpoint — SHA-specific handoff

**PR:** https://github.com/Baatiku/masanawa/pull/565 (**draft, unmerged**).
**Before-edit claim:** https://github.com/Baatiku/masanawa/issues/564.
**Base:** `main@5e758673ae91082520b21b3153da53791ae2cbf3`.
**Code/test checkpoint HEAD before this handoff:** `e23d35c34b3720cc51a317b9d5eff3681f48a9bc`.
**Status:** `PARTIAL_IMPLEMENTATION` — narrow existing authenticated profile service hardening only, NOT F13/R18 complete, not integrated into #435, never verified on DB/device/CI.

### Exactly changed paths

- `services/gateway/src/talk_profiles/service.ts` — existing production-authenticated create/update code calls the new text normalizers and retains canonical field error codes; no permission identity changes.
- `services/gateway/src/talk_profiles/profile_text_validation.ts` — allow Hausa/Arabic/emoji/normal RTL script, reject NUL/ASCII+C1 controls, bidi embedding/override/isolate, invalid surrogate sequences; canonicalize Windows CRLF only for bio; keep limits and empty bio behavior.
- `services/gateway/src/talk_profiles/profile_text_validation.test.ts` — 10 invalid-name cases, 8 invalid-bio cases, valid multilingual/multiline/length/Unicode cases.
- `services/gateway/src/talk_profiles/f13_profile_input_guard.test.ts` — service-level create/update negative tests proving rejected input does not reach SQL repository, plus accepted auth scope/no-op handling.
- `docs/workstreams/f13-profile-input-integrity-20261009.md` — pre-edit exact claim, handoff, evidence and dependencies.

No other file changed. No migration, actor/tenant/auth schema, gateway composition, five-tab Flutter router, Firebase, media/avatars, money, native setup, provider, production or shared CI code.

### Verification actually executed

- GitHub fetched new module blob SHA `54b8055fa4dc265ba460e1cfe90ba00306a51cd7`; manually reproduced file in isolated local workspace, `git hash-object` yielded **same exact SHA**. This validates the locally executed **module bytes**, not a full checkout or all imports.
- Node `v22.16.0`: `node --experimental-strip-types --test /tmp/f13-profile-test/smoke.test.mjs` → **16/16 PASS, 0 failures** (built-in test harness against matching published TypeScript module; this is *not* an execution of the committed Vitest files).
- `tsc /tmp/f13-profile-test/profile_text_validation.ts --noEmit --target ES2022 --module ESNext --skipLibCheck` → **PASS** (isolated module only; the full repo's Node requirement is >=24).
- Connector-side compare from base main to code checkpoint: **ahead 6, behind 0, exactly five owned paths**. Existing R18 #435 changed files do not include these paths.
- Committed Vitest tests are **AUTHORED / NOT RUN**. No actual Gateway/Fastify, Postgres, Flutter, Android, end-to-end, provider or live network acceptance executed.

### Deferred commands and release blocks

On a full authorized repo checkout with Node **24**, pnpm **12.8.2**, and installed dependencies:

```sh
pnpm exec vitest run services/gateway/src/talk_profiles/profile_text_validation.test.ts services/gateway/src/talk_profiles/f13_profile_input_guard.test.ts services/gateway/src/talk_profile_routes.test.ts
pnpm --filter @masanawa/gateway-service typecheck
pnpm test:ci
```

Then run authenticated Fastify real response checks: invalid Unicode and bidi input returns HTTP 400 with no database write, valid Arabic/Hausa inputs read back identically after restart, cross-account create/update denied, user account switch refreshes profile. Execute PostgreSQL constraints and full profile/avatar integration on a disposable DB. R18 #435 owns actual WebP/S3 avatar upload, deletion and Flutter screen; reconcile this input guard during F13 integration, do not replace #435. Work #497 owns controlled integration; Actions quota/runner #457 and local full-checkout/Node24 dependencies remain blockers. Flutter two-device/S3/CDN, offline/restart, accessibility and release gates remain **UNVERIFIED**.

### Security and behavior notes

No data migration, destructive change, upload, credential or production action. The behavior intentionally rejects explicit directional control formatting in names/bios but **not** ordinary Arabic/Hausa characters, emoji or the ordinary RTL mark `U+200F`; body text is not HTML-rendered by the server. Server returns the already documented `profiles.display_name_invalid` or `profiles.bio_invalid` 400 error for invalid fields. No success is inferred from source-level tests.

### Handoff instruction

Merge only after semantic reconciliation with avatar R18 #435 and full executable Gateway suite on the composed SHA, then real auth/DB/device verification. If any product needs embedded bidi isolate sequences in bios, coordinate an explicit reviewed exception rather than silently removing safety checks. Claim lease expires without renewed repository activity; this handoff is not a standing block of F13.
