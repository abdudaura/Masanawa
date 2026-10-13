# AF07: direct Rooms from each professional Masana — 2026-10-13

Base main `0bec155321b385f20dc9344e761525bc7db72215`, after merged #722 and later unrelated integrations.

The roster already had a seeded published free Room for each of 26 Masana, but these Rooms were not linked to the actual character in the authorized mobile directory. This change performs a single tenant-scoped PostgreSQL join for visible Character IDs, only returning a Room ID for an active, platform-owned, **approved** Masana with a **published free** Room. No guessed IDs, no duplicate static contact directory or fake online state. The authorized Gateway directory optionally projects `roomId` and Flutter caches it across transient disconnects without upgrading presence.

Users can open the exact teacher Room from the Masana directory or their chat header. The new `/rooms/:id` route requires authentication and reuses the five-tab account-fenced Rooms clients, lessons, membership, discussion and saved lessons. Sign-out/account replacement hides old data. A paused/retired/paid Room has no shortcut, and backend access checks remain authoritative.

Provider voice calling still uses the existing per-character Gemini Live admission and payment/trial contracts. This change neither enables paid gates nor claims successful external-call verification. The original Railway project remains offline at last audit; no runtime activation is established by these source and hosted tests.
