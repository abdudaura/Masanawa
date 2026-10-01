# ADR-0007: Foreground Character and Background Work

Status: accepted
Date: 2026-10-01

## Decision

A character session remains the foreground conversational identity.

Long work is represented by canonical durable Task/Workflow state. AgentStrategy/worker execution runs in the background and returns progress/artifacts/results through that state.

CyberVerse's ACK-before-work, progress query, final-result reinjection and role-isolated worker behaviors are adopted.
OpenJarvis supplies agent/tool execution strategies and loop/budget guards.
ChatWithStars owns workflow truth, approvals, idempotency and consequential-action evidence.

Workers receive explicit capability/tool/skill/package/credential allowlists and bounded artifact/time budgets.
