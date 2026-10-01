# Phase 0B Microsoft Agent Framework Repository Coverage Inventory

Pinned source: `microsoft/agent-framework@e15c6dce2d10196a61c851a56ef3d839ff3c3ea7`.

Purpose: repository-family closure proof for `docs/migration/coverage/MICROSOFT-AGENT-FRAMEWORK.md`.

## Inventory sources

- exact pinned `python/pyproject.toml` workspace/source table;
- exact pinned `dotnet/agent-framework-dotnet.slnx`;
- exact pinned package manifests for Python packages;
- exact pinned implementation/test paths cited in the main coverage document.

This inventory separates runtime/source packages from samples/tests and does not treat package names alone as behavioral proof.

## Python maintained workspace — 40 packages

### Core/runtime/orchestration
- `agent-framework-core`
- `agent-framework-orchestrations`
- `agent-framework-declarative`
- `agent-framework-typesafe`
- `agent-framework-tools`

Masanawa mapping:
- core agent loop/runtime -> `packages/agents`;
- durable graph/checkpoint/HITL/orchestration -> `packages/workflows`;
- declarative definitions -> authoring/import into immutable `WorkflowVersion`;
- tools -> `packages/tools`;
- no Python object becomes Character/domain truth.

### Protocol/hosting/client surfaces
- `agent-framework-a2a`
- `agent-framework-ag-ui`
- `agent-framework-chatkit`
- `agent-framework-hosting`
- `agent-framework-hosting-a2a`
- `agent-framework-hosting-mcp`
- `agent-framework-hosting-responses`
- `agent-framework-hosting-telegram`
- `agent-framework-foundry-hosting`
- `agent-framework-devui`

Masanawa mapping:
- protocol/channel/UI adapters only;
- application/server authentication, authorization, session binding and deployment remain canonical Masanawa concerns;
- protocol IDs never become Character/workflow authority.

### Model/provider integrations
- `agent-framework-anthropic`
- `agent-framework-bedrock`
- `agent-framework-claude`
- `agent-framework-copilotstudio`
- `agent-framework-foundry`
- `agent-framework-foundry-local`
- `agent-framework-gemini`
- `agent-framework-github-copilot`
- `agent-framework-mistral`
- `agent-framework-ollama`
- `agent-framework-openai`

Masanawa mapping:
- `packages/providers` adapters only;
- provider retry/fallback/remote-state rules remain Masanawa policy;
- no provider agent/thread/conversation object is canonical platform identity.

### Data/search/memory/checkpoint integrations
- `agent-framework-azure-ai-search`
- `agent-framework-azure-documentdb`
- `agent-framework-azure-cosmos`
- `agent-framework-duckdb`
- `agent-framework-mem0`
- `agent-framework-mongodb`
- `agent-framework-postgres`
- `agent-framework-sql-server`
- `agent-framework-qdrant`
- `agent-framework-redis`

Masanawa mapping:
- search/vector stores -> rebuildable/provider indexes under canonical domain owners;
- memory adapters cannot replace `packages/memory`;
- Azure Cosmos's explicit CheckpointStorage implementation is a backend reference for `packages/workflows`, not the canonical store;
- PostgreSQL remains Masanawa canonical domain persistence.

### Safety/governance/document processing/code execution
- `agent-framework-purview`
- `agent-framework-azure-contentunderstanding`
- `agent-framework-hyperlight`
- `agent-framework-monty`

Masanawa mapping:
- governance/content understanding -> provider/security adapters;
- code execution -> tool/sandbox capability behind `packages/tools` and canonical approval/security.

### Experimental Python lab

Root `python/pyproject.toml` explicitly excludes `packages/lab` from the maintained workspace and README identifies AF Labs as experimental.

Disposition: **C/reference/evaluation**, unless an individual capability is later adopted through a separate evidence pass.

## .NET source inventory — 35 projects

Exact source project list from pinned `dotnet/agent-framework-dotnet.slnx`:

1. `Aspire.Hosting.AgentFramework.DevUI`
2. `Microsoft.Agents.AI.A2A`
3. `Microsoft.Agents.AI.Abstractions`
4. `Microsoft.Agents.AI.Anthropic`
5. `Microsoft.Agents.AI.AzureAI.Persistent`
6. `Microsoft.Agents.AI.CopilotStudio`
7. `Microsoft.Agents.AI.CosmosNoSql`
8. `Microsoft.Agents.AI.Declarative`
9. `Microsoft.Agents.AI.DevUI`
10. `Microsoft.Agents.AI.Foundry.Hosting`
11. `Microsoft.Agents.AI.Foundry`
12. `Microsoft.Agents.AI.GitHub.Copilot`
13. `Microsoft.Agents.AI.Harness`
14. `Microsoft.Agents.AI.Hosting.A2A.AspNetCore`
15. `Microsoft.Agents.AI.Hosting.A2A`
16. `Microsoft.Agents.AI.Hosting.AGUI.AspNetCore`
17. `Microsoft.Agents.AI.Hosting.AspNetCore`
18. `Microsoft.Agents.AI.Hosting.AzureStorage`
19. `Microsoft.Agents.AI.Hosting.OpenAI`
20. `Microsoft.Agents.AI.Hosting`
21. `Microsoft.Agents.AI.Hyperlight`
22. `Microsoft.Agents.AI.LocalCodeAct`
23. `Microsoft.Agents.AI.Mcp`
24. `Microsoft.Agents.AI.AgentHooks`
25. `Microsoft.Agents.AI.Mem0`
26. `Microsoft.Agents.AI.OpenAI`
27. `Microsoft.Agents.AI.Purview`
28. `Microsoft.Agents.AI.Tools.Shell`
29. `Microsoft.Agents.AI.Valkey`
30. `Microsoft.Agents.AI.Workflows.Declarative.Foundry`
31. `Microsoft.Agents.AI.Workflows.Declarative.Mcp`
32. `Microsoft.Agents.AI.Workflows.Declarative`
33. `Microsoft.Agents.AI.Workflows.Generators`
34. `Microsoft.Agents.AI.Workflows`
35. `Microsoft.Agents.AI`

Pinned solution also contains **48 test projects**, including workflow, hosting, provider, storage, A2A/MCP, hooks, memory and integration suites.

### .NET canonical disposition

- `Microsoft.Agents.AI.Workflows*` -> primary workflow semantic evidence; adapted to one TS/Postgres `packages/workflows`.
- core/abstractions/harness/hooks -> runtime/middleware secondary donor, not Character authority.
- A2A/MCP/AGUI/hosting -> adapters only.
- provider projects -> `packages/providers`.
- Cosmos/Valkey/Mem0 -> data-provider references only.
- Shell/Hyperlight/LocalCodeAct -> `packages/tools` + sandbox/security.
- Purview -> governance/security/provider adapter.
- DevUI/Aspire -> development/ops UI, never business truth.

## Cross-language parity rule

Python and .NET are not separate implementation targets for Masanawa.

Where both implement the same concept:
- use both as evidence;
- prefer the stronger observable invariant;
- record behavioral deltas;
- implement exactly one Masanawa TypeScript/PostgreSQL contract.

Examples:
- Python checkpoint lineage explicitly distinguishes predecessor-chain ordering from iteration count.
- .NET Foundry checkpoint persistence adds bounded optimistic-concurrency index retries and branch-aware pruning.
- both expose first-class pending external/HITL requests and restore behavior.
- both provide graph builders and orchestration patterns.

## High-risk production families explicitly accounted for

- graph build/validation/signature;
- sequential/fan-out/fan-in/switch routing;
- runner convergence/cancellation;
- checkpoints/lineage/restore;
- checkpoint serialization trust boundary;
- pending request/HITL/tool approval;
- exact approval-bound arguments;
- handoff/group-chat/Magentic/sequential/concurrent orchestration;
- middleware;
- skills/resources/scripts/path safety;
- provider clients and retry ownership;
- A2A;
- MCP;
- declarative workflows;
- telemetry privacy;
- Cosmos/Foundry durable checkpoint stores;
- search/vector/memory/data integrations;
- hosting/session persistence;
- code execution/tool adapters.

## Closure result

- pinned maintained Python packages mapped: **40 / 40**;
- pinned .NET source projects mapped: **35 / 35**;
- pinned .NET test projects recognized: **48**;
- experimental Python lab explicitly dispositioned: **C/reference**;
- unresolved canonical-authority conflicts: **0**;
- unresolved meaningful production package families: **0**.

Package-family closure does not imply direct code reuse. Retained behaviors remain governed by A/B/C classification and the observable acceptance gates in the main coverage document.
