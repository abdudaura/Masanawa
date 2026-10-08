# R11 root-shell translation integration

- Owner: ChatGPT continuation integration, 2026-10-08 Africa/Lagos.
- Canonical base: `fd9779b7a717827a189e01a50cb72390b036c22e`, branch `work/r11-shell-localization-integration-20261008`.
- Reclaimed stale R11 #426 `75cb6a3ae9c2ded67b7842235894ed2ecaa10fa0`, last updated more than 5 minutes ago.
- Exact copied paths: six app ARBs, shell localization tests, shell widget test, original workstream checkpoint; one shared shell file must be semantically merged with R18 #425, not overwritten.
- Collision identified: `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`. R18 profile header must keep user profile provider, safe HTTPS avatar URL and session fallback while R11 translates shell UI.
- CI/mobile emulator not runnable in this environment; tests authored upstream but still need toolchain verification. No production release qualifications claimed.
