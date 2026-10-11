# C09 — account device-security acceptance (J01/J16 adjunct)

Source: feature-local auth session projection, not a new user or session store.
AF00 owns binding Settings -> DeviceSecurityScreen using the signed-in Dio session.
- Fan signs in on two Android installations; C09 displays both opaque session handles without credential hashes.
- Current device is marked and cannot be revoked through this remote-device control. Logout uses canonical auth.
- Fan confirms remote sign-out; database revokes the target access AND refresh in one write; request audited in same transaction. Re-authenticating from the removed device is required.
- Switch fan accounts while remote list fetch is pending: old fan devices never appear under the new fan.
- Retry the same key after a timeout: one audit row, same remote session revoked, no unintended second target.
- Invalid bearer, forged tenant/user, UUID injection, cross-fan device id, expired/rotated credentials -> 401/404/422/409 and no session mutation.
- Offline: read-only message and retry; no queued logout or false success.
- Upgrade PostgreSQL in disposable staging: existing sessions acquire opaque handles, no token hash or financial record changes.
- Device names are deliberately generic: current auth has no verified device attestation; never claim hardware identity.
- No worker needed: canonical security.platform_sessions revoked_at / expiry predicates gate both auth access and refresh.
Unexecuted environment checks: `pnpm typecheck`, `pnpm test:ci`, PG18 fresh+upgrade restore,
`cd apps/mobile && flutter analyze && flutter test`, Android debug/release APK and real two-device J01/J16.
