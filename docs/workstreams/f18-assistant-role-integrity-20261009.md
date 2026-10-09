# F18 / C07 recovery — authenticated Assistant role integrity

**Claim issued:** 2026-10-09; the GitHub commit timestamp is the start of the five-minute ownership lease. Heartbeat is required within five minutes of active editing; this is not a permanent reservation.

- **Selected workstream:** F18 (C07) recovery; continue existing draft PR #480 on `work/c07-assistant-workspace-20261008`, not a competing branch/PR.
- **Latest main inspected:** `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing #480 HEAD at claim inspection: `6a0f8e4561684afcff8d1b85c452575b8d022a75`.
- **Lease scope — exact paths:** `services/gateway/src/assistant_workspace/service.ts`, `services/gateway/src/assistant_workspace/service.test.ts`, and `docs/workstreams/f18-assistant-role-integrity-20261009.md`. No shared `app.ts`/`main.ts`, Flutter root/router, migrations, Firebase, billing/ledger, deployment or production changes.
- **Discovery:** all U01–U30 have draft source; current F09/F10/F13/F14/F17 owners have added their work to existing R/C PRs. C07 #480 last checked 2026-10-08T11:24:44Z, past the five-minute threshold; preserve its full diff and resume its exact code. Review F18, R03/R19 and U01 contract before patch.
- **Implementation target:** prevent an inconsistent/ambiguous official support identity (name ↔ voice ↔ character) from being mapped to Gwani/Gwana; refuse to select/open/turn/snapshot when trust metadata conflicts. Preserve use of the authenticated directory and canonical session/turn services, and prove positive and negative cases in the existing isolated test.
- **Dependencies:** shared F12 Gateway/Flutter composer, U01/U02 authority, F03 persona catalog, F10 Firebase, R02 Live, R05–R08 finance. Do not bypass them.
- **At claim:** source changes not yet made; tests not run; CI #457 and provider/physical device qualification remain blocked. Draft PR stays unmerged.

## Implemented checkpoint (source/test SHA `265e20e2c522e7c05d6843f364a610749e5823dc`)

**Status:** F18/C07 remains **PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT VERIFIED_E2E**. This is a narrow server-side identity recovery in an existing C07 PR, not a complete Assistant or a second transcript/approval authority.

### Actual changes and effects

- `services/gateway/src/assistant_workspace/service.ts`: use independently observed authenticated directory name and voice hints to resolve Gwani/Gwana; when both hints are recognized and conflict, fail closed with `assistant.support_identity_conflict`. Reject an unknown *selected* support identity with `assistant.selected_support_unrecognized` instead of silently exposing Gwani as the selection. Preserve valid voice-based aliases, existing duplicate-character and double-default refusal, and canonical delegated session authorization.
- `services/gateway/src/assistant_workspace/service.test.ts`: three new Vitest cases for crossed Gwani/Sulafat hints (including attempted select/turn with no side effects), unsupported selected support on open/status, and benign official voice alias.
- No schema, money action, human DM, user records, Firebase, root navigation, external provider or deployed service changes. The Gateway composition routes remain unregistered on shared `main`.

### Evidence matrix

| Check | Status | Evidence |
|---|---|---|
| GitHub SHA-specific source readback | **PASS** | Re-fetched exact new `service.ts` and `service.test.ts` after commits |
| Actual `roleOf` source-body isolated runtime | **PASS_SIMULATED** | Six cases (correct Gwani/Gwana, alias, unsupported/non-support, conflicting metadata), all six passed; extracted TypeScript annotations only and ran JS body with a mocked `PlatformError` factory |
| Source guard and committed test assertions | **PASS (static only)** | Five structure checks passed: unknown default guard, fail-before-history ordering, both negative-case assertions, positive alias, preservation of existing route/snapshot checks |
| Actual `validateRoles` source-body isolated runtime | **PASS_SIMULATED** | Six cases passed, including duplicate Gwani, two defaults, reused Character ID, unknown selected support and mismatched voice; extracted TS annotations only and ran exact decision body with a mocked error factory |
| `pnpm exec vitest run services/gateway/src/assistant_workspace/service.test.ts` | **NOT_RUN** | No checked-out private repository/dependencies in this tool runtime; GitHub clone DNS unavailable |
| `pnpm typecheck && pnpm test`; Gateway Fastify/PostgreSQL integration | **NOT_RUN** | No full checkout, pnpm workspace install or disposable migrated DB |
| Flutter analyze/widgets, two-account real auth, Live audio/Android/iOS, CI | **NOT_RUN/BLOCKED** | No Flutter/device/provider environment; Actions #457 runner-quota issue must be independently resolved and validated |

**Evidence limits:** The isolated source-body runtime is stronger than textual assertions but is **not** a compiled TS package, Vitest execution, real `PlatformError` instance test, current Gateway endpoint, Postgres replay, two-persona server task pointer, Flutter device or production qualification. One earlier extraction attempt produced an infrastructure/mock `rejected is not a function` failure because the isolated harness had not bound its injected stub; correcting the harness yielded 6/6, with no repository code change. Do not suppress this distinction.

### Current integration conflict/remaining requirements

- `main` at checkpoint: `5e758673ae91082520b21b3153da53791ae2cbf3`; C07 PR diverged (32 ahead / 5 behind at checkpoint). Rebase/semantic integration belongs to appointed final integrator; never force-push across unreviewed F03/U01/U02/F12/Firebase changes.
- F03 must eventually supply immutable **server-proven role codes** rather than merely checking directory name/voice hints. The current fail-closed check handles disagreement but cannot validate a spoof where both mutable hints agree incorrectly. It also cannot recognize an inaccessible preferred role absent from directory results.
- Shared Gateway owner must register the existing C07 routes *after* auth and contracts are reconciled; F12 alone integrates the final centered Assistant tab. U01/U02/F18 coordinate durable cross-persona server-owned task/consent authority; F03 owns persona catalog identity, R02 native Gemini Live, R05–R08 financial safeguards, and C01–C06 human messaging.
- Run full focused and package TypeScript/Vitest; then real two-tenant/role/reauth readback and concurrent switch tests, device/voice, CI, and end-to-end J02/J07/J11 before any merge or release.

### SHA-specific handoff

Claim commit: `5ba33178fc5761822e46777ce5fcf216980f4e39`; service commit: `fcd419f9ddf16cc8d78ad3a1c527b77057ba3481`; regression-test commit: `265e20e2c522e7c05d6843f364a610749e5823dc`. The subsequent documentation commit is the latest PR head, see draft PR #480 live SHA. Exact changed files on this continuation: two existing C07 server files and this new documentation file. No merge/deploy, no production mutations.
