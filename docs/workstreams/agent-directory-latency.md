# Agent directory latency — 2026-10-05

Owner/window: ChatGPT production readiness continuation after mobile fast-start reconciliation.
Branch: `work/agent-directory-latency-20261005`
Base: `29894f7257302d13152862e8f3b2634b395ac334`

Purpose:
1. Reduce avoidable serialized database waits in the authenticated mobile AgentDirectory projection.
2. Preserve exactly the same authorization, visibility and response contract.

Owned paths:
- `services/gateway/src/agent_directory.ts`
- `services/gateway/src/agent_directory.test.ts`
- this claim file

Boundaries:
- no customer-auth/authorizer changes (owned by the production APK polish workstream);
- no platform-agent bootstrap changes;
- no repository/migration changes;
- no mobile, billing, crypto or provider changes.

Acceptance:
- preference, per-visible-Agent profile reads and activity projection begin concurrently once the visible roster is known;
- output ordering/default/presence semantics are unchanged;
- empty roster remains valid;
- focused tests prove concurrent launch and unchanged projection.

Implemented:
- AgentDirectory resolves the visible Character IDs once;
- user preference, all visible-Agent platform profiles and activity projection now start in one Promise.all wave;
- response ordering and default/presence fallbacks are unchanged;
- focused test holds each independent repository read open and proves all three start before any resolves.

Runtime context:
- production Gateway has already been moved from SFO to AMS alongside PostgreSQL;
- this change removes an additional serialized DB wait inside the directory projection after authorization/presentation lookup.

Verification:
- changed code is limited to AgentDirectory service + focused test + this claim;
- no auth/bootstrap/repository/mobile/finance/provider contracts changed.

Status: implementation checkpoint complete pending PR integration.
