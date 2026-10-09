# Development rules

Current rules: [AGENTS.md](../AGENTS.md), [coordination](MULTI-WINDOW-WORK.md), [AF allocation](AUDIO-FIRST-WINDOW-PLAN-20261009.md). Historical phase/U/R/C launch sequences are recovery references, not active scheduling.

Use domain logic in packages, transport/orchestration in services, presentation in apps and external effects behind qualified providers/tools. Reuse contracts and parity fixtures; donor/reference source is not a runtime boundary. Respect dependency/provenance/license rules.

Validate configuration at startup. Keep secrets out of source. Use typed errors and correlation IDs, exact amounts, idempotent effects, bounded retries, recovery and reconciliation. Models do not authorize consequential actions.

Never change applied migrations. AF00 owns ordering/registration; new financial/auth/media functionality requires appropriate migration and negative tests. Preserve Firebase and signing identity.

Use docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md for native vs Dart-only delivery. Do not patch native/plugin/asset differences through OTA bypasses.

Merge source-tested dependency-ready work into a safe target promptly; release qualification is separate. Do not claim completion without immutable evidence or delete unfinished source during documentation cleanup.
