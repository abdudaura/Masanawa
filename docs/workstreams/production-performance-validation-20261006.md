# Production performance/load/backpressure/fleet validation — Task 146

Owner/window: current ChatGPT continuation window — Task 146
Branch: `work/production-performance-validation-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 146 — performance/load/backpressure/realtime-latency/fleet capacity validation.

## Exact owned paths

- `scripts/performance-qualification.mjs` (new)
- `scripts/performance-qualification.test.mjs` (new)
- `docs/workstreams/production-performance-validation-20261006.md`

## Explicitly excluded/shared paths

- Gateway/Worker/Presence/Device implementation and PR #136;
- production environment, deployment/scaling config and provider infrastructure;
- load generation against production systems;
- Telemetry package/runtime ownership;
- alerts/SLO incident operations (Task 147);
- backup/restore/DR (Task 148);
- pilot/cutover/release Tasks 149-150.

## Implementation boundary

- validate externally measured performance evidence rather than simulate production success;
- require bounded named scenarios covering HTTP/API latency, realtime latency, backpressure/saturation and fleet capacity;
- compute deterministic percentile/throughput/error/drop/rejection summaries from raw samples;
- enforce explicit threshold profiles with no hidden defaults that can silently pass missing dimensions;
- require sample count/duration/concurrency metadata and reject malformed, NaN/negative, duplicate or incomplete evidence;
- treat intentional backpressure/rejections separately from unexpected errors/drops;
- fleet qualification must prove assigned capacity, ready capacity, utilization headroom and failure reserve;
- output machine-readable ACCEPTED/INCOMPLETE/FAILED qualification suitable for later production-like pilot evidence;
- no live traffic generation, deployment mutation or fabricated production pass.

State: CLAIMED. Implement the deterministic qualification harness and regression tests; real load/realtime/fleet evidence remains external execution.
