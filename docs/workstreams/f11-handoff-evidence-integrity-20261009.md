# F11 — Independent draft-PR handoff integrity verifier (2026-10-09)

**Scope and status:** F11 read-only verification/recovery subclaim, not F11 production integration. **PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED.** This verifies evidence *structure*, not the veracity of assertions in a PR or product E2E readiness.

## Immutable authority and ownership
- Base: `main@5e758673ae91082520b21b3153da53791ae2cbf3`.
- Repository claim: [issue #568](https://github.com/Baatiku/masanawa/issues/568), published before changes with five-minute lease; exact paths below.
- Branch: `work/f11-handoff-evidence-checker-20261009-gpt6`.
- Source/test checkpoint: `1e31129b12859f6883ca1c3f569c57bc05ab8b0b` (first source checkpoint `557c72a59c15b9ee8d7cbc13a0417b9cede1b48e`). Final PR head and disposition are maintained in PR body, not self-referential inside a Git commit.
- Owned: `tools/handoff-integrity/check.mjs`, `tools/handoff-integrity/check.test.mjs`, this handoff. No shared Gateway, Flutter, Firebase, financial, migration, CI or provider files touched.
- Existing F11 PR #518 collision scanner and #567 zero-step CI verifier stay untouched. Other F11 work and F09/F14/F15/F17 PR claims stay intact.

## Actual source behavior
- Read-only GitHub REST GET of one PR, its paginated changed-file inventory and a linked `docs/workstreams/*.md` from the **exact current PR head SHA**, bounded to 3000 changed files.
- Fail-closed on wrong ref/base, merged/non-draft state, missing full current head in PR body, missing linked changed/committed handoff, and absent implementation-status, test, or draft-disposition notes.
- Verify owner/repo/PR inputs, allowlist read paths/host, bounded 10-second requests and sanitized HTTP failures; never print token or send GitHub writes.
- Verdict explicitly `STRUCTURE_PASS_NOT_E2E`, `STRUCTURE_FAIL` or `READ_BLOCKED`. Passing structure is never a release authorization. Does **not** assert linked tests ran or that a PR is safe to merge.

## Executed evidence (local Node 22.16.0)
```sh
node --test tools/handoff-integrity/check.test.mjs
# 11 pass, 0 fail, 0 skip
node tools/handoff-integrity/check.mjs Baatiku/masanawa 478
# Needs GitHub network connectivity; not executed against live API in local container
```

The 11 deterministic tests cover valid structure, stale HEAD, missing link, missing changed/committed file, absent test/disposition, merged/non-draft state, traversal, exact-SHA read, input/pagination bounds, and read-path allowlist. Locally executed identical files are 5445 and 3213 UTF-8 bytes, respectively; remote GitHub contents were read back with matching byte lengths. **These are Node unit tests with fake request boundaries (PASS_SIMULATED), not real GitHub API or customer E2E tests.**

## Remaining verification and handoff
- **NOT_RUN/BLOCKED:** live CLI authenticated GitHub GET from this sandbox (container DNS resolution for github.com unavailable); no token-based external run, CI #457 exhausted/zero-step failures. Run the CLI from a connected checkout with `GITHUB_TOKEN` read permissions, or no token for accessible public PRs.
- F11 integrator should run the exact command at pinned merged/branch SHA, inspect every FAIL manually, and treat error codes as structural only. Update PR body to current HEAD after the final commit. Tests should be rerun in trusted CI and after any merge; no release gate is waived.
- No device, provider, database, real Flutter UI or migration test was possible/appropriate for this isolated verifier. Those domain-specific F lanes remain independently blocked and unverified.
