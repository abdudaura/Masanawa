# Masanawa AI character portrait assets

This directory contains **26 separate 384×384 WebP AI-generated fictional character portraits**, plus `manifest.json` mapping each canonical seed key and displayed character name to its asset filename. No old cartoon SVG images are used here.

**Gemini:** Use `manifest.json` and `services/gateway/src/platform_agent_bootstrap.ts` to match each agent; add `assets/masana/portraits/` to `apps/mobile/pubspec.yaml`, then use `Image.asset(assetPath)` in its Masana profile widgets. The owner mobile corrections branch already contains that Flutter wiring. Keep voice names Bodi/Sulafat separate from visible Gwani/Gwana names.

These are generated fictional portraits and do not depict actual certified Nigerian doctors, lawyers or other individuals. Review images before release, particularly the Arabic/Hindi/Mandarin language educators.
