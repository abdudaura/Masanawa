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
button, divider. Unknown primitives show readable text. Unsupported versions use the
message fallback. The document is limited to 100 nodes, depth 6 and bounded strings.
IDs must be unique. Buttons carry an opaque server action token. Required fields
validate before dispatch. Busy and consumed documents suppress repeated taps;
expiry is checked again at selection. This is a UI guard, not server idempotency.

Example:
```json
{
  "kind": "status",
  "body": "Choose your bundle",
  "document": {
    "version": 1,
    "id": "bundle-quote-123",
    "revision": 1,
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

Advertise supported schema version and primitive capabilities using an agreed Gateway
contract. Server authors must provide readable text for app, WhatsApp, Telegram and
voice. Voice selects the same authorized action; do not create a second money path.

Further shell work: authenticated dispatcher, document patch/revision lifecycle,
capability negotiation, durable action-result recovery, selectable voice options,
balance/receipt/progress components, native compatibility and responsive accessibility
verification. Coordinate shared Gateway/controller paths before editing.

## Verification

Added parser and widget tests for scope round trips, unknown versions, duplicate IDs,
size bounds, missing action tokens, unbound disabled buttons, required fields and
single submission. Flutter/Dart are unavailable in the authoring environment;
tests have not run. Run flutter analyze and flutter test in apps/mobile, then a
real-device APK test with server-generated documents before merging/releasing.
