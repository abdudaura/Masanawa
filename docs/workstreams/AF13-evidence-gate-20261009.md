# AF13 — Audio-first acceptance evidence preflight

**Window:** MASANAWA-01 / AF13-qualification-gate · **Date:** 2026-10-09
**Status:** IMPLEMENTED_UNVERIFIED as an isolated Node tool; **NOT VERIFIED_E2E** for Masanawa.
**PR:** https://github.com/Baatiku/masanawa/pull/592
**Base:** `main@f381f077c485c04261459b77a42c215d3ce3a14b`
**Tested source commit:** `fe696a4b774aecbf0c220cef2079299a66dd6de2` (source and tests only; handoff commit will supersede this).
**Claim:** `masanawa-01-af13-evidence-gate-20261009` on `factory/claims`, published and read back before edits.
**Safe merge target:** `integration/af13-qualification-20261009`, branched from this exact main, NOT production main.

## Exact owned paths

- `tools/audio-first-qualification/evidence-gate.mjs`
- `tools/audio-first-qualification/evidence-gate.test.mjs`
- `docs/workstreams/AF13-evidence-gate-20261009.md`

No shared Flutter router, Gateway/worker composition, auth, ledger, native manifest, migrations, CI, or production config was changed. The private owner's locally fixed APK/source was unavailable and not touched.

## Connected behavior

A no-dependency Node 22 CLI consumes (1) a structured manifest scoped to a **full 40-character commit SHA**, and (2) one or more current authoritative acceptance Markdown documents, parsing deduplicated `UX-Axx`, `WF-Axx`, `CR-Axx`, `PF-Axx`, `DB-Axx` IDs, including explicit ranges such as `UX-A01–UX-A12`. It reports complete/missing evidence IDs, statuses and sanitized structural errors. `PASS_REAL` requires matching source SHA, UTC execution time, nonzero steps, assertions, evidence references, role/environment and external dependency labels; mocks may only be `PASS_SIMULATED`. Duplicate IDs, unknown IDs, unsafe references, and status laundering fail closed.

The CLI **never connects to providers**, never certifies evidence-reference contents and **always** returns `verifiedE2E: false`, `releaseAuthorized: false`, `reviewRequired: true`. The optional `--require-all-real` restricts *structural preflight* and returns exit code 2 if evidence claims are incomplete; it is NOT release approval. Input size is bounded to 1 MiB per document; failures avoid echoing potentially sensitive source contents.

Commands on a checkout containing this PR:

```bash
node --test tools/audio-first-qualification/evidence-gate.test.mjs
node tools/audio-first-qualification/evidence-gate.mjs \
  --manifest /safe/path/redacted-evidence.json \
  --journeys docs/AUDIO-FIRST-SCREEN-SPECS.md \
  --journeys docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md \
  --journeys docs/BACKEND-STORAGE-OPERATIONS-20261009.md \
  --require-all-real
```

Manifest v1 example (explicitly NOT_RUN; do not fabricate PASS_REAL):

```json
{
  "schemaVersion": 1,
  "targetSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "observations": [
    {
      "journeyId": "UX-A05",
      "status": "BLOCKED",
      "reason": "Two physical Android devices unavailable to this window"
    }
  ]
}
```

## Tests and evidence

- **EXECUTED PASS** on local Node `v22.16.0`: `node --test /mnt/data/masanawa-af13/evidence-gate.test.mjs`, **14/14** tests, 0 failures. Includes a real Node subprocess for CLI exit/status, parser range coverage and multiple-document acceptance; external provider/device/DB not involved.
- Immutable GitHub blob readback matched local `git hash-object`: source `7d611e5c00f96cdf8b8e00e0c657afa2f07e95a3`; tests `e8e98d71f98c18586c484995958a9b7f5f24ef81`. This binds the executed local bytes to remote source files. Latest source/test head above; rerun tests after future edits.
- Required real cases **NOT_RUN**: live Android/Flutter, actual providers, wallet/escrow ledger, PostgreSQL concurrency, data/object restore, CI job execution and staged deployment. No APK artifact was generated or examined, and no real acceptance journey was certified.
- GitHub scope collision review: #527, #518, #559, #561, #554, #567, #570 and concurrent AF00/AF08/AF14 #586–#588 changed none of the three paths owned here (checked exact PR changed-file lists). AF00 dependencies: current screen specs, journey matrix, and DB operations documents.

## Remaining integration/release work

1. AF00 should review new branch, test the exact merged SHA, then reuse this standalone gate from a future **AF13-owned** test invocation or expressly transfer the CI file to AF00. Existing workflows were only read; no CI settings or job was modified. Foundation CI presently triggers on PR and main; Railway/Git-linked production deployment settings cannot be independently ruled out from workflow YAML alone.
2. Capture actual redacted, SHA/API/device/provider/DB-bound evidence with manual and machine verification **independent of this JSON validator**; this tool cannot stop a person writing a false but well-shaped `PASS_REAL` claim.
3. Establish qualified restore, escrow race, two-device permission/audio, rollout/rollback and source+APK identity evidence before any production authorization. Do not treat a safe source merge as release.

**Acceptance references:** UX-A01..12, WF-A01..10, CR-A01, PF-A01..04 and DB-A01..08. Project direction remains Chats · Rooms · Talks · Gwani · Wallet, Talks default; this lane did not alter UI.

**No production merge, provider operation, migration or expense authorized or performed.**
