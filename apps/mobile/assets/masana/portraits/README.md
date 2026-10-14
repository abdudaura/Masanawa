# Masanawa AI-character photo portraits (26 identities)

**Catalog correspondence:** `services/gateway/src/platform_agent_bootstrap.ts`; character keys and portraits are an ordered one-to-one map, **not the incorrect labels from source generation grids**.

Portrait images were generated and cropped into individual **384×384 WebP** files in the downloadable conversation artifact **`masanawa_26_profile_portraits.zip`**. To install the 26 binary images in this directory, extract the ZIP at the **repository root**:

```powershell
# Windows PowerShell, from weavewellindustrieslimited/masanawa checkout:
Expand-Archive -Path 'C:\path\to\masanawa_26_profile_portraits.zip' -DestinationPath . -Force
```

This creates the 26 `.webp` files here, plus `manifest.json`. Do not commit only this README while claiming portraits are present. This repository connection does not automatically ingest ChatGPT container ZIP files.

## Individual image filenames

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

## App mapping
- Register `- assets/masana/portraits/` in `apps/mobile/pubspec.yaml` **after binary files are present**.
- In `MasanaPortraitAvatar`, use `Image.asset(portraitAssetFor(agent.displayName)!)` for platform catalogue entries when `avatarUrl` is absent.
- Continue honoring an authorized server `avatarUrl` over bundled assets for admin-customized portraits. Unknown agents fall back to initials.
- Never infer portraits from ordinal or remotely supplied arbitrary character names without catalog checks. The artwork is fictional AI-generated identity illustration, not a photo of any licensed real-world professional.
- Run Flutter portrait tests, full regression and APK build after unpacking; do not deploy an APK with broken asset references.
