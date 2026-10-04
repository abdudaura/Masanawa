#!/usr/bin/env bash
set -euo pipefail
export AGENT_BASE_URL="${AGENT_BASE_URL:-http://127.0.0.1:3000}"
export ALPHA_DEV_ACCESS_TOKEN="${ALPHA_DEV_ACCESS_TOKEN:-}"
cd "$(dirname "$0")/.."
DEFINES_FILE="$(mktemp)"
trap 'rm -f "$DEFINES_FILE"' EXIT
python3 - "$DEFINES_FILE" <<'PY'
import json, os, pathlib, sys, urllib.request
from urllib.parse import urlparse
url = os.environ['AGENT_BASE_URL'].rstrip('/')
parsed = urlparse(url)
local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path or (parsed.scheme != 'https' and not (local and parsed.scheme == 'http')):
    sys.exit('Use an HTTPS Gateway address, or localhost for USB testing.')
token = os.environ['ALPHA_DEV_ACCESS_TOKEN'].strip()
if any(c.isspace() for c in token):
    sys.exit('Alpha token must not contain whitespace.')
try:
    with urllib.request.urlopen(url + '/readyz', timeout=20) as response:
        if json.load(response).get('status') != 'ready':
            raise ValueError()
    if token:
        request = urllib.request.Request(url + '/v1/agent/directory', headers={'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(request, timeout=20) as response:
            print('Gateway verified. Agents:', len(json.load(response)['agents']))
except Exception:
    sys.exit('Could not verify the selected Gateway. Start it first, and use its own Alpha token.')
defines = {'AGENT_RUNTIME_ENABLED': 'true', 'AGENT_BASE_URL': url, 'ALPHA_TTS_ENABLED': 'true'}
if token:
    defines['ALPHA_DEV_ACCESS_TOKEN'] = token
pathlib.Path(sys.argv[1]).write_text(json.dumps(defines))
PY
flutter pub get
flutter build apk --debug --dart-define-from-file="$DEFINES_FILE"
APK="$PWD/build/app/outputs/flutter-apk/app-debug.apk"
echo "Alpha APK: $APK"
echo "Gateway: $AGENT_BASE_URL"
if [[ -z "$ALPHA_DEV_ACCESS_TOKEN" ]]; then
  echo "After installing: test login, Settings > Developer > Connect test app. Enter this Gateway's Alpha token."
fi
if [[ "${1:-}" == "--install" ]]; then
  USB_PORT="$(python3 - <<'PY'
import os
from urllib.parse import urlparse
url = urlparse(os.environ['AGENT_BASE_URL'])
if url.hostname in ('localhost', '127.0.0.1', '::1'):
    print(url.port or (443 if url.scheme == 'https' else 80))
PY
)"
  if [[ -n "$USB_PORT" ]]; then adb reverse "tcp:$USB_PORT" "tcp:$USB_PORT"; fi
  adb install -r "$APK"
  echo "Installed. Gateway: $AGENT_BASE_URL"
fi
