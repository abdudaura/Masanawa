# R14 — Firebase push delivery resilience (2026-10-08)

- **Owner/window:** ChatGPT R14 independent production notification lane
- **Branch:** `work/r14-fcm-delivery-resilience-20261008`
- **Base main SHA:** `f91519fb05ae6b244ba9a721479aada03e7e08ba`
- **Task:** R14 notification reliability, privacy and recovery; do not claim device/deployment acceptance.
- **Last repository-visible work:** 2026-10-08T05:47:49.090Z
- **Exact owned paths:** `services/gateway/src/mobile_push.ts`, `services/gateway/src/mobile_push.test.ts` (new), `docs/workstreams/r14-fcm-delivery-resilience-20261008.md`.
- **Shared contracts:** Existing MobilePushSender and MobilePushRepository; no changes to their signatures, gateway composition, package exports, migrations, mobile shell or other windows' paths.
- **Current step:** Existing server FCM sender inspected; a transient non-2xx per-device response currently gets silently counted as delivered=0 with no retry, OAuth calls race, no explicit transport-error handling. Implement bounded, classification-aware delivery/retry, preserve privacy and fail-closed auth semantics, add focused deterministic tests.
- **Implementation:** IN PROGRESS.
- **Verification:** Not yet executed. GitHub main Foundation CI reported failure; no application-specific diagnosis claimed.
- **Deployment/device qualification:** BLOCKED on configured Firebase client/server project, Android/iOS device checks and production push credentials. Never claim R14 done from code alone.
- **Handoff:** PR will contain exact committed SHA/tests and explicitly separate code, CI, deployment and device evidence.
