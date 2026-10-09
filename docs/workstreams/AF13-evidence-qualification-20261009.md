# AF13 — fail-closed audio-first qualification evidence

**Window:** MASANAWA-01 / AF13  
**Registry claim:** `masanawa-01-af13-evidence-qualification-20261009` in `factory/claims:.factory/leases.json`; CAS write and readback verified before any feature edit (2026-10-09T21:45:04Z). Renewed at 2026-10-09T21:48:24Z.  
**Branch:** `work/af13-evidence-manifest-20261009-masanawa01`  
**Base main:** `f381f077c485c04261459b77a42c215d3ce3a14b`  
**PR:** https://github.com/Baatiku/masanawa/pull/594  
**Tested source commit:** `962a80680e5408212d4725d5a6900d9ece450292` (this documentation update follows it).  
**Status:** `IMPLEMENTED_UNVERIFIED` for the independent AF13 evidence-qualification utility; the whole AF13 and app/device/provider/DB E2E gates remain `NOT_RUN / BLOCKED`. No deployment.

## Exact owned paths

- `tools/audio-first-qualification/verify-evidence.mjs`
- `tools/audio-first-qualification/verify-evidence.test.mjs`
- `tools/audio-first-qualification/acceptance-matrix.json`
- `docs/workstreams/AF13-evidence-qualification-20261009.md`

## Delivered behavior

The dependency-free, offline, read-only Node verifier consumes a **caller-pinned immutable source SHA** and an explicit acceptance evidence JSON. It checks a distinct evidence record for each of 35 official acceptance IDs (12 UX, 10 WF, 4 PF, 1 CR, 8 DB) from `AUDIO-FIRST-SCREEN-SPECS.md`, `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` and `BACKEND-STORAGE-OPERATIONS-20261009.md`. No undocumented gate ID is silently accepted. It rejects missing, duplicate, unknown, invalid, failed, stale, future, forged-source, hash-mismatched and symlink/path-traversal proof records, and emits only concise structured gate ID/status counts instead of dumping sensitive logs. Proof files are bounded (50 MiB); JSON inputs are bounded (512 KiB).

`release` mode **requires PASS_REAL on every gate**; a mere `PASS_SIMULATED`, `BLOCKED` or `NOT_RUN` can never make it ready. `integration` mode allows simulated tests, with an explicitly marked mode and pass-simulation count; it does not authorize production deployment. The evidence file is an **untrusted, self-reported attestation**. Even if all entries say PASS_REAL, this tool cannot cryptographically prove that providers or devices actually ran; a human/independent verifier must inspect real proof and configuration before production sign-off.

## Usage (run in a complete checkout; never attach secrets or customer data)

```bash
node --test tools/audio-first-qualification/verify-evidence.test.mjs
node tools/audio-first-qualification/verify-evidence.mjs --root . --manifest <safe-evidence.json> --expected-sha <40-character-Git-SHA> --mode release
```

Manifest schema:

```json
{
  "schemaVersion": 1,
  "sourceSha": "<exact SHA passed via --expected-sha>",
  "evidence": [
    {
      "id": "UX-A03",
      "status": "PASS_REAL",
      "sourceSha": "<same exact SHA>",
      "command": "<redacted exact command that ran>",
      "environment": "<device/OS/toolchain or PG/provider staging identification; no credentials>",
      "executedAt": "2026-10-09T21:45:00Z",
      "proof": { "path": "proof/ux-a03-redacted.log", "sha256": "<64-character SHA256>" }
    }
  ]
}
```

Place proof files under the checkout root; they must be regular files (no symlink escape). The example is a **schema example only**; it is not a real proof, signed artifact or validated receipt. No positive production evidence manifest was fabricated or committed.

## Executed verification

- **PASS_REAL (local code-unit tests only):** `node --test /mnt/data/af13/verify-evidence.test.mjs` on Node.js `v22.16.0`, 12/12 tests passed. Covers positive synthetic fixture, missing gate, simulated vs release, duplicated gate, false hash, wrong source binding, `..` traversal, symlink escape, future timestamp, no evidence, explicit failure, caller SHA mismatch.
- **PASS_REAL (local syntax check):** `node --check /mnt/data/af13/verify-evidence.mjs`; `node --check /mnt/data/af13/verify-evidence.test.mjs`.
- **PASS_REAL (local negative CLI):** nonexistent manifest with valid 40-hex source SHA exits **2**, emits no stdout and a sanitized error.
- **PASS (GitHub exact file blob readback):** remote `verify-evidence.mjs` blob `647f9a6d68b5ae0759e78549003ad99b56ed3182`, remote test blob `bbb5c74464ec67680edd2af6b8e7c05d45bf2e26` exactly match Git blob SHA-1 hashes of files executed locally.
- **PASS (document/matrix inventory check):** all 35 IDs independently extracted from canonical docs match the committed matrix: no missing/extra IDs.
- **NOT_RUN:** full Masanawa test suite, 2-device/APK/audio, real finance/provider, PostgreSQL 18, restore/capacity, Firebase, Telegram/WhatsApp and production deploy. GitHub Actions minutes previously exhausted; no new CI runtime proof claimed.

## Dependencies, recovery and safe next action

AF00 is the only integrator; no shared route, Gateway/worker/ops composition, migrations, finances, auth, Flutter/native, lockfiles or provider writes are in scope. Existing #527/#518/#559/#561/#554/#567/#570 recovery tests and #497 local-source reconciliation remain independent; AF07 #593, AF00 #586 and AF01/#05/#08/#14 claims were reviewed for overlap. Owner's local APK/source still unavailable and untouched. No schema change, secret, external side effect or spending was introduced.

**Safe merge target:** a non-production integration branch while automatic production triggers for main remain unverified; AF00 must reconcile this merged source into its canonical working integration/main when deployment isolation is confirmed. Real whole-product readiness requires an externally assembled, redacted and independently examined proof manifest pinned to final application/artifact/schema SHA, not a successful synthetic verifier unit test.
