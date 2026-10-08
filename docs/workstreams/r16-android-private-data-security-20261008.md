# R16 Android private-data protection claim

- Owner/window: ChatGPT R16 Android security continuation, 2026-10-08
- Branch: `work/r16-android-private-data-security-20261008`
- Base SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- Task: R16 production release hardening; application private data backup and transport safeguards
- Exact owned paths: `apps/mobile/android/app/src/main/AndroidManifest.xml`, `apps/mobile/android/app/src/main/res/xml/masanawa_network_security_config.xml`, `docs/workstreams/r16-android-private-data-security-20261008.md`, `tests/security/android-private-data-release.test.ts`
- Dependencies: canonical app shell and existing Android release signing; no changes to those contracts
- Step: Android backup and TLS defaults implemented; three Vitest regression cases added; reviewed committed source against manifest/network policy
- Implementation: committed on branch; tests authored but not executed (container cannot resolve github.com, no checkout); Flutter/Gradle build, device, production deploy: unverified
- Last repository-visible update: initial claim publication on 2026-10-08
- Handoff: run `pnpm vitest run tests/security/android-private-data-release.test.ts`; run Flutter analyze and release APK/AAB build with proper signing; verify API/LiveKit connectivity and app links on actual devices. Keep R16 OPEN until CI/build/handset/store/deployment evidence. Android 12+ backup extraction policy should receive further review; `allowBackup=false` by itself may not guarantee all OEM device-to-device migration behavior.

## 2026-10-08 lease reclaim — Android 12+ device transfer gap
Window owner: GPT-6 secure Android local-data transfer extension. Reclaimed the stale existing draft #455 after last activity `2026-10-08T06:17:52Z` (> five minutes), preserving source and tests. Reviewed latest main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; existing head before reclaim `f472b079b3bc09a460450516002dd7f9405369c4`. Exact owned paths: manifest, **new** `apps/mobile/android/app/src/main/res/xml/masanawa_data_extraction_rules.xml`, `tests/security/android-private-data-release.test.ts`, and this handoff. Preserve #455 transport policy and permissions, R17/C08 router and R16 DB operator #485 untouched. Android official docs explicitly note `allowBackup=false` may not disable device-to-device migration on some Android 12+ manufacturers; implement explicit cloud/D2D exclusion rules before claiming complete source. No local Android device/Gradle/CI verification yet; draft remains unmerged.
