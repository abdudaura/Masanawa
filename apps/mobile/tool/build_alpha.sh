#!/usr/bin/env bash
set -euo pipefail
export AGENT_BASE_URL="${AGENT_BASE_URL:-http://127.0.0.1:3000}"
export API_BASE_URL="${API_BASE_URL:-https://unigeria.up.railway.app}"
cd "$(dirname "$0")/.."
DEFINES_FILE="$(mktemp)"
trap 'rm -f "$DEFINES_FILE"' EXIT
python3 - "$DEFINES_FILE" <<'PY'
import json, os, pathlib, sys, urllib.request
from urllib.parse import urlparse

gateway = os.environ['AGENT_BASE_URL'].rstrip('/')
parsed = urlparse(gateway)
local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path or (parsed.scheme != 'https' and not (local and parsed.scheme == 'http')):
    sys.exit('Use an HTTPS Gateway address, or localhost for USB testing.')

api = os.environ['API_BASE_URL'].rstrip('/')
api_parsed = urlparse(api)
if not api_parsed.hostname or api_parsed.username or api_parsed.password or api_parsed.query or api_parsed.fragment or api_parsed.path or api_parsed.scheme != 'https':
    sys.exit('Use an HTTPS platform API address.')

try:
    with urllib.request.urlopen(gateway + '/readyz', timeout=20) as response:
        if json.load(response).get('status') != 'ready':
            raise ValueError()
except Exception:
    sys.exit('Could not verify the selected Gateway. Start or deploy it first.')

pathlib.Path(sys.argv[1]).write_text(json.dumps({
    'API_BASE_URL': api,
    'AGENT_RUNTIME_ENABLED': 'true',
    'AGENT_BASE_URL': gateway,
}))
PY
flutter pub get
flutter build apk --debug --dart-define-from-file="$DEFINES_FILE"
APK="$PWD/build/app/outputs/flutter-apk/app-debug.apk"
echo "Debug APK: $APK"
echo "Gateway: $AGENT_BASE_URL"
echo "Platform API: $API_BASE_URL"
echo "Sign in normally with phone/email OTP; no developer token is required."
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
fi
