# F13 avatar session-fencing handoff — 2026-10-09

Status: PARTIAL_IMPLEMENTATION for full F13; this bounded backend slice is locally tested.

Claim: PR435 comment6072451866. Owner Work88b2711eedab. Base main5e758673ae91082520b21b3153da53791ae2cbf3. Continues existing branch work/r18-avatar-end-to-end-20261008; preserves uncertain-write recovery head5bd0fcf7b761340b11721075b239cc74f1cb2d50 and staging lease source990af05f101a6d0086be994418022523bc861ac3.

Files: services/gateway/src/profile_avatar/{service.ts,service.test.ts,routes.ts,routes.test.ts}. Reauthorize after normalization, SQL read, staging, object PUT, attachment/removal. Reject changed tenant/user. Revoked session cannot start the next protected mutation. Revocation after committed SQL means a lost receipt, never a claimed rollback. Staged uploads remain recoverable by the existing journal. Route-local private/no-store and nosniff headers include successful and rejected HTTP requests.

Executed: Node24.19.0, Vitest5.0.3, Sharp0.35.5. `vitest run services/gateway/src/profile_avatar/{service,routes,normalizer,s3_store}.test.ts --maxWorkers=1`: four files,36 tests passed,zero failures/skips. Includes real Sharp PNG→512x512 opaque WebP decoding, metadata stripping, size/format bounds,13 session-revocation/account-change regressions, real Fastify inject and mocked S3. Main canonical normalizer/S3 source used read-only; not duplicated in this change.

Not executed: full TypeScript build, real PostgreSQL races, Flutter/Android avatar/device/gallery/camera, real S3/CDN. Full F13 handle rename still requires alias/reference migration. Shared Gateway/migration integration remains a qualification requirement. No production mutation or deployment. Rollback: revert four-file source change; no schema changes. Release gates: source yes,local focused tests yes; CI/DB/device/provider/deployed/merged no or unverified. PR remains draft/unmerged. Final source SHA is linked by the PR checkpoint comment (self-reference cannot be included in its own commit).
