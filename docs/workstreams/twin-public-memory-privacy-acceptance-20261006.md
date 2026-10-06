# Public Twin memory privacy acceptance — TWIN-107 slice

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/twin-public-memory-privacy-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Acceptance-harness commit: `aa79f720ebfc3107b43831bb054156860cc47b1a`
PR: #222

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-107** privacy acceptance: public Twin cannot expose private owner memory.
- `docs/TWIN-INTEGRATION-MATRIX.md` — public profile/memory foundations are merged; shared Gateway composition remains under protected integration ownership.

## Owned paths
- `tests/integration/twin-public-memory-privacy.test.ts`
- `docs/workstreams/twin-public-memory-privacy-acceptance-20261006.md`

## Excluded/shared paths
- No edits to Memory implementation, Identity implementation, Gateway composition, mobile app, migrations, production environment or PR #136-owned paths.
- This lane does not claim full TWIN-107 production completion until the shared production request path can be exercised end-to-end.

## Completed acceptance harness
- Verifies the public Twin profile projection omits owner user identity and internal revision fields while preserving the explicit AI-representation label.
- Verifies only `character-shared` memory for the exact represented Twin is admitted.
- Verifies character-private, Relationship, session and another Twin's shared memory are rejected.
- Verifies cross-tenant memory is rejected even if its scope names the same Character.
- Verifies a mixed batch containing any private record fails closed rather than partially leaking a response context.

## Changed-file audit
Exactly two files:
1. `docs/workstreams/twin-public-memory-privacy-acceptance-20261006.md`
2. `tests/integration/twin-public-memory-privacy.test.ts`

No production implementation or protected shared paths changed.

## Verification
GitHub Actions Foundation CI run `37452342076`, job `112231624055` ended `failure` with `steps = null`. Checkout/install/typecheck/tests never executed. This is not a test pass and is not evidence of an application failure.

## Remaining dependencies
- PR #136/shared production owner must expose/compose the actual public Twin request path and then run this privacy acceptance against that exact integrated release head.
- Exact production acceptance still needs authenticated request/response evidence proving no private owner memory reaches model context or response.
- If that shared path requires adapter or persistence changes, they remain with the existing integration/persistence owners.

## Current state
**ISOLATED ACCEPTANCE HARNESS COMPLETE / PRODUCTION ACCEPTANCE BLOCKED ON SHARED OWNER.**

No further isolated implementation remains in this acceptance slice.
