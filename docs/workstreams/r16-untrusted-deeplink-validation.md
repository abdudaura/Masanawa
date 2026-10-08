# R16 — untrusted Android link admission
Updated UTC: 2026-10-08; owner: GPT-6 R16 link-hardening window
Status: PARTIAL_IMPLEMENTATION; branch: `work/r16-untrusted-deeplink-validation-20261008`; base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Five-minute ownership activity lease starts with this push; do not infer permanent reservation.
Owned paths: `apps/mobile/lib/src/core/shell_deep_link.dart`, `apps/mobile/test/core/shell_deep_link_security_test.dart`, this handoff file.
Scope: validate external deep links strictly at the app boundary, reject ambiguous parameters and unauthorized route forms, maintain legacy AI route semantics. No Gateway, DB, financial or Flutter shared router changes.
Dependencies: R17/C08 owns route aliases; R16 release/security owner verifies Android verified links, separate provider/signing evidence. CI #457 remains externally blocked.
Claim: source edits/tests forthcoming; no runtime qualification yet.
