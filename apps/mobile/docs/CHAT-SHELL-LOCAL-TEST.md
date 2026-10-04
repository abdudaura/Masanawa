# Local chat-shell testing

The new renderer is on chat-shell-dynamic-renderer (PR #91), not main. Do not assume git pull origin main includes it. Preserve local modifications before changing branches.

From your existing repository in PowerShell:

```powershell
git fetch origin
git switch --track origin/chat-shell-dynamic-renderer
cd apps/mobile
.\tool\build_chat_test.ps1 -Install
```

If the branch already exists locally, use git switch chat-shell-dynamic-renderer then git pull --ff-only origin chat-shell-dynamic-renderer. The helper checks hosted readiness, installs Flutter dependencies, runs analysis (errors fatal; warnings/info visible), runs the entire mobile test suite, builds a debug APK and optionally installs through adb. No local device/browser TTS flags are added.

To require verified Gwani/Gwana availability, set ALPHA_DEV_ACCESS_TOKEN privately in the terminal and run:

```powershell
.\tool\build_chat_test.ps1 -RequireSupportAgents -Install
```

Never paste the token into chat or commit it. It must be the hosted Gateway's existing Alpha token. Without a token the helper does not claim agent availability; use debug login and Settings > Developer > Connect test app with https://nurainworker-production.up.railway.app and that token.

Source bootstrap defines Gwani (Bodi) and Gwana (Sulafat), but the previously verified hosted roster had Amina. Provisioning source is not evidence of a live roster. Do not rerun bootstrap on the existing database: it creates fresh canonical identities. Existing-user support-agent provisioning and per-Character native voice routing must be verified by the runtime owner.

PR #91 is still draft: dynamic widgets, live document/recovery models and secure storage are added, but the active runtime window owns screen/transport/Gateway integration. Agent conversational testing can use existing chat, but new actionable commerce/teaching flows are not yet connected. This local command is a verification path, not evidence that compilation already passed. Native recording/audio and Gwani/Gwana real conversation still require device tests.
