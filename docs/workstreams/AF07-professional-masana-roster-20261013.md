# AF07 — 26 professional Masana AI characters with published free Rooms

Source base `ce7f4a9df38262b00c9fab78986143e6ccdf760c`. This is a catalogue and per-tenant product data change, not a cloned separate chat or voice system.

## Behaviors
- Expand the platform backend bootstrap from two stock Characters to 26: Gwani/Gwana support + twenty Nigerian-university-style discipline educators + Arabic, English, Hindi and Mandarin tutors.
- Professional, fictional display names and per-character expertise and language instructions; explicit AI/noncredential disclosures. Every Character uses normal Identity/versions, independent Skill assignments, Gateway agent directory, authorized Chat and per-Character Gemini Live token voice profile. Existing Gwani/Gwana UUIDs, session relationships, history, preferences and admin voices remain unchanged; upgrade their stock titles once without duplicating.
- Each character owns a published free Room connected by canonical tenant-scoped Rooms PostgreSQL with Question→Gemini worker. No staff question review/daily quota.
- All 26 unique vector illustrated portrait SVGs and companion banners bundled into Android at build time. The media records point to public source-controlled original assets and are rights attributed; no invented human licensing. *This does not imply a copy has been uploaded to private S3.* Flutter uses its local compiled portraits, avoiding profile networking cost.
- Bootstrapping starts when a configured platform Gateway has canonical DB/Identity/Skill ports, without MASANAWA_BOOTSTRAP_PLATFORM_AGENTS flag. It acquires a PostgreSQL advisory lock to avoid duplicate races, protects tenant ownership and editor-paused Rooms, and keeps the same canonical identity/rooms/money ledgers.
- No prepopulation on APK compilation by itself can replace a running production Gateway and PostgreSQL. Qualified app builds show source assets once server seeds and returns active characters. Actual live Gemini network, voice/LiveKit device acceptance and active production Railway still separately required.

## Verification
CI `.github/workflows/masana-roster-integration.yml`: production Gateway/Worker builds, identity/profiles and Room/voice tests, disposable real PG18 approvals+membership+question, 26 packaged Flutter portrait tests, focused analysis. Do not claim CI succeeded without exact-head run results.

## Operational blockers
Previous audit found Railway production Gateway/PostgreSQL/legacy billing worker offline; the existing worker is not the canonical Rooms AI worker. Restore and migrate the existing production database safely before startup seeding. Do not replace or delete persisted finance rows, bypass paid Play, payments or chat identity authentication.
