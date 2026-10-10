# J11 fan memory acceptance — NOT RUN
Run against disposable PG18 with applied canonical identity+memory migrations and the forward-only fan-memory migration. Test consumer and Admin on Android.
1. A opts in for one Masana; a source-message-verified ordinary preference is saved with 180-day TTL in existing memory.records and later retrieved only for A.
2. B shares the Masana: all B reads, prompts and messages must NOT include A's content. A disabled state must hide old stored content and block in-flight extraction at final transaction fence.
3. A deletes a single memory and all memories separately: request is durable/idempotent; only existing approved canonical tombstone can mark completed; retry and worker crash must never produce double deletion or lost request.
4. Tenant, user, character, record and account-switch authorization negatives; 401/403/409/503, stale revision, offline/cancel/retry.
5. Admin sees only aggregates; a detailed read must require data-officer privilege, explicit purpose and audit.
All above are release checks, NOT assertions of passing behavior. AF00 alone composes gateway, worker, mobile/admin router and migration registry. Source requires live PG18, Flutter and Android evidence.
