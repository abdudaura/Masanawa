# F12 companion verification — five-tab shell source/route regression guard (2026-10-09)

Status: CLAIMED — verification/recovery only, NOT feature ownership or completed F12.

- Window: GPT-6 independent F12 verification companion, after all U01–U30 product lanes were found in draft PRs.
- Branch: `work/verify-f12-five-tab-guard-20261009-gpt6`.
- Base `main` SHA: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exclusive new paths: `scripts/verify-five-tab-shell.mjs`, `scripts/verify-five-tab-shell.test.mjs`, `docs/workstreams/f12-five-tab-guard-20261009.md`.
- Other owners retain all `apps/mobile/**`, `services/gateway/**`, migration, finance, Firebase and shared routing files; **do not** modify them in this verification branch.
- Evidence reviewed: current main shell has four tabs (Home/Agents/Wallet/Talk); draft #493 `050b101c3f701db8b1d68f15d455a9bf3acd8dcb` has five-tab source but is unmerged, unverified. Work #497 and other feature PRs remain draft.
- Purpose: executable zero-dependency Node check that fails closed when a future integration resurrects the obsolete shell, repurposes legacy private-AI paths as human messages, removes authenticated DM route/protection or moves the Start Talk button off Talks. Unit tests of pass/fail fixtures. Verification must not be falsely described as Flutter/device acceptance.
- Claim published before any code/test file changes. Five-minute lease: refresh by repository-visible commits; if elapsed, recheck other claims and live PRs before writes.
- Current step: create checker and executable tests; record main vs candidate evidence, exact commands and SHA-specific draft PR handoff.
