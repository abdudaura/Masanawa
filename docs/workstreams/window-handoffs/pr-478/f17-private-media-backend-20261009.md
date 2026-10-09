# F17 / C04 — Private voice backend verification and recovery

Updated UTC: 2026-10-09T01:32:30Z. Autonomous Work window 88b2711eedab.
Existing draft PR: https://github.com/Baatiku/masanawa/pull/478
Existing branch: work/c04-private-voice-notes-20261008
Inspected current main: 5e758673ae91082520b21b3153da53791ae2cbf3
Original preserved C04/F17 branch head: 9cd1f2f4dcd97a377cf40326d6faa9dc6129a333
Latest tested source: c5422d84d4489335dab2b56b86bc132746f3cf0b
Final handoff-only commit SHA is recorded in the PR body.
Status: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED.

## Ownership and source accounting

Continuing existing C04 source after five-minute lease expiry, not creating another media backend.
Repository-visible claim preceded edits: https://github.com/Baatiku/masanawa/pull/478#issuecomment-6072285552
Scope extensions for codec fixture, route caching, Work storage reconciliation and runtime cleanup are recorded in the same PR discussion.
Exact modified source/test paths are the eleven files below plus this handoff.
Read current CONTINUE-HERE, unfinished reconciliation, expanded U/F allocation, execution workbook, ownership and C04 media contract. F17 branch search found no competing F17 branch. Compared all media module blobs against Work #497. Service/parser/runtime/routes matched; preserved and carried forward Work's existing S3 byte-body/test typing fixes instead of overwriting them with old C04 copies.
Original recorder lifecycle files/tests and all Flutter code remain intact.
No shared app/main, migration manifest, root router/tab, Firebase, ledger, native or production changes.
Lease checkpointed and available to coordinated integration/review owners.

## Implemented functionality

- service.ts / service.test.ts: snapshot validated upload bytes before repository waits; actual stored GET/size/SHA-256/Ogg/duration verification before SQL attachment and 201 success; current same-tenant/person session recheck after staging, upload/readback, attachment, history query, playback read and deletion. Late revocation prevents bytes/private metadata or a success receipt. An already attached send is not falsely described as undone; original request remains the sole retry identity. Malformed journal hashes/duration mismatch yield safe corruption errors.
- ogg_opus.ts / ogg_opus.test.ts / ogg_opus_test_fixture.ts: preserve existing one-stream mono container policy, CRC/size/page limits; reconstruct lacing continuation, enforce consistent flags/header order, bounded comment lengths/count, RFC 6716 frame count/length/padding and 120ms packet duration. Independently bound decoded work so forged final granules/end trimming cannot conceal excessively long playback. Account for initial granule offset and legitimate preskip/trimming. Fixture now contains enough actual 20ms packets for its stated seconds, not one 20ms packet with fabricated granule duration.
- routes.ts / routes.test.ts: route-local no-store/private and nosniff for success and error responses across upload/history/playback/delete. No global Gateway hook. Real Fastify GET returns verified attachment; revocation during object I/O returns JSON 401 without private bytes or filename disposition.
- private_s3.ts / private_s3.test.ts: preserve exact Work #497 typed bounded request body; reject NaN/infinite/fractional read bounds before provider access; cancel unused PUT/DELETE and failed GET response bodies; retain existing signing/SSE/redirect denial/stream bounds.
- runtime.ts / runtime.test.ts: report returned failed GC counts through the existing payload-free failure signal, as well as thrown exceptions. Failure of metrics callback cannot stop retries; existing single-flight/startup/timer/shutdown behavior preserved.

Sources: RFC 7845 §§3–5 (https://www.rfc-editor.org/rfc/rfc7845) and RFC 6716 §3.2 (https://www.rfc-editor.org/rfc/rfc6716). Parser validates framing/duration, not full Opus entropy decoding or antivirus qualification.

## Executed evidence

Node 24.19.0, Vitest 5.0.3, Fastify 5.12.5, TypeScript 5.9.3 with actual main contracts/security/events restored read-only:
**5 files / 41 tests passed / 0 failures / 0 skipped**.

```sh
ffmpeg -v error -f lavfi -i sine=frequency=440:duration=1 -ac 1 -c:a libopus /tmp/masanawa-f17-real.ogg -y
MASANAWA_C04_REAL_OGG=/tmp/masanawa-f17-real.ogg pnpm exec vitest run services/gateway/src/human_media/service.test.ts services/gateway/src/human_media/ogg_opus.test.ts services/gateway/src/human_media/routes.test.ts services/gateway/src/human_media/private_s3.test.ts services/gateway/src/human_media/runtime.test.ts --maxWorkers=1
```

Real independently encoded one-second Ogg is accepted; ffprobe identified Opus, 48kHz, mono (encoded stream duration includes 312-sample preskip). Parser returns 1000ms playable duration.
Temporary filesystem test performs real write -> stored readback -> playback -> corruption rejection. Metadata/auth/contact/storage HTTP policy tests otherwise use injected doubles; no actual PostgreSQL/provider/device claim.
Covered forged short granules, continued packets/comments, correct CRC adversarial framing, frame count/padding/length, oversized bodies, bound misuse, current-session revocation/account change, private HTTP headers, GC retry/single-flight/shutdown/failure signal.
One new test had a syntax error on its first run; corrected before the passing checkpoint. No failure hidden.
All 11 modified local source/test blobs exactly match published Git blobs at tested source SHA.

Strict TypeScript passed all 14 isolated module/test files (model, service/test, parser/test/fixture, routes/test, S3/test, runtime/test, composition and postgres_repository) under current main compiler options:
```sh
pnpm exec tsc --noEmit --strict --target ES2024 --lib ES2024 --module NodeNext --moduleResolution NodeNext --verbatimModuleSyntax --isolatedModules --exactOptionalPropertyTypes --noUncheckedIndexedAccess --noImplicitOverride --useUnknownInCatchVariables --forceConsistentCasingInFileNames --types node services/gateway/src/human_media/model.ts services/gateway/src/human_media/service.ts services/gateway/src/human_media/service.test.ts services/gateway/src/human_media/ogg_opus.ts services/gateway/src/human_media/ogg_opus.test.ts services/gateway/src/human_media/ogg_opus_test_fixture.ts services/gateway/src/human_media/routes.ts services/gateway/src/human_media/routes.test.ts services/gateway/src/human_media/private_s3.ts services/gateway/src/human_media/private_s3.test.ts services/gateway/src/human_media/runtime.ts services/gateway/src/human_media/runtime.test.ts services/gateway/src/human_media/composition.ts services/gateway/src/human_media/postgres_repository.ts
```

These are focused runtime/HTTP/scoped build checks, not the full application/real database/native qualification.

## Remaining integration and blockers

1. Work #497 elected composer must preserve these source commits and mount the existing installHumanVoiceModule only with canonical C01/C02 authorizer/membership/pool and qualified private S3. Existing installation remains opt-in and shared Gateway files are untouched.
2. F11 must qualify one 0016 -> 0017 -> 0018 migration sequence and original guarded PostgreSQL tests; no numbered migration or schema was changed here. C02 #472 vs #475 source election is still shared integration work.
3. F12/C02 must embed the existing C04 panel in the actual human thread. C03/C05 own restart-persistent encrypted media outbox and ordering; current in-memory pending recording is not process-kill recovery.
4. R12/F08 must drain admitted/uncertain uploads and qualify provider physical erasure, including retained versions/replicas, before profile/media FK deletion. Existing GC DELETE acknowledgement is not a standalone retention/version-erasure proof; late-PUT/deletion races need actual coordinated write-drain/provider qualification. Preserve durable erasure journal/guard.
5. Stored-content readback adds bounded provider GET before attachment: qualify client/upload/receive timeouts, weak-network uncertain status, retry identity and provider consistency/latency. Do not infer a cancelled message solely from lost 401/timeout after attachment.
6. Flutter/Dart SDK, Android mic/codec, iOS codec, two-user devices, LiveKit/Gemini/recorder focus, background/kill/logout tests, private bucket ACL/SSE/live S3 and real PostgreSQL server checks remain unavailable/unexecuted. Runtime rejects the user switch needed to initialize a downloaded local PG binary; no production server was touched.
7. Full Gateway workspace build, Actions #457 and deployed end-to-end evidence remain distinct. No paid CI retries or production modification.

Original recorder handoff: docs/workstreams/f17-private-recorder-lifecycle-20261009.md.
Canonical media contract: docs/contracts/HUMAN-DM-MEDIA-C04.md.
Backend source is tested at the scoped level; full C04/F17 remains PARTIAL_IMPLEMENTATION. No merge, deployment, financial change, branch deletion, spending or DONE claim.
