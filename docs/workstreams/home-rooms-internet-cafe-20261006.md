# Home + Rooms Lane I — Internet Cafe

Status: ISOLATED LANE COMPLETE / SHARED INTEGRATION PENDING
Date: 2026-10-06
Branch: `work/home-rooms-internet-cafe-20261006`
PR: #203
Base: `docs/home-rooms-launch-20261006`

## Ownership

This window owns only:

- `apps/mobile/lib/src/rooms/internet_cafe/**`
- `apps/mobile/test/rooms/internet_cafe/**`
- `docs/workstreams/home-rooms-internet-cafe-20261006.md`

No shared Gateway/router/chat/transport/APK, provider, Commerce/Event migration, or
production environment path is owned by this lane.

## Completed

Implemented the isolated Internet Cafe Room contract and presentation slice:

- server-projected Internet Cafe Room identity/title/subtitle/continuation;
- five launch service families:
  - Quick Purchase;
  - Applications;
  - Business Services;
  - Documents;
  - Online Help;
- opaque server-owned quick-start intent IDs;
- service options with opaque canonical execution bindings;
- mutually exclusive execution mapping:
  - `billingServiceRef` for canonical billing composition;
  - `skillRef` for canonical Skill discovery/admission;
- strict rejection of mixed billing/Skill authority bindings;
- server-projected option selections for provider/catalog-like choices without
  embedding provider truth in the client;
- application/document task-intake schema with short text, long text, choice, date,
  phone, email and document field kinds;
- required-field, choice-membership, duplicate-field and unknown-field validation;
- typed intake submissions carrying only user-entered presentation values plus the
  server-owned service/intent identity;
- quick-service cards, continuation card, projected selection UI, categorized service
  list, task-intake bottom sheet, loading/error/empty/stale-warning states;
- responsive quick-start layout for narrow phones and wider screens;
- typed callbacks for quick starts, service selection, projected option selection,
  validated intake submission and continuation;
- isolated `InternetCafeTransport` seam with a fail-closed unavailable default;
- Riverpod `InternetCafeController` and state for load/mutation/error handling;
- duplicate mutation dispatch prevention while an action is in flight;
- controller-side stale/forged quick-start, service, selection and invalid intake rejection before transport;
- `InternetCafeRoomView` that composes state/controller/screen so shared integration only
  needs to mount one widget and override the transport provider.

The client does not define prices, transaction success, receipts, provider eligibility,
financial state transitions or executable Skill authority.

## Tests added

- `apps/mobile/test/rooms/internet_cafe/internet_cafe_models_test.dart`
  - billing/Skill binding parsing;
  - mixed-authority rejection;
  - unknown quick-start rejection;
  - taxonomy-section consistency;
  - intake validation and unknown-field rejection;
  - non-empty projected selection requirement.
- `apps/mobile/test/rooms/internet_cafe/internet_cafe_room_screen_test.dart`
  - projection rendering;
  - typed quick-start/service/selection callbacks;
  - narrow-screen loading/error/retry;
  - application intake collection and validated submission.
- `apps/mobile/test/rooms/internet_cafe/internet_cafe_state_test.dart`
  - isolated transport loading;
  - server-returned projection replacement;
  - forged/stale selection and intake rejection before dispatch;
  - duplicate in-flight mutation suppression;
  - last-good projection preservation on transport failure.
- `apps/mobile/test/rooms/internet_cafe/internet_cafe_room_view_test.dart`
  - Provider override integration;
  - automatic initial load;
  - quick-start dispatch through the controller seam.

## Verification

Latest implementation head before this evidence-only handoff update:
`c518b24f0d05cb1a5dccd854f20368fb06648d87`.

PR diff inspection confirms only the owned Internet Cafe source/test paths plus this handoff are changed.

The execution environment available to this window has no Flutter or Dart SDK, so no
local Flutter result is claimed.

GitHub workflows were run on PR head
`3834b9ff6694df015b0d7c53319afe476a31e8dd`:

- Foundation CI run `37445912846` — completed `failure`, job `check`, `steps = null`;
- Mobile Build run `37445912878` — completed `failure`, job `build`, `steps = null`.

Both jobs terminated before any checkout/test/build step was allocated. This matches the
repository's known runner-allocation failure and is not an application test or compile
failure. No CI pass is claimed.

## Remaining integration dependencies

Only shared-owner composition remains:

1. PR #136 / Lane P implements `InternetCafeTransport`, overrides
   `internetCafeTransportProvider`, and mounts `InternetCafeRoomView` from Home/router
   navigation.
2. Home Data/Airtime/Electricity/TV shortcuts pass the server-owned quick-start intent
   into this Room; this lane does not edit Home or router files.
3. Canonical billing composition resolves `billingServiceRef` to the existing
   Flutterwave catalog/validation/quote/checkout/reconciliation/receipt flow.
4. Canonical Skill discovery/admission resolves `skillRef` for application, business,
   document and online-help services.
5. Shared conversation/attachment rendering handles actual uploaded documents and
   long-running task artifacts; this lane only describes intake fields.
6. Production qualification and physical APK purchase tests remain Lane B/Lane P
   responsibilities.

No second billing engine, InternetCafeAgent, Workflow engine or direct provider path was
introduced.


**No further isolated implementation remains in this lane.**
