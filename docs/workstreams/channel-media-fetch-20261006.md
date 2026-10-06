# Messaging channels authorized media fetch — 2026-10-06

Status: active reclaimed channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channels-authorized-media-fetch-20261006`
Base: stale PR #92 head `f6e8dbd1115ec1ceaf803826dc4ff24f44eecdef`

## Reclaimed context

PR #92 is stale under the repository five-minute lease rule. Its authenticated webhook
ingress/outbound/reconciliation implementation is preserved unchanged. This slice continues
one item explicitly listed in #92's handoff: authorized inbound media fetch.

## Exact owned paths

- `adapters/channels/messaging/src/media-fetch.ts` (new)
- `adapters/channels/messaging/src/media-fetch.test.ts` (new)
- `adapters/channels/messaging/src/index.ts` (media-fetch export only)
- `docs/CHANNEL-MEDIA-FETCH.md` (new)
- `docs/workstreams/channel-media-fetch-20261006.md`

## Boundaries

- no Gateway/app/main/storage/migration/Commerce/mobile/deployment edits;
- provider access tokens and provider download URLs stay inside injected authenticated edges;
- provider file ids are transport evidence only and never become canonical file/user authority;
- fetched bytes remain subject to later canonical media/perception admission.

## Goal

Implement a bounded provider-neutral fetch boundary for WhatsApp/Telegram inbound media
with exact channel-account scope, explicit provider rejection, redacted ambiguous failures,
MIME consistency checks, byte limits and SHA-256 evidence hashing.


## Implementation checkpoint

Implemented on draft PR #306.

Exact head: `773606c1884d43db014ee39281908de0f587211e`.

Completed:
- generic authorized media fetcher plus WhatsApp/Telegram constructors;
- exact channel/account/file scope checks before provider access;
- configurable per-kind limits plus hard 64 MiB ceiling;
- provider file-id, MIME syntax and media-kind verification;
- webhook-declared vs fetched MIME conflict detection;
- empty/oversize body rejection;
- defensive byte copy and SHA-256 content evidence;
- stable platform provider-rejection code;
- redacted retryable ambiguous/network failures;
- focused tests for scope substitution, file substitution, MIME/kind mismatch, size
  bounds, provider rejection, network failure, hash evidence and defensive copying;
- package export and integration/security documentation.

Verification:
- PR #306 is mergeable.
- Foundation CI run 37491654640 failed before a downloadable job log existed.
  This is the same repository runner/non-execution condition and is not a test verdict.

Remaining integration:
- construct credential-backed provider edges in the owning Gateway/channel composition;
- persist admitted media linkage and feed returned bytes into canonical file/perception
  admission;
- no live provider credential or webhook deployment is claimed here.
