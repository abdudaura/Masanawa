# AF15 private media access — execution and SHA-specific handoff (2026-10-10)

**Window:** MASANAWA-01 / AF15 private-media-access
**Five-minute CAS claim:** factory/claims @ 5f13a80be062345e623b9fe6c311c2b7d90f136a, read back at that immutable SHA
**Base main SHA:** f381f077c485c04261459b77a42c215d3ce3a14b
**Source and test checkpoint:** ce534423873f9059eac9e2e80219f4ce44dce804
**Branch:** work/af15-private-media-access-20261010-masanawa01
**Status:** PARTIAL_IMPLEMENTATION. This slice is implemented and locally unit-tested, but has no integrated authenticated route, DB-backed permission resolver, actual signer, or provider/device/restore verification.

## Exactly owned paths

- services/gateway/src/media_lifecycle/private_access.ts
- services/gateway/src/media_lifecycle/private_access.test.mjs
- docs/workstreams/AF15-private-media-access-20261010.md

No root composer/router, worker startup, financial authority, schema registry, existing object adapter, lockfile, native file or deployment configuration changed.

## Contract and behavior

AF v1 private-media lifecycle and backend/storage operations requirements; supporting DB-A media access/revocation gate, UX-A08/A10/A11 media/room/chat privacy acceptance and PF-A01 privacy gating. Server-sourced principal -> authoritative current membership/visibility/block/deletion decision -> signed URL limited to 5–60 s (default 30 s) and HTTPS configured signer host -> recheck current access revision and object key after signing -> deliver with private/no-store metadata. Denial maps to a non-enumerating not_found. Backend/signer outages map to temporarily_unavailable. No object key, caller identity, or signer host is authorized from client parameters.

The access revision MUST change on membership, block, deletion and media replacement; sign callback MUST obey the requested TTL. A revocation cannot revoke an already-issued presigned URL: its residual risk window is limited by TTL and object-store/cache configuration. A real route MUST set HTTP Cache-Control: private, no-store; the returned metadata alone cannot enforce HTTP headers.

## Executed checks

- Node v22.16.0: node --experimental-strip-types --test /mnt/data/private_access/private_access.test.mjs — PASS 10/10, native Node test runner. Simulated authoritative signer/DB; no real provider.
- TypeScript: tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck /mnt/data/private_access/private_access.ts — PASS.
- GitHub file readback: exact uploaded source bytes matched local tested files (4878 and 3578 bytes respectively).
- DB/provider/device/whole-Gateway build, real signed URL TTL and resource revocation: NOT_RUN. Container cannot access github.com through DNS, so full monorepo checkout/test unavailable here.

## Unfinished integration and safety gates

AF00 must elect the canonical media route and integrate the existing identity/session resolver; media-domain owners must implement authoritative DB membership/hold checks and revision changes, configure object namespace and service signer, apply HTTP no-store headers and account-fenced errors. Do not expose this service until those real implementations and negative integration tests exist. Confirm S3/URL caching behavior, IDOR, block/member removal, stale URL expiry, multi-account and media replacement against live resources. No SQL migrations, deployment changes, live object deletion, paid providers or data writes were performed.

A completed composition needs new access-control and private URL E2E proof plus DB/object backup/restore per docs/BACKEND-STORAGE-OPERATIONS-20261009.md. Keep this source on a non-deploying integration target if production deployment on main remains uncertain. This commit alone is NOT VERIFIED_E2E nor DEPLOYED_VERIFIED.

## Other lanes preserved

The overlapping AF15 orphan sweep branch work/af15-orphan-cleanup-20261010-masanawa01 advanced during this session; it was neither overwritten nor rebased. AF15 media cleanup integration branch and other open PR heads remain untouched. This branch uses separate exact paths and a separate ownership claim.

## Immediate next action

Review source + unit tests and merge into a safe, non-deploying integration target when dependency checks allow. AF00 integrates an authenticated access route after schema/adapter ownership handoff; AF13 adds real security/media evidence. Production cutover requires signing-provider and revocation tests; none were claimed.
