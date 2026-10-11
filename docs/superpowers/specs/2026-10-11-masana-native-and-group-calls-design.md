# Native reporting and multiple-Masana calls

Owner-directed scope: complete native history reporting and add multiple-Masana
group calls, then integrate the tested changes. Keep Chats/Status/Wallet/Calls/Rooms
and retired personal Twins. Other Status, Rooms and Quality windows retain their
paths. Current source base is call-history branch `aca319c1a`, main `a8e1c84ce`.

## Native history

Parse optional server grant callId. Report connected only after provider setup
and microphone subscription succeed; report ended after local teardown, including
failure, timeout, backgrounding and abandoned grants. Reports never settle billing.
Use a bounded account-fenced persistent outbox, serial ordering, idempotent retry,
request timeouts and resume flushing. Never serialize credentials/audio. Pin each
request's credential to its intended signed-in account; discard foreign-account
responses and never reuse a mutable bearer header across accounts. Refresh recents
after history changes without reopening an audio session.

## Group contract

One human account owns a private group of 2–4 current platform Masana. No human
contacts, personal Twin admission or public Room media grants. Server owns canonical
participant eligibility. Creation is durable and request-key idempotent, with no
provider call or financial reservation. Recheck eligibility at each participant
token request, issue through existing liveVoiceTokens/paid-admission gate, and bind
the resulting child history record to the owned group. Group detail, token issue,
participant removal and termination always bind tenant and authenticated account.
Store no provider credentials. Removal/end prevents future token issuance.

HTTP shape:
- POST /v1/calls/groups {requestId, characterIds}: {group}
- GET /v1/calls/groups/:groupId: {group}
- POST /v1/calls/groups/:groupId/participants/:characterId/token {admissionId?}:
  existing live grant plus callId, groupId, characterId and displayName
- DELETE /v1/calls/groups/:groupId/participants/:characterId: {group}
- POST /v1/calls/groups/:groupId/end {}: {group}

group contains groupId, state connecting/active/ended, createdAt, endedAt and
participants [{characterId,displayName,state:selected/connecting/active/left/failed,callId:null|string}].
No client-supplied account, roles or pricing accepted. Paid admission must retain
existing explicit quote/consent and canonical settlement; unsupported paid admission
fails closed, never silently treats a participant as free.

## Shared native audio

One group owner acquires microphone/audio focus and captures mono PCM16 at 16kHz.
Each authorized LiveVoiceSession consumes the same broadcast input, bypassing its
own recorder/audio focus. Each session emits PCM24k through an injected output
callback. One bounded playback coordinator serializes persona output, prevents
overlapping speakers, handles interruption and drops removed-member buffers.
No model audio is sent directly into another model's input. Group owner releases
the microphone, player, sockets and audio focus on termination/background/account
change. Participant failures clean up that participant and preserve healthy members.
No reconnect may resurrect ended or removed participants. Native sessions expose
sharedMicrophone, onAudioPcm, onConnected/onClosed callbacks and sendGreeting.

## Delivery and verification

Separate exact-path backend/group-mobile/native ownership; root owns composition,
core native session and current single-call integration. Test authorization, consent
denial, request replay, remove/token/end races, isolation, outbox restart/retry,
ordering, native close/setup callbacks, shared-input behavior, one recorder, speaker
queue bounds, account fencing and group UI. Run local PostgreSQL, Gateway build,
Flutter/widget/regression and scoped analysis. Review unified source before merge.
Real device/provider audio, push, signed binaries and production migrations require
their own executed qualification; source tests do not establish those outcomes.

Merge target must not silently activate production or run live migrations. Inspect
fresh main, claims, CI and deployment settings before integrating. Preserve all
existing source and historical migration checksums.
