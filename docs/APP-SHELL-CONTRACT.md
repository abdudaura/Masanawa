# Independent app shell contract

Status: renderer implementation on PR #91; not yet a verified or deployed release.

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

## Required integration before release

The current chat screen does not bind onAction. Therefore action buttons are disabled,
not falsely connected to transactions. The next integration owner must bind the
ShellActionHandler to the canonical authenticated Gateway action dispatcher and
replace/update the message document with the authoritative result.

Server requirements: validate user/session/document/revision/token/expiry; allowlist
action and input IDs; validate values; recheck prices, fees and recipient; distinguish
selection from transaction confirmation; persist idempotency and recover results after
timeouts; execute only through existing commerce/Skill authority. An agent's narration
never proves payment or fulfillment. A retry after an ambiguous timeout must query
the original action result, not issue a new financial command.

ShellDocument.capabilities exposes the exact supported version, primitives and limits.
It is not yet transmitted by the chat transport: negotiate it through the owning Gateway
contract before server authors depend on new components. Server authors must provide readable text for app, WhatsApp, Telegram and
voice. Voice selects the same authorized action; do not create a second money path.

Further shell work: authenticated dispatcher, document patch/revision lifecycle,
capability negotiation, durable action-result recovery, selectable voice options,
native compatibility and responsive accessibility
verification. Coordinate shared Gateway/controller paths before editing.

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

PR #89 currently changes Gateway composition/conversation contracts and the mobile
session, transport, chat controller and screen. This window does not edit those paths.
PR #91 owns only the renderer/model/coordinator/tests and its scoped documentation.
Integration must bind these ports, transmit capabilities, emit documents and implement
authoritative result/revision recovery. Financial execution remains with existing owners.

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
