# Technology and Framework Decisions

Status: initial canonical baseline. Changes require ADRs.

## Goals

Choose technologies for maintainability, type safety, realtime capability, AI/ML ecosystem compatibility, deployment flexibility and a clean monorepo—not to mimic donor repositories.

## Core language: TypeScript

Use TypeScript as the primary platform language for:
- domain packages;
- runtime/orchestration;
- gateway APIs;
- workflows;
- social/commerce integrations;
- web/Ops applications;
- provider adapters that do not require Python-native ML stacks.

Baseline: TypeScript 6.x, strict mode, ESM.

Why:
- shared end-to-end contracts;
- excellent Node/web ecosystem;
- current ChatWithStars expertise and migration knowledge;
- strong fit for event-driven APIs and integrations;
- avoids maintaining separate business logic in Python/Go.

Do not port Python donor code line-for-line merely to preserve implementation shape.

## Core runtime: Node.js 24 LTS

Baseline: Node.js 24 LTS. Node 24 is the current primary LTS line as of the foundation decision.

Use Node for persistent application services and workers whose libraries do not require Python-native inference.

## API framework: Fastify

Use Fastify for internal/public service APIs where a full web framework is not required.

Reasons:
- focused high-performance server;
- plugin architecture;
- schema-oriented request/response validation;
- mature Node ecosystem;
- good fit for typed service boundaries.

Transport/domain contracts should remain framework-neutral.

## Web and Ops: Next.js 16 Active LTS + React

Use Next.js for `apps/web` and `apps/ops`.

Reasons:
- one modern application framework for both customer and operator experiences;
- mature React ecosystem;
- SSR/streaming/app-like navigation;
- strong deployment portability via adapters;
- avoids maintaining Astro + separate admin framework.

Do not place provider secrets or runtime orchestration in React components. Server-side UI handlers call typed platform APIs.

Pin patched Active-LTS releases; do not float minor security versions.

## ML/media language: Python 3.14

Use Python for workloads where Python has a material ecosystem advantage:
- local model inference;
- embeddings/reranking when Python-native;
- media/vision pipelines;
- avatar inference;
- GPU workers;
- experimental evaluation/optimization.

Baseline: Python 3.14 maintenance line.

Python services expose typed versioned network/job contracts; they do not own core domain truth.

## Go

Do not introduce Go by default even though CyberVerse uses it. Add Go only through an ADR if measured requirements show it materially improves a transport/media component and the operational cost of a third language is justified.

## Database: PostgreSQL 18

Canonical durable store: PostgreSQL 18.x, using current supported minor releases.

Supabase may provide managed Postgres, Auth, RLS, Realtime and storage where useful, but Masanawa domain contracts must not depend on Supabase-specific client behavior.

Database principles:
- migrations in repository;
- append-only ledgers/audit where required;
- normalized canonical state;
- JSONB only where flexibility is genuinely needed;
- derived caches/indexes rebuildable;
- pgvector only behind retrieval abstractions.

## Queue/jobs/events

Start with PostgreSQL-backed durable jobs/outbox for transactional correctness and operational simplicity.

Introduce Redis/NATS/Kafka only when measured scale/latency requirements justify them via ADR. Do not add distributed infrastructure pre-emptively.

## Package manager/build

Use pnpm workspaces for JavaScript/TypeScript monorepo management.

Use a task orchestrator only when the repository reaches enough packages to justify it; Turborepo is acceptable but not required for the first foundation.

Python dependency management: uv.

## Schemas/contracts

Use runtime-validatable schemas at service boundaries. Preferred TypeScript baseline: TypeBox or Zod selected by the contracts ADR during Phase 2; schemas must generate/infer static types and validate untrusted input.

OpenAPI should be generated from canonical service schemas rather than maintained independently.

## Testing

TypeScript:
- Vitest for unit/integration;
- Playwright for browser/golden journeys;
- contract tests at all service/provider boundaries.

Python:
- pytest.

Add architecture-boundary tests and migration/parity suites.

## Observability

Adopt OpenTelemetry-compatible traces/metrics/log correlation from foundation.

Every cross-service operation should carry correlation/request/task/session identifiers where privacy-safe.

## Infrastructure abstraction

Architecture recognizes compute classes, not vendors:
- web/edge;
- stateful application;
- durable workers;
- GPU/batch;
- local/edge device.

Initial deployments may use Cloudflare/Vercel, Railway/DigitalOcean, Supabase, Modal/RunPod, but domain packages must not import vendor deployment assumptions.

## Realtime

WebRTC is the canonical browser realtime media transport.

Presence code must separate:
- transport;
- realtime intelligence;
- ASR;
- TTS;
- avatar renderer.

This allows Gemini Live or another provider to change independently of WebRTC/avatar selection.

## Mobile/desktop

Do not build separate business runtimes for mobile/desktop.

When clients are introduced:
- mobile: React Native/Expo is the preferred first evaluation because of TypeScript contract reuse;
- desktop/avatar shell: evaluate Tauri/Electron only when required.

Clients consume the same platform APIs/session protocols.

## Coding standards

- TypeScript strict.
- ESM only for new JS/TS.
- explicit public contracts;
- no barrel-file dependency cycles;
- no hidden global mutable domain state;
- dependency injection at provider edges;
- pure domain functions where practical;
- side effects behind tools/workflows/providers;
- exhaustive typed errors, never stringly-typed workflow truth.

## Version policy

Technology versions in this document are foundation baselines, not eternal pins. Security/maintenance updates may advance within compatible major lines. Major upgrades require compatibility verification; architectural changes require ADRs.
