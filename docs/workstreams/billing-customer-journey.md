# Billing customer journey completion

User assignment: finish billing services before APK compilation, continuing the verified Flutterwave fixed-IP relay work.

Base: integration-flutterwave-webhook-live 78b53596ad6a0bd36d45e258d2c26b23c25f49fa.

Own narrowly scoped billing fixes in packages/providers/src/flutterwave-bills/client.ts, commerce-orchestrator.ts and their tests; new billing checkout files in packages/commerce, Gateway and Postgres; financial_billing.ts and tests; coordinated billing-only route/wiring edits in Gateway app.ts/main.ts. Resume our Flutterwave proxy operational files when needed.

Do not edit apps/mobile, crypto, clone onboarding, messaging, existing float-owned Commerce files, or overwrite other workstream changes. Mobile shell integration depends on its owning workstream. Billing must require verified customer funds and explicit quote confirmation before provider dispatch; never mix NGN with AI Credits. Ambiguous outcomes reconcile without a second purchase. No further live purchase is authorized beyond the already completed single NGN100 Airtel test.

Status: active; customer billing remains disabled until the integrated checkout and authorization checks pass.
