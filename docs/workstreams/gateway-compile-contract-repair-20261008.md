# Gateway compilation contract repair

Owner: Gwani production investigation window.
Base: 8c7afe92b754c59e68a2559cdff15db744241783
Branch: work/gateway-compile-contract-repair-20261008
Owned paths: services/gateway/src/app.ts (directory presence schema only); services/gateway/src/talk_ai_worker/postgres_stage_repository.ts (method parameter typing only); services/gateway/src/talk_gift_routes.ts (optional catalogItemId forwarding only); this record.
Evidence: approved Railway e240dd14 build fails TS2322 directory unknown presence/schema mismatch, TS7031 contextual typing lost through Object.freeze, TS2379 explicit undefined catalogItemId.
No changes to domain rules, auth, money execution, SQL/migrations or mobile lanes. PR430 paths do not overlap. R09/R10 already merged.
Current step: strict type/response contract repair, then actual Railway build qualification.
Updated: 2026-10-08T05:37Z.
