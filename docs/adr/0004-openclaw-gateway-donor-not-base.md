# ADR-0004: OpenClaw Is a Gateway/Device Design Donor, Not the Masanawa Base

Status: accepted
Date: 2026-10-01

## Context

Phase 0A identified OpenClaw as a mature TypeScript platform with:
- a unified multi-channel Gateway;
- explicit channel/account bindings;
- isolated per-agent workspaces and session stores;
- device nodes;
- plugins/skills/providers;
- tool/sandbox policy;
- queue steering and recovery;
- local-first operation.

It was considered as a possible base layer for Masanawa.

## Decision

Masanawa will **not** be implemented by forking OpenClaw or by making the OpenClaw Gateway/runtime the canonical host for the platform.

OpenClaw becomes the primary **design donor** for:
- Gateway/control plane;
- channel routing and adapter behavior;
- device node architecture;
- queue/steering semantics;
- selected sandbox/tool-policy behavior;
- skill distribution/trust patterns.

Masanawa may directly depend on narrow published OpenClaw packages only behind adapters. Initial candidates are:
- `@openclaw/ai`;
- `@openclaw/gateway-protocol` and `@openclaw/gateway-client` for optional compatibility only.

OpenClaw's internal/private runtime packages and host-coupled channel plugins are not canonical Masanawa dependencies.

## Rationale

OpenClaw's core isolation unit is an agent that combines persona/workspace/auth/session state. Masanawa intentionally separates Character identity, private relationships, world truth, execution strategies, credentials and durable workflows.

Making OpenClaw the base would introduce a second/competing domain model and make future replacement of the agent runtime a data migration.

## Consequences

- `services/gateway` is a Masanawa service, not an OpenClaw Gateway fork.
- `ChannelAdapter`, `DeviceNode`, `RuntimeSession` and related contracts are defined in Masanawa terms.
- OpenClaw clients/nodes may later connect through a compatibility adapter.
- OpenClaw behavior is mined into parity/acceptance fixtures.
- Cross-donor comparison remains required for AgentRuntime, Skills, Memory and Presence.
- OpenClaw can be removed/replaced without migrating Character, relationship, world, task or finance data.
