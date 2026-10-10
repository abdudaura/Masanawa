# Cross-slice contracts — AF v1

Status: design contract, not implemented API evidence. AF00 publishes canonical typed exports only after reconciling existing contracts; other lanes import them rather than copy financial/auth schemas. Existing endpoint paths are preserved unless a versioned migration is required. Paths below name capabilities, not a claim that a URL already exists.

## Shared envelopes and identity

Actor comes from the authenticated session, never a caller-supplied user/role field. Stable account ID, AI character ID, conversation ID, room ID and post ID are distinct types. Directory entries are a tagged union of human account and Masana persona; selecting one cannot silently open the other's route.

All mutating operations accept an idempotency key and expected resource revision where state can race. Reusing a key with changed payload rejects. Replies include operation ID, status, updated revision and correlation ID. Errors distinguish AUTH_REQUIRED, FORBIDDEN, VALIDATION, RATE_LIMITED, STALE_REVISION, QUOTE_EXPIRED, INSUFFICIENT_FUNDS, CAPABILITY_UNAVAILABLE, NETWORK_RETRY and OUTCOME_UNCERTAIN; translate human copy without parsing strings.

Account-bound cache and subscriptions are keyed by account/session; logout or switch cancels them. Public content cache may persist only where visibility and moderation allow. Pagination uses bounded server cursors.

## Money authority — AF01 exports

Money = { assetId, atomicAmount: decimal-integer string, precision }; supported asset/network and limits are server data. Display equivalents are indicative with timestamp, never settlement authority.

WalletView = { accountId, revision, asOf, balances: [assetId, available, pending, reserved], capabilityRestrictions, activityCursor }. No user-spendable fiat balance. Existing Cr/NGN fields require versioned compatibility and audited migration; no implicit rename or silent truncation.

Quote = { quoteId, purpose, actorId, source, destination, recipientId?, fees, expiresAt, operationRevision, eligibility }. Consent binds authenticated actor, exact quote/payload and a one-use authorization challenge. Changed terms invalidate consent.

Canonical commands: funding create/status, deposit instructions/status, conversion quote/execute/status, internal transfer quote/execute/status, crypto withdrawal quote/execute/status, purchase quote/execute/status, escrow reserve/release/return/status. Every executed effect references one balanced ledger transaction and durable receipt. Reserved amounts are excluded from available funds.

AF02 calls AF01 escrow primitives through an explicit transaction boundary. Order creation and reservation commit atomically; no independent P2P balance table. AF03/AF04/AF06 consume these contracts; none writes financial authority.

Receipt = { operationId, kind, status, source/destination amounts, fees, timestamps, authorized recipient/context, ledgerRef, qualified providerRef?, failureCode?, supportRef }. Status lookup after uncertain execution precedes resubmission.

## Gwani purchase draft — AF04 exports

PurchaseDraft = { taskId, accountId, revision, service, selectedOptions, missingFields, recipient, amount, quoteRef?, consentRef?, status }. Menus, text and voice submit intent updates to this same draft. Server validates product/market availability. Any material edit invalidates quote/consent. The service catalogue is versioned data; no menu may invent a purchasable item.

Suggested stages: DRAFT, NEEDS_INPUT, QUOTED, AWAITING_AUTHORIZATION, EXECUTING, CHECKING_STATUS, COMPLETED, FAILED, CANCELLED. A completion receipt is server evidence, not model text. AF04 adapts existing billing and durable task services; AF01 remains financial executor.

## Audio/media authority — AF05, AF09, AF10, AF11

Audio focus grant identifies owner/mode/session generation; cancellation and lifecycle end release the exact grant. Modes include recording, feed playback, private note playback, assistant live, private call and Room live. One active audible source; calls/recording pause casual playback. Do not resume public audio after private call without predictable user action.

Audio failure includes stage = permission | initialization | capture | encode | upload | retrieval | sessionAuth | connect | send | receive | output, retryability and safe correlation metadata. A generic microphone error must not replace provider/network failure.

MediaRef = { mediaId, mime, durationMs, sizeBytes, waveformSummary?, visibility, processingStatus }. Private media URLs are short-lived authorized fetch results, not durable stored links. Validate real codec/duration/size server-side; never trust extension alone.

AudioPost = { postId, creator tagged identity, title?, mediaRef, createdAt, publicationStatus, aiDisclosure, sourceSummary?, visibility, socialCounts, viewerFlags }. Draft/upload/processing/published/failed/moderated/deleted states are separate. New posts reuse media/social foundations but do not reinterpret old live Talk IDs. Server play events measure actual listened time and deduplicate bounded viewer/post sessions; fetching a card is not a play.

Room = { roomId, membershipPolicy, memberRole, revision, permissions, messageCursor, liveSessionRef? }. Server enforces membership/moderation on every read, post, join, media fetch and removal; leave/kick revokes live access. Optional live sessions are distinct resources, not public Talk posts.

Call = existing C09 canonical lifecycle and identity contract, inspected before changes. Calls do not share public room authorization grants.

## Creator publishing — AF12

ScheduledPublication = { publicationId, personaId, scheduleTimezone, dueAt, occurrenceId, scriptVersion, mediaRef?, provenance, budgetRef, state }. Lease/occurrence idempotency and publish-once protection survive worker restart. AI labels follow the content into feed/profile/share. Failed generation never creates a public empty post. Source-based factual scripts and fictional/emotional performances have different provenance requirements.

## Composition and versioning

AF00 alone registers routes, migration manifests, package exports, services and workers. Other lanes supply isolated route factories/repository constructors plus tests and exact composition instructions. New SQL proposals stay in lane modules until unique migration names and ordering are allocated; never edit applied files.

AF00 integrates contract-first, tests latest combined SHA, and publishes compatibility/deep-link mappings. Contracts do not relax existing authorization, retention, deletion, provider eligibility or private/public separation.

## Confirmed navigation contract

Ordered semantic keys: chats, rooms, talks, gwani, wallet. Ordinary authenticated home launch defaults to talks (index 2). Explicit authenticated deep-link/incoming-call destinations override the launch default; background resume preserves in-flight state. Consumer Assistant label is Gwani, while existing internal assistant API/task keys remain compatible. AF00 alone composes routes and migrates versioned old index/name storage. Calls are nested in Chats; Masana & Contacts opens from New chat.
