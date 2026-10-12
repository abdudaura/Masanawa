# Calls: direct continuation after incoming delivery

Incoming source: `efd1597872e15eaf9623c1346167ad1053c8bea4`, delivered by
[PR #675](https://github.com/weavewellindustrieslimited/masanawa/pull/675).
The PR records its exact main integration SHA. Previous native/group/billing
source is preserved. Read [executed evidence](AF11-incoming-calls-20261012.md).
No receiving window confirmed; inspect fresh main and claims.

## Copy into the next window

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main. Read
AGENTS.md, CONTINUE-HERE.md, docs/workstreams/AF11-incoming-calls-20261012.md
and docs/workstreams/CALLS-NEXT-WINDOW-HANDOFF-20261012.md. Inspect current
PR heads/claims and preserve other windows' Status/Rooms work.

Also read docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md. Keep this signed
Calls qualification task intact and carry the audit forward. MUI-05 tracks
call-history search and shared Calls presentation; continue it as independent
source work if qualification runners are unavailable and exact paths can be
claimed. Preserve any newer implementation before changing Calls/history.

Incoming Masana signaling/push is implemented in PR #675: durable scoped
ringing, explicit accept/decline, server cancel/timeout, missed history,
metadata push retries, passive polling/resume readback and existing paid voice
acceptance/native/history/billing recovery. Local evidence: 98 Gateway tests,
87 Flutter tests and Gateway build pass; incoming-owned Dart has no diagnostics.
Broader Gateway typecheck matches 54 pre-existing main diagnostics. Remote CI
still fails on the pre-existing TalkId export and six mobile analyzer warnings;
repair demonstrated baseline blockers where needed for signed qualification,
without disabling checks. Do not
rebuild delivered native/group/billing/incoming code or replace the full Calls
screen with an old scaffold. Contacts are Masana only; no personal Twins or
human-to-human consumer calls. Preserve historical financial records/Wallet.

Next milestone: signed Android/iOS device and real provider qualification of
incoming calls plus existing one-to-one/group calls. Check available runners
and configured authority first. Qualify foreground/background/terminated push,
permission denial, duplicate/late notification taps, account switches,
accept/decline/cancel/timeout races, missed history, audio interruptions,
offline restart, duration/consent/removal and billing/refund recovery. Reuse the
server-only incoming authority and existing FCM registration/paid voice contracts;
unknown issuance must stay fenced from remint. Provider spending and production
financial activation are separate from routine authorized development CI/CD.

Fix demonstrated source defects with tests, review, commit, push and merge
compatible source into main. If device/provider runners are unavailable, finish
independent source work and state exactly what remains unrun. Do not claim
production-qualified behavior from local tests. Publish an updated handoff and
give the owner the merged SHA, executed results and reusable prompt directly.
Include the UI queue link, the next ready milestone and relevant handoff in
that prompt. Record any MUI-05 work in docs/workstreams/UI-MUI-05-calls-search.md;
keep signed-device/provider checks open separately, never silently closed by
search/widget tests. Use UI-NEXT-WINDOW-PROMPT-20261012.md as the UI prompt seed.
```

## Evidence boundary

Local source checks passed; no signed phone, real FCM/APNs/Gemini call,
production migration/provider spending or deployment qualification was executed.
Shared localization and history retention/account-erasure qualification remain
future work. AF11 has contracts, exact commands and tooling.
