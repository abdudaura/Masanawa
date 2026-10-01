# Source Map — elizaOS

Pinned: `cda43c762c605b69e4fcb9a791092508814bf6c4` (`develop`).

Status: Phase 0A runtime/plugin deep pass complete.

## Executive result

elizaOS is selected as the primary **TypeScript component/plugin runtime donor**, not Masanawa's kernel.

Its pinned core is a broad agent operating-system runtime with typed actions, providers, evaluators, services, events, models, routes, connectors, security/access context, local/device capabilities and UI/app extension surfaces.

## AgentRuntime

The runtime explicitly owns one agent's public runtime identity, registries, settings and initialization while delegating model dispatch, state composition, service lifecycle, embeddings and mutations to dedicated owners.

Useful architecture:
- typed runtime registry;
- staged routing/planning/action execution;
- provider/context composition;
- service registry/lifecycle;
- turn controllers and queues;
- model dispatch separated from runtime identity;
- access/disclosure context integrated into component admission;
- telemetry/trace seams.

Rejected boundary:
- eliza Agent identity/settings/memory as Character truth;
- one giant AgentRuntime as Masanawa's domain kernel;
- plugin/provider state as business truth.

## Plugin/component model

The `Plugin` contract can aggregate:
- actions;
- providers;
- evaluators;
- services;
- models;
- routes;
- events;
- schema/components;
- connectors and optional app/UI surfaces.

`plugin.ts` provides an important supply-chain boundary:
- core validates plugin shape;
- dependencies are resolved/topologically ordered with cycle detection;
- core never installs packages;
- core never imports package names itself;
- the host injects a PluginResolver;
- without a resolver, string package references are skipped/fail closed.

Masanawa should preserve this split. Plugin installation/resolution belongs to an operator/host layer and cannot be initiated implicitly by a model.

## Services

Long-lived services have explicit start/stop lifecycle, typed service IDs, optional multi-implementation support and a shutdown-admission hook (`prepareStop`) so new work can be rejected before draining admitted work.

This is a strong lifecycle donor for `packages/plugins`/runtime services.

## Actions and execution policy

Actions have typed parameters, validation, planner/hook modes and disclosure/access gates. The pinned code contains explicit owner/audience disclosure concepts and separates model-declared reply effects from execution proof.

Masanawa preserves the typed action/component idea but canonical tools/workflows remain the authority for side effects.

## Adoption role

Primary donor:
- TypeScript runtime component contracts;
- plugin manifest/component registration;
- service lifecycle;
- action/provider/evaluator/event seams;
- host-vs-kernel plugin loading boundary.

Secondary donor:
- planner/routing pipeline;
- access/disclosure gates;
- local/device/provider integration patterns.

See ADR-0008 and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.
