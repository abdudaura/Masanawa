# AF13 evidence path security — MASANAWA-01

Status: **PARTIAL_IMPLEMENTATION** (bounded security utility and unit tests; not wired to existing AF13 qualification CLI and not production verified).

## Scope and ownership
Claim: `masanawa01-af13-evidence-path-guard-20261010`, read back on `factory/claims`, registry commit `2290fc533a1f403935b17c3fe43c2416a14513d9`.

Branch: `work/af13-evidence-path-security-20261010-masanawa01`. Base: GitHub current `main` at branch creation; earlier observed `f381f077c485c04261459b77a42c215d3ce3a14b` (must refresh exact PR base/head during merge review).

Exact source:
- `tests/security/audio_first/evidence_path_guard.mjs`
- `tests/security/audio_first/evidence_path_guard.test.mjs`
- `docs/workstreams/AF13-evidence-path-guard-20261010.md`

## Behavior
Standalone `verifyEvidenceFile(root, relativePath, sha256, maxBytes)` restricts verification to normalized relative files below a trusted root, rejects symlinks at each current path segment, enforces a byte ceiling, hashes actual file bytes and checks pre/post file identity. Returns only byte count/path/digest, not an acceptance or provider-qualification assertion. No auth/financial/Gateway/runtime/migration/deployment changes.

## Executed verification
Node v22.16.0, isolated reproduction of checked-in module and semantically equivalent focused test cases:

```sh
node --test /mnt/data/af13/evidence_path_guard.test.mjs
```
Result: **3 passed, 0 failed** (bounded success/digest/size, hostile paths, symlink leaf/parent). This was not a monorepo checkout of the pushed immutable SHA. The checked-in test file must be executed on its exact PR head with:
```sh
node --test tests/security/audio_first/evidence_path_guard.test.mjs
```

## Remaining work / integration contract
This is a reusable security primitive only. AF13 integrator must inspect existing qualification PR #AF13 read-only evidence gate and decide whether to replace/compose its current path validation with this primitive; do not claim integration from its existence alone. Additional review needed for symlink replacement races on hostile mutable filesystems, Windows device/drive paths, exact-head test execution and full journey coverage.

Acceptance impact: security of PF-A01/SA/DB/WF-A10 evidence attachments, **not execution** of those journeys.

No providers, devices, database, or production services were invoked. Merge only after exact-head tests, collision/security review and auto-deployment audit; otherwise retain as scoped PR.
