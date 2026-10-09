# F11/R16 — redacted source-secret verification gate (draft handoff)

## Provenance and exact-path ownership

- **Owner/window:** GPT-6 F11 isolated verification/recovery, 2026-10-09.
- **Base `main` SHA:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Head branch:** `work/f11-source-secret-exposure-gate-20261009-gpt6`.
- **Draft, unmerged PR:** [#566](https://github.com/Baatiku/masanawa/pull/566).
- **Repository-visible claim commit before code:** `8bb8d5305cd6cd712bff31651dc8d32b98854176`.
- **Source commit:** `bbd715e0876ed5ba9ab03594303182e4ad259e48`.
- **Regression tests commit:** `21df4440b81dd0b14e1b4b9f9ea51fdf685a505f`.
- **Exact matched Git blob SHAs:** `tools/secret-exposure-gate/scan.mjs@fc151f2f46fbd54abc849048aaefe1937750a818` and `tools/secret-exposure-gate/scan.test.mjs@d509fa2c6e2f9304c8518e87c692ef0edc1584a0`. These match `git hash-object` of the locally executed files.
- **Exact owned paths:** the two tool files above and this handoff. Nothing else is modified. No source claim over Gateway composer, accounts, database registry, financial ledger, root Flutter router, native Firebase, CI settings or production.
- **Initial path claim:** recorded before implementation as required by `docs/MULTI-WINDOW-WORK.md`; lease timestamps are actual GitHub commits, not this document text.
- **Existing PRs protected:** Work #497, F11 #518/#554/#559/#561/#563, Firebase #461, CI #457 and all active U/F/R/C drafts. This is intentionally an isolated complementary F11 security verification slice, not a duplicate feature implementation.

## Completed source scope

`tools/secret-exposure-gate/scan.mjs` is a dependency-free Node read-only checkout scanner and CLI. It detects high-confidence exposed RSA/EC/DSA/OpenSSH/untyped private-key headers, sufficiently shaped GitHub tokens, sufficiently shaped live-payment secret keys, JSON Google service-account credential objects and private `.env*` file names (while allowing common `.env.example`/sample files). It emits **paths, line numbers and rule IDs only**, never matched credential content. Bounded file size/entry scan returns error 2 on missing, inaccessible or unscanned oversized text sources. Secret findings return 1; clean result returns 0. JSON mode supports machine consumption. It does not follow symlinks or send data to providers.

`tools/secret-exposure-gate/scan.test.mjs` provides deterministic positive/adversarial fixtures: clean source, env files, private key, Github/live-payment synthetic tokens, JSON service account vs public Firebase client config, malformed JSON, benign short examples, symlink escape, NUL binaries, oversized source, missing root, CLI return/diagnostic redaction and CLI child process behavior.

This is a **security verification gate**, not an implemented consumer product journey and not a statement that credential audit of the repository, historical commits, binary APK/AAB, deployed images or secrets vault is complete.

## Actual verification

**Environment:** Node v22.16.0 and git v2.47.3 local sandbox; tests executed against local code whose two git blob hashes match the above pushed blobs.

| Check | Actual result |
| --- | --- |
| `node --check tools/secret-exposure-gate/scan.mjs` | PASS |
| `node --check tools/secret-exposure-gate/scan.test.mjs` | PASS |
| `node --test tools/secret-exposure-gate/scan.test.mjs` | **13 PASS / 0 FAIL** |
| `node tools/secret-exposure-gate/scan.mjs --root tools/secret-exposure-gate --json` | CLEAN, exactly 2 scanner source files checked |
| Local `git hash-object` compared to GitHub branch `fetch_file` blob SHAs | Exact equality for source and tests |
| Complete GitHub repository source scan, Node24/pnpm workspace, actual CI | NOT RUN |
| Postgres, provider APIs, Firebase devices, Flutter app, signed APK/AAB, real restore | NOT RUN |

GitHub clone was attempted only read-only, and failed with `Could not resolve host: github.com`. The GitHub connector was able to push the individual files and verify their content SHAs, but cannot prove a full checkout scan. Existing GitHub Actions quota incident #457 remains unresolved by this slice.

## Handoff and integration instructions

1. Work integrator fetches #566 on a trusted complete checkout and checks for path conflict, verifying main and PR head SHAs at composition. No other F11 branch may silently overwrite these independent files.
2. From repository root on Node 22 or 24, execute `node --check tools/secret-exposure-gate/scan.mjs`, `node --check tools/secret-exposure-gate/scan.test.mjs`, and `node --test tools/secret-exposure-gate/scan.test.mjs`.
3. Execute `node tools/secret-exposure-gate/scan.mjs --root . --json` on checked-out complete repository, including staged configuration. Exit 1 needs protected, private review of actual secrets and rotation where real; exit 2 is **incomplete**, never green. Keep raw secret contents out of CI logs/issues/handoffs.
4. Decide whether this source-only gate belongs in Actions once #457 runners work. Add git-history scans, binary artifact scans and provider/vault policy as separately coordinated controls; this gate explicitly does not claim to cover them.
5. Re-run on final composed SHA and qualify real Flutter/Firebase/finance, database recovery, APK signing, device E2E and staged rollback independently. Do not merge or promote status based on these synthetic scanner tests.

**Status:** F11 overall `PARTIAL_IMPLEMENTATION`; this isolated checker is `LOCALLY_TESTED` (simulated fixtures), `DRAFT` / `UNMERGED` / `NOT_DEPLOYED` / `NOT_VERIFIED_E2E`. No branch deletion, merge, production or paid operations.
