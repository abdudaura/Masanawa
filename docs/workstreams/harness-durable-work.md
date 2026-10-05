# Harness durable Work projection — 2026-10-05

Owner/window: ChatGPT harness continuation, explicitly assigned by the user after the startup/harness checkpoint.
Branch: `work/harness-durable-work-20261005`
Base: `176f7a818eca4eda11029348e1b00185b9fe1e15`

Purpose:
1. Make real harness Task/Workflow progress durable and visible through the existing mobile shell event stream.
2. Fix reconnect/restart behavior so `work.updated` events are not lost when no prior assistant bubble exists.
3. Keep Work as a projection of existing Task/WorkflowRun + AgentRun identities.

Owned paths:
- `packages/agents/src/harness.ts` and its existing export only
- new focused harness-progress helper/tests under `services/gateway/src/`
- `services/gateway/src/agent_conversation.ts` + focused tests only to route admitted execution through the harness boundary
- `apps/mobile/lib/src/agents/agent_shell.dart`
- `apps/mobile/lib/src/state/ai_chat_state.dart` only for Work-event recovery/upsert
- `apps/mobile/lib/src/chat/message_parts_view.dart` only for Work status presentation
- focused tests for the above
- `docs/AGENT-HARNESS.md`
- canonical workflow foundation under `packages/workflows/**` (new package only; no PostgreSQL composition yet)
- this claim file

Boundaries:
- no billing/crypto/provider execution changes;
- no new Task/Workflow persistence model;
- no direct domain writes from the harness;
- no fabricated progress or user-visible subagent identities;
- no deployment in this slice.

Acceptance:
- harness progress can be projected to canonical `work.updated` shell events;
- work reference identity is TaskId, otherwise WorkflowRunId, otherwise AgentRunId;
- reconnect/restart can render a Work card even when there is no existing assistant message;
- later updates replace the same reference instead of duplicating cards;
- machine phases are presented as concise human-readable status labels;
- docs are checkpointed before handoff.

Implemented:
- conversation execution now passes through `AgentHarness` using the compatibility strategy adapter;
- harness progress is projected through `work.updated` shell events;
- Task/Workflow/AgentRun reference precedence is deterministic;
- mobile creates a stable Work recovery card when no assistant narration exists and updates
  it in place on later/replayed events;
- human-readable Work status presentation added;
- Gateway progress-projection tests, conversation harness bridge test and mobile replay/recovery
  regression test added.

Discovered dependency:
- `packages/workflows` remains a placeholder. Canonical Task/Workflow identities exist, but
  durable Task/Workflow lifecycle/checkpoint persistence does not. This slice must not be
  described as service-restart-safe Work execution.

Continuation ownership:
- after completing the projection checkpoint, this same window may establish the isolated
  canonical `@masanawa/workflows` domain/repository contract because that package is still
  a placeholder and no active workstream claims it;
- this continuation must not mark roadmap Tasks 084-096 complete, alter shared migration
  registries or compose production persistence without a fresh checkpoint/claim update.

Status: projection/execution-seam checkpoint complete; canonical Workflow foundation now active.
