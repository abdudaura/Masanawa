# RECOVERY-03 — U01 approval-record recovery — 2026-10-09

Status: **isolated repair complete; U01 remains PARTIAL_IMPLEMENTATION / draft / unmerged / not E2E verified**.

## Identity, lineage and ownership
- Window: RECOVERY-03 (RECOVERY-01 already in use by other active recovery windows).
- Existing branch: `work/u01-operator-contract-20261009-gpt6`; original PR preserved: https://github.com/Baatiku/masanawa/pull/519.
- Main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`; current Work #497 inspected: `bb73b528862aae403a52b0fdedffd36c3f7a5674`.
- Base/source PR #519 head: `350e6ae1f6cab5ae61992a98bfbe31a7a3a4d2b7`.
- Tested repair/source commit: `b16a628979c9cd24b7bd5e4afb7619d4f817abb8`. Final document commit is reported by the PR handoff comment (avoids a self-referential SHA).
- Published CAS claim: `recovery-03-u01-approval-20261009`, coordination commit `fc7c7c85bbb070d62012f90da3b8c2f7b8f217d5`; visible readback confirmed before local edits. Competing registry updates produced a 409; refreshed registry, preserved RECOVERY-02/U02 and RECOVERY-01/U15 claims, then acquired these nonoverlapping paths.
- Exact changed paths:
  - `packages/operator-contract/src/index.js`
  - `packages/operator-contract/test/index.test.mjs`
  - `docs/workstreams/recovery-03-u01-approval-20261009.md`
- Source comparison: one authentic child commit, 0 behind; exactly two implementation/test files changed. No reconstructed Git history published.

## Recovery reading
Software Factory current `.agents/skills/software-factory/SKILL.md`, AGENTS.md and operating/owner-defaults/parallel/security/verification references; continue-repository skill; Masanawa CONTINUE-HERE, MULTI-WINDOW-WORK, requested U/F reconciliation, final consolidation template, current #497 final handoff, manifest/open-PR ledger/build-recovery handoff; original #519 U01 README, declarations, tests and handoff. Recursive source tree contained no applicable AGENTS.md; root fetch was 404. Factory root SKILL.md was absent; README located the actual skill. Fresh #519 head and CAS registry were reread before publication. Historical main/Work test reports were not reused as current evidence.

## Demonstrated defect and repaired behavior
Original #519 14 Node tests passed. Four new regression groups failed against the original runtime:
1. A getter in approved terms mutated the original issued operation after identity/operation checks; the verifier accepted the comparison and could return the substituted operation.
2. Computed identity/reference/envelope properties were evaluated instead of being rejected.
3. Sparse arrays, extended arrays and hidden/symbol properties could be ignored by JSON canonicalization, making distinct supplied terms compare equal.
4. Approval refs/identities could admit control characters or oversized/noncanonical strings.

Repair:
- Snapshot the envelope, trusted stored approval record, current principal and expected transaction into own enumerable data properties before verification. Reject accessors without invoking them.
- Canonicalize nested term records through the same data-property validation; accept only dense ordinary arrays with exact index data and length. Reject ignored properties, sparse arrays and computed elements.
- Bound canonical identity/operation/revision/ticket strings and validate capability syntax consistently. All existing exact account/session/device, state/version, revision, terms, expiry and 15-minute lifetime checks remain.
- Returned immutable operation/ticket/revision come from checked snapshots.
- Public declarations/exports and ordinary JSON terms retain their previous API. No provider or financial-domain execution added.

Requirement references: U01 approval/capability protocol, C07/F18 integration boundary, J02/J09/J11. No integrated J/K journey passed here.

## Executed evidence
Environment: Node `v24.19.0`; isolated SHA-pinned files under `/workspace/scratch/889607ea3788/u01`. Runtime/test files fetched from original #519, unchanged declarations/config and canonical contracts fetched at the same original SHA. Existing installed dependencies reused read-only.
- Baseline: `node --test packages/operator-contract/test/index.test.mjs`: **14/14 PASS**.
- New regressions against original runtime: same command: **14 pass / 4 fail**, exit 1; expected rejection was absent.
- Repaired source: same command: **18/18 PASS**, zero fail/skip, exit 0. These are real Node module-loader/node:test runs, deterministic in-process library tests, not adapted V8 or provider/DB evidence.
- `node --check packages/operator-contract/src/index.js`: PASS, exit 0.
- `/workspace/scratch/88b2711eedab/masanawa/node_modules/.bin/tsc -p packages/operator-contract/tsconfig.json`: PASS, exit 0, TypeScript **5.9.3**, unchanged strict/noEmit/skipLibCheck=false repository config. This checks declarations against actual SHA-pinned canonical contracts; package manifest's TypeScript 7.0.2 was unavailable and was not installed/claimed tested.
- GitHub committed source/test readbacks at `b16a628979c9cd24b7bd5e4afb7619d4f817abb8`: byte-for-byte equal to executed local source/test, blobs `2ca9e93237263b5bce398d6bfdc11c1e8dd7098d` and `74e49c8225bb3dd9d556a0d74881ac41852a2766`.
- GitHub comparison: exactly source/test above, no unrelated file changes, authentic #519 lineage retained.

## Integration contracts and remaining behavior
No migrations/API routes/Flutter entry points/providers introduced or modified. Pure synchronous `verifyIssuedApproval` and `normalizedTerms` signatures unchanged. Error codes remain `approval_invalid`, `approval_terms_changed`, `invalid_terms`. Accessor/hidden/sparse/non-JSON terms now fail closed; DB JSON serialization should already produce plain data.

Journey through this isolated boundary: current authenticated principal + stored issued ticket + expected operation terms → validate exact bindings/expiry → canonical data-only comparison → return checked refs or structured rejection. Persistence, ticket consumption, provider action and receipts remain outside U01. **Trusted stored issuance is mandatory**: a matching client/model record is still not proof of authority.

Sole integrator dependencies:
1. Preserve #519, integrate repair commit `b16a628979c9cd24b7bd5e4afb7619d4f817abb8` after electing its U01 contract; do not replace older source or duplicate the package.
2. Coordinate RECOVERY-02/U02 current task-journal PR. Persisted ticket lookup must authenticate tenant/user/account/session/device; issuance, single-use consumption and execution admission must be atomic/idempotent. Reauthorize live domain membership and quote at execution; this pure library is no DB lock.
3. F18/C07 and U03 review cards must use current exact terms/revision and opaque persisted ticket; voice/text/tap all reach the same server-owned operation. Model affirmation cannot create approval.
4. Run exact integrated Gateway/U02/Postgres tests for duplicate execution, expiry, revocation, account switch, restart/unknown provider outcome and authoritative receipt readback. Then qualify actual device/provider flow.
5. Shared Gateway composition, root router, financial authority, native/Firebase, migration registry, manifests and CI remain exclusively with their owners. No shared patch required for this API-compatible repair; no new workspace dependency is requested.

NOT_RUN: full pnpm install/frozen lockfile, pinned TypeScript 7 package check, workspace backend build/full suite, authenticated Gateway/U02 canonical PostgreSQL, Flutter/Android APK, physical devices, financial/live-provider/E2E and deployment/rollback. Reasons: scope isolated from protected composition; complete authenticated checkout and pinned installation not available here; canonical DB/provider/device credentials absent. CI #457 zero-step evidence is historical and was not rerun or called a pass. Independent U01 tests/typecheck above were completed despite those limitations.

## Final ownership transfer
This bounded approval repair is complete and reviewable. U01 overall remains partial because authenticated Gateway/U02/U03/F18 composition and external proof are pending, not because this patch has unwritten source. Release the three-path claim after publishing final handoff readback; transfer integration to sole #497 integrator at the immutable source SHA above. Other active recovery claims remain untouched.

No merges, branch deletion, production writes, paid resources, money movement, native or Firebase changes. Rollback: omit/revert this bounded package repair on the controlled integration branch; no DB rollback. Do not claim an APK/product release from this handoff.
