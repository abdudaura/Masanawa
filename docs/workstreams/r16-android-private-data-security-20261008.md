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
