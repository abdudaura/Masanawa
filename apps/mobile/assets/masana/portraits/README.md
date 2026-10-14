# Masanawa AI-character portraits — all 26 files committed

**Directory:** `apps/mobile/assets/masana/portraits/`.

The **26 unique, AI-generated 384×384 WebP portraits are stored as real Git binary files** in this directory. They match the production catalog keys in `services/gateway/src/platform_agent_bootstrap.ts` and `manifest.json`. They are fictional character portraits—not images of named real licensed professionals.

Flutter registers `assets/masana/portraits/` in `apps/mobile/pubspec.yaml`. The `MasanaPortraitAvatar` widget displays these images offline, preferring an authenticated server-admin override `avatarUrl` if provided. Old cartoon SVGs remain only in the historical `avatars/` and `banners/` folders; they are not the profile image fallback.

## Files



- `gwani.webp` — Gwani
- `gwana.webp` — Gwana
- `amina.webp` — Dr. Amina Yusuf
- `fatima.webp` — Nurse Fatima Abdullahi
- `salim.webp` — Pharm. Salim Ibrahim
- `zainab.webp` — Barr. Zainab Bello
- `sadiq.webp` — Prof. Sadiq Musa
- `musa.webp` — Engr. Musa Garba
- `bello.webp` — Engr. Bello Shehu
- `umar.webp` — Engr. Umar Lawal
- `safiya.webp` — Arc. Safiya Kabir
- `ruqayya.webp` — Prof. Ruqayya Haruna
- `idris.webp` — Dr. Idris Muhammad
- `maryam.webp` — Prof. Maryam Usman
- `kabir.webp` — Dr. Kabir Ahmad
- `hauwa.webp` — Prof. Hauwa Sani
- `yusuf.webp` — Dr. Yusuf Danladi
- `haruna.webp` — Prof. Haruna Adamu
- `bilkisu.webp` — Dr. Bilkisu Suleiman
- `nura.webp` — Dr. Nura Abdullahi
- `aisha.webp` — Dr. Aisha Tanko
- `abdulrahman.webp` — Prof. Abdulrahman Isah
- `layla.webp` — Ustazah Layla Hassan
- `grace.webp` — Prof. Grace Okonkwo
- `asha.webp` — Madam Asha Verma
- `mei.webp` — Prof. Mei Lin

## Gemini / Android integration

Use `portraitAssetFor(agent.displayName)` in `apps/mobile/lib/src/agents/masana_portrait_avatar.dart` or inspect the JSON manifest. Do not hard-code alternate labels or assume another character's identity. Existing tests in `apps/mobile/test/masana_professional_portraits_test.dart` validate every packaged WebP. Rebuild the APK after pulling this branch.

For higher-resolution UI beyond the bundled 384px images, request newly approved artwork rather than substituting the retired cartoon SVGs.
