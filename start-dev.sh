#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_ENV_FILE="${ROOT_DIR}/.env"

load_root_env() {
  if [ -f "$ROOT_ENV_FILE" ]; then
    # Load project-level .env so local app config wins over stale shell exports.
    set -a
    # shellcheck disable=SC1090
    source "$ROOT_ENV_FILE"
    set +a
  fi
}

load_root_env

SERVER_PORT="${SERVER_PORT:-5001}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
JWT_SECRET="${JWT_SECRET:-dev-inspection-secret}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4.1}"
VITE_PROXY_TARGET="${VITE_PROXY_TARGET:-http://127.0.0.1:${SERVER_PORT}}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

check_port_free() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Port ${port} is already in use. Stop the running process or change the port env var." >&2
      exit 1
    fi
  fi
}

cleanup() {
  local exit_code=$?
  trap - INT TERM EXIT

  if [ -n "${CLIENT_PID:-}" ] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi

  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}

require_cmd docker
require_cmd npm
check_port_free "$SERVER_PORT"
check_port_free "$CLIENT_PORT"

if [ -z "$OPENAI_API_KEY" ]; then
  echo "Warning: OPENAI_API_KEY is not set. Quiz generation from documents will fail." >&2
fi

echo "Starting MongoDB with docker compose..."
(cd "$ROOT_DIR" && docker compose up -d mongo)

echo "Starting backend on http://127.0.0.1:${SERVER_PORT}..."
(
  cd "$ROOT_DIR/server"
  JWT_SECRET="$JWT_SECRET" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  OPENAI_MODEL="$OPENAI_MODEL" \
  PORT="$SERVER_PORT" \
  npm start
) > >(sed -u 's/^/[server] /') 2> >(sed -u 's/^/[server] /' >&2) &
SERVER_PID=$!

echo "Starting frontend on http://127.0.0.1:${CLIENT_PORT}..."
(
  cd "$ROOT_DIR/client"
  VITE_PROXY_TARGET="$VITE_PROXY_TARGET" npm run dev -- --host 0.0.0.0 --port "$CLIENT_PORT"
) > >(sed -u 's/^/[client] /') 2> >(sed -u 's/^/[client] /' >&2) &
CLIENT_PID=$!

trap cleanup INT TERM EXIT

echo "Dev stack is launching."
echo "Frontend: http://127.0.0.1:${CLIENT_PORT}"
echo "Backend:  http://127.0.0.1:${SERVER_PORT}"
echo "Press Ctrl+C to stop both app processes."

wait "$SERVER_PID" "$CLIENT_PID"
