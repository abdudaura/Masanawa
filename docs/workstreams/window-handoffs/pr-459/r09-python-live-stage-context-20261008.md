# R09 — Production Python LiveKit public Talk stage context (2026-10-08)

Owner/window: ChatGPT independent Python presence runtime R09 lane.
Branch: `work/r09-python-live-stage-context-20261008` | Draft PR #459 | main base `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
Latest repository-visible activity: 2026-10-08T06:31:28.885Z.

Exact owned paths: `services/presence/stage_context.py` (new), `services/presence/test_stage_context.py` (new), `services/presence/test_stage_store.py` (new), `services/presence/runtime_store.py`, `services/presence/agent.py`, this claim. No TS Gateway event/worker code (PR #452 and #448), gateway composition, migrations or financial authority touched.

## Delivered

- After each admitted AI Seat's canonical runtime check (active, unmuted, live, Host connected, commerce admitted), fetch a fresh **read-only, repeatable-read PostgreSQL snapshot** for the same tenant/Talk/Seat/persona/kind. Deny context if the Talk is not live, Seat no longer authorized, Host absent/stale or platform Talk visibility restricted.
- Reuse existing Talk, live, Seat, participation, answered-question and poll-vote tables. Current participants exclude Host-blocked people; reaction/hand totals aggregate only unblocked users. Only *answered* public questions are included. Poll counts are aggregates, not identifiable votes. Never read private conversation threads, Credits, wallet balances, unconfirmed gifts or raw comments.
- Bounded context: 6 Seats, 6 reactions, 3 hand states, 8 approved questions, 4 public polls with 4 options, short text and numeric limits; remove control/bidi characters. Public text is serialized JSON and passed as a **low-trust user-level turn message**. It is not a developer/system instruction, never triggers model generation on its own, and cannot confer Host or financial authority.
- Context-read errors do not bypass the existing per-turn Seat/Host/financial gate or fabricate public events; the model can still respond to the existing human turn without extra context.
- The live worker now connects its initial speaker to a human **Host or Speaker**, never a passive audience listener. Reactive speaker switching remains Host/Speaker-only.
- Actual Python runtime receives the new per-turn context; the earlier TypeScript `event_context.ts` integration was not connected to the deployed Python process. No parallel content ledger or new public API created.

## Validation evidence

- Remote committed code: `6ad6514bd2bb355224f39df88c6e65bf7ce6afef` (read-only stage SQL), `112b65698db17ded59b79c4b0fc0e6c2ef2e852f` (safe projector), `5ec105a6f4183f51c17313d1daf42855ad12c181` (real LiveKit hook), `6d5540934c113280c73ab9278fd29b7fcbe4aae6` (pure formatter regression cases), `470c45748eba24d38efb4aab4836f937f6cf09a4` (mock store SQL test), `ce5e1c18c7f6421a426ef96fed7ef5aecd95cca4` (fresh poll vote events), `2cf57c1f15277a6c69164df87c789ceaf0860feb` (poll test).
- **Executed locally** under Python 3, standard-library `unittest`: 10/10 cases PASSED covering bounded projection, privacy, malformed data, prompt text, numeric caps and a standalone mock of the same `read_public_stage` method (read-only, tenant/Host/Seat authorization SQL and no financial tables). Executed `python3 -m py_compile` on the pure context module, isolated SQL method and test harness. The local SQL method was staged in a stub RuntimeStore because the complete private repo and `asyncpg` were unavailable in this environment; this is not a PostgreSQL/live-SDK integration pass.
- GitHub branch sources were read back and all exact owned edits confirmed. GitHub Actions continues failing at runner startup with zero job steps; no full repo test, Docker image build, LiveKit/Gemini voice, real DB or device test was run.
- Railway read-only inspection confirmed the currently deployed Gateway cohosts the Python presence worker, and LiveKit/Gemini credential *names* are set; values are redacted. No credentials, deployment, balance or production data were modified.

## Known gates and handoff

- The six current read-only database queries are per approved human turn; qualify round-trip latency, error/abort behavior and race with moderator removal in a PostgreSQL+LiveKit integration. SQL projection follows the existing Gateway stage authorized-query pattern and intentionally omits settled gifts and moderated comments pending canonical publication authority; R09 is **PARTIAL**, not completed.
- Make sure the latest TypeScript safety-approved stage work in PR #452 is preserved/merged; do not bypass Host blocking, visibility or settlement authority.
- Run `cd services/presence && python3 -m unittest -v test_stage_context.py test_stage_store.py`, full Python import checks in built image (`asyncpg` and `livekit-agents`), Gateway Vitest and Docker image build, then real authorized Host/Speaker/Twin and multilingual Gemini Live tests.
- Confirm no listener-triggered speech, cross-tenant leakage, private money, offensive unmoderated text, prompt-injection obedience, audio interruption or false gift acknowledgments on device.
- Do not merge/deploy this draft while real Postgres/LiveKit execution, release CI and device acceptance remain missing.

**Status:** CODE PUSHED; 10 local standard-library tests passed for isolated logic/mocks; FULL APP CI NOT EXECUTED; provider/storage/device qualification NOT DONE; PR #459 DRAFT/UNMERGED. Lease released after handoff.
