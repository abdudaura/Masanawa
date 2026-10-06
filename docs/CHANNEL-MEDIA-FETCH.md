# Authorized inbound channel media fetch

Status: implementation slice on PR #298.

## Purpose

WhatsApp and Telegram webhook admission deliberately stores only provider media identifiers
and bounded transport metadata. Provider file identifiers are not canonical File IDs and
must not be treated as fetched content until the platform has re-entered the provider
through an authenticated account-scoped edge.

This slice adds that missing adapter boundary.

## Security boundary

`ChannelAuthenticatedMediaEdge` owns provider credentials and the provider-specific
download flow. Implementations may perform the WhatsApp two-step media URL lookup/download
or Telegram `getFile`/file download internally, but must not return access tokens,
download URLs or redirect targets.

The common fetcher receives only:

- exact messaging channel;
- exact canonical ChannelAccountId;
- provider file id from admitted webhook evidence;
- admitted media kind;
- optional provider-declared MIME type;
- per-kind byte limits.

Before bytes are returned to Gateway/perception admission, the fetcher:

1. rejects channel/account substitution before calling the provider edge;
2. applies a hard 64 MiB ceiling in addition to configured per-kind limits;
3. requires the provider response to return the same file id;
4. validates provider MIME syntax and audio/image/video kind compatibility;
5. rejects a declared-vs-fetched MIME conflict instead of silently trusting either side;
6. rejects empty and oversize bodies;
7. copies provider-owned bytes before returning them;
8. computes `sha256:<hex>` content evidence over the copied bytes;
9. maps explicit provider rejection to a stable platform error surface;
10. redacts ambiguous provider/network failures and marks them retryable.

## Authority

The result is still transport/media evidence. It does not establish:

- canonical File identity;
- User or Character ownership;
- permission to inspect private content;
- successful perception/model processing;
- payment, fulfillment or workflow authority.

Those remain with the existing Gateway, Security, Perception/File and runtime boundaries.

## Integration

The Gateway/channel owner should construct one authenticated media edge per configured
WhatsApp/Telegram account and call the fetcher only after the corresponding
`ChannelIngressRecord` has been durably admitted and linked to an authorized session.

No provider token or webhook secret should be added to the media request DTO.


## Provider-specific orchestration

The generic fetcher now has concrete provider orchestration seams.

### WhatsApp

`createWhatsAppAuthenticatedMediaEdge()` performs:

1. authenticated media metadata lookup by exact provider file id;
2. exact returned file-id verification;
3. provider-declared file-size preflight against the caller's admitted byte limit;
4. authenticated download through an opaque provider download reference;
5. actual byte-count validation against both the admitted limit and provider metadata.

The opaque download reference never leaves the provider client/edge boundary.

### Telegram

`createTelegramAuthenticatedMediaEdge()` performs:

1. authenticated Bot API `getFile` lookup by exact file id;
2. exact returned file-id verification;
3. provider-declared file-size preflight;
4. authenticated download using the opaque returned file path;
5. actual byte-count validation.

The normal Telegram Bot API download ceiling is enforced at 20 MiB even when the outer
Masanawa media policy allows more. The opaque file path never enters the generic media
result.

Neither provider seam owns credentials or raw HTTP directly. Their injected clients are
the credential boundary; Gateway/Security composition remains responsible for constructing
those clients.
