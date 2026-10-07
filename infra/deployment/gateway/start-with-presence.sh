#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @masanawa/gateway-service start &
gateway_pid=$!
presence_pid=""

shutdown() {
  trap - TERM INT
  if [[ -n "$presence_pid" ]] && kill -0 "$presence_pid" 2>/dev/null; then
    kill -TERM "$presence_pid" 2>/dev/null || true
  fi
  if kill -0 "$gateway_pid" 2>/dev/null; then
    kill -TERM "$gateway_pid" 2>/dev/null || true
  fi
  wait "$gateway_pid" 2>/dev/null || true
  if [[ -n "$presence_pid" ]]; then
    wait "$presence_pid" 2>/dev/null || true
  fi
}

trap shutdown TERM INT EXIT

if [[ -n "${LIVEKIT_URL:-}" && -n "${LIVEKIT_API_KEY:-}" && -n "${LIVEKIT_API_SECRET:-}" ]]; then
  echo "Starting Masanawa Talk Presence runtime"
  /opt/masanawa-presence/bin/python services/presence/agent.py start &
  presence_pid=$!
else
  echo "Talk Presence runtime disabled: LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not configured"
fi

if [[ -n "$presence_pid" ]]; then
  set +e
  wait -n "$gateway_pid" "$presence_pid"
  status=$?
  set -e
  echo "A cohosted production process exited with status $status; stopping container for Railway restart"
  exit "$status"
fi

wait "$gateway_pid"
