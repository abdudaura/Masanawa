# AF08 shared client / session credential isolation — 2026-10-13

## Scope and precise source
- Base: `472bc3d9ba99c2b7d58808c3e3540064f603781d` (PR #710 merged).
- Branch: `lane/af08-credential-fencing-20261013-gpt6`.
- Claim: `af08-credential-fencing-20261013-gpt6` on `factory/claims`.
- Paths: `apps/mobile/lib/src/core/network/api_client.dart`,
  `apps/mobile/lib/src/state/session_state.dart`,
  `apps/mobile/test/auth_credential_fencing_test.dart`,
  `apps/mobile/test/session_state_test.dart`,
  `.github/workflows/af08-credential-fencing.yml` and this handoff.

## Integrated authenticated user journey
A signed-in fan opening Chats, Status, Rooms, profile or Wallet uses the
existing shared Dio / canonical SessionController. Private requests now retain
the session identity at admission. Queued dispatch, HTTP readback and 401
refresh retries fail closed after A→B, logout, or A→B→A replacement; the
server-supplied body of an old response must not enter a new session. The same
authenticated account can still rotate its token once and retry a 401. Public
OTP, password and refresh routes keep their normal transport.

The session controller binds the canonical signed-in user ID to the transport
instead of trusting caller headers; new logins invalidate the prior request
generation even for the same fan. Session-epoch checks guard async restore,
refresh, delayed logout and credential storage. Writes/deletes are serialized
against account replacement: an old refresh cannot overwrite a new fan's
session after a logout or login. Login/refresh share the original encrypted
session record; no second account store, session provider or backend authority.

Tests inject deterministic Dio HTTP adapter responses, including successful
old account response, late 401, refresh during replacement, A→B→A, logout
and same-account refresh retry; SessionController tests use the existing secure
storage test channel and deferred auth responses. All values synthetic.

**Verification:** new hosted Flutter 3.x workflow prepared, execution pending
against PR head; do not claim tests have passed before viewing run results.
Execute focused regression, Dart analyzer and inspect real Mobile Build only
as available. Gateway, production tenant accounts, real installed signed
Android, actual refresh provider and payment operations have NOT been run.
AF01 funding/MSN/crypto, live Status/Rooms/Chats flag and worker/device
qualification, MUI-09/MUI-10 and AF11 remain separate OPEN journeys. Never
activate paid/provider endpoints based on this source-only transport change.
