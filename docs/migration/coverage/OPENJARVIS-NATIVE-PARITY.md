# OpenJarvis Python/Rust Native Parity Boundary

Pinned source: `open-jarvis/OpenJarvis@c4da16e1ca3d21f4cc1905d4200063e564104f0f`

Status: COMPLETE FOR PHASE 0B

OpenJarvis contains overlapping Python and Rust implementations. Masanawa must not preserve both as independent production authorities.

## Decision

TypeScript/Masanawa contracts own semantics. Native code may later accelerate bounded algorithms only when:
- the canonical contract is already fixed;
- a parity suite proves equivalent security/behavior;
- native unavailability has a safe fallback or the capability fails closed;
- native state is not independently durable.

## Overlap matrix

| Capability | Python evidence | Rust evidence | Masanawa treatment | Parity requirement |
|---|---|---|---|---|
| agent loop guard | `src/openjarvis/agents/loop_guard.py` | `rust/crates/openjarvis-agents/src/loop_guard.rs` | B behavior, optional native acceleration | identical-call, ping-pong, poll-budget and reset semantics must match; security/budget policy remains TS-owned |
| agent strategies | `agents/native_react.py`, `native_openhands.py`, `orchestrator.py`, `simple.py` | corresponding files in `openjarvis-agents/src` | C/B algorithm reference | no dual executor; only one Masanawa AgentRun authority |
| tool execution | `tools/_stubs.py`, calculator/file/git/http/shell tools | `openjarvis-tools/src/executor.rs`, `builtin/**` | TS tool contracts authoritative; native helper optional | schema/result/error/timeout/security policy parity; approvals remain outside native helper |
| retrieval/storage | Python storage backends under `tools/storage/**` | Rust storage modules BM25/ColBERT/FAISS/hybrid/SQLite | C/B algorithm/provider candidates | indexes remain rebuildable; no native DB becomes canonical memory/knowledge truth |
| SSRF/security | `security/ssrf.py` and other security modules | `openjarvis-security/src/ssrf.rs`, capabilities/file_policy/guardrails/injection/rate_limiter/taint | A behavior; direct native reuse only with exhaustive parity | private/metadata/disguised-IP/DNS-fail-closed cases must match or fail more conservatively |
| inference engines | Python `engine/**` | `openjarvis-engine/src/{discovery,ollama,openai_compat,vllm,sglang,llamacpp}.rs` | C/B provider implementation candidates | ADR-0010 operation/readiness/result contract is authoritative; no independent engine registry |
| traces | `traces/**` | `openjarvis-traces/src/**` | B telemetry implementation candidate | correlation, step ordering, redaction and unsubscribe/run boundaries must match |
| telemetry | `telemetry/**` | `openjarvis-telemetry/src/**` | B native metrics collection candidate | native metrics are observations only and cannot alter execution authority |
| learning | `learning/**` | `openjarvis-learning/src/**` | C/B research/acceleration | candidate-generation only; Masanawa evaluation/certification/activation remains canonical |
| scheduler/session/skills/workflow | Python full implementations | Rust crates mostly thin/partial | Python evidence used for donor behavior only; Rust not adopted as authority | if native implementations later mature, they must pass canonical workflow/session/skill parity before use |
| MCP/A2A | Python protocol/adapters | Rust `openjarvis-mcp`, `openjarvis-a2a` | B interoperability adapters | canonical Tool/Agent admission and security precede protocol registration |
| Python bridge | Python runtime imports Rust opportunistically | `openjarvis-python` crate | C implementation detail | Masanawa does not reproduce a Python↔Rust authority split |

## Fail-safe rule

For security-sensitive capabilities, a native backend is never allowed to weaken behavior when unavailable or inconsistent. OpenJarvis's SSRF path is a useful precedent: the Python implementation remains security-active if Rust is unavailable rather than silently skipping the check.

## Direct-reuse gate

No OpenJarvis Rust crate is approved for direct Masanawa dependency during Phase 0. A future performance ADR must name:
1. the exact crate/module;
2. the canonical TS contract;
3. benchmark justification;
4. parity/security tests;
5. fallback/failure behavior;
6. license/NOTICE treatment.

This closes the Phase 0B Python/Rust dual-authority risk without prematurely choosing a native implementation.
