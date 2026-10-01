# ChatWithStars Supabase Migration Coverage

Pinned source: `Baatiku/chatwithstars@3ab02704118ce3d8f38a423c9a52e9d44a705aeb`

Status: ACTIVE REMEDIATION

The donor contains 381 migration files. This document prevents the old mistake of treating `supabase/migrations` as a single covered root.

## Primary migration families

The following families are already mapped by explicit semantic evidence in the Feature/Data/Behaviour ledgers:

- agent/Character/version/binding/publication/rehearsal;
- memory/contact identity/context/knowledge;
- missions/work/routines/handoffs/commitments;
- life/canon/world/group;
- skills/capabilities/JEV decisions;
- commerce/wallet/billing/Flutterwave/refunds/chargebacks/subscriptions;
- social/channel/presence;
- civic truth/pulse/elections;
- operations/privacy/security/acceptance.

A filename may belong to multiple semantic families. Migration ordering is historical evidence, not the Masanawa package boundary.

## Previously-unclassified migration disposition

These files were missed by the old keyword/root sweep. They are now explicitly classified.

### Core platform, tenancy, relational integrity — A/B

Canonical destinations: identity, relationships, tenancy, gateway, security, database migrations.

- `0001_platform_core.sql` — foundational tenant/session/contact/conversation/message/memory/commitment/policy schema. Preserve semantic invariants, redesign schema around Masanawa canonical owners.
- `20250120110000_create_advanced_mgmt.sql` — historical management/control surface; preserve only still-valid control semantics.
- `20260809_saas_users.sql`
- `20260809_saas_tenancy.sql` — tenant-scoped uniqueness over legacy automation tables; preserve tenant-isolation behavior, not table names.
- `20260901174800_people_runtime_integrity.sql`
- `20260901175621_people_performance_cleanup.sql`
- `20260909191000_core_tenant_relationship_isolation.sql` — A security invariant.
- `20260919102000_unified_service_fk_indexes.sql`
- `20260922103000_creator_platform_mode_and_onboarding.sql`
- `20260923003500_require_exact_dashboard_release.sql` — Ops/release evidence, not domain state.
- `20260927070752_chatra_evidence_projection_contracts.sql`

Acceptance: cross-tenant foreign keys/uniqueness fail closed; no legacy table becomes a second identity/relationship authority.

### Legacy automation/social scheduler lineage — B/C

Canonical destination: `services/social` + workflows; retire old Omni tables after migration.

- `20240120_create_queue.sql` — atomic claim via `FOR UPDATE SKIP LOCKED`, retry count, stale-lock recovery. Behavior B; legacy `star_queue` schema C.
- `20250126_create_cron_job.sql` — scheduler deployment reference C/B.
- `20251231_omni_bot_configs.sql`
- `20260809_drip_reliability.sql` — per-destination in-flight claim and freshness snapshot; behavior A/B.
- `20260809_review_queue.sql` — manual-review setting/state; behavior A.
- `20260810_dubbing.sql` — per-destination dubbing preference; B.
- `20260810_profile_destinations.sql`
- `20261001002500_secure_retired_omni_bot_claims.sql`
- `20261001004600_secure_retired_omni_bot_tables.sql`
- `omni_bot_add_split_columns.sql`
- `omni_bot_master_schema.sql`
- `omni_bot_settings.sql`

Acceptance: queue claim is atomic; stale claims recover; destination dedupe survives restarts/redeploys; retired Omni tables are never queried by canonical Masanawa runtime after migration.

### Gemini/community capacity and quota lineage — B/C

Canonical destinations: providers, entitlements, ops. Old provider-pool schema is not canonical.

- `0009_enforce_gemini_pool_membership.sql`
- `20260901191200_unlimited_community_gemini_sharing.sql`
- `20260901191300_normalize_legacy_gemini_share_limit.sql`
- `20260901192500_unlimited_community_borrowing.sql`
- `20260915142500_enforce_gemini_four_rpm.sql`
- `20260925054500_simplify_gemini_pool.sql`
- `20260906010248_tenant_spend_cap.sql`

Acceptance: provider quota/capacity can throttle routing but cannot redefine user entitlement, Character identity, or tenant ownership.

### Conversation, service notification and continuity lineage — A/B

Canonical destinations: relationships, gateway, memory, workflows.

- `20260901152745_restore_search_conversations_rpc.sql`
- `20260901173850_bootstrap_failure_status_compatibility.sql`
- `20260901221214_conversation_pending_threads_conversation_fk_index.sql`
- `20260901230500_conversation_brain_sessions.sql`
- `20260901231000_conversation_brain_fk_indexes.sql`
- `20260903080500_owner_first_response_grace.sql`
- `20260909190000_service_customer_notifications.sql`
- `20260909200500_service_customer_notifications.sql`
- `20260911051000_remove_duplicate_service_notification_index.sql`
- `20260917101839_owner_communication_kill_switch.sql`
- `20260917222500_transactional_clear_conversation_history.sql`
- `20260921152000_service_clarifications.sql`
- `20260921234500_customer_concierge_front_desk.sql`
- `20260922003000_specialist_continuity_state.sql`
- `20260922011500_specialist_continuity_source_ids.sql`

Acceptance: clear-history is transactional and scope-bounded; kill switch is durable; specialist continuity is source-bound and cannot leak another relationship's private state.

### Commerce, accounting, funding and reseller lineage — A/B/C

Canonical destination: `packages/commerce` + workflows + ops.

- `20260906010247_money_ledger.sql` — append-only financial event evidence A.
- `20260909183500_vtpass_service_orders.sql` — durable provider order/reconciliation behavior A; provider itself currently retired/reference.
- `20260909191000_owner_product_catalogue.sql`
- `20260913184250_generic_creator_order_execution.sql`
- `20260918170500_financial_adjustments.sql`
- `20260921150500_creator_business_ledger.sql`
- `20260921151500_creator_balance_funding_and_plan_spend.sql`
- `20260921152500_creator_service_cost_balance.sql`
- `20260921154500_creator_earnings_settlement.sql`
- `20260922111500_creator_reseller_sale_settlement.sql`
- `20260922115300_idempotent_plan_checkout.sql`
- `20260922115800_completed_plan_checkout_is_paid.sql`
- `20260922122000_creator_data_resale_inventory.sql`
- `20260922122500_creator_data_inventory_lot_allocations.sql`
- `20260922123000_immutable_creator_data_pack_orders.sql`
- `20260922123500_creator_funding_safety_state_machine.sql` — provisional funding, maturity, chargeback debt, recovery A.
- `20260922123500_restore_creator_data_inventory_lot_allocator.sql`
- `20260922125000_reconcile_creator_debt_recovery_sources.sql`
- `20260922125500_creator_debt_cash_credit_guard.sql`
- `20260922131000_exact_order_funding_resume.sql`
- `20260922133000_service_order_reseller_economics.sql`
- `20260923008500_reconcile_stale_funding_provisioning.sql`
- `20260923101500_immutable_collection_fee_evidence.sql`

Acceptance: money evidence append-only; funding not spendable before verified/mature; retries keyed/idempotent; ambiguous provider outcomes reconcile; failed/chargeback paths release or recover exactly once.

### Security, RPC hardening and production-readiness lineage — A

Canonical destination: security + ops + provider adapters.

- `20260910052915_harden_internal_trigger_functions.sql`
- `20260918171500_operational_completeness_primitives.sql`
- `20260918180500_authenticated_rpc_hardening.sql`
- `20260918204000_normalize_public_table_privileges.sql`
- `20260922222500_require_egress_fingerprint_match_in_readiness.sql`
- `20260922230000_bind_webhook_registration_to_secret_fingerprint.sql`
- `20260922231500_require_current_webhook_receiver_observation.sql`

Acceptance: public/authenticated roles cannot invoke service-only mutations; production readiness is tied to current observed credentials/egress/webhook fingerprints and invalidates stale acceptance automatically.

### Community/teaching lineage — B

Canonical destination: optional teaching vertical + relationships/workflows.

- `20260910064000_community_memberships_and_teaching.sql`
- `20260910065000_durable_teaching_delivery.sql`
- `20260926102801_teaching_mastery_profiles.sql`
- `20260926110831_teaching_study_sessions.sql`
- `20260926111237_teaching_study_sessions_authenticated_read_only.sql`

Acceptance: mastery/study state belongs to the learner relationship/teaching workflow, not global Character identity; only one active scoped study session where policy requires it; read/write authorization enforced.

### Civic lineage — B

Canonical destination: optional civic vertical.

- `20260914220500_unigeria_citizen_engagement.sql`
- `20260921134500_anonymize_presidential_poll_change_history.sql`

Acceptance: privacy-safe aggregates/history; no private participant identity exposure; civic data never becomes generic world truth without its own admission policy.

### Capability compatibility and historical cleanup — C/B

Canonical destination: migration/compatibility tooling only.

- `20260912222741_preserve_existing_optional_capabilities.sql`
- `20260925060000_partner_operating_mode.sql`
- `20260923007500_serialize_wallet_funding_provisioning.sql` and other already-ledgered funding migrations remain commerce A/B.
- duplicate-index/removal and compatibility migrations are historical evidence, not canonical features.

## Remaining migration accounting rule

The migration set is considered fully accounted for only when an automated manifest in the rewrite maps every filename to one or more canonical families or an explicit historical/cleanup exclusion. The lists above close the 85 filenames missed by the previous keyword sweep, but a generated manifest is still required before source closure so future reviewers can prove the count equals the pinned 381 files.
