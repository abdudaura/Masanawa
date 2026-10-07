# Live Talk AI runtime integration — 2026-10-07

- Owner/window: current ChatGPT integration window
- Branch: `work/talks-live-ai-runtime-integration-20261007`
- Base SHA: `74b6949dd665d5bb0a81ae38497b09f051f5000f`
- Reclaims the released integration handoff from the merged provider-neutral AI Seat worker.
- Task: complete the production path from admitted AI Seat + live human speech/context to persona inference and audible LiveKit publication, including Direct Twin instruction lookup.
- Preserve canonical Talk lifecycle, human Host presence, commerce authorization, LiveKit room authority and current mobile contracts.
- No autonomous AI-only Talk continuation.

## Implemented
- Gateway explicitly dispatches each canonically admitted Expert/Twin Seat to the named LiveKit agent runtime.
- Dispatch is idempotent per Seat and carries only canonical IDs/kind as job metadata.
- Direct Host-added admission dispatches immediately; sponsored admission dispatches only after Host acceptance.
- Runtime dispatch outages surface as retryable 503s; canonical admission remains retry-safe.
- `services/presence` now hosts the server-side LiveKit Agent using Gemini Live native audio.
- The agent follows the current active human Host/Speaker while keeping one conversation session.
- Every user turn rechecks Seat active/mute state, live Host presence, Talk live state and admitted commercial authorization.
- Twin owner direction is fetched fresh per turn and injected only for that response.
- Gwani/Gwana/default voice names and Gemini Live model are environment-configurable.
- Railway container/config added for the Presence service.

## External runtime requirements
Railway Presence service needs the same LiveKit and PostgreSQL credentials as Gateway plus a Google Gemini key. No user laptop changes are required for server runtime composition.

## Verification note
GitHub Foundation CI is currently failing before any runner is allocated: the workflow job reports `steps: []`, `runner_id: 0`, and no application step executes. The PR remains GitHub-mergeable. This is the same repository Actions infrastructure failure observed on the preceding Talk lanes.

Status: implementation complete; repository CI blocked before runner allocation.
