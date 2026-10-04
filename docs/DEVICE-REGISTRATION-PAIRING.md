# Device registration and secure pairing

Status: Task 104 foundational implementation  
Package: `@masanawa/devices`

## Boundary

Task 104 establishes canonical Device identity and one-time secure pairing.

It deliberately does not implement:

- DeviceCapability publication/readiness (Task 105);
- CharacterDeviceAssignment (Task 106);
- operational Device credential generation/revocation/reconnect control
  (Task 107);
- Android runtime behavior;
- OmniSIP;
- Device-as-Provider selection;
- DeviceOperation execution.

Pairing proves that a registered Device has completed the one-time enrollment
ceremony. It does **not** grant Tool capabilities, Character assignment or a
long-lived operational credential.

## Device registration

Registration is tenant-scoped and server-identified.

The caller supplies:

- a bounded enrollment fingerprint;
- Device class;
- platform/version;
- model;
- Agent Device app version.

The platform allocates the canonical DeviceId.

Within one Tenant, the enrollment fingerprint is unique. Exact replay returns
the existing Device. Reuse of the same enrollment identity with materially
different metadata fails with `devices.registration_conflict`.

A newly registered Device starts in `pending-pairing`.

## Pairing secret

A challenge uses a cryptographically random 32-byte secret encoded as
base64url.

Only:

`SHA-256(secret)`

is persisted.

The plaintext pairing secret is returned once by the challenge-issuance API and
must not enter logs, database rows, model context, telemetry or later Device
records.

Verification hashes the presented secret and compares the two fixed-length
hashes with `timingSafeEqual`.

## Challenge lifetime

A pairing challenge:

- is tenant + Device scoped;
- uses a canonical RequestId;
- lives between 1 and 15 minutes;
- is one-time;
- permits at most five invalid-secret attempts;
- is one of `pending | consumed | expired`.

Only one pending challenge can exist for a Device. Expired challenges may be
replaced.

Five bad secrets durably increment the attempt counter and move the challenge
to `expired`. The transaction commits this lockout before the API returns the
authorization error.

## Completion

Successful pairing atomically:

1. locks the exact challenge;
2. locks the exact tenant-scoped Device;
3. verifies challenge state and expiry;
4. constant-time verifies the supplied secret hash;
5. consumes the challenge;
6. transitions Device `pending-pairing → active`;
7. increments Device revision;
8. records `pairedAt`.

No operational Device credential is generated here.

If the server committed pairing but its response was lost, replaying the same
challenge + secret returns the already-active Device without repeating any
state transition. A different secret against a consumed challenge is rejected.

## Tenant isolation

Every registration/pairing query is Tenant scoped.

A DeviceId/challenge pair presented under another Tenant resolves as not found,
rather than exposing the existence or state of the Device.

## Persistence

`devices.devices` holds canonical Device registration/lifecycle facts.

`devices.pairing_challenges` holds:

- RequestId;
- DeviceId;
- SHA-256 secret hash;
- state;
- failed-attempt count;
- creation/expiry/consumption timestamps.

There is no plaintext secret column.

## Acceptance coverage

Focused unit/PostgreSQL coverage includes:

- immutable normalized Device metadata;
- high-entropy unique secrets;
- deterministic SHA-256 hashing;
- constant-time verification path;
- registration replay and changed-metadata conflict;
- one pending challenge per Device;
- plaintext secret absence from persistence;
- five-attempt durable lockout;
- expiry + replacement challenge;
- successful Device activation;
- exact completion replay after simulated response loss;
- prevention of issuing another challenge after pairing;
- cross-Tenant challenge rejection.

## Security integration

The PostgreSQL adapter is an internal persistence boundary. Public/control-plane
routes that call it must still enforce current Masanawa Security authority.

Task 107 will add the operational credential/reconnect boundary. Pairing must
not be mistaken for ongoing command authorization.

## Completion boundary

Task 104 remains open until repository checks and PostgreSQL 18 acceptance
actually execute and canonical task evidence advances.
