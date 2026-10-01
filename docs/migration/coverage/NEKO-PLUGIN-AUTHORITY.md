# N.E.K.O Plugin State Authority Map

Pinned source: Project-N-E-K-O/N.E.K.O@48ac9243a9d8e75a37d7598548c29017df1c6d2e

Status: COMPLETE FOR PHASE 0B

N.E.K.O's plugin subsystem is large enough to become a hidden second platform if copied structurally. This map fixes ownership before any adaptation.

| Donor state / subsystem | Evidence | Masanawa owner | Treatment |
|---|---|---|---|
| plugin registry / installed package metadata | plugin/core/registry.py, plugin/server/application/plugins/registry_service.py, install_registry.py | packages/plugins | redesign into canonical PluginManifest + Installation records |
| runtime intent / running-stopped state | plugin/core/state.py, status.py, lifecycle services | packages/plugins runtime | preserve explicit stopped/running intent; process state remains runtime only |
| install/replace/source-switch transaction | installation_transactions/**, source_switch.py, hot_reload_service.py | plugins + workflows | preserve transactional semantics as D-PLG-020 |
| operation lock / lifecycle serialization | operation_lock.py, lifecycle_service.py | plugins runtime | preserve single-operation/current-authority behavior |
| plugin config | config command/query/hot-update services + infrastructure config_* | packages/plugins/config | split declared plugin config from secrets; no free-form config file becomes global truth |
| secrets/provider credentials | model gateway/config paths where provider tokens appear | packages/security + providers | vault refs only; raw secrets never canonical plugin state |
| model usage store / model config store | plugin/server/infrastructure/model_usage_store.py, model_config_store.py | providers/telemetry | usage is telemetry; provider config normalized under packages/providers |
| plugin-to-plugin message plane | plugin/message_plane/**, messaging handlers | plugins/events | ephemeral typed transport; D-PLG-021 trace only, never durable domain truth |
| bus messages/conversations/memory facades | plugin/core/bus/**, messaging handlers for memory/messages/user_context | canonical events/relationships/memory | facade/adapter only; plugin bus cannot own messages, memory or user context |
| autostart approvals | plugin/server/infrastructure/autostart_approvals.py | workflows/security | explicit current approval policy required; donor remembered approval cannot bypass current authority |
| UI manifest/hosted UI state | ui_manifest.py, sdk hosted-ui, frontend plugin-manager | apps/ops/client extension registry | presentation metadata only |
| development/build/install artifacts | neko_plugin_cli/**, development artifacts/build services | developer tooling | C/B tooling; not runtime authority |
| logs/monitoring/metrics | plugin server logs/monitoring | telemetry | observability only |
| run records / IPC run service | application/runs/**, plugin/runs | workflows/telemetry | execution evidence; canonical workflow/task state remains outside plugin runtime |
| plugin-owned storage SDK | plugin/sdk/shared/storage/** | plugin-scoped storage adapter | allowed only for plugin-private cache/state; cannot hold canonical identity/memory/workflow/business truth |
| adapter gateway contracts | plugin/sdk/adapter/** | gateway/plugins | compatibility registration only; canonical Gateway routing/identity remains external |
| plugin LLM tools | messaging/llm_tool_registry + sdk llm_tool | packages/tools | register canonical Tool definitions; plugin cannot bypass tool policy |
| source/package ownership metadata | install_source manager/models/scanner/reconciler | packages/plugins/security | preserve provenance/source revision/trust evidence |
| server HTTP routes/control plane | plugin/server/routes/**, http_app.py | apps/ops/services | donor API surface retired; future Ops API calls canonical package services |

## Non-negotiable authority rule

A N.E.K.O plugin process may own only:
- its ephemeral process/runtime state;
- plugin-private cache/state explicitly marked non-canonical;
- provider/session handles granted by the host.

It may not own:
- Character or user identity;
- relationship memory;
- world state;
- workflow/task truth;
- commerce/payment truth;
- channel routing truth;
- provider credentials;
- approval authority.

## Hot-reload rule

Replacement is not a file-copy operation. The canonical lifecycle is:
validate source -> verify ownership/provenance -> acquire operation authority -> stage candidate -> preflight -> drain/stop old runtime when safe -> switch active installation -> start if current desired intent says running -> record receipt.

Any failure before committed switch leaves the prior healthy installation active. Any failure after switch creates rollback/needs-attention evidence.

This closes the risk that N.E.K.O's plugin server becomes a second application kernel inside Masanawa.
