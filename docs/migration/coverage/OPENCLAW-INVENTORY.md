# Phase 0B OpenClaw Repository Coverage Inventory

Pinned source: `openclaw/openclaw@83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

Status: **ACTIVE / PARTIAL**. This inventory is the repository-family closure proof companion to `docs/migration/coverage/OPENCLAW.md`. Do not mark OpenClaw covered until the unresolved list in that file reaches zero.

## Reproducible inventory sources

The pinned repository provides its own exact inventory machinery:

- `pnpm-workspace.yaml` defines root, `ui`, `packages/*`, `extensions/*`, and `examples/*`.
- `scripts/lib/plugin-inventory.mts` reads a requested exact Git commit/tree with lazy fetch and replacement refs disabled, enumerates extension manifests, validates duplicate IDs, records distribution/surfaces, and hashes the resulting inventory.
- checked-in generated `docs/plugins/plugin-inventory.md` is rebuilt from the canonical plugin inventory pipeline.
- `config/knip.config.ts` enumerates the maintained workspace/package source roots and plugin build entry conventions.
- pinned `pnpm-lock.yaml` provides the installed workspace importer graph.

This proof therefore uses generated inventory/build metadata rather than code-search hit counts.

## Top-level workspace families

Pinned workspace roots:
- root `openclaw` runtime/CLI/Gateway;
- `ui` Control UI;
- `examples/*` examples/reference only;
- `packages/*` reusable runtime/protocol packages;
- `extensions/*` plugins/providers/channels/device/tool integrations.

`qa/convex-credential-broker` appears in Knip as an intentionally standalone package and is not linked into the pnpm workspace; it is QA/reference infrastructure, not production runtime authority.

## Maintained `packages/*` workspaces

The pinned lock/import graph contains **18 package workspaces**:

1. `packages/acp-core` — ACP protocol/runtime contracts -> agents/workflows adapter boundary.
2. `packages/agent-core` — reusable agent loop/harness primitives -> secondary `packages/agents` donor, not Character authority.
3. `packages/ai` — model/provider types and low-level AI transport -> `packages/providers`.
4. `packages/gateway-client` — Gateway client protocol/request transport -> gateway adapter.
5. `packages/gateway-protocol` — RPC schemas/roles/scopes/devices -> gateway/security adapter evidence.
6. `packages/llm-core` — model/LLM helpers -> `packages/providers`.
7. `packages/markdown-core` — presentation/content parsing -> clients/content utilities.
8. `packages/media-core` — media contracts/utilities -> perception/provider adapters.
9. `packages/media-generation-core` — generation contracts -> providers/media.
10. `packages/memory-host-sdk` — memory host integration contract -> `packages/memory` adapter only.
11. `packages/mermaid-renderer` — rendering/presentation -> client/media utility.
12. `packages/model-catalog-core` — model catalog metadata -> `packages/providers`.
13. `packages/net-policy` — IP/network policy -> `packages/security`.
14. `packages/normalization-core` — pure normalization helpers -> shared utility.
15. `packages/sdk` — public SDK facade -> integration surface, not authority.
16. `packages/session-url-contract` — session URL/addressing contract -> external reference/navigation only.
17. `packages/terminal-core` — terminal protocol/helpers -> `packages/tools` adapter.
18. `packages/tool-call-repair` — model/tool-call normalization/repair -> agent/provider parsing; never side-effect authority.

Unmapped maintained package workspaces: **0**.

## Generated plugin inventory

Pinned `docs/plugins/plugin-inventory.md` reports exactly:

- **64 core npm plugins**;
- **96 official external packages**;
- **3 source-checkout-only plugins**;
- total catalog/inventory entries: **163**.

The three source-only entries are:
- `qa-channel`;
- `qa-lab`;
- `visitor-access`.

Three core plugin IDs are root-owned rather than separate extension packages:
- `active-memory`;
- `device-pair`;
- `talk-voice`.

Pinned package importer data contains 159 `extensions/*` importer roots. That count is intentionally **not** treated as the plugin count because package/importer identity and plugin-manifest/catalog identity differ. Concrete exceptions at the pinned tree include:
- manifest ID `kimi` implemented under workspace directory `extensions/kimi-coding`;
- `image-generation-core` is a package-backed extension helper without its own plugin manifest;
- `lmstudio` has a private source package/manifest whose package dependency graph does not make it a useful lock-importer counting primitive;
- `qqbot` is an official external catalog entry without a local `extensions/qqbot` source directory at this revision.

This separation prevents catalog-only external plugins, root-owned plugins, helper packages, aliases, and source manifests from being conflated.

## Plugin family disposition

Every generated inventory entry belongs to one of these canonical Masanawa destinations. Individual provider/channel brands do not receive separate authority merely because they are separate plugins.

### Model, embedding, media, speech and search providers
Examples include OpenAI, Anthropic, Google, Gemini/Vertex surfaces, Bedrock, Mistral, Kimi, Qwen, Ollama, vLLM, SGLang, Groq, Cohere, DeepSeek, OpenRouter, Together, xAI, speech providers, web-search providers, image/video generation providers and embedding providers.

Disposition: **B provider adapters** -> `packages/providers` / perception/media. Provider session IDs, auth records and model catalogs are never Character/business truth.

### Messaging/channel/realtime carriers
Examples include Telegram, Discord, Slack, WhatsApp, Signal, Matrix, iMessage, IRC, LINE, Feishu, Google Chat, Teams, SMS, Nostr, Tlon, Twitch, Buzz, Reef, Raft, voice/meeting carriers and A2A.

Disposition: **B gateway/channel adapters**. Admission, identity, dedupe, outbound acceptance, reply receipts and account lifecycle must conform to canonical Gateway contracts.

### Agent harnesses / coding runtimes / ACP
Examples include Codex, Copilot, ACPX, Agents API and related harnesses.

Disposition: **B execution adapters** -> `packages/agents` + `packages/workflows`; native/provider thread identity is never canonical.

### Memory/knowledge
Examples include active-memory, memory-core, memory-lancedb, memory-wiki and migration/import tools.

Disposition: **A/B behavioral/provider donors; C as canonical memory storage**. `packages/memory` remains sole authority.

### Browser/computer/device/filesystem/sandbox/code execution
Examples include browser, CUA, file-transfer, Linux node, QuickJS code mode, MXC/OpenShell, local code/tool helpers and terminal-related capabilities.

Disposition: **B tool/device adapters** behind canonical security, approval, sandbox, current-authority and reconciliation policy.

### Secrets/governance/policy/diagnostics
Examples include 1Password, Vault, policy, diagnostics OTel/Prometheus and governance helpers.

Disposition: **B security/ops adapters**; secret material belongs to the Masanawa vault and authorization remains canonical.

### Workflow/product/UI utilities
Examples include Lobster, Workboard, logbook, session-share, diffs/renderers, document extraction, structured LLM tasks and UI surfaces.

Disposition: **B capabilities** behind canonical workflows/tools/clients. Plugin-local product tables are not new domain truth without an explicit Masanawa ADR.

### QA/source-only helpers
`qa-channel`, `qa-lab`, `visitor-access` and test-only fixtures.

Disposition: **C/reference/test** unless a capability is separately adopted with production evidence.

## Native/platform application families

The pinned source contains native/platform surfaces under `apps/` and node-host code, including Android, Apple/macOS/iOS/watchOS-related code and Linux/node-host paths.

Canonical disposition:
- native apps are presentation/device capability hosts;
- pairing/device token and node command policy remain server-authorized;
- native local state is cache/credential/device state only;
- no native app becomes Character/memory/world/workflow/business authority.

Exact node/device security and recovery evidence is tracked in the main OpenClaw coverage document.

## Root/runtime families already mapped

The main coverage document has direct pinned evidence for:
- durable channel ingress/replay;
- effect-once crash windows;
- dynamic current-authority policy;
- device setup/token/node invocation;
- durable approvals;
- shared-Gateway trust mismatch;
- skill revision/session pinning;
- sandbox/tool/elevated policy;
- plugin lifecycle/state ownership;
- steering/transcript commitment;
- restart/write custody;
- SQLite integrity/quarantine;
- provider/model/auth/retry;
- memory provenance/dreaming/recall;
- cron/heartbeat;
- SSRF;
- secrets/diagnostics/telemetry;
- Gateway handshake/RPC/worker;
- agent bindings;
- session/subagent/ACP lineage;
- outbound delivery reconciliation.

## Current closure state

Exact package workspaces mapped: **18 / 18**.

Generated plugin inventory entries classified by canonical family: **163 / 163**.

Unresolved package/plugin enumeration ambiguity: **0**.

OpenClaw is **not yet marked covered** because direct descendant/test closure is still required for the remaining runtime families listed in `OPENCLAW.md`, especially channel-specific deltas, session/catalog/transcript/attachment details, native app/device descendants and exact consequential-test proof.
