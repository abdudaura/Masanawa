# Mobile shell pull-ready integration — 2026-10-04

Owner/window: ChatGPT Android shell final integration, explicitly assigned by the user to make a normal local pull/build contain the completed shell work.

Branch: `work/mobile-shell-pull-ready-20261004`
Base: current `main` after merged PRs #104 and #125.

Owned paths for this final pass:
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- `apps/mobile/test/agent_recovery_test.dart` for transport-route regression coverage only
- `docs/workstreams/mobile-shell-pull-ready.md`

Purpose:
1. Verify the merged mobile transport against the merged Gateway route surface.
2. Correct any remaining route mismatches that would render UI but fail at runtime.
3. Make the existing hosted test Gateway the non-secret default address used by local/debug connection UX without embedding any Alpha token.
4. Preserve all other workstreams and do not change Commerce, Teaching, channel, provider, migration, deployment or unrelated mobile UI ownership.

Findings before edit:
- #104 and #125 are merged into main.
- All /agent/** mobile routes match the Gateway.
- Five creator mobile routes still use retired /v1/creator/** paths while the Gateway exposes /creator/**.
- kAgentBaseUrl defaults empty even though the existing hosted debug Gateway is https://nurainworker-production.up.railway.app.
- The Alpha token remains private and must never be committed.

Status: claim published before implementation.