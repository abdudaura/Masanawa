# Independent app shell contract

## Twin economy shell overlay — 2026-10-05

The four primary product surfaces (My Twin, Explore, Activity, Wallet) are native shell
navigation/screen concerns. Transaction choices inside a twin conversation should reuse
the existing ShellDocument/action contract where suitable.

Gift, paid voice quote, commerce purchase and Request Owner actions must be backed by
server-issued opaque actions and canonical financial state. Narrative AI text must never
create a charge, transfer, hold or settlement.

Status: renderer and live mobile/Gateway integration are combined on draft PR #104; not yet a verified or deployed release.

## Update boundary

The installed Flutter shell owns native permissions, authentication, trusted styling,
accessibility, media integration and the renderer. The server supplies data, product
catalogs, teaching content and versioned declarative documents. New content and flows
using supported primitives require server deployment only. A new primitive, plugin,
permission, native SDK, deep-link configuration or security fix can still require
an APK. This architecture cannot honestly promise to render every future feature.

Keep Masanawa's approved blue branding and current features. Do not put executable
Dart, JavaScript, HTML, arbitrary endpoints or device permissions in documents.

## Implemented foundation

AgentMessagePart accepts an optional document and preserves it through serialization.
MessagePartsView renders it using ShellDocumentView; existing cards remain supported.
Version 1 primitives: text, heading, column, options (wrapping buttons), card, input,
button, divider, metric, detail, progress and notice. These compose balance summaries,
transaction receipts, fulfillment updates and teaching exercises without product-specific
native screens. Unknown primitives make the whole document fall back to readable text
with no active controls. Unsupported versions use the
message fallback. The document is limited to 100 nodes, depth 6, bounded individual strings and 24,000
aggregate characters. Options accept buttons only; leaf nodes cannot hide controls.
IDs must be unique. Buttons carry an opaque server action token. Required fields
validate before dispatch. Busy and consumed documents suppress repeated taps;
action documents require timezone-bound expiry, and expiry is checked again at selection.
Visible controls refresh on expiry. Document replacement resets form state; callbacks from
older revisions cannot consume a newer card. Detail rows stack on narrow screens or
large text. Headings and status changes expose accessibility semantics. This is a UI guard, not server idempotency.

Example:
```json
{
  "kind": "status",
  "body": "Choose your bundle",
  "document": {
    "version": 1,
    "id": "bundle-quote-123",
    "revision": 1,
    "expiresAt": "2026-10-04T18:00:00Z",
    "fallback": "Choose your bundle or ask for other options.",
    "nodes": [{
      "type": "options",
      "children": [{
        "type": "button",
        "id": "bundle-small",
        "text": "1 GB",
        "action": "choose-bundle",
        "token": "opaque-server-issued-value"
      }]
    }]
  }
}
```

## Integrated release contract

PR #104 now binds `MessagePartsView.onAction` to the authenticated shell action
dispatcher. The mobile host persists the exact action terms in encrypted storage before
submission, the Gateway authorizes the Character/session, and the server records
idempotent document/revision action state before any executor side effect. The client
never blindly replays an ambiguous action: it queries the original action status and
requires authoritative acceptance.

The mobile shell transmits `ShellDocument.capabilities` through
`GET /agent/shell/config`. The server enables shell documents/actions/revisions only
when the client declares the complete v1 primitive set. Minimum and recommended app
versions are server-controlled. Unknown/unsupported document content still falls back
to readable text and disabled controls.

Canonical mobile endpoints use the `/agent/**` prefix:
- directory and default-support-agent preference;
- session open/turn/turn-stream/media/media-set/close;
- shell config/history/turn status/events/action status/action dispatch;
- presence, push registration and Live voice token minting.

`/v1/**` remains the operations/admin namespace; do not reintroduce
`/v1/agent/**` in the mobile transport.

Server requirements remain unchanged: validate user/session/document/revision/token/
expiry, allowlist action and input IDs, validate values, recheck prices/fees/recipient,
separate selection from consequential confirmation, and execute only through canonical
Commerce/Skill authority. Narrative text never proves payment or fulfillment.

Server-backed completed history, RequestId turn recovery, realtime event reconciliation,
presence, push/deep-link hooks, offline queue state and Gemini Live direct-client voice
are integrated. Push is inert unless Firebase build defines and server service-account
configuration are supplied.

Remaining release verification is environmental rather than an intentionally unwired
feature: run repository TypeScript checks, Flutter analyze/tests, an APK build, and
physical-device interaction before merging/releasing. GitHub Actions currently allocates
no runner (`runner_id: 0`, zero job steps), so its red status is not a test result.

## Durable selection integration

ShellActionCoordinator is a provider-neutral host port. Bind MessagePartsView.onAction
to coordinator.submit only after concrete encrypted journal and authenticated dispatcher
adapters are available. Scope journal keys to canonical user + CharacterSession;
account logout/removal must clear the user's records and opaque tokens.

The journal must atomically createPending per scope/document/revision. A document
revision represents one selection, so switching option or values after dispatch requires
new server options. complete is monotonic and preserves original immutable terms.
Store pending before network submission. On timeout or completion-write failure, leave
pending and query the original server result. Never automatically resend. A false
accepted result includes absent/pending/failure and remains blocked for reconciliation.
The owning transaction flow decides whether new confirmation is permitted. Local guards
never replace canonical RequestId idempotency, server token validation or authorization.

This port does not add a second wallet, payment engine or transaction state machine.
Gateway tokens must bind canonical server command identity, actor, session, exact
document revision/action/values and expiry. Dispatch returns normally only after durable
server acknowledgement of the selection, never merely HTTP acceptance without a
recoverable identity. Accepted selection does not imply product fulfillment.

## Ownership and release dependencies

PR #104 is the integration owner for the mobile-shell/Gateway paths listed in
`docs/workstreams/integration-mobile-shell.md`. It rebased onto current `main` and
preserves creator-economy/default-agent work already merged there. Commerce settlement,
provider adapters, Teaching internals and WhatsApp/Telegram ingress remain owned by
their respective workstreams. Shell action execution is still a delegated server port;
this PR does not invent a second transaction engine.

## Verification

2026-10-04: Dart 3.13.5 analysis passed for shell_document.dart,
shell_action_coordinator.dart and message_parts.dart with no issues.
18 pure Dart tests passed: 10 parser/capability/fallback cases and 8 coordinator cases,
including atomic cross-instance claims, changed selections, restart recovery,
storage failures and uncertain outcomes without redispatch. The checked-in mobile test
cases were executed in an isolated Dart package with only package imports adapted from
flutter_test to package:test; the production model/coordinator/parser files were unchanged.

Flutter widget regression source additionally covers required forms, disabled unbound
actions, unknown components, expiry, stale completion and narrow/large-text receipts.
Those widget cases have not run. Dart formatting parsed all changed Flutter sources;
this is not Flutter typechecking. The Flutter SDK was unavailable; attempted archive
retrieval returned 404. Run flutter analyze and flutter test in apps/mobile plus real
device/Gateway interaction before merging or releasing. No APK, live selectable purchase,
native compatibility, deployment or numbered task completion is claimed.

## Live document continuation

ShellDocumentSession now maintains scoped immutable server document replacements, exact replay, predecessor revision checks and stale-update rejection. submitted/processing/fulfilled/failed/cancelled are distinct authoritative states. Terminal documents cannot reopen; processing cannot regress to submitted. Only authenticated server receivers may call apply; narrative text never sets fulfillment.

ShellDocumentSessionView listens for accepted updates and replaces one document in place, exposing accessible phase labels and disabling selection outside choosing. Host must clear/close sessions on logout or conversation disposal. This reusable live view is not yet mounted by the integration-owned chat screen.

Session.select resolves an explicit visible ordinal or exact unique label into the same ShellAction token used by buttons. It validates current revision, expiry, supported content, required fields and allowed field IDs. Ambiguous labels, injected values and stale choices fail closed. The speech provider may supply the selector; no transcription or speech parsing is added here.

Verification: 28 pure Dart tests pass (18 prior + 10 live-session/selection cases). Analysis of all four pure production files passes. Formatting parses the live Flutter view; Flutter typechecking/widget/device verification and runtime binding remain pending.

Encrypted persistence checkpoint: EncryptedShellActionJournal and FlutterShellEncryptedStore implemented using existing flutter_secure_storage dependency. The journal serializes competing claims in the UI isolate, preserves pending records across instances/restarts, fails closed on corruption/unavailable storage/full journal, and invalidates all old instances at logout through namespace generations. No plaintext fallback or silent pending eviction. Server idempotency remains mandatory; do not share this native journal across isolates. Concrete journal is not yet composed into the #89-owned screen/transport.
Verification: 34 pure Dart tests pass, including six encrypted-journal behavior cases; journal Dart analysis passes. Secure-storage adapter source is formatted but native plugin/device encryption is not verified. Flutter tool successfully cloned and SDK bootstrap began, but automatic approval review rejected startup because it attempted to contact cloud metadata (possible instance credential exposure). That route was stopped; do not bypass rejection. Full Flutter/APK verification remains blocked until a safe/local runner is available. Gateway/screen integration still needs explicit ownership transfer from #89; #90 and #92 ownership preserved. Not merged/deployed or fully implemented end-to-end.


## PR #104 verification addendum

The integration rebase repaired migration numbering, Gateway composition, Alpha
authorization, conversation streaming/media-set contracts, the mobile PUT helper,
canonical `/agent/**` routing and the unsupported-action pending-state bug. Server
tests were added for shell capability negotiation and action replay semantics, and
conversation route tests now cover media sets.

The checked-in PowerShell smoke runner performs `flutter pub get`, `flutter analyze`,
`flutter test`, debug APK build, hosted Gateway readiness, optional Gwani/Gwana roster
verification, and optional device install. Firebase defines are forwarded only when
present in environment variables. Do not put secrets in the script or repository.
