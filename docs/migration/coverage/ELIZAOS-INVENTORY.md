# Phase 0B elizaOS Repository Coverage Inventory

Pinned source: `elizaOS/eliza@cda43c762c605b69e4fcb9a791092508814bf6c4`.

Purpose: closure proof for `docs/migration/coverage/ELIZAOS.md`. This inventory does not treat package names as behavioral proof. It maps the exact pinned workspace/build inventory to the implementation families already evidenced in `ELIZAOS.md`, and records the additional pinned package manifests inspected to close otherwise-hidden subtrees.

## Inventory method

1. Read the exact pinned root `package.json` workspace globs.
2. Read the exact pinned `turbo.json` and extract every package-qualified task key: **77 named workspaces**.
3. Read the exact pinned runtime plugin registries:
   - `packages/agent/src/runtime/core-plugins.ts`;
   - `packages/agent/src/runtime/optional-plugins.ts`;
   - `packages/agent/src/runtime/android-app-plugins.ts`.
4. Fetch pinned first-party plugin manifests and high-risk plugin entry points for side-effectful families.
5. Separate runtime references to non-local packages from source-owned descendants.
6. Map each source-owned family to one Masanawa canonical boundary and to exact behavioral evidence in `ELIZAOS.md`.

No current upstream behavior is used as pinned behavioral evidence.

## 77 named workspace packages from pinned turbo.json

### Runtime / host / security / client shell
- `@elizaos/core`
- `@elizaos/agent`
- `@elizaos/agent-server`
- `@elizaos/app`
- `@elizaos/ui`
- `@elizaos/auth`
- `@elizaos/testing`
- `@elizaos/electrobun`
- `@elizaos/capacitor-gateway`
- `@elizaos/os`
- `@elizaos/native-activity-tracker`

Coverage: ELIZAOS §§1–18, 21, 23–25. Canonical Masanawa boundaries: agents/plugins/tools/security/clients/device adapters. None owns Character, memory, world or workflow truth.

### Cloud / deployment / gateways
- `@elizaos/cloud-api`
- `@elizaos/cloud-shared`
- `@elizaos/cloud-services-common`
- `@elizaos/cloud-e2e`
- `@elizaos/cloud-test-mocks`
- `@elizaos/container-control-plane`
- `@elizaos/gateway-discord`
- `@elizaos/gateway-webhook`

Coverage: ELIZAOS §§13, 22, 24, 25, 28. Canonical Masanawa boundaries: deployment adapters, gateway/channel adapters, durable workflows, security/vault. Compute containers are disposable execution locations.

### Model / inference / media / retrieval providers
- `@elizaos/plugin-anthropic`
- `@elizaos/plugin-openai`
- `@elizaos/plugin-embeddings`
- `@elizaos/plugin-local-inference`
- `@elizaos/plugin-native-inference`
- `@elizaos/plugin-video`
- `@elizaos/plugin-vision`
- `@elizaos/plugin-pdf`
- `@elizaos/plugin-web-search`

Coverage: ELIZAOS §§9, 20, 21, 23. Canonical owner: `packages/providers`; media/device acquisition remains adapter-side. Provider/model output never owns business/domain truth.

### Messaging / SaaS / external connectors
- `@elizaos/plugin-discord`
- `@elizaos/plugin-telegram`
- `@elizaos/plugin-slack`
- `@elizaos/plugin-x`
- `@elizaos/plugin-imessage`
- `@elizaos/plugin-github`
- `@elizaos/plugin-google-workspace`
- `@elizaos/plugin-calendar`
- `@elizaos/plugin-meetings`
- `@elizaos/plugin-mcp`
- `@elizaos/plugin-maps`

Coverage: ELIZAOS §§11, 18, 19, 22, 24. Canonical owners: gateway/channel adapters, provider/integration accounts, tools/workflows for consequential effects. Durable ingress dedupe and ambiguous outbound acceptance rules are retained.

### Automation / device / coding / high-consequence tools
- `@elizaos/plugin-browser`
- `@elizaos/plugin-computeruse`
- `@elizaos/plugin-coding-tools`
- `@elizaos/plugin-pty`
- `@elizaos/plugin-native-contacts`
- `@elizaos/plugin-native-filesystem`
- `@elizaos/plugin-native-messages`
- `@elizaos/plugin-native-phone`
- `@elizaos/plugin-native-settings`
- `@elizaos/plugin-native-wifi`
- `@elizaos/plugin-wallet`

Coverage: ELIZAOS §§12, 16, 17, 23, 24. Pinned high-risk entry points inspected include browser dispatcher/domain policy, coding-tools FILE/SHELL/WORKTREE stack, wallet plugin composition, native phone authority catalog and native bridge packages. Canonical owner: `packages/tools` + security approvals/current authority + device/provider adapters. Wallet/trade/device/browser/shell effects require deterministic authorization/idempotency/reconciliation; donor wallet or local device stores are not business truth.

### Product/domain plugins and orchestration
- `@elizaos/plugin-agent-orchestrator`
- `@elizaos/plugin-assistant`
- `@elizaos/plugin-personal-assistant`
- `@elizaos/plugin-form`
- `@elizaos/plugin-goals`
- `@elizaos/plugin-health`
- `@elizaos/plugin-inbox`
- `@elizaos/plugin-knowledge`
- `@elizaos/plugin-notes`
- `@elizaos/plugin-relationships`
- `@elizaos/plugin-scheduling`
- `@elizaos/plugin-todos`
- `@elizaos/plugin-workflow`

Coverage: ELIZAOS §§2–8, 10, 12, 18, 22, 26–27. Additional pinned entry points inspected:
- Agent Orchestrator: ACP/sub-agent/task/workspace services are execution/orchestration, not Character identity;
- Scheduling: storage-agnostic task-state-machine donor only; Masanawa `packages/workflows` owns durable jobs;
- Todos/Goals/Notes: donor-local schemas are product data references, not a second Masanawa task/memory/world authority;
- Health: connector/signal/anchor/default-pack contributions are domain evidence feeding canonical contracts;
- Form/Inbox/Knowledge/Relationships/Personal Assistant: extension/domain composition behind canonical skills/tools/workflows/memory/identity boundaries.

### Persistence / observability
- `@elizaos/plugin-sql`
- `@elizaos/plugin-sqlite`
- `@elizaos/plugin-trajectory-logger`

Coverage: ELIZAOS §§6–7, 15, 18, 21, 24, 26–28. SQL schema authority is fully mapped in §26. Persistence mechanics may be retained, but eliza domain tables are not Masanawa canonical truth.

### Benchmark / test-only workspaces
- `@elizaos/bench-eliza-1`
- `@elizaos/bench-eliza-1-vision-cua-e2e`
- `@elizaos/bench-vision-language`
- `@elizaos/benchmark-framework`
- `@elizaos/configbench`
- `@elizaos/lifeops-bench`
- `@elizaos/personality-bench`
- `@elizaos/plugin-benchmarks`
- `@elizaos/three-agent-dialogue`
- `memperf-suite`

Disposition: C/reference/evaluation. They may supply acceptance cases/measurement ideas, never runtime authority.

## Additional pinned local packages not represented by package-qualified turbo task keys

These were discovered through pinned dependency/runtime references and verified by fetching their exact manifests:

- `@elizaos/plugin-blocker` — website/app blocking services + `app_blocker` schema. B capability behind Masanawa tools/security/workflows; hosts-file/app blocking is consequential device state.
- `@elizaos/plugin-reminders` — reminder plans/delivery attempts/escalation schema + migration. B behavior/data model reference; canonical reminders are workflows/delivery state.
- `@elizaos/capacitor-location` — geolocation bridge. B device/perception adapter.
- `@elizaos/capacitor-camera` — photo/video/preview bridge. B perception adapter.
- `@elizaos/capacitor-system` — Android system-role/status bridge. B device adapter.

Pinned `plugin-blocker` and `plugin-reminders` entry points were inspected: their local schemas cannot become a second Masanawa workflow/security authority.

## Runtime plugin references that are not local source descendants

The exact pinned `core-plugins.ts` mentions these package names, but the corresponding `plugins/plugin-*/package.json` paths do not exist at the pinned revision:

- `@elizaos/plugin-cron`
- `@elizaos/plugin-directives`
- `@elizaos/plugin-elevenlabs`
- `@elizaos/plugin-gitpathologist`
- `@elizaos/plugin-music`
- `@elizaos/plugin-obsidian`
- `@elizaos/plugin-repoprompt`

They are therefore integration/package-resolution references, not elizaOS source descendants to be migrated. Their existence is covered by the host/plugin resolver boundary (§§1, 14): arbitrary external package code never becomes canonical Masanawa authority merely because a host can resolve it.

## High-risk descendant closure

The families most likely to hide duplicate authority were read directly at pinned source:

- plugin/package install and hot lifecycle;
- task scheduler/workflow fencing;
- authorization/membership/disclosure;
- SQL schema/migrations/RLS/CAS;
- model/local-cloud fallback;
- connector ingress/outbound delivery;
- browser/computer-use replay and domain policy;
- coding shell/filesystem surfaces;
- wallet composition;
- native device capability brokerage;
- credential vault and cloud replacement recovery;
- product schemas for reminders/todos/goals/notes/blocking;
- sub-agent/orchestrator task/workspace execution.

Each is assigned one Masanawa owner in `ELIZAOS.md` and the migration ledgers.

## Closure result

**Unmapped named workspace packages: 0.**
**Unmapped pinned local packages discovered outside named turbo task keys: 0.**
**Known runtime plugin references incorrectly treated as local source: 0.**
**Unresolved canonical-authority conflicts: 0.**

This closes the repository-family proof requirement. It does not mean Masanawa will copy every elizaOS implementation. A/B/C disposition remains feature-by-feature, and all production implementation must pass the acceptance gates recorded in `ELIZAOS.md`.
