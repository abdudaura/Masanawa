# C04 — Secure private voice-note transport (lease)

- Window: GPT-6 independent C04 implementation, 2026-10-08 around 12:00 Africa/Lagos.
- Branch: `work/c04-private-voice-notes-20261008`, base current `main` SHA `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Work item: C04 / M03, M04, M10, J04/J11. Authenticated person-to-person **voice note** media (not LiveKit Talk/audio call).
- Owned exact paths: `services/gateway/src/human_media/**`, `packages/talks/migrations/0018_human_dm_media.sql`, `apps/mobile/lib/src/human_media/**`, `apps/mobile/test/human_media_*.dart`, `docs/contracts/HUMAN-DM-MEDIA-C04.md`, this claim.
- Excluded from claim: shared Gateway app.ts/main.ts, Flutter root/router, existing media/store helpers, C01 contacts, C02 human_messages/**, C03 events, C05 cache, financial provider/ledger, existing migration 0016 or 0017. Another owner must coordinate additive composition without losing C01/R18 changes. Verify exact C02 message schema/API before FK integration.
- Source scope: bounded voice upload, real canonical session + participant checks, content validation/secure object storage, read access recheck after block/revoke, retry/delete and app recorder/preview/playback with typed transport/tests. No false E2EE or delivered/read claims.
- Status: CLAIMED; SOURCE_WRITTEN=no, LOCAL_TESTED=no, CI_EXECUTED=no, DB_INTEGRATED=no, APP_INTEGRATED=no, DEVICE_VERIFIED=no, DEPLOYED=no, MERGED=no. Shared Actions #457 prevents cloud execution; local shell cannot access private GitHub clone.
- Five-minute repository-visible lease; claim expires without new branch activity. Preserve other owners' work.
